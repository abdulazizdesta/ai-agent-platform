<?php

namespace App\Models;

use App\Models\Agent;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\AgentMessage;

class AgentConversation extends Model
{
    use HasFactory;

    protected $fillable = [
        'agent_id', 'user_id', 'title', 'is_sandbox',
    ];

    protected function casts(): array
    {
        return ['is_sandbox' => 'boolean'];
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(AgentMessage::class, 'conversation_id')->orderBy('created_at');
    }

    /**
     * Get messages formatted for Claude API.
     */
    public function getMessagesForApi(): array
    {
        return $this->messages()
            ->whereIn('role', ['user', 'assistant'])
            ->get()
            ->map(fn ($m) => [
                'role'    => $m->role,
                'content' => $m->content,
            ])
            ->toArray();
    }
}