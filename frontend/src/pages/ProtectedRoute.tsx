import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

// import { Outlet } from 'react-router-dom';

// export default function ProtectedRoute() {
//   // TEMPORARY: bypass auth check untuk preview
//   return <Outlet />;
// }