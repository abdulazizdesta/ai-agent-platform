import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

// ─── Constants ───────────────────────────────────────────
const PROVIDERS = [
  { value: 'fonnte', label: 'Fonnte' },
  { value: 'meta', label: 'Meta (WhatsApp Business API)' },
];
const MODES = [
  { value: 'human_only', label: 'Human Only' },
  { value: 'ai_human_handoff', label: 'AI + Human Handoff' },
  { value: 'ai_only', label: 'AI Only' },
];
const STATUSES = ['active', 'inactive', 'pending_verification'];

// ─── Types ───────────────────────────────────────────────
interface WaChannelData {
  id: number; phone_number: string; display_name: string; description: string | null;
  provider: string;
  organization: { id: number; name: string } | null;
  department: { id: number; name: string } | null;
  city: string | null; agent_id: number | null; mode: string; status: string;
  verification_error: string | null; verified_name: string | null;
  quality_rating: string | null; device_status: string | null;
  package: string | null; quota: number | null;
  webhook_url: string | null; connected_at: string | null;
  last_message_at: string | null; created_at: string;
}
interface PaginatedResponse { data: WaChannelData[]; current_page: number; last_page: number; per_page: number; total: number; }
interface LookupItem { id: number; name: string; organization_id?: number; city?: string; }
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

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (<div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="cm-modal-overlay">
    <div style={{ animation: 'cm-slide-up 0.3s ease' }}>{children}</div></div>);
}

