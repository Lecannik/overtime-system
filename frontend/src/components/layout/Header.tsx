import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, LogOut, Sun, Moon, BarChart2, CheckSquare, Settings, LayoutDashboard } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface HeaderProps {
    user: any;
}

const Logo: React.FC = () => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px' }}>
            <div style={{ width: '10px', height: '10px', background: '#dc2626', borderRadius: '3px' }}></div>
            <div style={{ width: '10px', height: '10px', background: '#16a34a', borderRadius: '3px' }}></div>
            <div style={{ width: '10px', height: '10px', background: '#1e40af', borderRadius: '3px' }}></div>
            <div style={{ width: '10px', height: '10px', background: '#dc2626', borderRadius: '3px' }}></div>
        </div>
        <span style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Overtime<span style={{ color: 'var(--accent)' }}>Pro</span></span>
    </div>
);

const Header: React.FC<HeaderProps> = ({ user }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { theme, toggleTheme } = useTheme();

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    if (!user) return null;

    const ROLE_LABELS: Record<string, string> = {
        admin: 'Администратор',
        head: 'Руководитель',
        manager: 'Менеджер',
        employee: 'Сотрудник'
    };

    const NavButton = ({ onClick, children, path, icon: Icon }: any) => {
        const isActive = location.pathname === path;
        return (
            <button
                onClick={onClick}
                style={{
                    padding: '10px 18px',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    border: 'none',
                    background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    transition: 'all 0.2s',
                    position: 'relative'
                }}
            >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {children}
                {isActive && (
                    <div style={{
                        position: 'absolute', bottom: '0', left: '20%', right: '20%',
                        height: '3px', background: 'var(--accent)', borderRadius: '10px 10px 0 0'
                    }}></div>
                )}
            </button>
        );
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '48px',
            paddingBottom: '28px',
            borderBottom: '1px solid var(--border)',
            paddingTop: '8px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
                <div
                    onClick={() => !user.must_change_password && navigate('/dashboard')}
                    style={{ cursor: user.must_change_password ? 'default' : 'pointer' }}
                >
                    <Logo />
                </div>

                {!user.must_change_password && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <NavButton icon={LayoutDashboard} path="/dashboard" onClick={() => navigate('/dashboard')}>Главная</NavButton>
                        <NavButton icon={BarChart2} path="/analytics" onClick={() => navigate('/analytics')}>Аналитика</NavButton>
                        <NavButton icon={CheckSquare} path="/review" onClick={() => navigate('/review')}>Согласование</NavButton>
                        {user.role === 'admin' && (
                            <NavButton icon={Settings} path="/users" onClick={() => navigate('/users')}>Управление</NavButton>
                        )}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* User Context Info */}
                <div style={{ textAlign: 'right', marginRight: '16px' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{user.full_name || user.email}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {ROLE_LABELS[user.role]}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-secondary)', padding: '6px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <button onClick={toggleTheme} style={{
                        width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none', background: 'var(--bg-primary)',
                        color: 'var(--text-primary)', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    </button>

                    <button onClick={() => navigate('/profile')} style={{
                        width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none', background: location.pathname === '/profile' ? 'var(--accent)' : 'var(--bg-primary)',
                        color: location.pathname === '/profile' ? 'white' : 'var(--text-primary)', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                        <User size={20} />
                    </button>

                    <button onClick={handleLogout} style={{
                        width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none', background: 'var(--bg-primary)',
                        color: 'var(--danger)', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                        <LogOut size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Header;
