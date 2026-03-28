<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_document_chunks', function (Blueprint $table) {
            $table->id();

            $table->foreignId('agent_document_id')
                  ->constrained('agent_documents')
                  ->cascadeOnDelete();

            $table->text('content');
            $table->integer('chunk_index')->default(0);

            $table->timestamps();
        });

        // Full-text search (built-in PostgreSQL, no extension needed)
        DB::statement('ALTER TABLE agent_document_chunks ADD COLUMN search_vector tsvector');
        DB::statement('CREATE INDEX idx_chunks_search ON agent_document_chunks USING GIN(search_vector)');

        DB::statement("
            CREATE OR REPLACE FUNCTION chunks_search_vector_update() RETURNS trigger AS \$\$
            BEGIN
                NEW.search_vector := to_tsvector('indonesian', COALESCE(NEW.content, ''));
                RETURN NEW;
            END;
            \$\$ LANGUAGE plpgsql;
        ");

        DB::statement("
            CREATE TRIGGER chunks_search_vector_trigger
            BEFORE INSERT OR UPDATE OF content ON agent_document_chunks
            FOR EACH ROW EXECUTE FUNCTION chunks_search_vector_update();
        ");
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS chunks_search_vector_trigger ON agent_document_chunks');
        DB::statement('DROP FUNCTION IF EXISTS chunks_search_vector_update');
        Schema::dropIfExists('agent_document_chunks');
    }
};