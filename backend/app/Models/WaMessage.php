<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WaMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'wa_conversation_id', 'direction', 'sender_type',
        'content', 'message_type', 'media_url',
        'fonnte_message_id', 'status',
        'input_tokens', 'output_tokens', 'model_used',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(WaConversation::class, 'wa_conversation_id');
    }

    public function isInbound(): bool  { return $this->direction === 'inbound'; }
    public function isOutbound(): bool { return $this->direction === 'outbound'; }
}