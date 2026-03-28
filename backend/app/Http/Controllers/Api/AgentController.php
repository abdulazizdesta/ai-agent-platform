<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Services\KnowledgeRetrievalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AgentController extends Controller
{
    public function __construct(
        private KnowledgeRetrievalService $knowledgeService
    ) {}

    /**
     * GET /api/agents
     */
    public function index(Request $request): JsonResponse
    {
        $query = Agent::with(['organization:id,name', 'waChannel:id,phone_number,display_name'])
            ->withCount(['documents', 'faqs', 'conversations']);

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'ilike', "%{$s}%")
                  ->orWhere('description', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('type'))            $query->where('type', $request->type);
        if ($request->filled('status'))          $query->where('status', $request->status);
        if ($request->filled('organization_id')) $query->where('organization_id', $request->organization_id);

        $sortBy = $request->get('sort_by', 'created_at');
        $sortDir = $request->get('sort_dir', 'desc');
        $allowed = ['name', 'type', 'status', 'created_at'];

        if (in_array($sortBy, $allowed)) {
            $query->orderBy($sortBy, $sortDir === 'asc' ? 'asc' : 'desc');
        }

        $perPage = min((int) $request->get('per_page', 10), 100);

        return response()->json($query->paginate($perPage));
    }

    /**
     * POST /api/agents
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'            => ['required', 'string', 'max:255'],
            'type'            => ['required', Rule::in(['cs_specialist', 'auditor', 'custom'])],
            'description'     => ['nullable', 'string'],
            'organization_id' => ['required', 'exists:organizations,id'],
            'wa_channel_id'   => ['nullable', 'exists:wa_channels,id'],
            'personality'     => ['nullable', 'string'],
            'model_provider'  => ['nullable', 'string', 'max:50'],
            'model_name'      => ['nullable', 'string', 'max:100'],
            'temperature'     => ['nullable', 'numeric', 'min:0', 'max:1'],
            'max_tokens'      => ['nullable', 'integer', 'min:100', 'max:4096'],
            'capabilities'    => ['nullable', 'array'],
            'instructions'    => ['nullable', 'string'],
            'status'          => ['nullable', Rule::in(['draft', 'active', 'disabled'])],
        ]);

        $validated['model_provider'] = $validated['model_provider'] ?? 'anthropic';
        $validated['model_name'] = $validated['model_name'] ?? 'claude-sonnet-4-20250514';
        $validated['status'] = $validated['status'] ?? 'draft';

        $agent = Agent::create($validated);
        $agent->load(['organization:id,name', 'waChannel:id,phone_number,display_name']);

        return response()->json([
            'message' => 'Agent berhasil dibuat.',
            'agent'   => $agent,
        ], 201);
    }

    /**
     * GET /api/agents/{agent}
     */
    public function show(Agent $agent): JsonResponse
    {
        $agent->load([
            'organization:id,name',
            'waChannel:id,phone_number,display_name',
            'faqs' => fn ($q) => $q->orderBy('sort_order'),
            'documents' => fn ($q) => $q->orderBy('created_at', 'desc'),
        ]);

        return response()->json([
            'agent'           => $agent,
            'knowledge_stats' => $agent->getKnowledgeStats(),
        ]);
    }

    /**
     * PUT /api/agents/{agent}
     */
    public function update(Request $request, Agent $agent): JsonResponse
    {
        $validated = $request->validate([
            'name'            => ['sometimes', 'string', 'max:255'],
            'type'            => ['sometimes', Rule::in(['cs_specialist', 'auditor', 'custom'])],
            'description'     => ['nullable', 'string'],
            'wa_channel_id'   => ['nullable', 'exists:wa_channels,id'],
            'personality'     => ['nullable', 'string'],
            'model_provider'  => ['nullable', 'string', 'max:50'],
            'model_name'      => ['nullable', 'string', 'max:100'],
            'temperature'     => ['nullable', 'numeric', 'min:0', 'max:1'],
            'max_tokens'      => ['nullable', 'integer', 'min:100', 'max:4096'],
            'capabilities'    => ['nullable', 'array'],
            'instructions'    => ['nullable', 'string'],
            'status'          => ['sometimes', Rule::in(['draft', 'active', 'disabled'])],
        ]);

        $agent->update($validated);
        $agent->load(['organization:id,name', 'waChannel:id,phone_number,display_name']);

        return response()->json([
            'message' => 'Agent berhasil diupdate.',
            'agent'   => $agent,
        ]);
    }

    /**
     * DELETE /api/agents/{agent}
     */
    public function destroy(Agent $agent): JsonResponse
    {
        $agent->delete();
        return response()->json(['message' => 'Agent berhasil dihapus.']);
    }

    /**
     * GET /api/agents/{agent}/knowledge-summary
     */
    public function knowledgeSummary(Agent $agent): JsonResponse
    {
        return response()->json(
            $this->knowledgeService->getKnowledgeSummary($agent)
        );
    }

    /**
     * GET /api/agents/lookup
     * For dropdowns (e.g. WA Channel assignment).
     */
    public function lookup(Request $request): JsonResponse
    {
        $query = Agent::select('id', 'name', 'type', 'status', 'organization_id');

        if ($request->filled('organization_id')) {
            $query->where('organization_id', $request->organization_id);
        }

        return response()->json($query->orderBy('name')->get());
    }
}