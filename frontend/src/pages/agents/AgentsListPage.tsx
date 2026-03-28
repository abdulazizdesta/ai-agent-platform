import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const TYPES = [
  { value: 'cs_specialist', label: 'CS Specialist' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'custom', label: 'Custom' },
];
const STATUSES = ['draft', 'active', 'disabled'];

interface AgentData {
  id: number; name: string; type: string; description: string | null;
  status: string; model_name: string; model_provider: string;
  organization: { id: number; name: string } | null;
  wa_channel: { id: number; phone_number: string; display_name: string } | null;
  documents_count: number; faqs_count: number; conversations_count: number;
  created_at: string;
}
interface PaginatedResponse { data: AgentData[]; current_page: number; last_page: number; per_page: number; total: number; }
interface LookupItem { id: number; name: string; }
interface ToastData { id: number; type: 'success' | 'error' | 'warning'; message: string; }
let toastId = 0;

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
  return (<div style={{ marginBottom: 4, gridColumn: span ? `span ${span}` : undefined }}>
    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{label}</label>{children}</div>);
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }: { title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; }) {
  return (<ModalOverlay onClose={onCancel}><div className="cm-modal-content sm">
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div className="cm-confirm-icon danger"><span className="material-symbols-rounded" style={{ fontSize: 22 }}>delete_forever</span></div>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{title}</h3>
    </div>
    <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <button onClick={onCancel} className="cm-btn cm-btn-ghost">Batal</button>
      <button onClick={onConfirm} className="cm-btn cm-btn-danger">{confirmLabel}</button>
    </div></div></ModalOverlay>);
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
export default function AgentsListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const addToast = useCallback((type: 'success' | 'error' | 'warning', msg: string) => { const id = ++toastId; setToasts((p) => [...p, { id, type, message: msg }]); setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000); }, []);
  const removeToast = useCallback((id: number) => setToasts((p) => p.filter((t) => t.id !== id)), []);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AgentData | null>(null);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, filterType, filterStatus, perPage]);

  const agentsQuery = useQuery<PaginatedResponse>({
    queryKey: ['agents', page, perPage, debouncedSearch, filterType, filterStatus],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, per_page: perPage };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      return (await api.get('/agents', { params })).data;
    },
  });

  const orgLookup = useQuery<LookupItem[]>({ queryKey: ['lookup-organizations'], queryFn: async () => (await api.get('/lookup/organizations')).data });

  const createAgent = useMutation({
    mutationFn: (p: Record<string, unknown>) => api.post('/agents', p),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setCreateModal(false);
      addToast('success', r.data.message);
      navigate(`/agents/${r.data.agent.id}`);
    },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal membuat agent.'),
  });

  const deleteAgent = useMutation({
    mutationFn: (id: number) => api.delete(`/agents/${id}`),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['agents'] }); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal menghapus agent.'),
  });

  const agents = agentsQuery.data?.data || [];
  const totalPages = agentsQuery.data?.last_page || 1;
  const totalAgents = agentsQuery.data?.total || 0;

  const typeOpts = [{ value: '', label: 'Semua Type' }, ...TYPES];
  const statusOpts = [{ value: '', label: 'Semua Status' }, ...STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))];
  const typeBadge = (t: string) => t === 'cs_specialist' ? 'cm-badge-agent' : t === 'auditor' ? 'cm-badge-admin' : 'cm-badge-viewer';
  const statusBadge = (s: string) => s === 'active' ? 'cm-badge-approved' : s === 'draft' ? 'cm-badge-pending' : 'cm-badge-suspended';
  const typeLabel = (t: string) => TYPES.find((x) => x.value === t)?.label || t;

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>AI Agents</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{totalAgents} agent terdaftar</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          <span className="material-symbols-rounded" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>search</span>
          <input type="text" placeholder="Cari agent..." value={search} onChange={(e) => setSearch(e.target.value)} className="cm-filter-input" style={{ paddingLeft: 38 }} />
        </div>
        <SearchableSelect value={filterType} options={typeOpts} placeholder="Semua Type" onChange={setFilterType} />
        <SearchableSelect value={filterStatus} options={statusOpts} placeholder="Semua Status" onChange={setFilterStatus} />
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Rows per page:</span>
          <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="cm-filter-input" style={{ width: 64, padding: '6px 8px' }}>
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button onClick={() => setCreateModal(true)} className="cm-btn cm-btn-primary">
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>
          Create New Agent
        </button>
      </div>

      {/* Agent Cards / Table */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
        <table className="cm-table">
          <thead><tr>
            <th>Agent</th><th>Type</th><th>WA Channel</th><th>Knowledge</th><th>Status</th><th>Aksi</th>
          </tr></thead>
          <tbody>
            {agentsQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (<tr key={i}>{Array.from({ length: 6 }).map((_, j) => (<td key={j}><div className="cm-skeleton" /></td>))}</tr>))
            ) : agents.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 48, display: 'block', marginBottom: 8, opacity: 0.3 }}>smart_toy</span>
                Belum ada AI Agent. Buat yang pertama!
              </td></tr>
            ) : agents.map((agent) => (
              <tr key={agent.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/agents/${agent.id}`)}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--accent-light)', flexShrink: 0 }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--accent)' }}>smart_toy</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{agent.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{agent.model_name}</div>
                    </div>
                  </div>
                </td>
                <td><span className={`cm-badge ${typeBadge(agent.type)}`}>{typeLabel(agent.type)}</span></td>
                <td>
                  {agent.wa_channel ? (
                    <div>
                      <div style={{ fontSize: 13 }}>{agent.wa_channel.display_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{agent.wa_channel.phone_number}</div>
                    </div>
                  ) : <span style={{ color: 'var(--text-tertiary)' }}>Not assigned</span>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span title="Documents">{agent.documents_count} docs</span>
                    <span title="FAQs">{agent.faqs_count} FAQ</span>
                  </div>
                </td>
                <td><span className={`cm-badge ${statusBadge(agent.status)}`}>{agent.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => navigate(`/agents/${agent.id}`)} className="cm-icon-btn" title="Configure">
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>settings</span>
                    </button>
                    <button onClick={() => setConfirmDelete(agent)} className="cm-icon-btn danger" title="Delete">
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
                    </button>
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

      {/* Create Modal */}
      {createModal && (
        <CreateAgentModal
          organizations={orgLookup.data || []}
          onClose={() => setCreateModal(false)}
          onSubmit={(d) => createAgent.mutate(d)}
          isLoading={createAgent.isPending}
        />
      )}

      {confirmDelete && (
        <ConfirmModal title="Hapus Agent" message={`Hapus "${confirmDelete.name}"? Semua knowledge base & chat history juga akan terhapus.`}
          confirmLabel="Hapus"
          onConfirm={() => { deleteAgent.mutate(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CREATE AGENT MODAL
// ═══════════════════════════════════════════════════════════
function CreateAgentModal({ organizations, onClose, onSubmit, isLoading }: {
  organizations: LookupItem[]; onClose: () => void;
  onSubmit: (d: Record<string, unknown>) => void; isLoading: boolean;
}) {
  const [form, setForm] = useState({ name: '', type: 'cs_specialist', description: '', organization_id: '' });
  const orgOpts = organizations.map((o) => ({ value: String(o.id), label: o.name }));

  const handleSubmit = () => {
    onSubmit({
      ...form,
      organization_id: Number(form.organization_id),
      description: form.description || null,
    });
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="cm-modal-content" style={{ maxWidth: 480 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>Create New Agent</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Nama Agent *" span={2}>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="cm-modal-input" placeholder="CS Agent Surabaya" autoComplete="off" />
          </FormField>
          <FormField label="Type *">
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="cm-modal-input">
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>
          <FormField label="Organisasi *">
            <SearchableSelect value={form.organization_id} options={orgOpts} placeholder="Pilih organisasi..." onChange={(v) => setForm((f) => ({ ...f, organization_id: v }))} />
          </FormField>
          <FormField label="Deskripsi" span={2}>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="cm-modal-input" rows={3} style={{ resize: 'vertical' }} placeholder="Deskripsi singkat agent ini..." />
          </FormField>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} className="cm-btn cm-btn-ghost">Batal</button>
          <button onClick={handleSubmit} disabled={isLoading || !form.name || !form.organization_id} className="cm-btn cm-btn-primary">
            {isLoading ? 'Membuat...' : 'Buat Agent'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}