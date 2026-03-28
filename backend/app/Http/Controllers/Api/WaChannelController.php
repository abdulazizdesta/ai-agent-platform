<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WaChannel;
use App\Services\WhatsAppServiceFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class WaChannelController extends Controller
{
    public function __construct(
        private WhatsAppServiceFactory $waFactory
    ) {}

    /**
     * GET /api/wa-channels
     */
    public function index(Request $request): JsonResponse
    {
        $query = WaChannel::with(['organization:id,name', 'department:id,name']);

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('phone_number', 'ilike', "%{$s}%")
                  ->orWhere('display_name', 'ilike', "%{$s}%")
                  ->orWhere('description', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('organization_id')) $query->where('organization_id', $request->organization_id);
        if ($request->filled('status'))          $query->where('status', $request->status);
        if ($request->filled('mode'))            $query->where('mode', $request->mode);
        if ($request->filled('provider'))        $query->where('provider', $request->provider);

        $sortBy = $request->get('sort_by', 'created_at');
        $sortDir = $request->get('sort_dir', 'desc');
        $allowed = ['phone_number', 'display_name', 'status', 'mode', 'provider', 'connected_at', 'last_message_at', 'created_at'];

        if (in_array($sortBy, $allowed)) {
            $query->orderBy($sortBy, $sortDir === 'asc' ? 'asc' : 'desc');
        }

        return response()->json($query->paginate(min((int) $request->get('per_page', 10), 100)));
    }

    /**
     * POST /api/wa-channels
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone_number'    => ['required', 'string', 'max:20', 'unique:wa_channels,phone_number'],
            'display_name'    => ['required', 'string', 'max:255'],
            'description'     => ['nullable', 'string'],
            'provider'        => ['required', Rule::in(['fonnte', 'meta'])],
            'organization_id' => ['required', 'exists:organizations,id'],
            'department_id'   => ['nullable', 'exists:departments,id'],
            'city'            => ['nullable', 'string', 'max:255'],
            'access_token'    => ['required', 'string'],
            'phone_number_id' => ['required_if:provider,meta', 'nullable', 'string'],
            'waba_id'         => ['required_if:provider,meta', 'nullable', 'string'],
            'mode'            => ['nullable', Rule::in(['ai_only', 'ai_human_handoff', 'human_only'])],
        ]);

        // Build credentials array
        $credentials = ['access_token' => $validated['access_token']];
        if ($validated['provider'] === 'meta') {
            $credentials['phone_number_id'] = $validated['phone_number_id'];
            $credentials['waba_id'] = $validated['waba_id'];
        }

        // Verify via provider API
        $verification = $this->waFactory->verify($validated['provider'], $credentials);

        // Set fields based on verification
        $validated['status'] = $verification['success'] ? 'active' : 'pending_verification';
        $validated['verification_error'] = $verification['success'] ? null : ($verification['error'] ?? null);
        $validated['verified_name'] = $verification['verified_name'] ?? null;
        $validated['quality_rating'] = $verification['quality_rating'] ?? null;
        $validated['device_status'] = $verification['device_status'] ?? null;
        $validated['package'] = $verification['package'] ?? null;
        $validated['quota'] = $verification['quota'] ?? null;
        $validated['connected_at'] = $verification['success'] ? now() : null;
        $validated['mode'] = $validated['mode'] ?? 'human_only';
        $validated['webhook_verify_token'] = Str::random(40);

        $channel = WaChannel::create($validated);
        $channel->update(['webhook_url' => $channel->generateWebhookUrl()]);
        $channel->load(['organization:id,name', 'department:id,name']);

        $message = $verification['success']
            ? 'WA Channel berhasil ditambahkan dan terverifikasi.'
            : 'WA Channel ditambahkan tapi verifikasi gagal: ' . ($verification['error'] ?? 'Unknown');

        return response()->json([
            'message'      => $message,
            'channel'      => $channel,
            'verification' => $verification,
        ], 201);
    }

    /**
     * GET /api/wa-channels/{waChannel}
     */
    public function show(WaChannel $waChannel): JsonResponse
    {
        $waChannel->load(['organization:id,name', 'department:id,name']);

        return response()->json([
            'channel'         => $waChannel,
            'has_credentials' => $waChannel->hasCredentials(),
        ]);
    }

    /**
     * PUT /api/wa-channels/{waChannel}
     */
    public function update(Request $request, WaChannel $waChannel): JsonResponse
    {
        $validated = $request->validate([
            'phone_number'    => ['sometimes', 'string', 'max:20', Rule::unique('wa_channels')->ignore($waChannel->id)],
            'display_name'    => ['sometimes', 'string', 'max:255'],
            'description'     => ['nullable', 'string'],
            'organization_id' => ['sometimes', 'exists:organizations,id'],
            'department_id'   => ['nullable', 'exists:departments,id'],
            'city'            => ['nullable', 'string', 'max:255'],
            'mode'            => ['sometimes', Rule::in(['ai_only', 'ai_human_handoff', 'human_only'])],
            'status'          => ['sometimes', Rule::in(['active', 'inactive', 'pending_verification'])],
        ]);

        $waChannel->update($validated);
        $waChannel->load(['organization:id,name', 'department:id,name']);

        return response()->json([
            'message' => 'WA Channel berhasil diupdate.',
            'channel' => $waChannel,
        ]);
    }

    /**
     * DELETE /api/wa-channels/{waChannel}
     */
    public function destroy(WaChannel $waChannel): JsonResponse
    {
        $waChannel->delete();
        return response()->json(['message' => 'WA Channel berhasil dihapus.']);
    }

    /**
     * POST /api/wa-channels/{waChannel}/re-verify
     */
    public function reVerify(WaChannel $waChannel): JsonResponse
    {
        if (!$waChannel->hasCredentials()) {
            return response()->json(['message' => 'Channel tidak memiliki credentials yang valid.'], 422);
        }

        $verification = $this->waFactory->reVerify($waChannel);

        $waChannel->update([
            'status'             => $verification['success'] ? 'active' : 'pending_verification',
            'verification_error' => $verification['success'] ? null : ($verification['error'] ?? null),
            'verified_name'      => $verification['verified_name'] ?? $waChannel->verified_name,
            'quality_rating'     => $verification['quality_rating'] ?? $waChannel->quality_rating,
            'device_status'      => $verification['device_status'] ?? $waChannel->device_status,
            'package'            => $verification['package'] ?? $waChannel->package,
            'quota'              => $verification['quota'] ?? $waChannel->quota,
            'connected_at'       => $verification['success'] ? now() : $waChannel->connected_at,
        ]);

        return response()->json([
            'message'      => $verification['success'] ? 'Verifikasi berhasil!' : 'Verifikasi gagal: ' . ($verification['error'] ?? ''),
            'channel'      => $waChannel->fresh(['organization:id,name', 'department:id,name']),
            'verification' => $verification,
        ]);
    }

    /**
     * POST /api/wa-channels/{waChannel}/update-credentials
     */
    public function updateCredentials(Request $request, WaChannel $waChannel): JsonResponse
    {
        $rules = ['access_token' => ['required', 'string']];
        if ($waChannel->isMeta()) {
            $rules['phone_number_id'] = ['required', 'string'];
            $rules['waba_id'] = ['required', 'string'];
        }

        $validated = $request->validate($rules);

        $credentials = ['access_token' => $validated['access_token']];
        if ($waChannel->isMeta()) {
            $credentials['phone_number_id'] = $validated['phone_number_id'];
            $credentials['waba_id'] = $validated['waba_id'];
        }

        $verification = $this->waFactory->verify($waChannel->provider, $credentials);

        $updateData = [
            'access_token'       => $validated['access_token'],
            'status'             => $verification['success'] ? 'active' : 'pending_verification',
            'verification_error' => $verification['success'] ? null : ($verification['error'] ?? null),
            'verified_name'      => $verification['verified_name'] ?? null,
            'quality_rating'     => $verification['quality_rating'] ?? null,
            'device_status'      => $verification['device_status'] ?? null,
            'package'            => $verification['package'] ?? null,
            'quota'              => $verification['quota'] ?? null,
            'connected_at'       => $verification['success'] ? now() : $waChannel->connected_at,
        ];

        if ($waChannel->isMeta()) {
            $updateData['phone_number_id'] = $validated['phone_number_id'];
            $updateData['waba_id'] = $validated['waba_id'];
        }

        $waChannel->update($updateData);

        return response()->json([
            'message'      => $verification['success'] ? 'Credentials berhasil diupdate.' : 'Credentials diupdate tapi verifikasi gagal.',
            'channel'      => $waChannel->fresh(['organization:id,name', 'department:id,name']),
            'verification' => $verification,
        ]);
    }
}