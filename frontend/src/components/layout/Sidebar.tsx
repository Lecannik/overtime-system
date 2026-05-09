import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, CheckSquare, BarChart3,
  ClipboardCheck, Users, User, LogOut, Network, Settings2, Briefcase, Zap,
  Moon, Sun
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ROLE_LABELS } from '../../constants/translations';

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  interface NavItem {
    path: string;
    label: string;
    icon: any;
  }

  const hasPermission = (perm: string) => {
    if (user?.role === 'admin') return true;
    return user?.permissions?.includes(perm);
  };

  const navItems: NavItem[] = [
    { path: '/dashboard', label: 'Рабочий стол', icon: LayoutDashboard },
  ];

  if (hasPermission('crm:leads:read') || hasPermission('crm:deals:read')) {
    navItems.push({ path: '/crm', label: 'CRM (Лиды/Сделки)', icon: Building2 });
    navItems.push({ path: '/counterparties', label: 'Контрагенты', icon: Users });
  }

  if (hasPermission('projects:read')) {
    navItems.push({ path: '/projects', label: 'Проекты', icon: Briefcase });
    navItems.push({ path: '/tasks', label: 'Задачи', icon: CheckSquare });
  }

  if (hasPermission('analytics:view')) {
    navItems.push({ path: '/analytics', label: 'Аналитика', icon: BarChart3 });
  }

  // Пункты для руководителей и админов
  if (user?.role === 'manager' || user?.role === 'head' || user?.role === 'admin' || hasPermission('projects:approve')) {
    navItems.push({ path: '/review', label: 'Согласование', icon: ClipboardCheck });
  }

  if (user?.role === 'admin' || hasPermission('admin:users:manage')) {
    navItems.push({ path: '/users', label: 'Команда', icon: Users });
  }

  if (user?.role === 'admin' || hasPermission('admin:org:manage')) {
    navItems.push({ path: '/admin/org', label: 'Оргструктура', icon: Network });
  }

  if (user?.role === 'admin' || hasPermission('admin:settings:edit')) {
    navItems.push({ path: '/admin/bpm', label: 'Автоматизация', icon: Zap });
    navItems.push({ path: '/admin/settings', label: 'Настройки системы', icon: Settings2 });
  }

  return (
    <div style={{
      width: '280px',
      height: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 16px',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 100
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px', padding: '0 8px' }}>
        <div style={{ width: '40px', height: '40px', background: 'var(--accent)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>
          OP
        </div>
        <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Overtime Pro</span>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                border: 'none',
                background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                fontWeight: isActive ? 700 : 500
              }}
            >
              <item.icon size={20} color={isActive ? 'var(--accent)' : 'var(--text-muted)'} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User Footer */}
      <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={toggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            background: 'rgba(59, 130, 246, 0.05)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            textAlign: 'left',
            marginBottom: '8px'
          }}
        >
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
            {theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
          </div>
        </button>

        <button
          onClick={() => navigate('/profile')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            background: location.pathname === '/profile' ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={18} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user?.full_name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {ROLE_LABELS[user?.role || 'employee'] || user?.role}
            </div>
          </div>
        </button>

        <button
          onClick={logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            background: 'transparent',
            color: '#ef4444',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: 600
          }}
        >
          <LogOut size={20} />
          Выйти
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
