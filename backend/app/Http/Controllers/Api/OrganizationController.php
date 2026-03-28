<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class OrganizationController extends Controller
{
    /**
     * GET /api/organizations
     */
    public function index(Request $request): JsonResponse
    {
        $query = Organization::withCount(['users', 'departments']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('slug', 'ilike', "%{$search}%");
            });
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->is_active === 'true');
        }

        $sortBy = $request->get('sort_by', 'created_at');
        $sortDir = $request->get('sort_dir', 'desc');
        $allowed = ['name', 'created_at', 'users_count', 'departments_count'];

        if (in_array($sortBy, $allowed)) {
            $query->orderBy($sortBy, $sortDir === 'asc' ? 'asc' : 'desc');
        }

        $perPage = min((int) $request->get('per_page', 10), 100);

        return response()->json($query->paginate($perPage));
    }

    /**
     * POST /api/organizations
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'slug'        => ['nullable', 'string', 'max:255', 'unique:organizations,slug'],
            'description' => ['nullable', 'string'],
            'logo'        => ['nullable', 'string', 'max:500'],
            'address'     => ['nullable', 'string', 'max:500'],
            'city'        => ['nullable', 'string', 'max:255'],
            'phone'       => ['nullable', 'string', 'max:20'],
            'email'       => ['nullable', 'email', 'max:255'],
            'is_active'   => ['nullable', 'boolean'],
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $org = Organization::create($validated);
        $org->loadCount(['users', 'departments']);

        return response()->json([
            'message'      => 'Organisasi berhasil ditambahkan.',
            'organization' => $org,
        ], 201);
    }

    /**
     * GET /api/organizations/{organization}
     */
    public function show(Organization $organization): JsonResponse
    {
        $organization->loadCount(['users', 'departments']);
        $organization->load(['departments' => function ($q) {
            $q->withCount('users')->orderBy('name');
        }]);

        return response()->json(['organization' => $organization]);
    }

    /**
     * PUT /api/organizations/{organization}
     */
    public function update(Request $request, Organization $organization): JsonResponse
    {
        $validated = $request->validate([
            'name'        => ['sometimes', 'string', 'max:255'],
            'slug'        => ['sometimes', 'string', 'max:255', Rule::unique('organizations')->ignore($organization->id)],
            'description' => ['nullable', 'string'],
            'logo'        => ['nullable', 'string', 'max:500'],
            'address'     => ['nullable', 'string', 'max:500'],
            'city'        => ['nullable', 'string', 'max:255'],
            'phone'       => ['nullable', 'string', 'max:20'],
            'email'       => ['nullable', 'email', 'max:255'],
            'is_active'   => ['nullable', 'boolean'],
        ]);

        $organization->update($validated);
        $organization->loadCount(['users', 'departments']);

        return response()->json([
            'message'      => 'Organisasi berhasil diupdate.',
            'organization' => $organization,
        ]);
    }

    /**
     * DELETE /api/organizations/{organization}
     */
    public function destroy(Organization $organization): JsonResponse
    {
        if ($organization->users()->exists()) {
            return response()->json([
                'message' => 'Tidak bisa menghapus organisasi yang masih memiliki member.',
            ], 422);
        }

        $organization->delete();

        return response()->json(['message' => 'Organisasi berhasil dihapus.']);
    }
}