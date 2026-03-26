import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLogout } from '../../hooks/useAuth';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/inbox', label: 'Inbox', icon: 'chat' },
  { to: '/contacts', label: 'Contacts', icon: 'contacts' },
  { to: '/campaigns', label: 'Campaigns', icon: 'campaign' },
  { to: '/agents', label: 'AI Agents', icon: 'smart_toy' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

export default function DashboardLayout() {
  const user = useAuthStore((s) => s.user);
  const org = useAuthStore((s) => s.org);
  const department = useAuthStore((s) => s.department);
  const { theme, toggleTheme } = useThemeStore();
  const { mutate: logout } = useLogout();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => { setProfileOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 769) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentPageLabel = navItems.find(n => location.pathname.startsWith(n.to))?.label ?? 'Dashboard';

  const sidebarContent = (
    <div className="flex-1 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 mb-2">
        <div className="icon-box icon-box-sm" style={{ background: 'var(--accent-light)' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '20px', color: 'var(--accent)' }}>robot_2</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold truncate text-sm text-primary heading">{org?.name ?? 'AI Agent'}</p>
            {department && <p className="text-xs truncate text-tertiary">{department.name}</p>}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {({ isActive }) => (
              <div className={`nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center' : ''}`}>
                <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="flex h-screen app-bg">
      {/* Mobile Header */}
      <div
        className="mobile-header fixed top-0 left-0 right-0 z-30 items-center justify-between px-4 h-14"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
      >
        <button onClick={() => setMobileOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-lg" style={{ background: 'var(--bg-input)' }}>
          <span className="material-symbols-rounded text-primary" style={{ fontSize: '20px' }}>menu</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-accent" style={{ fontSize: '20px' }}>robot_2</span>
          <span className="font-bold text-sm text-primary heading">{org?.name ?? 'AI Agent'}</span>
        </div>
        {/* Mobile Profile */}
        <div className="relative">
          <button onClick={() => setProfileOpen(!profileOpen)} className="avatar avatar-sm text-xs">
            {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </button>
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-12 z-50 w-56 card p-2" style={{ boxShadow: 'var(--shadow-lg)' }}>
                <div className="px-3 py-2 mb-1">
                  <p className="text-sm font-semibold text-primary">{user?.name}</p>
                  <p className="text-xs text-tertiary">{user?.username}</p>
                </div>
                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-secondary hover:bg-[var(--bg-hover)]" style={{ background: 'transparent' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>notifications</span>
                  Notifications
                </button>
                <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-secondary hover:bg-[var(--bg-hover)]" style={{ background: 'transparent' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
                  {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                </button>
                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                <button
                  onClick={() => { logout(); setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-danger hover:bg-[var(--danger-light)]" style={{ background: 'transparent' }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>logout</span>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Overlay */}
      <div className={`overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />

      {/* Sidebar Desktop */}
      <aside
        className={`${collapsed ? 'w-20' : 'w-64'} flex-col hidden md:flex relative`}
        style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}
      >
        {sidebarContent}

        {/* Bottom: Theme Toggle */}
        <div className="px-3 pb-3">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-3'} py-2`}>
            <button onClick={toggleTheme} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: 'var(--bg-input)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
                {theme === 'light' ? 'dark_mode' : 'light_mode'}
              </span>
            </button>
            {!collapsed && (
              <span className="text-xs font-medium text-tertiary">
                {theme === 'light' ? 'Light' : 'Dark'} Mode
              </span>
            )}
          </div>
        </div>

        {/* Collapse Button — centered on border */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-1/2 -right-3 w-6 h-6 rounded-full flex items-center justify-center z-10"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            transform: 'translateY(-50%)',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </aside>

      {/* Sidebar Mobile */}
      <aside
        className={`mobile-sidebar w-72 flex flex-col md:hidden ${mobileOpen ? 'open' : ''}`}
        style={{ background: 'var(--bg-sidebar)' }}
      >
        <div className="flex justify-end p-3">
          <button onClick={() => setMobileOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-lg" style={{ background: 'var(--bg-input)' }}>
            <span className="material-symbols-rounded text-primary" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto mt-14 md:mt-0 flex flex-col">
        {/* Desktop Header */}
        <div
          className="hidden md:flex items-center justify-between px-6 h-14 flex-shrink-0"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="text-sm font-semibold text-primary heading">{currentPageLabel}</h2>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button className="w-9 h-9 flex items-center justify-center rounded-lg relative" style={{ background: 'var(--bg-input)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>notifications</span>
            </button>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                style={{ background: 'var(--bg-input)' }}
              >
                <div className="avatar avatar-sm text-xs">{user?.name?.charAt(0)?.toUpperCase() ?? 'U'}</div>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-medium text-primary leading-tight">{user?.name}</p>
                  <p className="text-xs text-tertiary leading-tight">{user?.username}</p>
                </div>
                <span className="material-symbols-rounded" style={{ fontSize: '16px', color: 'var(--text-tertiary)' }}>expand_more</span>
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-12 z-50 w-56 card p-2" style={{ boxShadow: 'var(--shadow-lg)' }}>
                    <div className="px-3 py-2 mb-1">
                      <p className="text-sm font-semibold text-primary">{user?.name}</p>
                      <p className="text-xs text-tertiary">{user?.username}</p>
                    </div>
                    <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-secondary hover:bg-[var(--bg-hover)]" style={{ background: 'transparent' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>person</span>
                      Profile
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-secondary hover:bg-[var(--bg-hover)]" style={{ background: 'transparent' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>notifications</span>
                      Notifications
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-secondary hover:bg-[var(--bg-hover)]" style={{ background: 'transparent' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>settings</span>
                      Settings
                    </button>
                    <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                    <button
                      onClick={() => { logout(); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-danger hover:bg-[var(--danger-light)]" style={{ background: 'transparent' }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>logout</span>
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}