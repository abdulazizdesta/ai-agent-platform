<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccessRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AccessRequestController extends Controller
{
    /**
     * GET /api/access-requests
     */
    public function index(Request $request): JsonResponse
    {
        $query = AccessRequest::with([
            'organization:id,name',
            'department:id,name',
            'reviewer:id,name,username',
        ]);

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'ilike', "%{$s}%")
                  ->orWhere('username', 'ilike', "%{$s}%")
                  ->orWhere('employee_id', 'ilike', "%{$s}%")
                  ->orWhere('phone', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('organization_id')) {
            $query->where('organization_id', $request->organization_id);
        }

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        // Auto-expire pending requests older than 24h
        AccessRequest::where('status', 'pending')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->update(['status' => 'expired']);

        $sortBy = $request->get('sort_by', 'created_at');
        $sortDir = $request->get('sort_dir', 'desc');
        $allowed = ['name', 'username', 'employee_id', 'status', 'created_at', 'expires_at'];

        if (in_array($sortBy, $allowed)) {
            $query->orderBy($sortBy, $sortDir === 'asc' ? 'asc' : 'desc');
        }

        $perPage = min((int) $request->get('per_page', 10), 100);

        return response()->json($query->paginate($perPage));
    }

    /**
     * GET /api/access-requests/{accessRequest}
     */
    public function show(AccessRequest $accessRequest): JsonResponse
    {
        $accessRequest->load([
            'organization:id,name',
            'department:id,name',
            'reviewer:id,name,username',
        ]);

        return response()->json(['request' => $accessRequest]);
    }

    /**
     * POST /api/access-requests/{accessRequest}/approve
     * City sudah dari registrasi, superadmin cuma assign role.
     */
    public function approve(Request $request, AccessRequest $accessRequest): JsonResponse
    {
        if ($accessRequest->status !== 'pending') {
            return response()->json([
                'message' => 'Hanya request dengan status pending yang bisa di-approve.',
            ], 422);
        }

        if ($accessRequest->isExpired()) {
            $accessRequest->update(['status' => 'expired']);
            return response()->json([
                'message' => 'Request sudah kedaluwarsa (lebih dari 24 jam).',
            ], 422);
        }

        $validated = $request->validate([
            'assigned_role' => ['required', Rule::in(['admin', 'agent', 'viewer', 'superadmin'])],
        ]);

        $reviewer = $request->user();
        $user = $accessRequest->approve($reviewer, $validated['assigned_role']);

        return response()->json([
            'message' => "Request dari {$accessRequest->name} berhasil di-approve sebagai {$validated['assigned_role']}.",
            'user'    => $user->load(['organization:id,name', 'department:id,name']),
        ]);
    }

    /**
     * POST /api/access-requests/{accessRequest}/reject
     */
    public function reject(Request $request, AccessRequest $accessRequest): JsonResponse
    {
        if ($accessRequest->status !== 'pending') {
            return response()->json([
                'message' => 'Hanya request dengan status pending yang bisa di-reject.',
            ], 422);
        }

        $validated = $request->validate([
            'reject_reason' => ['nullable', 'string', 'max:500'],
        ]);

        $reviewer = $request->user();
        $accessRequest->reject($reviewer, $validated['reject_reason'] ?? null);

        return response()->json([
            'message' => "Request dari {$accessRequest->name} berhasil ditolak.",
        ]);
    }

    /**
     * DELETE /api/access-requests/{accessRequest}
     */
    public function destroy(AccessRequest $accessRequest): JsonResponse
    {
        if ($accessRequest->status === 'pending') {
            return response()->json([
                'message' => 'Tidak bisa menghapus request yang masih pending. Reject dulu.',
            ], 422);
        }

        $accessRequest->delete();

        return response()->json(['message' => 'Request berhasil dihapus.']);
    }
}