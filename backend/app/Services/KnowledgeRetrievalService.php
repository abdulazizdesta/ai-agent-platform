<?php

namespace App\Services;

use App\Models\Agent;
use App\Models\AgentDocumentChunk;
use App\Models\AgentFaq;

class KnowledgeRetrievalService
{
    /**
     * Retrieve relevant knowledge for a given query.
     * Uses PostgreSQL full-text search (Phase 1 — free, no API key).
     *
     * Priority: FAQ matches first, then document chunks.
     *
     * @return array{context: string, sources: array}
     */
    public function retrieve(Agent $agent, string $query): array
    {
        $sources = [];
        $contextParts = [];

        // 1. Search FAQs first (highest priority)
        $faqResults = AgentFaq::searchForAgent($agent->id, $query, 3);

        if ($faqResults->isNotEmpty()) {
            $faqContext = $faqResults->map(function ($faq) {
                return "Q: {$faq->question}\nA: {$faq->answer}";
            })->join("\n\n");

            $contextParts[] = "## Relevant FAQ\n{$faqContext}";
            $sources[] = ['type' => 'faq', 'count' => $faqResults->count()];
        }

        // 2. Search document chunks
        $chunkResults = AgentDocumentChunk::searchForAgent($agent->id, $query, 5);

        if ($chunkResults->isNotEmpty()) {
            $chunkContext = $chunkResults->map(function ($chunk) {
                return $chunk->content;
            })->join("\n\n---\n\n");

            $contextParts[] = "## Relevant Documents\n{$chunkContext}";
            $sources[] = ['type' => 'document', 'count' => $chunkResults->count()];
        }

        $context = '';
        if (!empty($contextParts)) {
            $context = "Gunakan informasi berikut sebagai referensi untuk menjawab:\n\n"
                     . implode("\n\n", $contextParts)
                     . "\n\nJawab berdasarkan informasi di atas. Jika tidak ada info yang relevan, jawab sesuai pengetahuan umum.";
        }

        return [
            'context' => $context,
            'sources' => $sources,
        ];
    }

    /**
     * Get a summary of what the agent "knows".
     */
    public function getKnowledgeSummary(Agent $agent): array
    {
        $stats = $agent->getKnowledgeStats();

        $documents = $agent->documents()
            ->select('filename', 'file_size', 'chunk_count', 'status', 'created_at')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn ($d) => [
                'filename'    => $d->filename,
                'size'        => $d->file_size_human,
                'chunks'      => $d->chunk_count,
                'status'      => $d->status,
                'uploaded_at' => $d->created_at->toDateTimeString(),
            ]);

        $faqSample = $agent->faqs()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->limit(5)
            ->get()
            ->map(fn ($f) => [
                'question' => $f->question,
                'answer'   => mb_substr($f->answer, 0, 100) . (mb_strlen($f->answer) > 100 ? '...' : ''),
            ]);

        return [
            'stats'        => $stats,
            'documents'    => $documents,
            'faq_sample'   => $faqSample,
            'instructions' => $agent->instructions ? mb_substr($agent->instructions, 0, 200) . '...' : null,
            'personality'  => $agent->personality ? mb_substr($agent->personality, 0, 200) . '...' : null,
        ];
    }
}