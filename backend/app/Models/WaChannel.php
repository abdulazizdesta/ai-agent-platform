<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class WaChannel extends Model
{
    use HasFactory;

    protected $fillable = [
        'phone_number', 'display_name', 'description', 'provider',
        'organization_id', 'department_id', 'city',
        'access_token', 'phone_number_id', 'waba_id',
        'verified_name', 'quality_rating', 'device_status', 'package', 'quota',
        'agent_id', 'mode', 'status', 'verification_error',
        'webhook_url', 'webhook_verify_token',
        'connected_at', 'last_message_at',
    ];

    protected $hidden = [
        'access_token', 'phone_number_id', 'waba_id', 'webhook_verify_token',
    ];

    protected function casts(): array
    {
        return [
            'connected_at'    => 'datetime',
            'last_message_at' => 'datetime',
        ];
    }

    // ── Encrypted Accessors/Mutators ─────────────────

    public function setAccessTokenAttribute(string $value): void
    {
        $this->attributes['access_token'] = Crypt::encryptString($value);
    }

    public function getAccessTokenAttribute(?string $value): ?string
    {
        return $value ? Crypt::decryptString($value) : null;
    }

    public function setPhoneNumberIdAttribute(?string $value): void
    {
        $this->attributes['phone_number_id'] = $value ? Crypt::encryptString($value) : null;
    }

    public function getPhoneNumberIdAttribute(?string $value): ?string
    {
        return $value ? Crypt::decryptString($value) : null;
    }

    public function setWabaIdAttribute(?string $value): void
    {
        $this->attributes['waba_id'] = $value ? Crypt::encryptString($value) : null;
    }

    public function getWabaIdAttribute(?string $value): ?string
    {
        return $value ? Crypt::decryptString($value) : null;
    }

    // ── Relationships ────────────────────────────────

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    // ── Scopes ───────────────────────────────────────

    public function scopeActive($query)     { return $query->where('status', 'active'); }
    public function scopeProvider($query, string $provider) { return $query->where('provider', $provider); }

    // ── Helpers ──────────────────────────────────────

    public function isActive(): bool        { return $this->status === 'active'; }
    public function isFonnte(): bool        { return $this->provider === 'fonnte'; }
    public function isMeta(): bool          { return $this->provider === 'meta'; }
    public function generateWebhookUrl(): string { return url("/api/webhook/whatsapp/{$this->id}"); }

    public function hasCredentials(): bool
    {
        if ($this->isFonnte()) {
            return !empty($this->attributes['access_token']);
        }
        return !empty($this->attributes['access_token'])
            && !empty($this->attributes['phone_number_id'])
            && !empty($this->attributes['waba_id']);
    }
}