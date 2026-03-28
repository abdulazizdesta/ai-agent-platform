<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class AgentDocumentChunk extends Model
{
    use HasFactory;

    protected $fillable = [
        'agent_document_id', 'content', 'chunk_index',
    ];

    public function document(): BelongsTo
    {
        return $this->belongsTo(AgentDocument::class, 'agent_document_id');
    }

    /**
     * Full-text search across chunks for a specific agent.
     * Uses PostgreSQL tsvector/tsquery — free, no API key needed.
     *
     * @param  int    $agentId
     * @param  string $query
     * @param  int    $limit
     * @return \Illuminate\Support\Collection
     */
    public static function searchForAgent(int $agentId, string $query, int $limit = 5)
    {
        // Convert query to tsquery format (handle Indonesian + simple terms)
        $sanitized = preg_replace('/[^\p{L}\p{N}\s]/u', '', $query);
        $terms = array_filter(explode(' ', $sanitized));

        if (empty($terms)) {
            return collect();
        }

        $tsQuery = implode(' & ', $terms);

        return static::select('agent_document_chunks.*')
            ->selectRaw("ts_rank(search_vector, plainto_tsquery('indonesian', ?)) as relevance", [$query])
            ->join('agent_documents', 'agent_documents.id', '=', 'agent_document_chunks.agent_document_id')
            ->where('agent_documents.agent_id', $agentId)
            ->where('agent_documents.status', 'completed')
            ->whereRaw("search_vector @@ plainto_tsquery('indonesian', ?)", [$query])
            ->orderByDesc('relevance')
            ->limit($limit)
            ->get();
    }
}