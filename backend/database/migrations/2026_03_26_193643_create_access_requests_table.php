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
        Schema::create('access_requests', function (Blueprint $table) {
            $table->id();

            // Applicant info (stored before user account exists)
            $table->string('name');
            $table->string('username');
            $table->string('employee_id');
            $table->string('phone', 20)->nullable();
            $table->string('email')->nullable();
            $table->string('password'); // hashed

            // Organization & Department
            $table->foreignId('organization_id')
                  ->constrained('organizations')
                  ->cascadeOnDelete();
            $table->foreignId('department_id')
                  ->nullable()
                  ->constrained('departments')
                  ->nullOnDelete();

            // Request status
            $table->enum('status', [
                'pending',
                'approved',
                'rejected',
                'expired',
            ])->default('pending');

            // Assigned by reviewer upon approval
            $table->enum('assigned_role', [
                'admin',
                'agent',
                'viewer',
            ])->nullable();

            // Review info
            $table->foreignId('reviewed_by')
                  ->nullable()
                  ->constrained('users')
                  ->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('reject_reason')->nullable();

            // Auto-expire pending requests after 24 hours
            $table->timestamp('expires_at')->nullable();

            $table->timestamps();

            // Prevent duplicate pending requests
            $table->index(['username', 'status']);
            $table->index(['employee_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('access_requests');
    }
};