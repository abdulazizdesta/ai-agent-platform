<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wa_channels', function (Blueprint $table) {
            $table->id();

            // Channel info
            $table->string('phone_number');
            $table->string('display_name');
            $table->text('description')->nullable();

            // Provider: fonnte or meta
            $table->enum('provider', ['fonnte', 'meta'])->default('fonnte');

            // Organization & Department
            $table->foreignId('organization_id')
                  ->constrained('organizations')
                  ->cascadeOnDelete();
            $table->foreignId('department_id')
                  ->nullable()
                  ->constrained('departments')
                  ->nullOnDelete();
            $table->string('city')->nullable();

            // Credentials (encrypted) — shape depends on provider
            // Fonnte: only access_token (device token)
            // Meta: phone_number_id + waba_id + access_token
            $table->text('access_token');                       // both providers
            $table->text('phone_number_id')->nullable();        // meta only
            $table->text('waba_id')->nullable();                // meta only

            // Verified info (from provider API response)
            $table->string('verified_name')->nullable();
            $table->string('quality_rating')->nullable();
            $table->string('device_status')->nullable();        // fonnte: connect/disconnect
            $table->string('package')->nullable();              // fonnte: free/starter/etc
            $table->integer('quota')->nullable();               // fonnte: remaining quota

            // Agent assignment (nullable — assign later)
            $table->unsignedBigInteger('agent_id')->nullable();

            // Mode
            $table->enum('mode', [
                'ai_only',
                'ai_human_handoff',
                'human_only',
            ])->default('human_only');

            // Status
            $table->enum('status', [
                'active',
                'inactive',
                'pending_verification',
            ])->default('pending_verification');
            $table->text('verification_error')->nullable();

            // Webhook
            $table->string('webhook_url')->nullable();
            $table->string('webhook_verify_token')->nullable();

            // Tracking
            $table->timestamp('connected_at')->nullable();
            $table->timestamp('last_message_at')->nullable();

            $table->timestamps();

            $table->unique('phone_number');
            $table->index(['organization_id', 'status']);
            $table->index('provider');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_channels');
    }
};