/* eslint-disable */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User as UserIcon, Mail, Shield, Building2, Globe, Save, Key,
    Bell, Smartphone, Camera, Loader2, CheckCircle2
} from 'lucide-react';
import api, { updateMyPreferences } from '../../services/api';
import Header from '../layout/Header';
import { ROLE_LABELS, COMPANY_LABELS } from '../../constants/locale';
import { User, UserUpdatePreferences } from '../../types';
import { AxiosError } from 'axios';

const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Form states
    const [prefs, setPrefs] = useState<UserUpdatePreferences>({
        is_2fa_enabled: false,
        tg_notifications: false,
        email_notifications: true
    });

    const fetchUser = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) { navigate('/login'); return; }
            const res = await api.get('/auth/me');
            setUser(res.data);
            setPrefs({
                is_2fa_enabled: res.data.is_2fa_enabled,
                tg_notifications: res.data.tg_notifications,
                email_notifications: res.data.email_notifications
            });
        } catch (err) {
            console.error(err);
            navigate('/login');
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setSuccess(false);
        try {
            await updateMyPreferences(prefs);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ detail?: string }>;
            alert(axiosError.response?.data?.detail || 'Ошибка при сохранении настроек');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ background: 'var(--bg-main)', minHeight: '100vh' }}></div>;

    return (
        <div className="page-container animate-fade-in">
            {user && <Header user={user} />}

            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Личный профиль</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Управление персональными данными и настройками безопасности.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', alignItems: 'start' }}>
                    {/* Left: User Info Card */}
                    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ height: '100px', background: 'var(--accent-gradient)' }}></div>
                        <div style={{ padding: '0 24px 24px', textAlign: 'center', marginTop: '-40px' }}>
                            <div style={{
                                width: '80px', height: '80px', borderRadius: '24px', background: 'var(--bg-secondary)',
                                border: '4px solid var(--bg-secondary)', margin: '0 auto 16px', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
                                boxShadow: 'var(--card-shadow)'
                            }}>
                                <UserIcon size={40} />
                            </div>
                            <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '4px' }}>{user?.full_name}</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>{user?.email}</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                                    <Shield size={18} style={{ color: 'var(--primary)' }} />
                                    <div style={{ textAlign: 'left' }}>
                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Роль</p>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>{user ? ROLE_LABELS[user.role] : '-'}</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                                    <Building2 size={18} style={{ color: 'var(--success)' }} />
                                    <div style={{ textAlign: 'left' }}>
                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Компания</p>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>{user ? COMPANY_LABELS[user.company] : '-'}</p>
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => navigate('/change-password')} style={{ width: '100%', marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} className="secondary">
                                <Key size={16} /> Сменить пароль
                            </button>
                        </div>
                    </div>

                    {/* Right: Settings Form */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <form className="glass-card" onSubmit={handleSave} style={{ padding: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                <Bell size={24} style={{ color: 'var(--primary)' }} />
                                <h4 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Уведомления</h4>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Mail size={20} />
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Email-уведомления</p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>О статусах ваших заявок</p>
                                        </div>
                                    </div>
                                    <input type="checkbox" checked={prefs.email_notifications} onChange={e => setPrefs({ ...prefs, email_notifications: e.target.checked })} style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }} />
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Smartphone size={20} />
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Telegram-бот</p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Уведомления в мессенджере</p>
                                        </div>
                                    </div>
                                    <input type="checkbox" checked={prefs.tg_notifications} onChange={e => setPrefs({ ...prefs, tg_notifications: e.target.checked })} style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }} />
                                </label>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '32px 0 24px' }}>
                                <Shield size={24} style={{ color: 'var(--warning)' }} />
                                <h4 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Безопасность</h4>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '32px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Key size={20} />
                                    </div>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Двухфакторная аутентификация (2FA)</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Дополнительный код при входе</p>
                                    </div>
                                </div>
                                <input type="checkbox" checked={prefs.is_2fa_enabled} onChange={e => setPrefs({ ...prefs, is_2fa_enabled: e.target.checked })} style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }} />
                            </label>

                            <button type="submit" disabled={saving} className="primary" style={{ width: '100%', padding: '14px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                {saving ? <Loader2 size={18} className="spin" /> : success ? <CheckCircle2 size={18} /> : <Save size={18} />}
                                {saving ? 'СОХРАНЕНИЕ...' : success ? 'НАСТРОЙКИ СОХРАНЕНЫ' : 'СОХРАНИТЬ ИЗМЕНЕНИЯ'}
                            </button>
                        </form>

                        <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                <Camera size={24} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ fontWeight: 700, fontSize: '0.9rem' }}>Фото профиля</h4>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Синхронизируется из Microsoft 365</p>
                            </div>
                            <Globe size={18} style={{ color: 'var(--text-muted)' }} />
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @media (max-width: 800px) {
                    div[style*="grid-template-columns: 1fr 1.5fr"] {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ProfilePage;
