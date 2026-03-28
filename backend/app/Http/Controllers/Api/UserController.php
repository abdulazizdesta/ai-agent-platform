<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * GET /api/users
     *
     * List users with filters, search, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::with(['organization', 'department']);

        // ── Filters ──
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('username', 'ilike', "%{$search}%")
                  ->orWhere('employee_id', 'ilike', "%{$search}%")
                  ->orWhere('email', 'ilike', "%{$search}%");
            });
        }

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('city')) {
            $query->where('city', 'ilike', "%{$request->city}%");
        }

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        if ($request->filled('organization_id')) {
            $query->where('organization_id', $request->organization_id);
        }

        // ── Sorting ──
        $sortBy = $request->get('sort_by', 'created_at');
        $sortDir = $request->get('sort_dir', 'desc');
        $allowedSorts = ['name', 'username', 'employee_id', 'city', 'role', 'status', 'created_at'];

        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortDir === 'asc' ? 'asc' : 'desc');
        }

        // ── Pagination ──
        $perPage = min((int) $request->get('per_page', 10), 100);
        $users = $query->paginate($perPage);

        return response()->json($users);
    }

    /**
     * POST /api/users
     *
     * Create a new user (superadmin manually adding user).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'            => ['required', 'string', 'max:255'],
            'username'        => ['required', 'string', 'max:50', 'alpha_dash', 'unique:users,username'],
            'employee_id'     => ['required', 'string', 'max:50', 'unique:users,employee_id'],
            'password'        => ['required', 'string', 'min:8'],
            'email'           => ['nullable', 'email', 'max:255'],
            'phone'           => ['nullable', 'string', 'max:20'],
            'city'            => ['nullable', 'string', 'max:255'],
            'role'            => ['required', Rule::in(['superadmin','admin', 'agent', 'viewer'])],
            'organization_id' => ['required', 'exists:organizations,id'],
            'department_id'   => ['nullable', 'exists:departments,id'],
        ]);

        $validated['password'] = Hash::make($validated['password']);
        $validated['status'] = 'approved'; // superadmin langsung approve

        $user = User::create($validated);
        $user->load(['organization', 'department']);

        return response()->json([
            'message' => 'User berhasil ditambahkan.',
            'user'    => $user,
        ], 201);
    }

    /**
     * GET /api/users/{user}
     *
     * Show user detail.
     */
    public function show(User $user): JsonResponse
    {
        $user->load(['organization', 'department']);

        return response()->json(['user' => $user]);
    }

    /**
     * PUT /api/users/{user}
     *
     * Update user data (NOT password).
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name'            => ['sometimes', 'string', 'max:255'],
            'username'        => ['sometimes', 'string', 'max:50', 'alpha_dash', Rule::unique('users')->ignore($user->id)],
            'employee_id'     => ['sometimes', 'string', 'max:50', Rule::unique('users')->ignore($user->id)],
            'email'           => ['nullable', 'email', 'max:255'],
            'phone'           => ['nullable', 'string', 'max:20'],
            'city'            => ['nullable', 'string', 'max:255'],
            'role'            => ['sometimes', Rule::in(['superadmin','admin', 'agent', 'viewer'])],
            'status'          => ['sometimes', Rule::in(['approved', 'suspended'])],
            'organization_id' => ['sometimes', 'exists:organizations,id'],
            'department_id'   => ['nullable', 'exists:departments,id'],
        ]);

        $user->update($validated);
        $user->load(['organization', 'department']);

        return response()->json([
            'message' => 'User berhasil diupdate.',
            'user'    => $user,
        ]);
    }

    /**
     * DELETE /api/users/{user}
     *
     * Delete user.
     */
    public function destroy(User $user): JsonResponse
    {
        // Prevent deleting yourself
        if ($user->id === auth()->id()) {
            return response()->json([
                'message' => 'Tidak bisa menghapus akun sendiri.',
            ], 403);
        }

        // Prevent deleting superadmin
        if ($user->role === 'superadmin') {
            return response()->json([
                'message' => 'Tidak bisa menghapus superadmin.',
            ], 403);
        }

        $user->delete();

        return response()->json([
            'message' => 'User berhasil dihapus.',
        ]);
    }

    /**
     * POST /api/users/{user}/reset-password
     *
     * Reset user password (superadmin only).
     */
    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user->update([
            'password' => Hash::make($validated['password']),
        ]);

        // Revoke all tokens (force re-login)
        $user->tokens()->delete();

        return response()->json([
            'message' => 'Password berhasil direset. User harus login ulang.',
        ]);
    }

    /**
     * POST /api/users/bulk-action
     *
     * Bulk actions: delete, change role, change status, assign department.
     */
    public function bulkAction(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'action'  => ['required', Rule::in(['delete', 'change_role', 'change_status', 'assign_department'])],
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['exists:users,id'],
            'value'   => ['required_unless:action,delete', 'string'],
        ]);

        $userIds = $validated['user_ids'];
        $action = $validated['action'];
        $value = $validated['value'] ?? null;

        // Exclude current user & superadmins from bulk actions
        $query = User::whereIn('id', $userIds)
            ->where('id', '!=', auth()->id())
            ->where('role', '!=', 'superadmin');

        $affected = 0;

        switch ($action) {
            case 'delete':
                $affected = $query->count();
                $query->delete();
                break;

            case 'change_role':
                if (!in_array($value, ['admin', 'agent', 'viewer'])) {
                    return response()->json(['message' => 'Role tidak valid.'], 422);
                }
                $affected = $query->update(['role' => $value]);
                break;

            case 'change_status':
                if (!in_array($value, ['approved', 'suspended'])) {
                    return response()->json(['message' => 'Status tidak valid.'], 422);
                }
                $affected = $query->update(['status' => $value]);
                break;

            case 'assign_department':
                $affected = $query->update(['department_id' => $value]);
                break;
        }

        return response()->json([
            'message'  => "Bulk action berhasil. {$affected} user terpengaruh.",
            'affected' => $affected,
        ]);
    }
}