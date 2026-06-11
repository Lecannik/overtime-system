import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, BarChart3, ClipboardCheck, Settings,
    LogOut, User as UserIcon, Sun, Moon, Menu, X
} from 'lucide-react';
import Logo from '../atoms/Logo';
import NotificationBell from './NotificationBell';
import { logout, setAccessToken } from '../../services/api';
import type { User } from '../../types';

interface HeaderProps {
    user: User;
}

const Header: React.FC<HeaderProps> = ({ user }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };


    const handleLogout = async () => {
        try {
            const response = await logout();
            if (response.data && response.data.sso_logout_url) {
                setAccessToken(null);
                window.location.href = response.data.sso_logout_url;
                return;
            }
        } catch (error) {
            console.error('Ошибка при выходе из системы:', error);
        } finally {
            setAccessToken(null);
            navigate('/login');
        }
    };


    const navItems = [
        { path: '/dashboard', label: 'Главная', icon: LayoutDashboard },
    ];

    if (user?.role === 'manager' || user?.role === 'head' || user?.role === 'admin') {
        navItems.push({ path: '/analytics', label: 'Аналитика', icon: BarChart3 });
        navItems.push({ path: '/review', label: 'Согласование', icon: ClipboardCheck });
    }

    if (user?.role === 'admin') {
        navItems.push({ path: '/users', label: 'Управление', icon: Settings });
    }

    return (
        <header className="glass-card" style={{
            padding: '12px 24px',
            marginBottom: '32px',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: '16px',
            zIndex: 1000,
            background: 'var(--bg-secondary)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                    <div onClick={() => { navigate('/dashboard'); setIsMobileMenuOpen(false); }} style={{ cursor: 'pointer' }}>
                        <Logo size="sm" />
                    </div>

                    <nav className="desktop-nav" style={{ display: 'flex', gap: '8px', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '12px' }}>
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
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{user?.full_name || 'Загрузка...'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {user?.role === 'admin' ? 'Администратор' :
                                user?.role === 'head' ? 'Нач. отдела' :
                                    user?.role === 'manager' ? 'Менеджер' : 'Сотрудник'}
                        </div>
                    </div>

                    <div className="user-info-desktop" style={{ height: '32px', width: '1px', background: 'var(--border)' }}></div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <NotificationBell />
                        <button className="action-button-modern" onClick={toggleTheme} title="Переключить тему">
                            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                        </button>
                        <button className="action-button-modern header-btn-desktop" onClick={() => navigate('/profile')} title="Профиль"><UserIcon size={18} /></button>
                        <button
                            onClick={handleLogout}
                            className="action-button-modern header-btn-desktop"
                            style={{ color: 'var(--danger)' }}
                            title="Выйти"
                        >
                            <LogOut size={18} />
                        </button>

                        <button
                            className="action-button-modern burger-button"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            title="Меню"
                        >
                            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>
            </div>

            {isMobileMenuOpen && (
                <div className="mobile-nav" style={{
                    width: '100%',
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }}>
                    {navItems.map(item => {
                        const Icon = item.icon;
                        const active = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => {
                                    navigate(item.path);
                                    setIsMobileMenuOpen(false);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    background: active ? 'var(--bg-tertiary)' : 'transparent',
                                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    fontSize: '0.9rem',
                                    fontWeight: active ? 700 : 500,
                                    border: 'none',
                                    textAlign: 'left',
                                    justifyContent: 'flex-start'
                                }}
                            >
                                <Icon size={18} /> {item.label}
                            </button>
                        );
                    })}

                    <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }}></div>

                    <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{user?.full_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {user?.role === 'admin' ? 'Администратор' :
                                user?.role === 'head' ? 'Начальник отдела' :
                                    user?.role === 'manager' ? 'Менеджер' : 'Сотрудник'}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', padding: '0 8px' }}>
                        <button
                            className="action-button-modern"
                            style={{ flex: 1, display: 'flex', gap: '8px' }}
                            onClick={() => { navigate('/profile'); setIsMobileMenuOpen(false); }}
                        >
                            <UserIcon size={18} /> Профиль
                        </button>
                        <button
                            className="action-button-modern"
                            style={{ flex: 1, display: 'flex', gap: '8px', color: 'var(--danger)' }}
                            onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                        >
                            <LogOut size={18} /> Выйти
                        </button>
                    </div>
                </div>
            )}

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
                    border: none;
                    cursor: pointer;
                }
                .action-button-modern:hover {
                    background: var(--border);
                    color: var(--text-primary);
                }
                .user-info-desktop {
                    text-align: right;
                }
                .burger-button {
                    display: none;
                }
                @media (max-width: 900px) {
                    .desktop-nav {
                        display: none !important;
                    }
                    .burger-button {
                        display: flex;
                    }
                    .user-info-desktop {
                        display: none !important;
                    }
                    .header-btn-desktop {
                        display: none !important;
                    }
                }
            `}</style>
        </header>
    );
};

export default Header;
