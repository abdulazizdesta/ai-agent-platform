<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RequestAccessRequest;
use App\Models\AccessRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * POST /api/auth/login
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('username', $request->username)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Username atau password salah.',
            ], 401);
        }

        if (!$user->isApproved()) {
            $statusMessages = [
                'pending'   => 'Akun kamu masih menunggu persetujuan.',
                'rejected'  => 'Permintaan akses kamu ditolak.',
                'expired'   => 'Permintaan akses kamu sudah kedaluwarsa.',
                'suspended' => 'Akun kamu telah dinonaktifkan. Hubungi admin.',
            ];

            return response()->json([
                'message' => $statusMessages[$user->status] ?? 'Akun tidak aktif.',
                'status'  => $user->status,
            ], 403);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Login berhasil.',
            'token'   => $token,
            'user'    => $this->formatUser($user),
        ]);
    }

    /**
     * POST /api/auth/request-access
     */
    public function requestAccess(RequestAccessRequest $request): JsonResponse
    {
        $existingUser = User::where('username', $request->username)
            ->orWhere('employee_id', $request->employee_id)
            ->first();

        if ($existingUser) {
            return response()->json([
                'message' => 'Username atau Employee ID sudah terdaftar.',
            ], 422);
        }

        $existingRequest = AccessRequest::where('status', 'pending')
            ->where(function ($q) use ($request) {
                $q->where('username', $request->username)
                  ->orWhere('employee_id', $request->employee_id);
            })
            ->where(function ($q) {
                $q->whereNull('expires_at')
                  ->orWhere('expires_at', '>', now());
            })
            ->first();

        if ($existingRequest) {
            return response()->json([
                'message' => 'Kamu sudah memiliki request yang sedang menunggu persetujuan.',
            ], 422);
        }

        $accessRequest = AccessRequest::create([
            'name'            => $request->name,
            'username'        => $request->username,
            'employee_id'     => $request->employee_id,
            'phone'           => $request->phone,
            'email'           => $request->email,
            'password'        => Hash::make($request->password),
            'organization_id' => $request->organization_id,
            'department_id'   => $request->department_id,
            'city'            => $request->city,
            'status'          => 'pending',
            'expires_at'      => now()->addHours(24),
        ]);

        return response()->json([
            'message' => 'Request access berhasil dikirim. Menunggu persetujuan admin (maks 1x24 jam).',
            'request' => [
                'id'         => $accessRequest->id,
                'name'       => $accessRequest->name,
                'username'   => $accessRequest->username,
                'status'     => $accessRequest->status,
                'expires_at' => $accessRequest->expires_at->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * POST /api/auth/logout
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logout berhasil.']);
    }

    /**
     * GET /api/auth/me
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['organization', 'department']);

        return response()->json(['user' => $this->formatUser($user)]);
    }

    private function formatUser(User $user): array
    {
        $user->loadMissing(['organization', 'department']);

        return [
            'id'          => $user->id,
            'name'        => $user->name,
            'username'    => $user->username,
            'employee_id' => $user->employee_id,
            'email'       => $user->email,
            'phone'       => $user->phone,
            'city'        => $user->city,
            'role'        => $user->role,
            'status'      => $user->status,
            'organization' => $user->organization ? [
                'id'   => $user->organization->id,
                'name' => $user->organization->name,
                'slug' => $user->organization->slug,
            ] : null,
            'department' => $user->department ? [
                'id'   => $user->department->id,
                'name' => $user->department->name,
            ] : null,
        ];
    }
}