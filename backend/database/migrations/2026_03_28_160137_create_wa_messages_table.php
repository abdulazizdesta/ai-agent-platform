<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wa_messages', function (Blueprint $table) {
            $table->id();

            $table->foreignId('wa_conversation_id')
                  ->constrained('wa_conversations')
                  ->cascadeOnDelete();

            // Direction
            $table->enum('direction', ['inbound', 'outbound']);

            // Who sent it
            $table->enum('sender_type', [
                'customer',     // from WA customer
                'ai',           // auto-reply by AI agent
                'human',        // manual reply by human agent
            ]);

            // Content
            $table->text('content')->nullable();
            $table->enum('message_type', [
                'text', 'image', 'document', 'audio', 'video', 'location', 'sticker',
            ])->default('text');
            $table->string('media_url')->nullable();

            // Fonnte tracking
            $table->string('fonnte_message_id')->nullable();
            $table->enum('status', [
                'received',     // inbound received
                'sent',         // outbound sent
                'delivered',    // outbound delivered
                'read',         // outbound read
                'failed',       // outbound failed
            ])->default('received');

            // AI metadata (if replied by AI)
            $table->integer('input_tokens')->nullable();
            $table->integer('output_tokens')->nullable();
            $table->string('model_used')->nullable();

            $table->timestamps();

            $table->index(['wa_conversation_id', 'created_at']);
            $table->index('fonnte_message_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_messages');
    }
};