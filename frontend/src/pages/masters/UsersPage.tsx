import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

// ─── Constants ───────────────────────────────────────────
const ALL_ROLES = ['superadmin', 'admin', 'agent', 'viewer'];
const STATUSES = ['approved', 'suspended', 'pending'];

// ─── Types ───────────────────────────────────────────────
interface UserData {
  id: number;
  name: string;
  username: string;
  employee_id: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  role: string;
  status: string;
  organization: { id: number; name: string } | null;
  department: { id: number; name: string } | null;
  created_at: string;
}

interface PaginatedResponse {
  data: UserData[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

interface LookupItem {
  id: number;
  name: string;
  organization_id?: number;
  city?: string;
}

interface Filters {
  search: string;
  role: string;
  status: string;
  department_id: string;
  city: string;
}

// ─── Toast System ────────────────────────────────────────
interface ToastData {
  id: number;
  type: 'success' | 'error' | 'warning';
  message: string;
}

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

// ─── Searchable Select Component ────────────────────────
function SearchableSelect({ value, options, placeholder, onChange, renderOption }: {
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (val: string) => void;
  renderOption?: (opt: { value: string; label: string }) => React.ReactNode;
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

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

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
            <input
              autoFocus
              type="text"
              placeholder="Ketik untuk cari..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="cm-dropdown-list">
            <div
              onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              className="cm-dropdown-item placeholder"
            >
              {placeholder}
            </div>
            {filtered.length === 0 ? (
              <div className="cm-dropdown-item" style={{ color: 'var(--text-tertiary)' }}>Tidak ditemukan</div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }}
                  className={`cm-dropdown-item ${opt.value === value ? 'active' : ''}`}
                >
                  {renderOption ? renderOption(opt) : opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Confirm Modal ──────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, variant, onConfirm, onCancel }: {
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
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
export default function UsersPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [filters, setFilters] = useState<Filters>({ search: '', role: '', status: '', department_id: '', city: '' });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [modal, setModal] = useState<'add' | 'edit' | 'reset-password' | 'bulk' | null>(null);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<UserData | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 400);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, filters.role, filters.status, filters.department_id, filters.city, perPage]);

  const addToast = useCallback((type: 'success' | 'error' | 'warning', message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Queries ─────────────────────────────────────────
  const usersQuery = useQuery<PaginatedResponse>({
    queryKey: ['users', page, perPage, debouncedSearch, filters.role, filters.status, filters.department_id, filters.city],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, per_page: perPage };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filters.role) params.role = filters.role;
      if (filters.status) params.status = filters.status;
      if (filters.department_id) params.department_id = filters.department_id;
      if (filters.city) params.city = filters.city;
      const { data } = await api.get('/users', { params });
      return data;
    },
  });

  const departmentsQuery = useQuery<LookupItem[]>({
    queryKey: ['lookup-departments'],
    queryFn: async () => (await api.get('/lookup/departments')).data,
  });

  const organizationsQuery = useQuery<LookupItem[]>({
    queryKey: ['lookup-organizations'],
    queryFn: async () => (await api.get('/lookup/organizations')).data,
  });

  const citiesQuery = useQuery<string[]>({
    queryKey: ['lookup-cities'],
    queryFn: async () => (await api.get('/lookup/cities')).data,
  });

