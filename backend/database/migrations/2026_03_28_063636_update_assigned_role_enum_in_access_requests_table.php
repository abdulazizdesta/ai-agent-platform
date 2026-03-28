<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop old check constraint and recreate with superadmin
        DB::statement("ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_assigned_role_check");
        DB::statement("ALTER TABLE access_requests ADD CONSTRAINT access_requests_assigned_role_check CHECK (assigned_role IN ('superadmin', 'admin', 'agent', 'viewer'))");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_assigned_role_check");
        DB::statement("ALTER TABLE access_requests ADD CONSTRAINT access_requests_assigned_role_check CHECK (assigned_role IN ('admin', 'agent', 'viewer'))");
    }
};