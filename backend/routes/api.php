<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\OrganizationController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\WaChannelController;
use App\Http\Controllers\Api\AccessRequestController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Auth Routes (Public)
|--------------------------------------------------------------------------
*/
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/request-access', [AuthController::class, 'requestAccess']);
});

/*
|--------------------------------------------------------------------------
| Public Lookups (for Register page — no auth required)
|--------------------------------------------------------------------------
*/
Route::get('/public/organizations', function () {
    return \App\Models\Organization::select('id', 'name')
        ->where('is_active', true)
        ->orderBy('name')
        ->get();
});

Route::get('/public/departments', function (\Illuminate\Http\Request $request) {
    $query = \App\Models\Department::select('id', 'organization_id', 'name', 'city')
        ->where('is_active', true);

    if ($request->filled('organization_id')) {
        $query->where('organization_id', $request->organization_id);
    }

    return $query->orderBy('name')->get();
});

/*
|--------------------------------------------------------------------------
| Authenticated Routes
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
    });

    // ──────────────────────────────────────
    // Masters Data — Superadmin Only
    // ──────────────────────────────────────
    Route::middleware('superadmin')->group(function () {

        // Users
        Route::apiResource('users', UserController::class);
        Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword']);
        Route::post('/users/bulk-action', [UserController::class, 'bulkAction']);

        // Organizations
        Route::apiResource('organizations', OrganizationController::class);

        // Departments
        Route::apiResource('departments', DepartmentController::class);

        // WA Channels
        Route::apiResource('wa-channels', WaChannelController::class);
        Route::post('/wa-channels/{wa_channel}/re-verify', [WaChannelController::class, 'reVerify']);
        Route::post('/wa-channels/{wa_channel}/update-credentials', [WaChannelController::class, 'updateCredentials']);

        // Access Requests
        Route::get('/access-requests', [AccessRequestController::class, 'index']);
        Route::get('/access-requests/{access_request}', [AccessRequestController::class, 'show']);
        Route::post('/access-requests/{access_request}/approve', [AccessRequestController::class, 'approve']);
        Route::post('/access-requests/{access_request}/reject', [AccessRequestController::class, 'reject']);
        Route::delete('/access-requests/{access_request}', [AccessRequestController::class, 'destroy']);

    });

    // ──────────────────────────────────────
    // Lookup / Dropdown Data (semua role)
    // ──────────────────────────────────────
    Route::get('/lookup/organizations', function () {
        return \App\Models\Organization::select('id', 'name', 'slug')
            ->where('is_active', true)
            ->orderBy('name')
            ->get();
    });

    Route::get('/lookup/departments', function (\Illuminate\Http\Request $request) {
        $query = \App\Models\Department::select('id', 'organization_id', 'name', 'city')
            ->where('is_active', true);

        if ($request->filled('organization_id')) {
            $query->where('organization_id', $request->organization_id);
        }

        return $query->orderBy('name')->get();
    });

    Route::get('/lookup/cities', function () {
        return \App\Models\User::whereNotNull('city')
            ->where('city', '!=', '')
            ->distinct()
            ->orderBy('city')
            ->pluck('city');
    });
});