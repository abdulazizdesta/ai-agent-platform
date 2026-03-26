<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Auth Routes
|--------------------------------------------------------------------------
|
| POST /api/auth/login          — Login (username + password)
| POST /api/auth/request-access — Submit access request (register)
| POST /api/auth/logout         — Logout (revoke token)
| GET  /api/auth/me             — Get current user
|
*/

// Public routes (no auth required)
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/request-access', [AuthController::class, 'requestAccess']);
});

// Protected routes (Sanctum auth required)
Route::middleware('auth:sanctum')->prefix('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
});