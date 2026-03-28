<?php

namespace App\Models;

use App\Models\WaMessage;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WaConversation extends Model
{
    use HasFactory;

    protected $fillable = [
        'wa_channel_id', 'agent_id', 'contact_phone', 'contact_name',
        'status', 'handler', 'assigned_user_id',
        'unread_count', 'last_message_at',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
        ];
    }

    // ── Relationships ────────────────────────────────

    public function channel(): BelongsTo
    {
        return $this->belongsTo(WaChannel::class, 'wa_channel_id');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(WaMessage::class)->orderBy('created_at');
    }

    public function latestMessage()
    {
        return $this->hasOne(WaMessage::class)->latestOfMany();
    }

    // ── Scopes ───────────────────────────────────────

    public function scopeActive($query)   { return $query->where('status', 'active'); }
    public function scopeWaiting($query)  { return $query->where('status', 'waiting'); }
    public function scopeUnread($query)   { return $query->where('unread_count', '>', 0); }

    // ── Helpers ──────────────────────────────────────

    public function isAiHandled(): bool   { return $this->handler === 'ai'; }
    public function isHumanHandled(): bool { return $this->handler === 'human'; }

    public function markRead(): void
    {
        $this->update(['unread_count' => 0]);
    }

    public function handoffToHuman(int $userId): void
    {
        $this->update([
            'handler'          => 'human',
            'status'           => 'active',
            'assigned_user_id' => $userId,
        ]);
    }

    /**
     * Get messages formatted for Claude API (for AI context).
     */
    public function getMessagesForAi(int $limit = 20): array
    {
        return $this->messages()
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get()
            ->reverse()
            ->values()
            ->map(fn ($m) => [
                'role'    => $m->direction === 'inbound' ? 'user' : 'assistant',
                'content' => $m->content ?? '[media]',
            ])
            ->toArray();
    }
}