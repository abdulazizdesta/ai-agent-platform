<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_faqs', function (Blueprint $table) {
            $table->id();

            $table->foreignId('agent_id')
                  ->constrained('agents')
                  ->cascadeOnDelete();

            $table->text('question');
            $table->text('answer');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->index(['agent_id', 'is_active']);
        });

        // Full-text search on FAQ question + answer
        DB::statement('ALTER TABLE agent_faqs ADD COLUMN search_vector tsvector');
        DB::statement('CREATE INDEX idx_faqs_search ON agent_faqs USING GIN(search_vector)');

        DB::statement("
            CREATE OR REPLACE FUNCTION faqs_search_vector_update() RETURNS trigger AS $$
            BEGIN
                NEW.search_vector := to_tsvector('indonesian', COALESCE(NEW.question, '') || ' ' || COALESCE(NEW.answer, ''));
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        ");

        DB::statement("
            CREATE TRIGGER faqs_search_vector_trigger
            BEFORE INSERT OR UPDATE OF question, answer ON agent_faqs
            FOR EACH ROW EXECUTE FUNCTION faqs_search_vector_update();
        ");
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS faqs_search_vector_trigger ON agent_faqs');
        DB::statement('DROP FUNCTION IF EXISTS faqs_search_vector_update');
        Schema::dropIfExists('agent_faqs');
    }
};