import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: 'https://ai-agent-platform-production-a259.up.railway.app/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

// Setiap request → otomatis tambahin token + org header
api.interceptors.request.use((config) => {
  const { token, org } = useAuthStore.getState();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (org) {
    config.headers['X-Organization-Id'] = String(org.id);
  }

  return config;
});

// Setiap response error 401 → otomatis logout + redirect ke login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error); // lempar pesan error ke fungsi yg dijalankan
  }
);

export default api;