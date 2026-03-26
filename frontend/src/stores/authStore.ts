import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Organization, Department, Role } from '../types';

interface AuthState {
  user: User | null;
  org: Organization | null;
  department: Department | null;
  role: Role | null;
  token: string | null;

  setAuth: (user: User, org: Organization, department: Department | null, role: Role, token: string) => void;
  updateUser: (partial: Partial<User>) => void;
  switchOrg: (org: Organization, role: Role) => void;
  switchDepartment: (department: Department | null) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
  hasAccess: (minRole: Role) => boolean;
}

const ROLE_LEVEL: Record<Role, number> = {
  viewer: 1,
  agent: 2,
  admin: 3,
  superadmin: 4,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      org: null,
      department: null,
      role: null,
      token: null,

      setAuth: (user, org, department, role, token) =>
        set({ user, org, department, role, token }),

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      switchOrg: (org, role) => set({ org, role }),

      switchDepartment: (department) => set({ department }),

      logout: () =>
        set({ user: null, org: null, department: null, role: null, token: null }),

      isAuthenticated: () => !!get().token,

      isSuperAdmin: () => get().role === 'superadmin',

      isAdmin: () => get().role === 'admin' || get().role === 'superadmin',

      hasAccess: (minRole) => {
        const currentRole = get().role;
        if (!currentRole) return false;
        return ROLE_LEVEL[currentRole] >= ROLE_LEVEL[minRole];
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        org: state.org,
        department: state.department,
        role: state.role,
        token: state.token,
      }),
    }
  )
);