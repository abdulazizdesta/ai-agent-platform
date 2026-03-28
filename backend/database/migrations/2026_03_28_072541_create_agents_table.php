<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agents', function (Blueprint $table) {
            $table->id();

            // Basic info
            $table->string('name');
            $table->enum('type', ['cs_specialist', 'auditor', 'custom'])->default('cs_specialist');
            $table->text('description')->nullable();

            // Organization
            $table->foreignId('organization_id')
                  ->constrained('organizations')
                  ->cascadeOnDelete();

            // WA Channel assignment (nullable — assign later)
            $table->foreignId('wa_channel_id')
                  ->nullable()
                  ->constrained('wa_channels')
                  ->nullOnDelete();

            // Personality / System Prompt
            $table->text('personality')->nullable();

            // Model config
            $table->string('model_provider')->default('anthropic');
            $table->string('model_name')->default('claude-sonnet-4-20250514');
            $table->decimal('temperature', 3, 2)->default(0.7);
            $table->integer('max_tokens')->default(1024);

            // Capabilities (JSON)
            $table->json('capabilities')->default('{"chat": true, "auto_reply": false}');

            // Instructions & Rules (free-text)
            $table->text('instructions')->nullable();

            // Status
            $table->enum('status', ['draft', 'active', 'disabled'])->default('draft');

            $table->timestamps();

            $table->index(['organization_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agents');
    }
};