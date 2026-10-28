import { Activity, BarChart3, BrainCircuit, ChevronDown, Clock3, Gauge, History, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings, X } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui';

const navItems = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/predictions', label: 'AI Predictions', icon: BrainCircuit },
  { to: '/app/resolution-time', label: 'Resolution Time', icon: Clock3 },
  { to: '/app/models', label: 'Model Center', icon: Gauge },
  { to: '/app/history', label: 'Prediction History', icon: History },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

const pageNames: Record<string, string> = { '/app': 'Overview', '/app/predictions': 'AI Predictions', '/app/resolution-time': 'Resolution Time', '/app/models': 'Model Center', '/app/history': 'Prediction History', '/app/analytics': 'Analytics', '/app/settings': 'Settings', '/app/operational-risk': 'Operational Risk', '/app/workload-forecasting': 'Workload Forecasting' };

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const pageName = pageNames[location.pathname] ?? 'Workspace';
  const initials = user?.name.split(' ').map((name) => name[0]).slice(0, 2).join('').toUpperCase() ?? 'OP';

  async function handleLogout() { await logout(); navigate('/login'); }

  return <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <div className={`mobile-overlay ${mobileOpen ? 'show' : ''}`} onClick={() => setMobileOpen(false)} />
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-top"><Logo compact={collapsed} /><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="workspace-switcher"><span className="workspace-avatar">O</span>{!collapsed && <span><small>Workspace</small><strong>Operations team</strong></span>}{!collapsed && <ChevronDown size={15} />}</div>
      <nav className="sidebar-nav" aria-label="Application navigation">
        <span className="nav-caption">Command center</span>
        {navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={collapsed ? label : undefined}><Icon size={18} /><span>{!collapsed && label}</span></NavLink>)}
        <span className="nav-caption nav-caption-spaced">Intelligence</span>
        <NavLink to="/app/operational-risk" onClick={() => setMobileOpen(false)} className="nav-item nav-muted"><Activity size={18} /><span>{!collapsed && 'Operational Risk'}{!collapsed && <small>Soon</small>}</span></NavLink>
        <NavLink to="/app/workload-forecasting" onClick={() => setMobileOpen(false)} className="nav-item nav-muted"><Gauge size={18} /><span>{!collapsed && 'Workload Forecasting'}{!collapsed && <small>Soon</small>}</span></NavLink>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-status"><span className="pulse-dot" />{!collapsed && <span>Model services monitored</span>}</div><button className="nav-item logout-item" onClick={handleLogout} title="Log out"><LogOut size={18} />{!collapsed && <span>Log out</span>}</button></div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="topbar-context"><div className="breadcrumb"><span>OpsPilot AI</span><span className="slash">/</span><strong>{pageName}</strong></div><p>{pageName === 'Overview' ? 'Your operational signal, at a glance.' : 'Turn signal into a more decisive next step.'}</p></div><div className="topbar-actions"><ThemeToggle /><button className="collapse-button icon-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button><button className="profile-chip" onClick={() => navigate('/app/settings')}><span className="avatar">{initials}</span><span className="profile-copy"><strong>{user?.name}</strong><small>{user?.email}</small></span><ChevronDown size={15} /></button></div></header>
      <div className="content-wrap"><Outlet /></div>
    </main>
  </div>;
}