  // ─── Mutations ───────────────────────────────────────
  const createUser = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/users', payload),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['users'] }); setModal(null); addToast('success', res.data.message); },
    onError: (err: any) => addToast('error', err.response?.data?.message || 'Gagal menambahkan user.'),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, ...payload }: Record<string, unknown>) => api.put(`/users/${id}`, payload),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['users'] }); setModal(null); setEditingUser(null); addToast('success', res.data.message); },
    onError: (err: any) => addToast('error', err.response?.data?.message || 'Gagal mengupdate user.'),
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['users'] }); addToast('success', res.data.message); },
    onError: (err: any) => addToast('error', err.response?.data?.message || 'Gagal menghapus user.'),
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, ...payload }: Record<string, unknown>) => api.post(`/users/${id}/reset-password`, payload),
    onSuccess: (res) => { setModal(null); setEditingUser(null); addToast('success', res.data.message); },
    onError: (err: any) => addToast('error', err.response?.data?.message || 'Gagal mereset password.'),
  });

  const bulkAction = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/users/bulk-action', payload),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['users'] }); setSelectedIds([]); setModal(null); addToast('success', res.data.message); },
    onError: (err: any) => addToast('error', err.response?.data?.message || 'Gagal menjalankan bulk action.'),
  });

  // ─── Helpers ─────────────────────────────────────────
  const users = usersQuery.data?.data || [];
  const totalPages = usersQuery.data?.last_page || 1;
  const totalUsers = usersQuery.data?.total || 0;

  const toggleSelectAll = () => setSelectedIds(selectedIds.length === users.length ? [] : users.map((u) => u.id));
  const toggleSelect = (id: number) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);

  const roleOpts = [{ value: '', label: 'Semua Role' }, ...ALL_ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))];
  const statusOpts = [{ value: '', label: 'Semua Status' }, ...STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))];
  const deptOpts = [{ value: '', label: 'Semua Department' }, ...(departmentsQuery.data || []).map((d) => ({ value: String(d.id), label: d.name }))];
  const cityOpts = [{ value: '', label: 'Semua Kota' }, ...(citiesQuery.data || []).map((c) => ({ value: c, label: c }))];

  // ─── Render ──────────────────────────────────────────
  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Users Management</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{totalUsers} total users</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          <span className="material-symbols-rounded" style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            fontSize: 18, color: 'var(--text-tertiary)', pointerEvents: 'none',
          }}>search</span>
          <input
            type="text"
            placeholder="Cari nama, username, employee ID..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="cm-filter-input"
            style={{ paddingLeft: 38 }}
          />
        </div>
        <SearchableSelect value={filters.role} options={roleOpts} placeholder="Semua Role" onChange={(v) => setFilters((f) => ({ ...f, role: v }))} />
        <SearchableSelect value={filters.status} options={statusOpts} placeholder="Semua Status" onChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
        <SearchableSelect value={filters.department_id} options={deptOpts} placeholder="Semua Department" onChange={(v) => setFilters((f) => ({ ...f, department_id: v }))} />
        <SearchableSelect value={filters.city} options={cityOpts} placeholder="Semua Kota" onChange={(v) => setFilters((f) => ({ ...f, city: v }))} />
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Rows per page:</span>
          <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="cm-filter-input" style={{ width: 64, padding: '6px 8px' }}>
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {selectedIds.length > 0 && (
            <button onClick={() => setModal('bulk')} className="cm-btn cm-btn-warning">
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>checklist</span>
              Bulk Action ({selectedIds.length})
            </button>
          )}
          <label className="cm-btn cm-btn-ghost" style={{ cursor: 'pointer' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>upload_file</span>
            Upload CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={() => addToast('warning', 'Fitur CSV upload belum tersedia.')} />
          </label>
          <button onClick={() => { setEditingUser(null); setModal('add'); }} className="cm-btn cm-btn-primary">
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>person_add</span>
            Tambah User
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
        <table className="cm-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={selectedIds.length === users.length && users.length > 0} onChange={toggleSelectAll} /></th>
              <th>Nama</th>
              <th>Username</th>
              <th>Employee ID</th>
              <th>Kota</th>
              <th>Role</th>
              <th>Departemen</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j}><div className="cm-skeleton" /></td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 48, display: 'block', marginBottom: 8, opacity: 0.3 }}>group_off</span>
                  Tidak ada user ditemukan.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className={selectedIds.includes(user.id) ? 'selected' : ''}>
                  <td><input type="checkbox" checked={selectedIds.includes(user.id)} onChange={() => toggleSelect(user.id)} /></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{user.name}</div>
                    {user.email && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{user.email}</div>}
                  </td>
                  <td>{user.username}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{user.employee_id}</td>
                  <td>{user.city || '—'}</td>
                  <td><span className={`cm-badge cm-badge-${user.role}`}>{user.role}</span></td>
                  <td>{user.department?.name || '—'}</td>
                  <td><span className={`cm-badge cm-badge-${user.status}`}>{user.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button onClick={() => { setEditingUser(user); setModal('edit'); }} className="cm-icon-btn" title="Edit">
                        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>edit</span>
                      </button>
                      <button onClick={() => { setEditingUser(user); setModal('reset-password'); }} className="cm-icon-btn" title="Reset Password">
                        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>lock_reset</span>
                      </button>
                      <button onClick={() => setConfirmDelete(user)} className="cm-icon-btn danger" title="Delete">
                        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 14, gap: 8, fontSize: 14 }}>
        <span style={{ color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="cm-pagination-btn">
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_left</span>
        </button>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="cm-pagination-btn">
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_right</span>
        </button>
      </div>

      {/* Modals */}
      {(modal === 'add' || modal === 'edit') && (
        <UserFormModal
          user={modal === 'edit' ? editingUser : null}
          organizations={organizationsQuery.data || []}
          departments={departmentsQuery.data || []}
          onClose={() => { setModal(null); setEditingUser(null); }}
          onSubmit={(data) => {
            if (modal === 'edit' && editingUser) updateUser.mutate({ id: editingUser.id, ...data });
            else createUser.mutate(data);
          }}
          isLoading={createUser.isPending || updateUser.isPending}
        />
      )}

      {modal === 'reset-password' && editingUser && (
        <ResetPasswordModal
          user={editingUser}
          onClose={() => { setModal(null); setEditingUser(null); }}
          onSubmit={(data) => resetPassword.mutate({ id: editingUser.id, ...data })}
          isLoading={resetPassword.isPending}
        />
      )}

      {modal === 'bulk' && (
        <BulkActionModal
          count={selectedIds.length}
          departments={departmentsQuery.data || []}
          onClose={() => setModal(null)}
          onSubmit={(action, value) => bulkAction.mutate({ action, user_ids: selectedIds, value })}
          isLoading={bulkAction.isPending}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Hapus User"
          message={`Apakah kamu yakin ingin menghapus "${confirmDelete.name}"? Aksi ini tidak bisa dibatalkan.`}
          confirmLabel="Hapus"
          variant="danger"
          onConfirm={() => { deleteUser.mutate(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// USER FORM MODAL
// ═══════════════════════════════════════════════════════════
function UserFormModal({ user, organizations, departments, onClose, onSubmit, isLoading }: {
  user: UserData | null;
  organizations: LookupItem[];
  departments: LookupItem[];
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isLoading: boolean;
}) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name: user?.name || '',
    username: user?.username || '',
    employee_id: user?.employee_id || '',
    password: '',
    email: user?.email || '',
    phone: user?.phone || '',
    city: user?.city || '',
    role: user?.role || 'viewer',
    organization_id: user?.organization?.id?.toString() || '',
    department_id: user?.department?.id?.toString() || '',
  });

  const filteredDepts = departments.filter(
    (d) => !form.organization_id || d.organization_id === Number(form.organization_id)
  );

  const orgOpts = organizations.map((o) => ({ value: String(o.id), label: o.name }));
  const deptOpts = filteredDepts.map((d) => ({ value: String(d.id), label: `${d.name}${d.city ? ` (${d.city})` : ''}` }));

  const handleSubmit = () => {
    const payload: Record<string, unknown> = { ...form };
    if (!payload.email) payload.email = null;
    if (!payload.phone) payload.phone = null;
    if (!payload.city) payload.city = null;
    if (payload.organization_id) payload.organization_id = Number(payload.organization_id);
    if (payload.department_id) payload.department_id = Number(payload.department_id);
    else payload.department_id = null;
    if (isEdit) delete payload.password;
    onSubmit(payload);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="cm-modal-content">
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
          {isEdit ? 'Edit User' : 'Tambah User'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Nama Lengkap *" span={2}>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="cm-modal-input" autoComplete="off" />
          </FormField>
          <FormField label="Username *">
            <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className="cm-modal-input" disabled={isEdit} autoComplete="new-username" />
          </FormField>
          <FormField label="Employee ID *">
            <input value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} className="cm-modal-input" autoComplete="off" />
          </FormField>
          {!isEdit && (
            <FormField label="Password *" span={2}>
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="cm-modal-input" placeholder="Min 8 karakter" autoComplete="new-password" />
            </FormField>
          )}
          <FormField label="Email">
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="cm-modal-input" autoComplete="off" />
          </FormField>
          <FormField label="Telepon">
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="cm-modal-input" autoComplete="off" />
          </FormField>
          <FormField label="Kota / Cabang">
            <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="cm-modal-input" autoComplete="off" />
          </FormField>
          <FormField label="Role *">
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="cm-modal-input">
              {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
          <FormField label="Organisasi *">
            <SearchableSelect
              value={form.organization_id}
              options={orgOpts}
              placeholder="Pilih organisasi..."
              onChange={(v) => setForm((f) => ({ ...f, organization_id: v, department_id: '' }))}
            />
          </FormField>
          <FormField label="Departemen">
            <SearchableSelect
              value={form.department_id}
              options={deptOpts}
              placeholder="Pilih departemen..."
              onChange={(v) => setForm((f) => ({ ...f, department_id: v }))}
            />
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
// RESET PASSWORD MODAL
// ═══════════════════════════════════════════════════════════
function ResetPasswordModal({ user, onClose, onSubmit, isLoading }: {
  user: UserData;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isLoading: boolean;
}) {
  const [pw, setPw] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');

  return (
    <ModalOverlay onClose={onClose}>
      <div className="cm-modal-content sm">
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>Reset Password</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Reset password untuk <strong>{user.name}</strong> ({user.username})
        </p>
        <FormField label="Password Baru *">
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="cm-modal-input" placeholder="Min 8 karakter" autoComplete="new-password" />
        </FormField>
        <FormField label="Konfirmasi Password *">
          <input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} className="cm-modal-input" autoComplete="new-password" />
        </FormField>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} className="cm-btn cm-btn-ghost">Batal</button>
          <button
            onClick={() => onSubmit({ password: pw, password_confirmation: pwConfirm })}
            disabled={isLoading || !pw || pw !== pwConfirm || pw.length < 8}
            className="cm-btn cm-btn-primary"
          >
            {isLoading ? 'Mereset...' : 'Reset Password'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ═══════════════════════════════════════════════════════════
// BULK ACTION MODAL
// ═══════════════════════════════════════════════════════════
function BulkActionModal({ count, departments, onClose, onSubmit, isLoading }: {
  count: number;
  departments: LookupItem[];
  onClose: () => void;
  onSubmit: (action: string, value: string) => void;
  isLoading: boolean;
}) {
  const [action, setAction] = useState('');
  const [value, setValue] = useState('');

  return (
    <ModalOverlay onClose={onClose}>
      <div className="cm-modal-content md">
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>Bulk Action</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>{count} user dipilih</p>
        <FormField label="Action *">
          <select value={action} onChange={(e) => { setAction(e.target.value); setValue(''); }} className="cm-modal-input">
            <option value="">Pilih action...</option>
            <option value="change_role">Ubah Role</option>
            <option value="change_status">Ubah Status</option>
            <option value="assign_department">Assign Departemen</option>
            <option value="delete">Hapus User</option>
          </select>
        </FormField>
        {action === 'change_role' && (
          <FormField label="Role Baru *">
            <select value={value} onChange={(e) => setValue(e.target.value)} className="cm-modal-input">
              <option value="">Pilih role...</option>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
        )}
        {action === 'change_status' && (
          <FormField label="Status Baru *">
            <select value={value} onChange={(e) => setValue(e.target.value)} className="cm-modal-input">
              <option value="">Pilih status...</option>
              <option value="approved">Approved</option>
              <option value="suspended">Suspended</option>
            </select>
          </FormField>
        )}
        {action === 'assign_department' && (
          <FormField label="Departemen *">
            <select value={value} onChange={(e) => setValue(e.target.value)} className="cm-modal-input">
              <option value="">Pilih departemen...</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </FormField>
        )}
        {action === 'delete' && (
          <div className="alert alert-danger" style={{ marginBottom: 12 }}>
            <strong>⚠ Peringatan:</strong> {count} user akan dihapus permanen.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} className="cm-btn cm-btn-ghost">Batal</button>
          <button
            onClick={() => onSubmit(action, action === 'delete' ? 'confirm' : value)}
            disabled={isLoading || !action || (action !== 'delete' && !value)}
            className={`cm-btn ${action === 'delete' ? 'cm-btn-danger' : 'cm-btn-primary'}`}
          >
            {isLoading ? 'Memproses...' : 'Jalankan'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ═══════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
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