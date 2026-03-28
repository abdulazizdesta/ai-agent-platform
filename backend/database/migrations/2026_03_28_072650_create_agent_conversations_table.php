<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_conversations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('agent_id')
                  ->constrained('agents')
                  ->cascadeOnDelete();

            $table->foreignId('user_id')
                  ->constrained('users')
                  ->cascadeOnDelete();

            $table->string('title')->nullable();
            $table->boolean('is_sandbox')->default(true);

            $table->timestamps();

            $table->index(['agent_id', 'is_sandbox']);
            $table->index(['user_id']);
        });

        Schema::create('agent_messages', function (Blueprint $table) {
            $table->id();

            $table->foreignId('conversation_id')
                  ->constrained('agent_conversations')
                  ->cascadeOnDelete();

            $table->enum('role', ['user', 'assistant', 'system']);
            $table->text('content');

            // Token tracking
            $table->integer('input_tokens')->nullable();
            $table->integer('output_tokens')->nullable();
            $table->string('model_used')->nullable();

            $table->timestamps();

            $table->index(['conversation_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_messages');
        Schema::dropIfExists('agent_conversations');
    }
};