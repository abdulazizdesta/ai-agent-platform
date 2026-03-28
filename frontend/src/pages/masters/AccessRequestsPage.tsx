import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

// ─── Constants ───────────────────────────────────────────
const ALL_STATUSES = ['pending', 'approved', 'rejected', 'expired'];
const ASSIGNABLE_ROLES = ['admin', 'agent', 'viewer'];

// ─── Types ───────────────────────────────────────────────
interface AccessRequestData {
  id: number; name: string; username: string; employee_id: string;
  phone: string | null; email: string | null; city: string | null;
  organization: { id: number; name: string } | null;
  department: { id: number; name: string } | null;
  status: string; assigned_role: string | null;
  reviewer: { id: number; name: string; username: string } | null;
  reviewed_at: string | null; reject_reason: string | null;
  expires_at: string | null; created_at: string;
}
interface PaginatedResponse { data: AccessRequestData[]; current_page: number; last_page: number; per_page: number; total: number; }
interface LookupItem { id: number; name: string; organization_id?: number; }
interface ToastData { id: number; type: 'success' | 'error' | 'warning'; message: string; }
let toastId = 0;

// ─── Shared Components ──────────────────────────────────
function ToastContainer({ toasts, onRemove }: { toasts: ToastData[]; onRemove: (id: number) => void }) {
  return (<div className="cm-toast-container">{toasts.map((t) => (
    <div key={t.id} onClick={() => onRemove(t.id)} className={`cm-toast cm-toast-${t.type}`}>
      <span className="material-symbols-rounded" style={{ fontSize: 20 }}>{t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'warning'}</span>{t.message}
    </div>))}</div>);
}

function SearchableSelect({ value, options, placeholder, onChange }: { value: string; options: { value: string; label: string }[]; placeholder: string; onChange: (v: string) => void; }) {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState(''); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));
  const selectedLabel = options.find((o) => o.value === value)?.label || '';
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(!open)} className="cm-select-trigger">
        <span style={{ color: value ? 'var(--text-primary)' : 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel || placeholder}</span>
        <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--text-tertiary)', flexShrink: 0 }}>expand_more</span>
      </div>
      {open && (<div className="cm-dropdown-panel"><div className="cm-dropdown-search"><input autoFocus type="text" placeholder="Ketik untuk cari..." value={search} onChange={(e) => setSearch(e.target.value)} onClick={(e) => e.stopPropagation()} /></div>
        <div className="cm-dropdown-list">
          <div onClick={() => { onChange(''); setOpen(false); setSearch(''); }} className="cm-dropdown-item placeholder">{placeholder}</div>
          {filtered.length === 0 ? <div className="cm-dropdown-item" style={{ color: 'var(--text-tertiary)' }}>Tidak ditemukan</div> :
            filtered.map((opt) => (<div key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }} className={`cm-dropdown-item ${opt.value === value ? 'active' : ''}`}>{opt.label}</div>))}
        </div></div>)}
    </div>);
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (<div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="cm-modal-overlay">
    <div style={{ animation: 'cm-slide-up 0.3s ease' }}>{children}</div></div>);
}

