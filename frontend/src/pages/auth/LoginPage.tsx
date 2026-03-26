import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLogin } from '../../hooks/useAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { mutate: login, isPending, error } = useLogin();
  const [form, setForm] = useState({ username: '', password: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(form, { onSuccess: () => navigate('/dashboard') });
  };

  const apiError = error?.response?.data as { message?: string } | undefined;

  return (
    <div className="min-h-screen flex items-center justify-center app-bg px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="icon-box icon-box-lg mx-auto" style={{ background: 'var(--accent-light)' }}>
            <span className="material-symbols-rounded text-accent" style={{ fontSize: '28px' }}>robot_2</span>
          </div>
          <h1 className="mt-6 text-2xl font-bold text-primary heading">Welcome back</h1>
          <p className="mt-2 text-sm text-secondary">Sign in to AI Agent Management</p>
        </div>

        {/* Card */}
        <div className="card p-6 sm:p-8">
          {apiError?.message && (
            <div className="alert alert-danger mb-6 flex items-center gap-2 text-sm font-medium">
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>error</span>
              {apiError.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-2 text-primary">Username / Employee ID</label>
              <div className="input-wrapper">
                <span className="input-icon-left material-symbols-rounded">badge</span>
                <input type="text" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="input input-icon" placeholder="e.g. BUD001" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-primary">Password</label>
              <div className="input-wrapper">
                <span className="input-icon-left material-symbols-rounded">lock</span>
                <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input input-icon" placeholder="••••••••" />
              </div>
            </div>

            <button type="submit" disabled={isPending} className="btn btn-primary w-full py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed">
              {isPending ? (
                <><span className="material-symbols-rounded animate-spin" style={{ fontSize: '18px' }}>progress_activity</span>Signing in...</>
              ) : (
                <><span className="material-symbols-rounded" style={{ fontSize: '18px' }}>login</span>Sign in</>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-secondary">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-accent hover:opacity-80 transition-opacity">Create one</Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-tertiary">AI Agent Management Platform v1.0</p>
      </div>
    </div>
  );
}