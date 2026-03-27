import { useMutation } from '@tanstack/react-query';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { Role } from '../types';

// ──────────────────────────────────────────
// Payloads
// ──────────────────────────────────────────

interface LoginPayload {
  username: string;
  password: string;
}

interface RequestAccessPayload {
  name: string;
  username: string;
  employee_id: string;
  phone: string;
  email?: string;
  password: string;
  password_confirmation: string;
  organization_id: number;
  department_id?: number;
}

// ──────────────────────────────────────────
// Backend Response Types
// ──────────────────────────────────────────

interface LoginResponse {
  message: string;
  token: string;
  user: {
    id: number;
    name: string;
    username: string;
    employee_id: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    role: Role;
    status: string;
    organization: {
      id: number;
      name: string;
      slug: string;
    } | null;
    department: {
      id: number;
      name: string;
    } | null;
  };
}

interface RequestAccessResponse {
  message: string;
  request: {
    id: number;
    name: string;
    username: string;
    status: string;
    expires_at: string;
  };
}

// ──────────────────────────────────────────
// Hooks
// ──────────────────────────────────────────

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const { data } = await api.post<LoginResponse>('/auth/login', payload);
      return data;
    },
    onSuccess: (data) => {
      const { user, token } = data;

      setAuth(
        user as any,               // User object
        user.organization as any,  // Organization (nested in user)
        user.department as any,    // Department (nested in user)
        user.role,                 // Role
        token                      // Sanctum token
      );
    },
  });
}

export function useRequestAccess() {
  return useMutation({
    mutationFn: async (payload: RequestAccessPayload) => {
      const { data } = await api.post<RequestAccessResponse>(
        '/auth/request-access',
        payload
      );
      return data;
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSettled: () => {
      logout();
      window.location.href = '/login';
    },
  });
}