<?php

namespace App\Models;

use App\Models\Agent;
use App\Models\AgentDocumentChunk;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AgentDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'agent_id', 'filename', 'file_path', 'file_size', 'mime_type',
        'chunk_count', 'status', 'error_message',
    ];

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class);
    }

    public function chunks(): HasMany
    {
        return $this->hasMany(AgentDocumentChunk::class)->orderBy('chunk_index');
    }

    public function isReady(): bool
    {
        return $this->status === 'completed';
    }

    /**
     * Get human-readable file size.
     */
    public function getFileSizeHumanAttribute(): string
    {
        $bytes = $this->file_size;
        if ($bytes < 1024) return $bytes . ' B';
        if ($bytes < 1048576) return round($bytes / 1024, 1) . ' KB';
        return round($bytes / 1048576, 1) . ' MB';
    }
}