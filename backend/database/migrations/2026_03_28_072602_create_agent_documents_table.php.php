<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_documents', function (Blueprint $table) {
            $table->id();

            $table->foreignId('agent_id')
                  ->constrained('agents')
                  ->cascadeOnDelete();

            $table->string('filename');
            $table->string('file_path');
            $table->integer('file_size')->default(0);  // bytes
            $table->string('mime_type')->nullable();

            // Processing status
            $table->integer('chunk_count')->default(0);
            $table->enum('status', [
                'pending',
                'processing',
                'completed',
                'failed',
            ])->default('pending');
            $table->text('error_message')->nullable();

            $table->timestamps();

            $table->index(['agent_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_documents');
    }
};