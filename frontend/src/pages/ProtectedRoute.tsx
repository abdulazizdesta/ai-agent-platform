import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { Role } from '../types';

interface ProtectedRouteProps {
  minRole?: Role;
}

export default function ProtectedRoute({ minRole }: ProtectedRouteProps) {
  const token = useAuthStore((s) => s.token);
  const hasAccess = useAuthStore((s) => s.hasAccess);

  // Not logged in → redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but insufficient role → redirect to dashboard with message
  if (minRole && !hasAccess(minRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}