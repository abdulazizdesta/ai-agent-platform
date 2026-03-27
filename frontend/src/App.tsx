import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedRoute from './pages/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from '././pages/auth/LoginPage';
import RegisterPage from '././pages/auth/RegisterPage';
import DashboardPage from '././pages/dashboard/DashboardPage';
import UsersPage from './pages/masters/users/UsersPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/inbox" element={<Placeholder title="Inbox" icon="chat" />} />
              <Route path="/contacts" element={<Placeholder title="Contacts" icon="contacts" />} />
              <Route path="/campaigns" element={<Placeholder title="Campaigns" icon="campaign" />} />
              <Route path="/agents" element={<Placeholder title="AI Agents" icon="smart_toy" />} />
              <Route path="/settings" element={<Placeholder title="Settings" icon="settings" />} />

              {/* Masters — superadmin only */}
              <Route element={<ProtectedRoute minRole="superadmin" />}>
                <Route path="/masters/users" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>

          {/* Redirect root */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// Temporary placeholder for routes not yet built
function Placeholder({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <span className="material-symbols-rounded neu-text-secondary" style={{ fontSize: '64px' }}>
          {icon}
        </span>
        <h2 className="mt-4 text-xl font-semibold neu-text-primary">{title}</h2>
        <p className="mt-2 text-sm neu-text-secondary">
          Coming soon — this page is on the Sprint Board!
        </p>
      </div>
    </div>
  );
}