<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Drop email_verified_at (tidak relevan — internal app, auth via username)
            $table->dropColumn('email_verified_at');
        });

        Schema::table('users', function (Blueprint $table) {
            // Make email nullable (auth pakai username, bukan email)
            $table->string('email')->nullable()->change();

            // New columns
            $table->string('username')->unique()->after('name');
            $table->string('employee_id')->unique()->after('username');
            $table->string('phone', 20)->nullable()->after('email');
            $table->string('city')->nullable()->after('phone');

            // Organization & Department relationships
            $table->foreignId('organization_id')->nullable()->after('city')
                  ->constrained('organizations')->nullOnDelete();
            $table->foreignId('department_id')->nullable()->after('organization_id')
                  ->constrained('departments')->nullOnDelete();

            // Role & Status
            $table->enum('role', [
                'superadmin',
                'admin',
                'agent',
                'viewer',
            ])->default('viewer')->after('password');

            $table->enum('status', [
                'pending',
                'approved',
                'rejected',
                'expired',
                'suspended',
            ])->default('pending')->after('role');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['organization_id']);
            $table->dropForeign(['department_id']);

            $table->dropColumn([
                'username',
                'employee_id',
                'phone',
                'city',
                'organization_id',
                'department_id',
                'role',
                'status',
            ]);

            $table->string('email')->nullable(false)->change();
            $table->timestamp('email_verified_at')->nullable()->after('email');
        });
    }
};