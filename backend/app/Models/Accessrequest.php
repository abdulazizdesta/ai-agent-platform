<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccessRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'username',
        'employee_id',
        'phone',
        'email',
        'password',
        'organization_id',
        'department_id',
        'city',
        'status',
        'assigned_role',
        'reviewed_by',
        'reviewed_at',
        'reject_reason',
        'expires_at',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'password'    => 'hashed',
            'reviewed_at' => 'datetime',
            'expires_at'  => 'datetime',
        ];
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

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    // ── Scopes ───────────────────────────────────────

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeNotExpired($query)
    {
        return $query->where(function ($q) {
            $q->whereNull('expires_at')
              ->orWhere('expires_at', '>', now());
        });
    }

    // ── Helpers ──────────────────────────────────────

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function isPending(): bool
    {
        return $this->status === 'pending' && !$this->isExpired();
    }

    /**
     * Approve the request and create user account.
     */
    public function approve(User $reviewer, string $role = 'viewer'): User
    {
        $this->update([
            'status'        => 'approved',
            'assigned_role' => $role,
            'reviewed_by'   => $reviewer->id,
            'reviewed_at'   => now(),
        ]);

        return User::create([
            'name'            => $this->name,
            'username'        => $this->username,
            'employee_id'     => $this->employee_id,
            'phone'           => $this->phone,
            'email'           => $this->email,
            'password'        => $this->getRawOriginal('password'),
            'organization_id' => $this->organization_id,
            'department_id'   => $this->department_id,
            'city'            => $this->city,
            'role'            => $role,
            'status'          => 'approved',
        ]);
    }

    /**
     * Reject the request.
     */
    public function reject(User $reviewer, ?string $reason = null): void
    {
        $this->update([
            'status'        => 'rejected',
            'reviewed_by'   => $reviewer->id,
            'reviewed_at'   => now(),
            'reject_reason' => $reason,
        ]);
    }
}