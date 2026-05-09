import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, BarChart3, ClipboardCheck, Settings,
    LogOut, User, Bell, Sun, Moon, Building2, CheckSquare
} from 'lucide-react';

interface HeaderProps {
    user: any;
}

import Logo from '../atoms/Logo';

const Header: React.FC<HeaderProps> = ({ user }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const navItems = [
        { path: '/dashboard', label: 'Главная', icon: LayoutDashboard },
        { path: '/crm', label: 'CRM', icon: Building2 },
        { path: '/tasks', label: 'Задачи', icon: CheckSquare },
        { path: '/analytics', label: 'Аналитика', icon: BarChart3 },
    ];

    if (user?.role === 'manager' || user?.role === 'head' || user?.role === 'admin') {
        navItems.push({ path: '/review', label: 'Согласование', icon: ClipboardCheck });
    }

    if (user?.role === 'admin') {
        navItems.push({ path: '/users', label: 'Управление', icon: Settings });
    }

    return (
        <header className="glass-card animate-fade-in" style={{
            padding: '12px 24px',
            marginBottom: '32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: '16px',
            zIndex: 1000,
            background: 'var(--bg-secondary)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                <div onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
                    <Logo size="sm" />
                </div>

                <nav style={{ display: 'flex', gap: '8px', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '12px' }}>
                    {navItems.map(item => {
                        const Icon = item.icon;
                        const active = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    background: active ? 'var(--bg-secondary)' : 'transparent',
                                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                                    boxShadow: active ? 'var(--card-shadow)' : 'none',
                                    textTransform: 'none',
                                    fontSize: '0.85rem',
                                    gap: '8px',
                                    fontWeight: active ? 700 : 500
                                }}
                            >
                                <Icon size={18} /> {item.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="user-info-desktop">
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{user?.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.role === 'admin' ? 'Администратор' : 'Сотрудник'}</div>
                </div>

                <div style={{ height: '32px', width: '1px', background: 'var(--border)' }}></div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="action-button-modern" title="Уведомления"><Bell size={18} /></button>
                    <button className="action-button-modern" onClick={toggleTheme} title="Переключить тему">
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <button className="action-button-modern" onClick={() => navigate('/profile')} title="Профиль"><User size={18} /></button>
                    <button
                        onClick={handleLogout}
                        className="action-button-modern"
                        style={{ color: 'var(--danger)' }}
                        title="Выйти"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            <style>{`
                .action-button-modern {
                    width: 38px;
                    height: 38px;
                    border-radius: 10px;
                    background: var(--bg-tertiary);
                    color: var(--text-secondary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }
                .user-info-desktop {
                    text-align: right;
                }
                @media (max-width: 640px) {
                    .user-info-desktop { display: none; }
                }
            `}</style>
        </header>
    );
};

export default Header;