function FormField({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (<div style={{ marginBottom: 4, gridColumn: span ? `span ${span}` : undefined }}>
    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{label}</label>{children}</div>);
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function WaChannelsPage() {
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const addToast = useCallback((type: 'success' | 'error' | 'warning', msg: string) => { const id = ++toastId; setToasts((p) => [...p, { id, type, message: msg }]); setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000); }, []);
  const removeToast = useCallback((id: number) => setToasts((p) => p.filter((t) => t.id !== id)), []);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterOrgId, setFilterOrgId] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | 'credentials' | null>(null);
  const [editingChannel, setEditingChannel] = useState<WaChannelData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WaChannelData | null>(null);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, filterStatus, filterMode, filterOrgId, filterProvider, perPage]);

  const channelsQuery = useQuery<PaginatedResponse>({
    queryKey: ['wa-channels', page, perPage, debouncedSearch, filterStatus, filterMode, filterOrgId, filterProvider],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, per_page: perPage };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterStatus) params.status = filterStatus;
      if (filterMode) params.mode = filterMode;
      if (filterOrgId) params.organization_id = filterOrgId;
      if (filterProvider) params.provider = filterProvider;
      return (await api.get('/wa-channels', { params })).data;
    },
  });

  const orgLookup = useQuery<LookupItem[]>({ queryKey: ['lookup-organizations'], queryFn: async () => (await api.get('/lookup/organizations')).data });
  const deptLookup = useQuery<LookupItem[]>({ queryKey: ['lookup-departments'], queryFn: async () => (await api.get('/lookup/departments')).data });

  const createChannel = useMutation({
    mutationFn: (p: Record<string, unknown>) => api.post('/wa-channels', p),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['wa-channels'] }); setModal(null); addToast(r.data.channel?.status === 'active' ? 'success' : 'warning', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal menambahkan WA Channel.'),
  });
  const updateChannel = useMutation({
    mutationFn: ({ id, ...p }: Record<string, unknown>) => api.put(`/wa-channels/${id}`, p),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['wa-channels'] }); setModal(null); setEditingChannel(null); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal mengupdate channel.'),
  });
  const deleteChannel = useMutation({
    mutationFn: (id: number) => api.delete(`/wa-channels/${id}`),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['wa-channels'] }); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal menghapus channel.'),
  });
  const reVerify = useMutation({
    mutationFn: (id: number) => api.post(`/wa-channels/${id}/re-verify`),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['wa-channels'] }); addToast(r.data.channel?.status === 'active' ? 'success' : 'error', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal memverifikasi.'),
  });
  const updateCredentials = useMutation({
    mutationFn: ({ id, ...p }: Record<string, unknown>) => api.post(`/wa-channels/${id}/update-credentials`, p),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['wa-channels'] }); setModal(null); setEditingChannel(null); addToast(r.data.channel?.status === 'active' ? 'success' : 'warning', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal mengupdate credentials.'),
  });

  const channels = channelsQuery.data?.data || [];
  const totalPages = channelsQuery.data?.last_page || 1;
  const totalChannels = channelsQuery.data?.total || 0;

  const orgOpts = [{ value: '', label: 'Semua Organisasi' }, ...(orgLookup.data || []).map((o) => ({ value: String(o.id), label: o.name }))];
  const statusOpts = [{ value: '', label: 'Semua Status' }, ...STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))];
  const modeOpts = [{ value: '', label: 'Semua Mode' }, ...MODES.map((m) => ({ value: m.value, label: m.label }))];
  const providerOpts = [{ value: '', label: 'Semua Provider' }, ...PROVIDERS];

  const statusBadge = (s: string) => s === 'active' ? 'cm-badge-approved' : s === 'inactive' ? 'cm-badge-suspended' : 'cm-badge-pending';
  const modeBadge = (m: string) => m === 'ai_only' ? 'cm-badge-superadmin' : m === 'ai_human_handoff' ? 'cm-badge-admin' : 'cm-badge-viewer';
  const providerBadge = (p: string) => p === 'fonnte' ? 'cm-badge-agent' : 'cm-badge-admin';
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const modeLabel = (m: string) => MODES.find((x) => x.value === m)?.label || m;

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>WA Channels</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{totalChannels} channel terdaftar</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          <span className="material-symbols-rounded" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>search</span>
          <input type="text" placeholder="Cari nomor, nama, deskripsi..." value={search} onChange={(e) => setSearch(e.target.value)} className="cm-filter-input" style={{ paddingLeft: 38 }} />
        </div>
        <SearchableSelect value={filterProvider} options={providerOpts} placeholder="Semua Provider" onChange={setFilterProvider} />
        <SearchableSelect value={filterOrgId} options={orgOpts} placeholder="Semua Organisasi" onChange={setFilterOrgId} />
        <SearchableSelect value={filterStatus} options={statusOpts} placeholder="Semua Status" onChange={setFilterStatus} />
        <SearchableSelect value={filterMode} options={modeOpts} placeholder="Semua Mode" onChange={setFilterMode} />
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Rows per page:</span>
          <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="cm-filter-input" style={{ width: 64, padding: '6px 8px' }}>
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button onClick={() => { setEditingChannel(null); setModal('add'); }} className="cm-btn cm-btn-primary">
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add_call</span>
          Add Number
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
        <table className="cm-table">
          <thead><tr>
            <th>Nomor WA</th><th>Provider</th><th>Display Name</th><th>Organisasi</th>
            <th>Mode</th><th>Status</th><th>Info</th><th>Last Message</th><th>Aksi</th>
          </tr></thead>
          <tbody>
            {channelsQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (<tr key={i}>{Array.from({ length: 9 }).map((_, j) => (<td key={j}><div className="cm-skeleton" /></td>))}</tr>))
            ) : channels.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 48, display: 'block', marginBottom: 8, opacity: 0.3 }}>phone_disabled</span>
                Belum ada WA Channel terdaftar.
              </td></tr>
            ) : channels.map((ch) => (
              <tr key={ch.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{ch.phone_number}</div>
                  {ch.verified_name && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{ch.verified_name}</div>}
                </td>
                <td><span className={`cm-badge ${providerBadge(ch.provider)}`}>{ch.provider}</span></td>
                <td>{ch.display_name}</td>
                <td>
                  <div>{ch.organization?.name || '—'}</div>
                  {ch.city && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{ch.city}</div>}
                </td>
                <td><span className={`cm-badge ${modeBadge(ch.mode)}`}>{modeLabel(ch.mode)}</span></td>
                <td>
                  <span className={`cm-badge ${statusBadge(ch.status)}`}>{ch.status.replace(/_/g, ' ')}</span>
                  {ch.status === 'pending_verification' && ch.verification_error && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ch.verification_error}>{ch.verification_error}</div>
                  )}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {ch.provider === 'fonnte' ? (
                    <div>
                      {ch.device_status && <div>Device: <strong>{ch.device_status}</strong></div>}
                      {ch.package && <div>Plan: {ch.package}</div>}
                      {ch.quota !== null && <div>Quota: {ch.quota}</div>}
                    </div>
                  ) : (
                    ch.quality_rating ? <span className={`cm-badge ${ch.quality_rating === 'GREEN' ? 'cm-badge-approved' : ch.quality_rating === 'YELLOW' ? 'cm-badge-pending' : 'cm-badge-suspended'}`}>{ch.quality_rating}</span> : '—'
                  )}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDate(ch.last_message_at)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => { setEditingChannel(ch); setModal('edit'); }} className="cm-icon-btn" title="Edit">
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>edit</span></button>
                    <button onClick={() => { setEditingChannel(ch); setModal('credentials'); }} className="cm-icon-btn" title="Update Token">
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>key</span></button>
                    <button onClick={() => reVerify.mutate(ch.id)} className="cm-icon-btn" title="Re-verify" disabled={reVerify.isPending}>
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>verified</span></button>
                    <button onClick={() => setConfirmDelete(ch)} className="cm-icon-btn danger" title="Delete">
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 14, gap: 8, fontSize: 14 }}>
        <span style={{ color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="cm-pagination-btn"><span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_left</span></button>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="cm-pagination-btn"><span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_right</span></button>
      </div>

      {/* Modals */}
      {modal === 'add' && <AddChannelModal organizations={orgLookup.data || []} departments={deptLookup.data || []} onClose={() => setModal(null)} onSubmit={(d) => createChannel.mutate(d)} isLoading={createChannel.isPending} />}
      {modal === 'edit' && editingChannel && <EditChannelModal channel={editingChannel} organizations={orgLookup.data || []} departments={deptLookup.data || []} onClose={() => { setModal(null); setEditingChannel(null); }} onSubmit={(d) => updateChannel.mutate({ id: editingChannel.id, ...d })} isLoading={updateChannel.isPending} />}
      {modal === 'credentials' && editingChannel && <CredentialsModal channel={editingChannel} onClose={() => { setModal(null); setEditingChannel(null); }} onSubmit={(d) => updateCredentials.mutate({ id: editingChannel.id, ...d })} isLoading={updateCredentials.isPending} />}
      {confirmDelete && <ConfirmModal title="Hapus WA Channel" message={`Hapus "${confirmDelete.display_name}" (${confirmDelete.phone_number})?`} confirmLabel="Hapus" variant="danger" onConfirm={() => { deleteChannel.mutate(confirmDelete.id); setConfirmDelete(null); }} onCancel={() => setConfirmDelete(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ADD CHANNEL MODAL — provider-aware credential fields
// ═══════════════════════════════════════════════════════════
function AddChannelModal({ organizations, departments, onClose, onSubmit, isLoading }: {
  organizations: LookupItem[]; departments: LookupItem[];
  onClose: () => void; onSubmit: (d: Record<string, unknown>) => void; isLoading: boolean;
}) {
  const [form, setForm] = useState({
    phone_number: '', display_name: '', description: '', provider: 'fonnte',
    organization_id: '', department_id: '', city: '',
    access_token: '', phone_number_id: '', waba_id: '', mode: 'human_only',
  });

  const isMeta = form.provider === 'meta';
  const filteredDepts = departments.filter((d) => !form.organization_id || d.organization_id === Number(form.organization_id));
  const orgOpts = organizations.map((o) => ({ value: String(o.id), label: o.name }));
  const deptOpts = filteredDepts.map((d) => ({ value: String(d.id), label: `${d.name}${d.city ? ` (${d.city})` : ''}` }));

  const canSubmit = form.phone_number && form.display_name && form.organization_id && form.access_token
    && (!isMeta || (form.phone_number_id && form.waba_id));

  const handleSubmit = () => {
    const payload: Record<string, unknown> = { ...form };
    if (payload.organization_id) payload.organization_id = Number(payload.organization_id);
    if (payload.department_id) payload.department_id = Number(payload.department_id);
    else payload.department_id = null;
    ['description', 'city'].forEach((k) => { if (!payload[k]) payload[k] = null; });
    if (!isMeta) { payload.phone_number_id = null; payload.waba_id = null; }
    onSubmit(payload);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="cm-modal-content" style={{ maxWidth: 600 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>Add WA Number</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Provider selector — prominent */}
          <FormField label="Provider *" span={2}>
            <div style={{ display: 'flex', gap: 8 }}>
              {PROVIDERS.map((p) => (
                <button key={p.value} onClick={() => setForm((f) => ({ ...f, provider: p.value, phone_number_id: '', waba_id: '' }))}
                  className={`cm-btn ${form.provider === p.value ? 'cm-btn-primary' : 'cm-btn-ghost'}`}
                  style={{ flex: 1, justifyContent: 'center' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{p.value === 'fonnte' ? 'bolt' : 'corporate_fare'}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Nomor WA *">
            <input value={form.phone_number} onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))} className="cm-modal-input" placeholder="+62812xxx" autoComplete="off" />
          </FormField>
          <FormField label="Display Name *">
            <input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} className="cm-modal-input" autoComplete="off" />
          </FormField>
          <FormField label="Organisasi *">
            <SearchableSelect value={form.organization_id} options={orgOpts} placeholder="Pilih organisasi..."
              onChange={(v) => setForm((f) => ({ ...f, organization_id: v, department_id: '' }))} />
          </FormField>
          <FormField label="Departemen">
            <SearchableSelect value={form.department_id} options={deptOpts} placeholder="Pilih departemen..."
              onChange={(v) => setForm((f) => ({ ...f, department_id: v }))} />
          </FormField>
          <FormField label="Kota / Cabang">
            <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="cm-modal-input" autoComplete="off" />
          </FormField>
          <FormField label="Mode">
            <select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))} className="cm-modal-input">
              {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </FormField>
          <FormField label="Deskripsi" span={2}>
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="cm-modal-input" placeholder="e.g. CS Cabang Jakarta Pusat" autoComplete="off" />
          </FormField>
        </div>

        {/* Credentials — changes based on provider */}
        <div style={{ marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--accent)' }}>key</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {isMeta ? 'Meta WA Business API Credentials' : 'Fonnte Device Token'}
            </h3>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
            {isMeta ? 'Dapatkan credentials dari Meta Developer Dashboard. Akan dienkripsi setelah disimpan.' : 'Dapatkan token dari dashboard Fonnte (fonnte.com → Device → Token). Akan dienkripsi setelah disimpan.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {isMeta && (
              <>
                <FormField label="Phone Number ID *">
                  <input value={form.phone_number_id} onChange={(e) => setForm((f) => ({ ...f, phone_number_id: e.target.value }))} className="cm-modal-input" autoComplete="off" />
                </FormField>
                <FormField label="WABA ID *">
                  <input value={form.waba_id} onChange={(e) => setForm((f) => ({ ...f, waba_id: e.target.value }))} className="cm-modal-input" autoComplete="off" />
                </FormField>
              </>
            )}
            <FormField label={isMeta ? 'Access Token *' : 'Device Token *'} span={isMeta ? 2 : undefined}>
              <input type="password" value={form.access_token} onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))}
                className="cm-modal-input" placeholder={isMeta ? 'Permanent access token' : 'Token dari dashboard Fonnte'} autoComplete="new-password" />
            </FormField>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} className="cm-btn cm-btn-ghost">Batal</button>
          <button onClick={handleSubmit} disabled={isLoading || !canSubmit} className="cm-btn cm-btn-primary">
            {isLoading ? 'Memverifikasi...' : 'Simpan & Verifikasi'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ═══════════════════════════════════════════════════════════
// EDIT CHANNEL MODAL (no credentials, no provider change)
// ═══════════════════════════════════════════════════════════
function EditChannelModal({ channel, organizations, departments, onClose, onSubmit, isLoading }: {
  channel: WaChannelData; organizations: LookupItem[]; departments: LookupItem[];
  onClose: () => void; onSubmit: (d: Record<string, unknown>) => void; isLoading: boolean;
}) {
  const [form, setForm] = useState({
    phone_number: channel.phone_number, display_name: channel.display_name,
    description: channel.description || '', organization_id: channel.organization?.id?.toString() || '',
    department_id: channel.department?.id?.toString() || '', city: channel.city || '', mode: channel.mode,
  });

  const filteredDepts = departments.filter((d) => !form.organization_id || d.organization_id === Number(form.organization_id));
  const orgOpts = organizations.map((o) => ({ value: String(o.id), label: o.name }));
  const deptOpts = filteredDepts.map((d) => ({ value: String(d.id), label: `${d.name}${d.city ? ` (${d.city})` : ''}` }));

  const handleSubmit = () => {
    const payload: Record<string, unknown> = { ...form };
    if (payload.organization_id) payload.organization_id = Number(payload.organization_id);
    if (payload.department_id) payload.department_id = Number(payload.department_id);
    else payload.department_id = null;
    ['description', 'city'].forEach((k) => { if (!payload[k]) payload[k] = null; });
    onSubmit(payload);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="cm-modal-content">
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>Edit WA Channel</h2>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>
          Provider: <span className={`cm-badge ${channel.provider === 'fonnte' ? 'cm-badge-agent' : 'cm-badge-admin'}`}>{channel.provider}</span>
        </p>
        {channel.webhook_url && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20 }}>Webhook: <code style={{ color: 'var(--accent)' }}>{channel.webhook_url}</code></p>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Nomor WA *"><input value={form.phone_number} onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))} className="cm-modal-input" /></FormField>
          <FormField label="Display Name *"><input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} className="cm-modal-input" /></FormField>
          <FormField label="Organisasi *">
            <SearchableSelect value={form.organization_id} options={orgOpts} placeholder="Pilih organisasi..." onChange={(v) => setForm((f) => ({ ...f, organization_id: v, department_id: '' }))} /></FormField>
          <FormField label="Departemen">
            <SearchableSelect value={form.department_id} options={deptOpts} placeholder="Pilih departemen..." onChange={(v) => setForm((f) => ({ ...f, department_id: v }))} /></FormField>
          <FormField label="Kota"><input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="cm-modal-input" /></FormField>
          <FormField label="Mode"><select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))} className="cm-modal-input">{MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></FormField>
          <FormField label="Deskripsi" span={2}><input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="cm-modal-input" /></FormField>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} className="cm-btn cm-btn-ghost">Batal</button>
          <button onClick={handleSubmit} disabled={isLoading} className="cm-btn cm-btn-primary">{isLoading ? 'Menyimpan...' : 'Update'}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ═══════════════════════════════════════════════════════════
// CREDENTIALS MODAL — provider-aware
// ═══════════════════════════════════════════════════════════
function CredentialsModal({ channel, onClose, onSubmit, isLoading }: {
  channel: WaChannelData; onClose: () => void;
  onSubmit: (d: Record<string, unknown>) => void; isLoading: boolean;
}) {
  const isMeta = channel.provider === 'meta';
  const [form, setForm] = useState({ access_token: '', phone_number_id: '', waba_id: '' });

  const canSubmit = form.access_token && (!isMeta || (form.phone_number_id && form.waba_id));

  return (
    <ModalOverlay onClose={onClose}>
      <div className="cm-modal-content" style={{ maxWidth: 480 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>Update Credentials</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {channel.display_name} ({channel.phone_number}) — <span className={`cm-badge ${channel.provider === 'fonnte' ? 'cm-badge-agent' : 'cm-badge-admin'}`}>{channel.provider}</span>
        </p>
        <div className="alert alert-danger" style={{ marginBottom: 16, fontSize: 13 }}>
          {isMeta ? 'Credentials lama akan ditimpa. Masukkan semua field.' : 'Token lama akan ditimpa dengan yang baru.'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {isMeta && (
            <>
              <FormField label="Phone Number ID *"><input value={form.phone_number_id} onChange={(e) => setForm((f) => ({ ...f, phone_number_id: e.target.value }))} className="cm-modal-input" autoComplete="off" /></FormField>
              <FormField label="WABA ID *"><input value={form.waba_id} onChange={(e) => setForm((f) => ({ ...f, waba_id: e.target.value }))} className="cm-modal-input" autoComplete="off" /></FormField>
            </>
          )}
          <FormField label={isMeta ? 'Access Token *' : 'Device Token *'} span={isMeta ? 2 : undefined}>
            <input type="password" value={form.access_token} onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))} className="cm-modal-input" autoComplete="new-password" />
          </FormField>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} className="cm-btn cm-btn-ghost">Batal</button>
          <button onClick={() => onSubmit(form)} disabled={isLoading || !canSubmit} className="cm-btn cm-btn-primary">
            {isLoading ? 'Memverifikasi...' : 'Update & Verifikasi'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}