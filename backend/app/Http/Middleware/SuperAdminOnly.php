<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SuperAdminOnly
{
    /**
     * Only allow superadmin role to proceed.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->user() || !$request->user()->isSuperAdmin()) {
            return response()->json([
                'message' => 'Akses ditolak. Hanya superadmin yang bisa mengakses fitur ini.',
            ], 403);
        }

        return $next($request);
    }
}