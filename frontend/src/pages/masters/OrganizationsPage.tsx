import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

// ─── Types ───────────────────────────────────────────────
interface OrgData {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  users_count: number;
  departments_count: number;
  created_at: string;
}

interface DeptData {
  id: number;
  organization_id: number;
  name: string;
  description: string | null;
  city: string | null;
  is_active: boolean;
  users_count: number;
  organization: { id: number; name: string } | null;
  created_at: string;
}

interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

interface LookupItem { id: number; name: string; }

// ─── Toast System ────────────────────────────────────────
interface ToastData { id: number; type: 'success' | 'error' | 'warning'; message: string; }
let toastId = 0;

function ToastContainer({ toasts, onRemove }: { toasts: ToastData[]; onRemove: (id: number) => void }) {
  return (
    <div className="cm-toast-container">
      {toasts.map((t) => (
        <div key={t.id} onClick={() => onRemove(t.id)} className={`cm-toast cm-toast-${t.type}`}>
          <span className="material-symbols-rounded" style={{ fontSize: 20 }}>
            {t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'warning'}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Searchable Select ──────────────────────────────────
function SearchableSelect({ value, options, placeholder, onChange }: {
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));
  const selectedLabel = options.find((o) => o.value === value)?.label || '';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(!open)} className="cm-select-trigger">
        <span style={{ color: value ? 'var(--text-primary)' : 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel || placeholder}
        </span>
        <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--text-tertiary)', flexShrink: 0 }}>expand_more</span>
      </div>
      {open && (
        <div className="cm-dropdown-panel">
          <div className="cm-dropdown-search">
            <input autoFocus type="text" placeholder="Ketik untuk cari..." value={search}
              onChange={(e) => setSearch(e.target.value)} onClick={(e) => e.stopPropagation()} />
          </div>
          <div className="cm-dropdown-list">
            <div onClick={() => { onChange(''); setOpen(false); setSearch(''); }} className="cm-dropdown-item placeholder">{placeholder}</div>
            {filtered.length === 0 ? (
              <div className="cm-dropdown-item" style={{ color: 'var(--text-tertiary)' }}>Tidak ditemukan</div>
            ) : filtered.map((opt) => (
              <div key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }}
                className={`cm-dropdown-item ${opt.value === value ? 'active' : ''}`}>{opt.label}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Confirm Modal ──────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, variant, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; variant: 'danger' | 'warning';
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <ModalOverlay onClose={onCancel}>
      <div className="cm-modal-content sm">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div className={`cm-confirm-icon ${variant}`}>
            <span className="material-symbols-rounded" style={{ fontSize: 22 }}>
              {variant === 'danger' ? 'delete_forever' : 'warning'}
            </span>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} className="cm-btn cm-btn-ghost">Batal</button>
          <button onClick={onConfirm} className={`cm-btn ${variant === 'danger' ? 'cm-btn-danger' : 'cm-btn-warning'}`}>{confirmLabel}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function OrganizationsPage() {
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const addToast = useCallback((type: 'success' | 'error' | 'warning', message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const removeToast = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  // ─── Org State ───────────────────────────────────────
  const [orgPage, setOrgPage] = useState(1);
  const [orgPerPage, setOrgPerPage] = useState(10);
  const [orgSearch, setOrgSearch] = useState('');
  const [debouncedOrgSearch, setDebouncedOrgSearch] = useState('');
  const [orgModal, setOrgModal] = useState<'add' | 'edit' | null>(null);
  const [editingOrg, setEditingOrg] = useState<OrgData | null>(null);
  const [confirmDeleteOrg, setConfirmDeleteOrg] = useState<OrgData | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  // ─── Dept State ──────────────────────────────────────
  const [deptPage, setDeptPage] = useState(1);
  const [deptPerPage, setDeptPerPage] = useState(10);
  const [deptSearch, setDeptSearch] = useState('');
  const [debouncedDeptSearch, setDebouncedDeptSearch] = useState('');
  const [deptModal, setDeptModal] = useState<'add' | 'edit' | null>(null);
  const [editingDept, setEditingDept] = useState<DeptData | null>(null);
  const [confirmDeleteDept, setConfirmDeleteDept] = useState<DeptData | null>(null);

  // Debounce
  useEffect(() => { const t = setTimeout(() => setDebouncedOrgSearch(orgSearch), 400); return () => clearTimeout(t); }, [orgSearch]);
  useEffect(() => { const t = setTimeout(() => setDebouncedDeptSearch(deptSearch), 400); return () => clearTimeout(t); }, [deptSearch]);
  useEffect(() => { setOrgPage(1); }, [debouncedOrgSearch, orgPerPage]);
  useEffect(() => { setDeptPage(1); }, [debouncedDeptSearch, deptPerPage, selectedOrgId]);

  // ─── Org Queries ─────────────────────────────────────
  const orgsQuery = useQuery<PaginatedResponse<OrgData>>({
    queryKey: ['organizations', orgPage, orgPerPage, debouncedOrgSearch],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: orgPage, per_page: orgPerPage };
      if (debouncedOrgSearch) params.search = debouncedOrgSearch;
      return (await api.get('/organizations', { params })).data;
    },
  });

  const createOrg = useMutation({
    mutationFn: (p: Record<string, unknown>) => api.post('/organizations', p),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['organizations'] }); setOrgModal(null); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal menambahkan organisasi.'),
  });

  const updateOrg = useMutation({
    mutationFn: ({ id, ...p }: Record<string, unknown>) => api.put(`/organizations/${id}`, p),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['organizations'] }); setOrgModal(null); setEditingOrg(null); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal mengupdate organisasi.'),
  });

  const deleteOrg = useMutation({
    mutationFn: (id: number) => api.delete(`/organizations/${id}`),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      if (selectedOrgId === confirmDeleteOrg?.id) setSelectedOrgId(null);
      addToast('success', r.data.message);
    },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal menghapus organisasi.'),
  });

  // ─── Dept Queries ────────────────────────────────────
  const deptsQuery = useQuery<PaginatedResponse<DeptData>>({
    queryKey: ['departments', deptPage, deptPerPage, debouncedDeptSearch, selectedOrgId],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: deptPage, per_page: deptPerPage };
      if (selectedOrgId) params.organization_id = selectedOrgId;
      if (debouncedDeptSearch) params.search = debouncedDeptSearch;
      return (await api.get('/departments', { params })).data;
    },
    enabled: !!selectedOrgId,
  });

  const orgLookup = useQuery<LookupItem[]>({
    queryKey: ['lookup-organizations'],
    queryFn: async () => (await api.get('/lookup/organizations')).data,
  });

  const createDept = useMutation({
    mutationFn: (p: Record<string, unknown>) => api.post('/departments', p),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['departments'] }); queryClient.invalidateQueries({ queryKey: ['organizations'] }); setDeptModal(null); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal menambahkan departemen.'),
  });

  const updateDept = useMutation({
    mutationFn: ({ id, ...p }: Record<string, unknown>) => api.put(`/departments/${id}`, p),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['departments'] }); setDeptModal(null); setEditingDept(null); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal mengupdate departemen.'),
  });

  const deleteDept = useMutation({
    mutationFn: (id: number) => api.delete(`/departments/${id}`),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['departments'] }); queryClient.invalidateQueries({ queryKey: ['organizations'] }); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal menghapus departemen.'),
  });

  // ─── Helpers ─────────────────────────────────────────
  const orgs = orgsQuery.data?.data || [];
  const orgTotalPages = orgsQuery.data?.last_page || 1;
  const orgTotal = orgsQuery.data?.total || 0;
  const depts = deptsQuery.data?.data || [];
  const deptTotalPages = deptsQuery.data?.last_page || 1;
  const deptTotal = deptsQuery.data?.total || 0;
  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) || null;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  // ─── Render ──────────────────────────────────────────
  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ═══════════ ORGANIZATIONS SECTION ═══════════ */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Organizations & Departments</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{orgTotal} organisasi terdaftar</p>
      </div>

      {/* Org Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          <span className="material-symbols-rounded" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>search</span>
          <input type="text" placeholder="Cari organisasi..." value={orgSearch}
            onChange={(e) => setOrgSearch(e.target.value)} className="cm-filter-input" style={{ paddingLeft: 38 }} />
        </div>
      </div>

      {/* Org Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Rows per page:</span>
          <select value={orgPerPage} onChange={(e) => setOrgPerPage(Number(e.target.value))} className="cm-filter-input" style={{ width: 64, padding: '6px 8px' }}>
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button onClick={() => { setEditingOrg(null); setOrgModal('add'); }} className="cm-btn cm-btn-primary">
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add_business</span>
          Tambah Organisasi
        </button>
      </div>

      {/* Org Table */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
        <table className="cm-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Members</th>
              <th>Departments</th>
              <th>Status</th>
              <th>Created</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {orgsQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (<td key={j}><div className="cm-skeleton" /></td>))}</tr>
              ))
            ) : orgs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 48, display: 'block', marginBottom: 8, opacity: 0.3 }}>corporate_fare</span>
                  Belum ada organisasi.
                </td>
              </tr>
            ) : orgs.map((org) => (
              <tr key={org.id} className={selectedOrgId === org.id ? 'selected' : ''}
                style={{ cursor: 'pointer' }} onClick={() => setSelectedOrgId(selectedOrgId === org.id ? null : org.id)}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--accent-light)', flexShrink: 0 }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--accent)' }}>corporate_fare</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{org.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{org.slug}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>{org.users_count}</td>
                <td style={{ fontWeight: 600 }}>{org.departments_count}</td>
                <td><span className={`cm-badge ${org.is_active ? 'cm-badge-approved' : 'cm-badge-suspended'}`}>{org.is_active ? 'Active' : 'Inactive'}</span></td>
                <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDate(org.created_at)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setEditingOrg(org); setOrgModal('edit'); }} className="cm-icon-btn" title="Edit">
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>edit</span>
                    </button>
                    <button onClick={() => setConfirmDeleteOrg(org)} className="cm-icon-btn danger" title="Delete">
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Org Pagination */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 14, gap: 8, fontSize: 14 }}>
        <span style={{ color: 'var(--text-secondary)' }}>Page {orgPage} of {orgTotalPages}</span>
        <button onClick={() => setOrgPage((p) => Math.max(1, p - 1))} disabled={orgPage <= 1} className="cm-pagination-btn">
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_left</span>
        </button>
        <button onClick={() => setOrgPage((p) => Math.min(orgTotalPages, p + 1))} disabled={orgPage >= orgTotalPages} className="cm-pagination-btn">
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_right</span>
        </button>
      </div>

      {/* ═══════════ DEPARTMENTS SECTION ═══════════ */}
      {selectedOrgId && (
        <div style={{ marginTop: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--accent-light)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--accent)' }}>account_tree</span>
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Departments — {selectedOrg?.name}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{deptTotal} departemen</p>
            </div>
          </div>

          {/* Dept Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 24 }}>
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-rounded" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>search</span>
              <input type="text" placeholder="Cari departemen, kota..." value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)} className="cm-filter-input" style={{ paddingLeft: 38 }} />
            </div>
          </div>

          {/* Dept Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Rows per page:</span>
              <select value={deptPerPage} onChange={(e) => setDeptPerPage(Number(e.target.value))} className="cm-filter-input" style={{ width: 64, padding: '6px 8px' }}>
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={() => { setEditingDept(null); setDeptModal('add'); }} className="cm-btn cm-btn-primary">
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>
              Tambah Departemen
            </button>
          </div>

          {/* Dept Table */}
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
            <table className="cm-table">
              <thead>
                <tr>
                  <th>Nama Departemen</th>
                  <th>Deskripsi</th>
                  <th>Kota / Cabang</th>
                  <th>Members</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {deptsQuery.isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (<td key={j}><div className="cm-skeleton" /></td>))}</tr>
                  ))
                ) : depts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 48, display: 'block', marginBottom: 8, opacity: 0.3 }}>folder_off</span>
                      Belum ada departemen di organisasi ini.
                    </td>
                  </tr>
                ) : depts.map((dept) => (
                  <tr key={dept.id}>
                    <td style={{ fontWeight: 600 }}>{dept.name}</td>
                    <td style={{ color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dept.description || '—'}
                    </td>
                    <td>{dept.city || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{dept.users_count}</td>
                    <td><span className={`cm-badge ${dept.is_active ? 'cm-badge-approved' : 'cm-badge-suspended'}`}>{dept.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDate(dept.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button onClick={() => { setEditingDept(dept); setDeptModal('edit'); }} className="cm-icon-btn" title="Edit">
                          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>edit</span>
                        </button>
                        <button onClick={() => setConfirmDeleteDept(dept)} className="cm-icon-btn danger" title="Delete">
                          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Dept Pagination */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 14, gap: 8, fontSize: 14 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Page {deptPage} of {deptTotalPages}</span>
            <button onClick={() => setDeptPage((p) => Math.max(1, p - 1))} disabled={deptPage <= 1} className="cm-pagination-btn">
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_left</span>
            </button>
            <button onClick={() => setDeptPage((p) => Math.min(deptTotalPages, p + 1))} disabled={deptPage >= deptTotalPages} className="cm-pagination-btn">
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_right</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ MODALS ═══════════ */}
      {/* Org Form */}
      {orgModal && (
        <OrgFormModal
          org={orgModal === 'edit' ? editingOrg : null}
          onClose={() => { setOrgModal(null); setEditingOrg(null); }}
          onSubmit={(d) => {
            if (orgModal === 'edit' && editingOrg) updateOrg.mutate({ id: editingOrg.id, ...d });
            else createOrg.mutate(d);
          }}
          isLoading={createOrg.isPending || updateOrg.isPending}
        />
      )}

      {/* Dept Form */}
      {deptModal && (
        <DeptFormModal
          dept={deptModal === 'edit' ? editingDept : null}
          organizationId={selectedOrgId!}
          organizationName={selectedOrg?.name || ''}
          onClose={() => { setDeptModal(null); setEditingDept(null); }}
          onSubmit={(d) => {
            if (deptModal === 'edit' && editingDept) updateDept.mutate({ id: editingDept.id, ...d });
            else createDept.mutate(d);
          }}
          isLoading={createDept.isPending || updateDept.isPending}
        />
      )}

      {/* Confirm Deletes */}
      {confirmDeleteOrg && (
        <ConfirmModal title="Hapus Organisasi"
          message={`Hapus "${confirmDeleteOrg.name}"? Semua departemen di bawahnya juga akan terhapus.`}
          confirmLabel="Hapus" variant="danger"
          onConfirm={() => { deleteOrg.mutate(confirmDeleteOrg.id); setConfirmDeleteOrg(null); }}
          onCancel={() => setConfirmDeleteOrg(null)} />
      )}

      {confirmDeleteDept && (
        <ConfirmModal title="Hapus Departemen"
          message={`Hapus departemen "${confirmDeleteDept.name}"?`}
          confirmLabel="Hapus" variant="danger"
          onConfirm={() => { deleteDept.mutate(confirmDeleteDept.id); setConfirmDeleteDept(null); }}
          onCancel={() => setConfirmDeleteDept(null)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ORG FORM MODAL
// ═══════════════════════════════════════════════════════════
function OrgFormModal({ org, onClose, onSubmit, isLoading }: {
  org: OrgData | null; onClose: () => void;
  onSubmit: (d: Record<string, unknown>) => void; isLoading: boolean;
}) {
  const isEdit = !!org;
  const [form, setForm] = useState({
    name: org?.name || '', slug: org?.slug || '',
    description: org?.description || '', logo: org?.logo || '',
    address: org?.address || '', city: org?.city || '',
    phone: org?.phone || '', email: org?.email || '',
    is_active: org?.is_active ?? true,
  });

  const handleSubmit = () => {
    const payload: Record<string, unknown> = { ...form };
    ['description', 'logo', 'address', 'city', 'phone', 'email'].forEach((k) => {
      if (!payload[k]) payload[k] = null;
    });
    onSubmit(payload);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="cm-modal-content">
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
          {isEdit ? 'Edit Organisasi' : 'Tambah Organisasi'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Nama Organisasi *" span={2}>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="cm-modal-input" autoComplete="off" />
          </FormField>
          <FormField label="Slug">
            <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} className="cm-modal-input" placeholder="auto-generated" autoComplete="off" />
          </FormField>
          <FormField label="Email">
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="cm-modal-input" autoComplete="off" />
          </FormField>
          <FormField label="Telepon">
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="cm-modal-input" autoComplete="off" />
          </FormField>
          <FormField label="Kota">
            <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="cm-modal-input" autoComplete="off" />
          </FormField>
          <FormField label="Status">
            <select value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === 'true' }))} className="cm-modal-input">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </FormField>
          <FormField label="Alamat" span={2}>
            <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="cm-modal-input" autoComplete="off" />
          </FormField>
          <FormField label="Deskripsi" span={2}>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="cm-modal-input" rows={3} style={{ resize: 'vertical' }} />
          </FormField>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} className="cm-btn cm-btn-ghost">Batal</button>
          <button onClick={handleSubmit} disabled={isLoading} className="cm-btn cm-btn-primary">
            {isLoading ? 'Menyimpan...' : (isEdit ? 'Update' : 'Simpan')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ═══════════════════════════════════════════════════════════
// DEPT FORM MODAL
// ═══════════════════════════════════════════════════════════
function DeptFormModal({ dept, organizationId, organizationName, onClose, onSubmit, isLoading }: {
  dept: DeptData | null; organizationId: number; organizationName: string;
  onClose: () => void; onSubmit: (d: Record<string, unknown>) => void; isLoading: boolean;
}) {
  const isEdit = !!dept;
  const [form, setForm] = useState({
    name: dept?.name || '', description: dept?.description || '',
    city: dept?.city || '', is_active: dept?.is_active ?? true,
  });

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {
      ...form, organization_id: organizationId,
    };
    if (!payload.description) payload.description = null;
    if (!payload.city) payload.city = null;
    onSubmit(payload);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="cm-modal-content" style={{ maxWidth: 480 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
          {isEdit ? 'Edit Departemen' : 'Tambah Departemen'}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>Organisasi: <strong>{organizationName}</strong></p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Nama Departemen *" span={2}>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="cm-modal-input" autoComplete="off" />
          </FormField>
          <FormField label="Kota / Cabang">
            <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="cm-modal-input" autoComplete="off" />
          </FormField>
          <FormField label="Status">
            <select value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === 'true' }))} className="cm-modal-input">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </FormField>
          <FormField label="Deskripsi" span={2}>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="cm-modal-input" rows={3} style={{ resize: 'vertical' }} />
          </FormField>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} className="cm-btn cm-btn-ghost">Batal</button>
          <button onClick={handleSubmit} disabled={isLoading} className="cm-btn cm-btn-primary">
            {isLoading ? 'Menyimpan...' : (isEdit ? 'Update' : 'Simpan')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ═══════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="cm-modal-overlay">
      <div style={{ animation: 'cm-slide-up 0.3s ease' }}>{children}</div>
    </div>
  );
}

function FormField({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{ marginBottom: 4, gridColumn: span ? `span ${span}` : undefined }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{label}</label>
      {children}
    </div>
  );
}