<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentFaq extends Model
{
    use HasFactory;

    protected $fillable = [
        'agent_id', 'question', 'answer', 'sort_order', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class);
    }

    /**
     * Search FAQs for a specific agent using full-text search.
     */
    public static function searchForAgent(int $agentId, string $query, int $limit = 3)
    {
        return static::select('agent_faqs.*')
            ->selectRaw("ts_rank(search_vector, plainto_tsquery('indonesian', ?)) as relevance", [$query])
            ->where('agent_id', $agentId)
            ->where('is_active', true)
            ->whereRaw("search_vector @@ plainto_tsquery('indonesian', ?)", [$query])
            ->orderByDesc('relevance')
            ->limit($limit)
            ->get();
    }
}