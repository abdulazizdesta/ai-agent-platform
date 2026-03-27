import { useAuthStore } from '../../stores/authStore';

const stats = [
  { label: 'Active Chats', value: '—', icon: 'chat', gradient: 'stat-tosca' },
  { label: 'Contacts', value: '—', icon: 'contacts', gradient: 'stat-blue' },
  { label: 'Campaigns', value: '—', icon: 'campaign', gradient: 'stat-purple' },
  { label: 'AI Agents', value: '—', icon: 'smart_toy', gradient: 'stat-pink' },
  { label: 'Masters', icon: 'database', children: [
    { label: 'Users', path: '/masters/users', icon: 'group' },
    
  ]},
];

const quickActions = [
  { label: 'New Broadcast', desc: 'Send to contacts via WhatsApp', icon: 'campaign' },
  { label: 'Create Survey', desc: 'Collect feedback from contacts', icon: 'quiz' },
  { label: 'Configure Agent', desc: 'Set up or edit AI agents', icon: 'smart_toy' },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const org = useAuthStore((s) => s.org);
  const department = useAuthStore((s) => s.department);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-primary heading">
          Welcome back, {user?.name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Here's what's happening at {org?.name ?? 'your org'}
          {department && <> · {department.name}</>} today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className={`stat-card ${stat.gradient}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>{stat.icon}</span>
              <span className="text-xs font-medium opacity-90 hidden sm:block">{stat.label}</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{stat.value}</p>
            <span className="text-xs opacity-80 sm:hidden">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-primary heading mb-4 flex items-center gap-2">
          <span className="material-symbols-rounded text-accent" style={{ fontSize: '22px' }}>bolt</span>
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {quickActions.map((action) => (
            <button key={action.label} className="card card-hover flex items-center gap-4 p-4 sm:p-5 text-left">
              <div className="icon-box icon-box-sm flex-shrink-0" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>{action.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-primary">{action.label}</p>
                <p className="text-xs text-secondary mt-0.5 hidden sm:block">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-primary heading mb-4 flex items-center gap-2">
          <span className="material-symbols-rounded text-accent" style={{ fontSize: '22px' }}>history</span>
          Recent Activity
        </h2>
        <div className="card p-6 sm:p-8 text-center">
          <span className="material-symbols-rounded text-tertiary" style={{ fontSize: '48px' }}>inbox</span>
          <p className="mt-3 text-sm text-secondary">
            No recent activity yet. Start by creating your first broadcast or configuring an AI agent.
          </p>
        </div>
      </div>
    </div>
  );
}