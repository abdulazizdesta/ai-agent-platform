import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

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

const ROLES = ['superadmin', 'admin', 'agent', 'viewer'];
const STATUSES = ['approved', 'suspended', 'pending'];
const ASSIGNABLE_ROLES = ['admin', 'agent', 'viewer'];

// ─── Main Component ──────────────────────────────────────
export default function UsersPage() {
  const queryClient = useQueryClient();

  // State
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    role: '',
    status: '',
    department_id: '',
    city: '',
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [modal, setModal] = useState<'add' | 'edit' | 'reset-password' | 'bulk' | null>(null);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 400);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, filters.role, filters.status, filters.department_id, filters.city, perPage]);

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
    queryFn: async () => {
      const { data } = await api.get('/lookup/departments');
      return data;
    },
  });

  const organizationsQuery = useQuery<LookupItem[]>({
    queryKey: ['lookup-organizations'],
    queryFn: async () => {
      const { data } = await api.get('/lookup/organizations');
      return data;
    },
  });

  // ─── Mutations ───────────────────────────────────────
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const createUser = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/users', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModal(null);
      showToast('success', res.data.message);
    },
    onError: (err: any) => {
      showToast('error', err.response?.data?.message || 'Gagal menambahkan user.');
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, ...payload }: Record<string, unknown>) => api.put(`/users/${id}`, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModal(null);
      setEditingUser(null);
      showToast('success', res.data.message);
    },
    onError: (err: any) => {
      showToast('error', err.response?.data?.message || 'Gagal mengupdate user.');
    },
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('success', res.data.message);
    },
    onError: (err: any) => {
      showToast('error', err.response?.data?.message || 'Gagal menghapus user.');
    },
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, ...payload }: Record<string, unknown>) => api.post(`/users/${id}/reset-password`, payload),
    onSuccess: (res) => {
      setModal(null);
      setEditingUser(null);
      showToast('success', res.data.message);
    },
    onError: (err: any) => {
      showToast('error', err.response?.data?.message || 'Gagal mereset password.');
    },
  });

  const bulkAction = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/users/bulk-action', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedIds([]);
      setModal(null);
      showToast('success', res.data.message);
    },
    onError: (err: any) => {
      showToast('error', err.response?.data?.message || 'Gagal menjalankan bulk action.');
    },
  });

  // ─── Helpers ─────────────────────────────────────────
  const users = usersQuery.data?.data || [];
  const totalPages = usersQuery.data?.last_page || 1;
  const totalUsers = usersQuery.data?.total || 0;

  const toggleSelectAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map((u) => u.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      superadmin: 'var(--badge-superadmin, #7c3aed)',
      admin: 'var(--badge-admin, #2563eb)',
      agent: 'var(--badge-agent, #0891b2)',
      viewer: 'var(--badge-viewer, #6b7280)',
    };
    return { backgroundColor: colors[role] || '#6b7280', color: '#fff' };
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      approved: '#059669',
      suspended: '#dc2626',
      pending: '#d97706',
    };
    return { backgroundColor: colors[status] || '#6b7280', color: '#fff' };
  };

  // ─── Render ──────────────────────────────────────────
  return (
    <div style={{ padding: '0' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999, padding: '12px 20px',
          borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500,
          backgroundColor: toast.type === 'success' ? '#059669' : '#dc2626',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', animation: 'slideIn 0.3s ease',
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Users Management</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary, #6b7280)', margin: '4px 0 0' }}>
            {totalUsers} total users
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selectedIds.length > 0 && (
            <button onClick={() => setModal('bulk')} style={btnStyle('warning')}>
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>checklist</span>
              Bulk Action ({selectedIds.length})
            </button>
          )}
          <button onClick={() => { setEditingUser(null); setModal('add'); }} style={btnStyle('primary')}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>person_add</span>
            Tambah User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 10, marginBottom: 20, padding: 16, borderRadius: 12,
        backgroundColor: 'var(--surface-secondary, #f8fafc)',
        border: '1px solid var(--border, #e2e8f0)',
      }}>
        <input
          type="text"
          placeholder="Cari nama, username, employee ID..."
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          style={{ ...inputStyle(), gridColumn: 'span 2' }}
        />
        <select value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))} style={inputStyle()}>
          <option value="">Semua Role</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={inputStyle()}>
          <option value="">Semua Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.department_id} onChange={(e) => setFilters((f) => ({ ...f, department_id: e.target.value }))} style={inputStyle()}>
          <option value="">Semua Department</option>
          {(departmentsQuery.data || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input
          type="text"
          placeholder="Filter kota..."
          value={filters.city}
          onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
          style={inputStyle()}
        />
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border, #e2e8f0)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-secondary, #f8fafc)' }}>
              <th style={thStyle()}>
                <input type="checkbox" checked={selectedIds.length === users.length && users.length > 0} onChange={toggleSelectAll} />
              </th>
              <th style={thStyle()}>Nama</th>
              <th style={thStyle()}>Username</th>
              <th style={thStyle()}>Employee ID</th>
              <th style={thStyle()}>Kota</th>
              <th style={thStyle()}>Role</th>
              <th style={thStyle()}>Departemen</th>
              <th style={thStyle()}>Status</th>
              <th style={thStyle()}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} style={tdStyle()}>
                      <div style={{ height: 16, borderRadius: 4, backgroundColor: 'var(--border, #e2e8f0)', animation: 'pulse 1.5s infinite' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...tdStyle(), textAlign: 'center', padding: 48, color: 'var(--text-secondary, #6b7280)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 48, display: 'block', marginBottom: 8, opacity: 0.3 }}>group_off</span>
                  Tidak ada user ditemukan.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} style={{
                  backgroundColor: selectedIds.includes(user.id) ? 'var(--surface-selected, #eff6ff)' : 'transparent',
                  transition: 'background 0.15s',
                }}>
                  <td style={tdStyle()}>
                    <input type="checkbox" checked={selectedIds.includes(user.id)} onChange={() => toggleSelect(user.id)} />
                  </td>
                  <td style={tdStyle()}>
                    <div style={{ fontWeight: 600 }}>{user.name}</div>
                    {user.email && <div style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>{user.email}</div>}
                  </td>
                  <td style={tdStyle()}>{user.username}</td>
                  <td style={{ ...tdStyle(), fontFamily: 'monospace', fontSize: 13 }}>{user.employee_id}</td>
                  <td style={tdStyle()}>{user.city || '—'}</td>
                  <td style={tdStyle()}>
                    <span style={{ ...badgeStyle(), ...roleBadge(user.role) }}>{user.role}</span>
                  </td>
                  <td style={tdStyle()}>{user.department?.name || '—'}</td>
                  <td style={tdStyle()}>
                    <span style={{ ...badgeStyle(), ...statusBadge(user.status) }}>{user.status}</span>
                  </td>
                  <td style={tdStyle()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setEditingUser(user); setModal('edit'); }} style={iconBtnStyle()} title="Edit">
                        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>edit</span>
                      </button>
                      <button onClick={() => { setEditingUser(user); setModal('reset-password'); }} style={iconBtnStyle()} title="Reset Password">
                        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>lock_reset</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Hapus user "${user.name}"?`)) deleteUser.mutate(user.id);
                        }}
                        style={{ ...iconBtnStyle(), color: '#dc2626' }}
                        title="Delete"
                      >
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
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 16, flexWrap: 'wrap', gap: 12, fontSize: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text-secondary, #6b7280)' }}>Rows per page:</span>
          <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} style={{ ...inputStyle(), width: 'auto' }}>
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text-secondary, #6b7280)' }}>
            Page {page} of {totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={paginationBtnStyle()}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_left</span>
          </button>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={paginationBtnStyle()}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_right</span>
          </button>
        </div>
      </div>

      {/* ─── Modals ─── */}
      {(modal === 'add' || modal === 'edit') && (
        <UserFormModal
          user={modal === 'edit' ? editingUser : null}
          organizations={organizationsQuery.data || []}
          departments={departmentsQuery.data || []}
          onClose={() => { setModal(null); setEditingUser(null); }}
          onSubmit={(data) => {
            if (modal === 'edit' && editingUser) {
              updateUser.mutate({ id: editingUser.id, ...data });
            } else {
              createUser.mutate(data);
            }
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

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ─── User Form Modal ──────────────────────────────────────
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
      <div style={modalStyle()}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
          {isEdit ? 'Edit User' : 'Tambah User'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Nama Lengkap *" span={2}>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle()} />
          </FormField>
          <FormField label="Username *">
            <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} style={inputStyle()} disabled={isEdit} />
          </FormField>
          <FormField label="Employee ID *">
            <input value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} style={inputStyle()} />
          </FormField>
          {!isEdit && (
            <FormField label="Password *" span={2}>
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} style={inputStyle()} placeholder="Min 8 karakter" />
            </FormField>
          )}
          <FormField label="Email">
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={inputStyle()} />
          </FormField>
          <FormField label="Telepon">
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={inputStyle()} />
          </FormField>
          <FormField label="Kota / Cabang">
            <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} style={inputStyle()} />
          </FormField>
          <FormField label="Role *">
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} style={inputStyle()}>
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
          <FormField label="Organisasi *">
            <select value={form.organization_id} onChange={(e) => setForm((f) => ({ ...f, organization_id: e.target.value, department_id: '' }))} style={inputStyle()}>
              <option value="">Pilih organisasi...</option>
              {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </FormField>
          <FormField label="Departemen">
            <select value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))} style={inputStyle()}>
              <option value="">Pilih departemen...</option>
              {filteredDepts.map((d) => <option key={d.id} value={d.id}>{d.name}{d.city ? ` (${d.city})` : ''}</option>)}
            </select>
          </FormField>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={btnStyle('ghost')}>Batal</button>
          <button onClick={handleSubmit} disabled={isLoading} style={btnStyle('primary')}>
            {isLoading ? 'Menyimpan...' : (isEdit ? 'Update' : 'Simpan')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Reset Password Modal ────────────────────────────────
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
      <div style={{ ...modalStyle(), maxWidth: 400 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Reset Password</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #6b7280)', marginBottom: 20 }}>
          Reset password untuk <strong>{user.name}</strong> ({user.username})
        </p>
        <FormField label="Password Baru *">
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={inputStyle()} placeholder="Min 8 karakter" />
        </FormField>
        <FormField label="Konfirmasi Password *">
          <input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} style={inputStyle()} />
        </FormField>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={btnStyle('ghost')}>Batal</button>
          <button
            onClick={() => onSubmit({ password: pw, password_confirmation: pwConfirm })}
            disabled={isLoading || !pw || pw !== pwConfirm || pw.length < 8}
            style={btnStyle('primary')}
          >
            {isLoading ? 'Mereset...' : 'Reset Password'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Bulk Action Modal ───────────────────────────────────
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
      <div style={{ ...modalStyle(), maxWidth: 420 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Bulk Action</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #6b7280)', marginBottom: 20 }}>
          {count} user dipilih
        </p>
        <FormField label="Action *">
          <select value={action} onChange={(e) => { setAction(e.target.value); setValue(''); }} style={inputStyle()}>
            <option value="">Pilih action...</option>
            <option value="change_role">Ubah Role</option>
            <option value="change_status">Ubah Status</option>
            <option value="assign_department">Assign Departemen</option>
            <option value="delete">Hapus User</option>
          </select>
        </FormField>
        {action === 'change_role' && (
          <FormField label="Role Baru *">
            <select value={value} onChange={(e) => setValue(e.target.value)} style={inputStyle()}>
              <option value="">Pilih role...</option>
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
        )}
        {action === 'change_status' && (
          <FormField label="Status Baru *">
            <select value={value} onChange={(e) => setValue(e.target.value)} style={inputStyle()}>
              <option value="">Pilih status...</option>
              <option value="approved">Approved</option>
              <option value="suspended">Suspended</option>
            </select>
          </FormField>
        )}
        {action === 'assign_department' && (
          <FormField label="Departemen *">
            <select value={value} onChange={(e) => setValue(e.target.value)} style={inputStyle()}>
              <option value="">Pilih departemen...</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </FormField>
        )}
        {action === 'delete' && (
          <div style={{
            padding: 12, borderRadius: 8, backgroundColor: '#fef2f2',
            border: '1px solid #fecaca', color: '#991b1b', fontSize: 14, marginBottom: 12,
          }}>
            <strong>⚠ Peringatan:</strong> {count} user akan dihapus permanen. Aksi ini tidak bisa dibatalkan.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={btnStyle('ghost')}>Batal</button>
          <button
            onClick={() => onSubmit(action, action === 'delete' ? 'confirm' : value)}
            disabled={isLoading || !action || (action !== 'delete' && !value)}
            style={btnStyle(action === 'delete' ? 'danger' : 'primary')}
          >
            {isLoading ? 'Memproses...' : 'Jalankan'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Shared Components ───────────────────────────────────
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
        backgroundColor: 'rgba(0,0,0,0.5)', animation: 'fadeIn 0.2s ease',
      }}
    >
      <div style={{ animation: 'slideUp 0.3s ease' }}>{children}</div>
    </div>
  );
}

function FormField({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{ marginBottom: 4, gridColumn: span ? `span ${span}` : undefined }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary, #6b7280)', marginBottom: 4, display: 'block' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Style Helpers ───────────────────────────────────────
function inputStyle(): React.CSSProperties {
  return {
    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
    border: '1px solid var(--border, #e2e8f0)', outline: 'none',
    backgroundColor: 'var(--surface, #fff)', color: 'var(--text-primary, #1e293b)',
    boxSizing: 'border-box',
  };
}

function btnStyle(variant: 'primary' | 'ghost' | 'danger' | 'warning'): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none',
    transition: 'all 0.15s',
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { ...base, backgroundColor: 'var(--primary, #0891b2)', color: '#fff' },
    ghost: { ...base, backgroundColor: 'transparent', color: 'var(--text-primary, #1e293b)', border: '1px solid var(--border, #e2e8f0)' },
    danger: { ...base, backgroundColor: '#dc2626', color: '#fff' },
    warning: { ...base, backgroundColor: '#d97706', color: '#fff' },
  };
  return variants[variant] || base;
}

function thStyle(): React.CSSProperties {
  return {
    padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    color: 'var(--text-secondary, #6b7280)',
    borderBottom: '1px solid var(--border, #e2e8f0)',
  };
}

function tdStyle(): React.CSSProperties {
  return {
    padding: '10px 12px', borderBottom: '1px solid var(--border, #e2e8f0)',
    verticalAlign: 'middle',
  };
}

function badgeStyle(): React.CSSProperties {
  return {
    padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    display: 'inline-block', textTransform: 'capitalize',
  };
}

function iconBtnStyle(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
    backgroundColor: 'transparent', color: 'var(--text-secondary, #6b7280)',
    transition: 'all 0.15s',
  };
}

function modalStyle(): React.CSSProperties {
  return {
    backgroundColor: 'var(--surface, #fff)', borderRadius: 16, padding: 24,
    maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  };
}

function paginationBtnStyle(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)',
    cursor: 'pointer', backgroundColor: 'var(--surface, #fff)',
    color: 'var(--text-primary, #1e293b)',
  };
}