function FormField({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (<div style={{ marginBottom: 8, gridColumn: span ? `span ${span}` : undefined }}>
    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{label}</label>{children}</div>);
}

function ConfirmModal({ title, message, confirmLabel, variant, onConfirm, onCancel }: { title: string; message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => void; onCancel: () => void; }) {
  return (<ModalOverlay onClose={onCancel}><div className="cm-modal-content sm">
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div className={`cm-confirm-icon ${variant}`}><span className="material-symbols-rounded" style={{ fontSize: 22 }}>{variant === 'danger' ? 'delete_forever' : 'warning'}</span></div>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{title}</h3>
    </div>
    <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <button onClick={onCancel} className="cm-btn cm-btn-ghost">Batal</button>
      <button onClick={onConfirm} className={`cm-btn ${variant === 'danger' ? 'cm-btn-danger' : 'cm-btn-warning'}`}>{confirmLabel}</button>
    </div></div></ModalOverlay>);
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function AccessRequestsPage() {
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const addToast = useCallback((type: 'success' | 'error' | 'warning', msg: string) => { const id = ++toastId; setToasts((p) => [...p, { id, type, message: msg }]); setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000); }, []);
  const removeToast = useCallback((id: number) => setToasts((p) => p.filter((t) => t.id !== id)), []);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOrgId, setFilterOrgId] = useState('');
  const [reviewModal, setReviewModal] = useState<AccessRequestData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AccessRequestData | null>(null);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, filterStatus, filterOrgId, perPage]);

  // ─── Queries ─────────────────────────────────────────
  const requestsQuery = useQuery<PaginatedResponse>({
    queryKey: ['access-requests', page, perPage, debouncedSearch, filterStatus, filterOrgId],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, per_page: perPage };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterStatus) params.status = filterStatus;
      if (filterOrgId) params.organization_id = filterOrgId;
      return (await api.get('/access-requests', { params })).data;
    },
  });

  const orgLookup = useQuery<LookupItem[]>({ queryKey: ['lookup-organizations'], queryFn: async () => (await api.get('/lookup/organizations')).data });

  // ─── Mutations ───────────────────────────────────────
  const approveRequest = useMutation({
    mutationFn: ({ id, ...p }: Record<string, unknown>) => api.post(`/access-requests/${id}/approve`, p),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['access-requests'] }); queryClient.invalidateQueries({ queryKey: ['users'] }); setReviewModal(null); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal approve request.'),
  });

  const rejectRequest = useMutation({
    mutationFn: ({ id, ...p }: Record<string, unknown>) => api.post(`/access-requests/${id}/reject`, p),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['access-requests'] }); setReviewModal(null); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal reject request.'),
  });

  const deleteRequest = useMutation({
    mutationFn: (id: number) => api.delete(`/access-requests/${id}`),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['access-requests'] }); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal menghapus request.'),
  });

  // ─── Helpers ─────────────────────────────────────────
  const requests = requestsQuery.data?.data || [];
  const totalPages = requestsQuery.data?.last_page || 1;
  const totalRequests = requestsQuery.data?.total || 0;

  const orgOpts = [{ value: '', label: 'Semua Organisasi' }, ...(orgLookup.data || []).map((o) => ({ value: String(o.id), label: o.name }))];
  const statusOpts = [{ value: '', label: 'Semua Status' }, ...ALL_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))];

  const statusBadge = (s: string) => s === 'approved' ? 'cm-badge-approved' : s === 'rejected' ? 'cm-badge-suspended' : s === 'pending' ? 'cm-badge-pending' : 'cm-badge-viewer';
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  // ─── Render ──────────────────────────────────────────
  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Access Requests</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {totalRequests} request total
          {pendingCount > 0 && <span style={{ marginLeft: 8, color: 'var(--warning)', fontWeight: 600 }}>({pendingCount} menunggu review)</span>}
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          <span className="material-symbols-rounded" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>search</span>
          <input type="text" placeholder="Cari nama, username, employee ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="cm-filter-input" style={{ paddingLeft: 38 }} />
        </div>
        <SearchableSelect value={filterStatus} options={statusOpts} placeholder="Semua Status" onChange={setFilterStatus} />
        <SearchableSelect value={filterOrgId} options={orgOpts} placeholder="Semua Organisasi" onChange={setFilterOrgId} />
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Rows per page:</span>
          <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="cm-filter-input" style={{ width: 64, padding: '6px 8px' }}>
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
        <table className="cm-table">
          <thead><tr>
            <th>Nama</th><th>Username</th><th>Employee ID</th><th>Telepon</th>
            <th>Kota</th><th>Organisasi</th><th>Departemen</th><th>Status</th>
            <th>Submitted</th><th>Expires</th><th>Aksi</th>
          </tr></thead>
          <tbody>
            {requestsQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (<tr key={i}>{Array.from({ length: 11 }).map((_, j) => (<td key={j}><div className="cm-skeleton" /></td>))}</tr>))
            ) : requests.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 48, display: 'block', marginBottom: 8, opacity: 0.3 }}>how_to_reg</span>
                Tidak ada access request.
              </td></tr>
            ) : requests.map((req) => {
              const isExpiringSoon = req.status === 'pending' && req.expires_at && (new Date(req.expires_at).getTime() - Date.now()) < 3600000;
              return (
                <tr key={req.id} style={isExpiringSoon ? { backgroundColor: 'rgba(217,119,6,0.06)' } : undefined}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{req.name}</div>
                    {req.email && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{req.email}</div>}
                  </td>
                  <td>{req.username}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{req.employee_id}</td>
                  <td>{req.phone || '—'}</td>
                  <td>{req.city || '—'}</td>
                  <td>{req.organization?.name || '—'}</td>
                  <td>{req.department?.name || '—'}</td>
                  <td>
                    <span className={`cm-badge ${statusBadge(req.status)}`}>{req.status}</span>
                    {req.assigned_role && req.status === 'approved' && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>as {req.assigned_role}</div>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDate(req.created_at)}</td>
                  <td style={{ fontSize: 12, color: isExpiringSoon ? 'var(--warning)' : 'var(--text-secondary)', fontWeight: isExpiringSoon ? 600 : 400 }}>
                    {formatDate(req.expires_at)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {req.status === 'pending' && (
                        <button onClick={() => setReviewModal(req)} className="cm-icon-btn" title="Review" style={{ color: 'var(--accent)' }}>
                          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>rate_review</span>
                        </button>
                      )}
                      {req.status !== 'pending' && (
                        <button onClick={() => setConfirmDelete(req)} className="cm-icon-btn danger" title="Delete">
                          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 14, gap: 8, fontSize: 14 }}>
        <span style={{ color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="cm-pagination-btn"><span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_left</span></button>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="cm-pagination-btn"><span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_right</span></button>
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <ReviewModal
          request={reviewModal}
          onClose={() => setReviewModal(null)}
          onApprove={(data) => approveRequest.mutate({ id: reviewModal.id, ...data })}
          onReject={(data) => rejectRequest.mutate({ id: reviewModal.id, ...data })}
          isLoading={approveRequest.isPending || rejectRequest.isPending}
        />
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <ConfirmModal title="Hapus Request" message={`Hapus request dari "${confirmDelete.name}"?`}
          confirmLabel="Hapus" variant="danger"
          onConfirm={() => { deleteRequest.mutate(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// REVIEW MODAL — Approve / Reject
// ═══════════════════════════════════════════════════════════
function ReviewModal({ request, onClose, onApprove, onReject, isLoading }: {
  request: AccessRequestData; onClose: () => void;
  onApprove: (d: Record<string, unknown>) => void;
  onReject: (d: Record<string, unknown>) => void;
  isLoading: boolean;
}) {
  const [assignedRole, setAssignedRole] = useState('viewer');
  const [rejectReason, setRejectReason] = useState('');
  const [mode, setMode] = useState<'review' | 'rejecting'>('review');

  const timeLeft = request.expires_at ? Math.max(0, Math.floor((new Date(request.expires_at).getTime() - Date.now()) / 60000)) : null;
  const hoursLeft = timeLeft !== null ? Math.floor(timeLeft / 60) : null;
  const minutesLeft = timeLeft !== null ? timeLeft % 60 : null;

  return (
    <ModalOverlay onClose={onClose}>
      <div className="cm-modal-content" style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Review Request</h2>
          {timeLeft !== null && timeLeft > 0 && (
            <span className={`cm-badge ${timeLeft < 60 ? 'cm-badge-suspended' : timeLeft < 360 ? 'cm-badge-pending' : 'cm-badge-approved'}`}>
              Expires in {hoursLeft}h {minutesLeft}m
            </span>
          )}
          {timeLeft !== null && timeLeft <= 0 && (
            <span className="cm-badge cm-badge-suspended">Expired</span>
          )}
        </div>

        {/* Applicant Info */}
        <div style={{ padding: 16, borderRadius: 12, backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <InfoRow label="Nama Lengkap" value={request.name} />
            <InfoRow label="Username" value={request.username} />
            <InfoRow label="Employee ID" value={request.employee_id} mono />
            <InfoRow label="Telepon" value={request.phone || '—'} />
            <InfoRow label="Email" value={request.email || '—'} />
            <InfoRow label="Kota / Cabang" value={request.city || '—'} />
            <InfoRow label="Organisasi" value={request.organization?.name || '—'} />
            <InfoRow label="Departemen" value={request.department?.name || '—'} />
            <InfoRow label="Submitted" value={new Date(request.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          </div>
        </div>

        {mode === 'review' ? (
          <>
            {/* Assign Role */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <FormField label="Assign Role *">
                <select value={assignedRole} onChange={(e) => setAssignedRole(e.target.value)} className="cm-modal-input">
                  {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </FormField>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button onClick={() => setMode('rejecting')} className="cm-btn cm-btn-danger" disabled={isLoading}>
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
                Reject
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} className="cm-btn cm-btn-ghost">Batal</button>
                <button onClick={() => onApprove({ assigned_role: assignedRole })} className="cm-btn cm-btn-primary" disabled={isLoading}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>check</span>
                  {isLoading ? 'Memproses...' : 'Approve'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Reject Reason */}
            <FormField label="Alasan Penolakan">
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                className="cm-modal-input" rows={3} style={{ resize: 'vertical' }}
                placeholder="Opsional — jelaskan alasan penolakan..." />
            </FormField>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button onClick={() => setMode('review')} className="cm-btn cm-btn-ghost">
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>arrow_back</span>
                Kembali
              </button>
              <button onClick={() => onReject({ reject_reason: rejectReason || null })} className="cm-btn cm-btn-danger" disabled={isLoading}>
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
                {isLoading ? 'Memproses...' : 'Konfirmasi Reject'}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalOverlay>
  );
}

// ─── Info Row (read-only field in review modal) ─────────
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</div>
    </div>
  );
}