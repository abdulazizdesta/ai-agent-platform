<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'conversation_id', 'role', 'content',
        'input_tokens', 'output_tokens', 'model_used',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(AgentConversation::class, 'conversation_id');
    }

    public function getTotalTokensAttribute(): int
    {
        return ($this->input_tokens ?? 0) + ($this->output_tokens ?? 0);
    }
}