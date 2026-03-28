<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\OrganizationController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\WaChannelController;
use App\Http\Controllers\Api\AccessRequestController;
use App\Http\Controllers\Api\AgentController;
use App\Http\Controllers\Api\AgentFaqController;
use App\Http\Controllers\Api\AgentDocumentController;
use App\Http\Controllers\Api\AgentChatController;
use App\Http\Controllers\Api\WebhookController;
use App\Http\Controllers\Api\InboxController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Webhook Routes (Public — no auth, Fonnte hits this)
|--------------------------------------------------------------------------
*/
Route::match(['get', 'post'], '/webhook/whatsapp/{channelId}', [WebhookController::class, 'handleFonnte'])
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);

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
| Public Lookups (for Register page)
|--------------------------------------------------------------------------
*/
Route::get('/public/organizations', function () {
    return \App\Models\Organization::select('id', 'name')
        ->where('is_active', true)->orderBy('name')->get();
});

Route::get('/public/departments', function (\Illuminate\Http\Request $request) {
    $query = \App\Models\Department::select('id', 'organization_id', 'name', 'city')
        ->where('is_active', true);
    if ($request->filled('organization_id')) $query->where('organization_id', $request->organization_id);
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
    // Inbox (semua authenticated users — filter by role di frontend)
    // ──────────────────────────────────────
    Route::prefix('inbox')->group(function () {
        Route::get('/stats', [InboxController::class, 'stats']);
        Route::get('/conversations', [InboxController::class, 'conversations']);
        Route::get('/conversations/{conversation}/messages', [InboxController::class, 'messages']);
        Route::post('/conversations/{conversation}/reply', [InboxController::class, 'reply']);
        Route::post('/conversations/{conversation}/takeover', [InboxController::class, 'takeover']);
        Route::post('/conversations/{conversation}/return-to-ai', [InboxController::class, 'returnToAi']);
        Route::post('/conversations/{conversation}/close', [InboxController::class, 'close']);
        Route::delete('/conversations/{conversation}', [InboxController::class, 'destroy']);
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

        // AI Agents
        Route::get('/agents/lookup', [AgentController::class, 'lookup']);
        Route::apiResource('agents', AgentController::class);
        Route::get('/agents/{agent}/knowledge-summary', [AgentController::class, 'knowledgeSummary']);

        // Agent FAQs
        Route::get('/agents/{agent}/faqs', [AgentFaqController::class, 'index']);
        Route::post('/agents/{agent}/faqs', [AgentFaqController::class, 'store']);
        Route::put('/agents/{agent}/faqs/{faq}', [AgentFaqController::class, 'update']);
        Route::delete('/agents/{agent}/faqs/{faq}', [AgentFaqController::class, 'destroy']);

        // Agent Documents
        Route::get('/agents/{agent}/documents', [AgentDocumentController::class, 'index']);
        Route::post('/agents/{agent}/documents', [AgentDocumentController::class, 'store']);
        Route::post('/agents/{agent}/documents/{document}/reprocess', [AgentDocumentController::class, 'reprocess']);
        Route::delete('/agents/{agent}/documents/{document}', [AgentDocumentController::class, 'destroy']);

        // Agent Chat (Sandbox)
        Route::post('/agents/{agent}/chat', [AgentChatController::class, 'chat']);
        Route::get('/agents/{agent}/conversations', [AgentChatController::class, 'conversations']);
        Route::get('/agents/{agent}/conversations/{conversation}/messages', [AgentChatController::class, 'messages']);
        Route::delete('/agents/{agent}/conversations/{conversation}', [AgentChatController::class, 'destroyConversation']);

    });

    // ──────────────────────────────────────
    // Lookup / Dropdown Data (semua role)
    // ──────────────────────────────────────
    Route::get('/lookup/organizations', function () {
        return \App\Models\Organization::select('id', 'name', 'slug')
            ->where('is_active', true)->orderBy('name')->get();
    });

    Route::get('/lookup/departments', function (\Illuminate\Http\Request $request) {
        $query = \App\Models\Department::select('id', 'organization_id', 'name', 'city')
            ->where('is_active', true);
        if ($request->filled('organization_id')) $query->where('organization_id', $request->organization_id);
        return $query->orderBy('name')->get();
    });

    Route::get('/lookup/cities', function () {
        return \App\Models\User::whereNotNull('city')
            ->where('city', '!=', '')->distinct()->orderBy('city')->pluck('city');
    });
});