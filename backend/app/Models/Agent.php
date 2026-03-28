<?php

namespace App\Models;

use App\Models\AgentConversation;
use App\Models\AgentDocument;
use App\Models\AgentFaq;
use App\Models\Organization;
use App\Models\WaChannel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Agent extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'type', 'description', 'organization_id', 'wa_channel_id',
        'personality', 'model_provider', 'model_name', 'temperature', 'max_tokens',
        'capabilities', 'instructions', 'status',
    ];

    protected function casts(): array
    {
        return [
            'capabilities' => 'array',
            'temperature'  => 'decimal:2',
        ];
    }

    // ── Relationships ────────────────────────────────

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function waChannel(): BelongsTo
    {
        return $this->belongsTo(WaChannel::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(AgentDocument::class);
    }

    public function faqs(): HasMany
    {
        return $this->hasMany(AgentFaq::class)->orderBy('sort_order');
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(AgentConversation::class);
    }

    // ── Scopes ───────────────────────────────────────

    public function scopeActive($query)   { return $query->where('status', 'active'); }
    public function scopeDraft($query)    { return $query->where('status', 'draft'); }

    // ── Helpers ──────────────────────────────────────

    public function isActive(): bool      { return $this->status === 'active'; }

    public function hasCapability(string $cap): bool
    {
        return !empty($this->capabilities[$cap]);
    }

    /**
     * Build the system prompt from personality + instructions + FAQ context.
     */
    public function buildSystemPrompt(): string
    {
        $parts = [];

        if ($this->personality) {
            $parts[] = "## Personality\n{$this->personality}";
        }

        if ($this->instructions) {
            $parts[] = "## Instructions & Rules\n{$this->instructions}";
        }

        // Append active FAQs
        $faqs = $this->faqs()->where('is_active', true)->get();
        if ($faqs->isNotEmpty()) {
            $faqText = $faqs->map(fn ($f) => "Q: {$f->question}\nA: {$f->answer}")->join("\n\n");
            $parts[] = "## FAQ (prioritas jawab dari sini dulu)\n{$faqText}";
        }

        return implode("\n\n---\n\n", $parts) ?: 'Kamu adalah AI assistant yang membantu customer.';
    }

    /**
     * Get knowledge base stats.
     */
    public function getKnowledgeStats(): array
    {
        return [
            'documents_count'    => $this->documents()->count(),
            'documents_ready'    => $this->documents()->where('status', 'completed')->count(),
            'documents_pending'  => $this->documents()->whereIn('status', ['pending', 'processing'])->count(),
            'total_chunks'       => $this->documents()
                                        ->join('agent_document_chunks', 'agent_documents.id', '=', 'agent_document_chunks.agent_document_id')
                                        ->count(),
            'faqs_count'         => $this->faqs()->where('is_active', true)->count(),
            'has_instructions'   => !empty($this->instructions),
        ];
    }
}