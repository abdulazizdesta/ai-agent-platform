import { useMutation } from '@tanstack/react-query';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { AuthResponse } from '../types';

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
  department_id: number;
}

interface RequestAccessResponse {
  message: string;
  expires_at: string;
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const { data } = await api.post<AuthResponse>('/auth/login', payload);
      return data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.organization, data.department, data.role, data.token);
    },
  });
}

export function useRequestAccess() {
  return useMutation({
    mutationFn: async (payload: RequestAccessPayload) => {
      const { data } = await api.post<RequestAccessResponse>('/auth/request-access', payload);
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
    },
  });
}