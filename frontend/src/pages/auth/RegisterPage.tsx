import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRequestAccess } from '../../hooks/useAuth';

const organizations = [
  { id: 1, name: 'PT Maju Jaya' },
];

const departments = [
  { id: 1, name: 'Customer Service', org_id: 1 },
  { id: 2, name: 'Sales', org_id: 1 },
  { id: 3, name: 'HR', org_id: 1 },
  { id: 4, name: 'Marketing', org_id: 1 },
];

export default function RegisterPage() {
  const { mutate: requestAccess, isPending, isSuccess, data, error } = useRequestAccess();
  const [form, setForm] = useState({
    name: '',
    username: '',
    employee_id: '',
    phone: '',
    email: '',
    password: '',
    password_confirmation: '',
    organization_id: 0,
    department_id: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestAccess(form);
  };

  const apiError = error?.response?.data as {
    message?: string;
    errors?: Record<string, string[]>;
  } | undefined;

  const filteredDepts = departments.filter(
    (d) => d.org_id === form.organization_id
  );

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center app-bg px-4">
        <div className="w-full max-w-md text-center">
          <div className="card p-8">
            <div className="icon-box icon-box-lg mx-auto" style={{ background: 'var(--success)', borderRadius: '50%' }}>
              <span className="material-symbols-rounded text-white" style={{ fontSize: '28px' }}>
                check_circle
              </span>
            </div>
            <h1 className="mt-6 text-xl font-bold text-primary heading">
              Request Submitted!
            </h1>
            <p className="mt-3 text-sm text-secondary leading-relaxed">
              Your access request has been sent to the administrator.
              You'll be able to login once your request is approved.
            </p>
            <div className="mt-4 alert alert-info flex items-center justify-center gap-2">
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                schedule
              </span>
              <span className="text-sm">Expires in 24 hours</span>
            </div>
            <Link
              to="/login"
              className="btn btn-primary inline-flex items-center gap-2 mt-6 text-sm"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                arrow_back
              </span>
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center app-bg px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="icon-box icon-box-lg mx-auto" style={{ background: 'var(--accent-light)' }}>
            <span className="material-symbols-rounded text-accent" style={{ fontSize: '28px' }}>
              person_add
            </span>
          </div>
          <h1 className="mt-6 text-2xl font-bold text-primary heading">
            Request Access
          </h1>
          <p className="mt-2 text-sm text-secondary">
            Fill in your details. A superadmin will review your request within 24 hours.
          </p>
        </div>

        {/* Form Card */}
        <div className="card p-6 sm:p-8">
          {apiError?.message && (
            <div className="alert alert-danger mb-6 flex items-center gap-2 text-sm font-medium">
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                error
              </span>
              {apiError.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-primary">
                Full Name
              </label>
              <div className="input-wrapper">
                <span className="input-icon-left material-symbols-rounded">person</span>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input input-icon"
                  placeholder="Budi Santoso"
                />
              </div>
            </div>

            {/* Username + Employee ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-primary">
                  Username
                </label>
                <div className="input-wrapper">
                  <span className="input-icon-left material-symbols-rounded">alternate_email</span>
                  <input
                    type="text"
                    required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="input input-icon"
                    placeholder="BUD001"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-primary">
                  Employee ID
                </label>
                <div className="input-wrapper">
                  <span className="input-icon-left material-symbols-rounded">badge</span>
                  <input
                    type="text"
                    required
                    value={form.employee_id}
                    onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                    className="input input-icon"
                    placeholder="EMP-2847"
                  />
                </div>
              </div>
            </div>

            {/* Phone + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-primary">
                  Phone Number
                </label>
                <div className="input-wrapper">
                  <span className="input-icon-left material-symbols-rounded">phone</span>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="input input-icon"
                    placeholder="08123456789"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-primary">
                  Email <span className="font-normal text-secondary">(optional)</span>
                </label>
                <div className="input-wrapper">
                  <span className="input-icon-left material-symbols-rounded">mail</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input input-icon"
                    placeholder="budi@company.com"
                  />
                </div>
              </div>
            </div>

            {/* Organization + Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-primary">
                  Organization
                </label>
                <div className="input-wrapper">
                  <span className="input-icon-left material-symbols-rounded">business</span>
                  <select
                    required
                    value={form.organization_id}
                    onChange={(e) => setForm({
                      ...form,
                      organization_id: Number(e.target.value),
                      department_id: 0,
                    })}
                    className="input input-icon appearance-none"
                  >
                    <option value={0} disabled>Select org</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-primary">
                  Department
                </label>
                <div className="input-wrapper">
                  <span className="input-icon-left material-symbols-rounded">groups</span>
                  <select
                    required
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: Number(e.target.value) })}
                    className="input input-icon appearance-none"
                    disabled={form.organization_id === 0}
                  >
                    <option value={0} disabled>
                      {form.organization_id === 0 ? 'Select org first' : 'Select dept'}
                    </option>
                    {filteredDepts.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-primary">
                  Password
                </label>
                <div className="input-wrapper">
                  <span className="input-icon-left material-symbols-rounded">lock</span>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="input input-icon"
                    placeholder="Min 8 characters"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-primary">
                  Confirm Password
                </label>
                <div className="input-wrapper">
                  <span className="input-icon-left material-symbols-rounded">lock_reset</span>
                  <input
                    type="password"
                    required
                    value={form.password_confirmation}
                    onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })}
                    className="input input-icon"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="alert alert-info">
              <div className="flex gap-3">
                <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                  info
                </span>
                <p className="text-xs leading-relaxed">
                  Your request will be reviewed by an administrator within 24 hours.
                  You'll be able to login once approved. Access permissions will be
                  assigned by the superadmin.
                </p>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="btn btn-primary w-full py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <span className="material-symbols-rounded animate-spin" style={{ fontSize: '18px' }}>
                    progress_activity
                  </span>
                  Submitting...
                </>
              ) : (
                <>
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                    send
                  </span>
                  Submit Request
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <p className="mt-6 text-center text-sm text-secondary">
            Already have access?{' '}
            <Link
              to="/login"
              className="font-semibold text-accent hover:opacity-80 transition-opacity"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}