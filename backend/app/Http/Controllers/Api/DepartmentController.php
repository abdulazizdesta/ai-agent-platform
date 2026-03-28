<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DepartmentController extends Controller
{
    /**
     * GET /api/departments
     */
    public function index(Request $request): JsonResponse
    {
        $query = Department::with('organization:id,name')
            ->withCount('users');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('description', 'ilike', "%{$search}%")
                  ->orWhere('city', 'ilike', "%{$search}%");
            });
        }

        if ($request->filled('organization_id')) {
            $query->where('organization_id', $request->organization_id);
        }

        if ($request->filled('city')) {
            $query->where('city', 'ilike', "%{$request->city}%");
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->is_active === 'true');
        }

        $sortBy = $request->get('sort_by', 'created_at');
        $sortDir = $request->get('sort_dir', 'desc');
        $allowed = ['name', 'city', 'created_at', 'users_count'];

        if (in_array($sortBy, $allowed)) {
            $query->orderBy($sortBy, $sortDir === 'asc' ? 'asc' : 'desc');
        }

        $perPage = min((int) $request->get('per_page', 10), 100);

        return response()->json($query->paginate($perPage));
    }

    /**
     * POST /api/departments
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'organization_id' => ['required', 'exists:organizations,id'],
            'name'            => [
                'required', 'string', 'max:255',
                Rule::unique('departments')->where(function ($q) use ($request) {
                    return $q->where('organization_id', $request->organization_id);
                }),
            ],
            'description' => ['nullable', 'string'],
            'city'        => ['nullable', 'string', 'max:255'],
            'is_active'   => ['nullable', 'boolean'],
        ]);

        $dept = Department::create($validated);
        $dept->load('organization:id,name');
        $dept->loadCount('users');

        return response()->json([
            'message'    => 'Departemen berhasil ditambahkan.',
            'department' => $dept,
        ], 201);
    }

    /**
     * GET /api/departments/{department}
     */
    public function show(Department $department): JsonResponse
    {
        $department->load('organization:id,name');
        $department->loadCount('users');

        return response()->json(['department' => $department]);
    }

    /**
     * PUT /api/departments/{department}
     */
    public function update(Request $request, Department $department): JsonResponse
    {
        $validated = $request->validate([
            'organization_id' => ['sometimes', 'exists:organizations,id'],
            'name'            => [
                'sometimes', 'string', 'max:255',
                Rule::unique('departments')->where(function ($q) use ($request, $department) {
                    return $q->where('organization_id', $request->organization_id ?? $department->organization_id);
                })->ignore($department->id),
            ],
            'description' => ['nullable', 'string'],
            'city'        => ['nullable', 'string', 'max:255'],
            'is_active'   => ['nullable', 'boolean'],
        ]);

        $department->update($validated);
        $department->load('organization:id,name');
        $department->loadCount('users');

        return response()->json([
            'message'    => 'Departemen berhasil diupdate.',
            'department' => $department,
        ]);
    }

    /**
     * DELETE /api/departments/{department}
     */
    public function destroy(Department $department): JsonResponse
    {
        if ($department->users()->exists()) {
            return response()->json([
                'message' => 'Tidak bisa menghapus departemen yang masih memiliki member.',
            ], 422);
        }

        $department->delete();

        return response()->json(['message' => 'Departemen berhasil dihapus.']);
    }
}