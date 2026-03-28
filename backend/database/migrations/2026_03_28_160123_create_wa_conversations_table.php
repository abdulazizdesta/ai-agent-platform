<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wa_conversations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('wa_channel_id')
                  ->constrained('wa_channels')
                  ->cascadeOnDelete();

            // Agent assigned to this channel (nullable if human_only)
            $table->foreignId('agent_id')
                  ->nullable()
                  ->constrained('agents')
                  ->nullOnDelete();

            // Customer info
            $table->string('contact_phone');
            $table->string('contact_name')->nullable();

            // Conversation status
            $table->enum('status', [
                'active',       // ongoing conversation
                'waiting',      // waiting for human (handoff)
                'closed',       // resolved
            ])->default('active');

            // Who's handling it
            $table->enum('handler', [
                'ai',           // AI is replying
                'human',        // human took over
                'unassigned',   // no one (human_only mode, unread)
            ])->default('unassigned');

            // Human agent who took over (nullable)
            $table->foreignId('assigned_user_id')
                  ->nullable()
                  ->constrained('users')
                  ->nullOnDelete();

            $table->integer('unread_count')->default(0);
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();

            $table->unique(['wa_channel_id', 'contact_phone']);
            $table->index(['status', 'handler']);
            $table->index('last_message_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_conversations');
    }
};