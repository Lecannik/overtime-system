import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Shield, Mail, Building, Bell, MessageSquare, Key, Save, X, Edit3, AlertTriangle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import api, { updateMyProfile, getDepartments, changePassword } from '../../services/api';
import Header from '../layout/Header';

const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [departments, setDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({
        full_name: '', telegram_chat_id: '', notification_level: 2, is_2fa_enabled: false
    });
    const [pwdForm, setPwdForm] = useState({
        old_password: '', new_password: '', confirm_password: ''
    });
    const [showPwd, setShowPwd] = useState({
        old: false, new: false, confirm: false
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await api.get('/auth/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUser(res.data);
                setForm({
                    full_name: res.data.full_name || '',
                    telegram_chat_id: res.data.telegram_chat_id || '',
                    notification_level: res.data.notification_level ?? 2,
                    is_2fa_enabled: res.data.is_2fa_enabled || false
                });
                if (res.data.role === 'admin') {
                    const depts = await getDepartments();
                    setDepartments(depts);
                }
            } catch {
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [navigate]);

    const getDeptName = (deptId: number | null) => {
        if (!deptId) return 'Не назначен';
        const dept = departments.find((d: any) => d.id === deptId);
        return dept ? dept.name : `Отдел #${deptId}`;
    };

    const handleSave = async (overrides?: any) => {
        console.log('ProfilePage: handleSave started', { currentForm: form, overrides });
        try {
            const cleanOverrides = (overrides && !(overrides instanceof Object && 'nativeEvent' in overrides)) ? overrides : {};

            const updatePayload = {
                full_name: form.full_name,
                telegram_chat_id: form.telegram_chat_id || null,
                notification_level: form.notification_level,
                is_2fa_enabled: form.is_2fa_enabled,
                ...cleanOverrides
            };

            console.log('ProfilePage: sending request', updatePayload);
            const res = await updateMyProfile(updatePayload);
            console.log('ProfilePage: request success', res);

            setUser(res);
            setEditing(false);
            setForm({
                full_name: res.full_name || '',
                telegram_chat_id: res.telegram_chat_id || '',
                notification_level: res.notification_level ?? 2,
                is_2fa_enabled: res.is_2fa_enabled || false
            });
        } catch (err: any) {
            console.error('ProfilePage: save error', err);
            alert(err.response?.data?.detail || 'Ошибка при сохранении');
        }
    };

    const handleToggle2FA = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newValue = !form.is_2fa_enabled;
        console.log('ProfilePage: handleToggle2FA', { oldValue: form.is_2fa_enabled, newValue });
        setForm(prev => ({ ...prev, is_2fa_enabled: newValue }));
        handleSave({ is_2fa_enabled: newValue });
    };

    const handlePasswordChange = async () => {
        if (!pwdForm.old_password || !pwdForm.new_password) {
            alert('Заполните все поля');
            return;
        }
        if (pwdForm.new_password !== pwdForm.confirm_password) {
            alert('Новые пароли не совпадают');
            return;
        }
        try {
            await changePassword(pwdForm.old_password, pwdForm.new_password);
            alert('Пароль успешно изменен');

            // Если была принудительная смена пароля — перекидываем на главную
            const wasForced = user?.must_change_password;

            if (wasForced) {
                // Обновляем состояние локально, чтобы убрать предупреждение до редиректа
                setUser({ ...user, must_change_password: false });
                navigate('/dashboard');
            } else {
                setPwdForm({ old_password: '', new_password: '', confirm_password: '' });
            }
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Ошибка при смене пароля');
        }
    };

    if (loading) return (
        <div className="page-container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
            <div className="loading-bar" style={{ width: '30%' }}></div>
        </div>
    );

    const ROLE_LABELS: Record<string, string> = {
        admin: 'Администратор',
        head: 'Руководитель',
        manager: 'Менеджер',
        employee: 'Сотрудник'
    };

    return (
        <div className="page-container animate-fade-in">
            <Header user={user} />

            <div style={{ marginBottom: '40px' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '8px' }}>Личный профиль</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Управление персональными данными и настройками безопасности.</p>
            </div>

            {user?.must_change_password && (
                <div style={{
                    padding: '20px 24px', borderRadius: '16px', background: 'rgba(180, 83, 9, 0.1)',
                    border: '1px solid var(--warning)', color: 'var(--warning)', marginBottom: '32px',
                    display: 'flex', gap: '16px', alignItems: 'center'
                }}>
                    <AlertTriangle size={24} />
                    <div>
                        <strong style={{ display: 'block', fontSize: '1.1rem' }}>Требуется смена пароля</strong>
                        <span style={{ fontSize: '0.9rem', opacity: 0.9 }}>Администратор сбросил ваш пароль. Пожалуйста, установите новый пароль для продолжения работы.</span>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '32px', alignItems: 'start' }}>
                {/* Information Card */}
                <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <UserIcon size={20} style={{ color: 'var(--accent)' }} /> Основная информация
                        </h3>
                        {!user?.must_change_password && !editing && (
                            <button onClick={() => setEditing(true)} style={{
                                padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--border)',
                                background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600
                            }}>
                                <Edit3 size={16} /> Редактировать
                            </button>
                        )}
                    </div>

                    {editing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Полное имя</label>
                                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Telegram Chat ID</label>
                                <div style={{ position: 'relative' }}>
                                    <MessageSquare size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input style={{ paddingLeft: '48px' }} value={form.telegram_chat_id} placeholder="ID для уведомлений"
                                        onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Уровень уведомлений</label>
                                <select value={form.notification_level}
                                    onChange={(e) => setForm({ ...form, notification_level: Number(e.target.value) })}>
                                    <option value={0}>Выключены</option>
                                    <option value={1}>Только критические</option>
                                    <option value={2}>Все оповещения</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button onClick={() => handleSave()} className="primary" style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Save size={18} /> Сохранить изменения
                                </button>
                                <button onClick={() => setEditing(false)} style={{
                                    padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--border)',
                                    background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '8px'
                                }}>
                                    <X size={18} /> Отмена
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ padding: '10px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--accent)' }}><UserIcon size={20} /></div>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>ФИО</p>
                                        <p style={{ fontWeight: 600 }}>{user?.full_name}</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ padding: '10px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--accent)' }}><Mail size={20} /></div>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Email</p>
                                        <p style={{ fontWeight: 600 }}>{user?.email}</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ padding: '10px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--accent)' }}><MessageSquare size={20} /></div>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Telegram</p>
                                        <p style={{ fontWeight: 600 }}>{user?.telegram_chat_id || 'Не привязан'}</p>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ padding: '10px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--accent)' }}><Shield size={20} /></div>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Роль в системе</p>
                                        <p style={{ fontWeight: 600 }}>{ROLE_LABELS[user?.role] || user?.role}</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ padding: '10px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--accent)' }}><Building size={20} /></div>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Подразделение</p>
                                        <p style={{ fontWeight: 600 }}>{getDeptName(user?.department_id)}</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ padding: '10px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--accent)' }}><Bell size={20} /></div>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Уведомления</p>
                                        <p style={{ fontWeight: 600 }}>{({ 0: 'Выключены', 1: 'Важные', 2: 'Все' }[user?.notification_level as number]) || 'Все'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Security Card */}
                <div className="glass-card">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Key size={20} style={{ color: 'var(--accent)' }} /> Безопасность
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Текущий пароль</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPwd.old ? "text" : "password"}
                                    value={pwdForm.old_password}
                                    onChange={(e) => setPwdForm({ ...pwdForm, old_password: e.target.value })}
                                    style={{ width: '100%', paddingRight: '44px' }}
                                />
                                <button type="button" onClick={() => setShowPwd({ ...showPwd, old: !showPwd.old })} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}>
                                    {showPwd.old ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Новый пароль</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPwd.new ? "text" : "password"}
                                    value={pwdForm.new_password}
                                    onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })}
                                    style={{ width: '100%', paddingRight: '44px' }}
                                />
                                <button type="button" onClick={() => setShowPwd({ ...showPwd, new: !showPwd.new })} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}>
                                    {showPwd.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Подтверждение</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPwd.confirm ? "text" : "password"}
                                    value={pwdForm.confirm_password}
                                    onChange={(e) => setPwdForm({ ...pwdForm, confirm_password: e.target.value })}
                                    style={{ width: '100%', paddingRight: '44px' }}
                                />
                                <button type="button" onClick={() => setShowPwd({ ...showPwd, confirm: !showPwd.confirm })} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}>
                                    {showPwd.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <button onClick={handlePasswordChange} className="primary" style={{ marginTop: '12px' }}>
                            Обновить пароль
                        </button>
                    </div>

                    <div style={{ marginTop: '40px', padding: '24px', borderRadius: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <div style={{ padding: '8px', borderRadius: '10px', background: form.is_2fa_enabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(100, 116, 139, 0.1)', color: form.is_2fa_enabled ? '#22c55e' : '#64748b' }}>
                                    <ShieldCheck size={20} />
                                </div>
                                <div>
                                    <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>Двухфакторная аутентификация</p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Подтверждение входа через email</p>
                                </div>
                            </div>
                            <div
                                onClick={handleToggle2FA}
                                style={{
                                    width: '48px', height: '26px', borderRadius: '13px',
                                    background: form.is_2fa_enabled ? 'var(--accent)' : '#cbd5e1',
                                    position: 'relative', cursor: 'pointer', transition: 'all 0.3s',
                                    border: 'none', padding: 0, outline: 'none'
                                }}>
                                <div style={{
                                    width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                                    position: 'absolute', top: '3px',
                                    left: form.is_2fa_enabled ? '25px' : '3px',
                                    transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    pointerEvents: 'none'
                                }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
