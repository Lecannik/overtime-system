import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import api from '../../services/api';

const ChangePasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasswords({ ...passwords, [e.target.name]: e.target.value });
    };

    const toggleShow = (field: 'current' | 'new' | 'confirm') => {
        setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            setError('Пароли не совпадают');
            return;
        }
        if (passwords.new.length < 6) {
            setError('Пароль должен быть не менее 6 символов');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await api.post('/auth/change-password', {
                old_password: passwords.current,
                new_password: passwords.new
            });
            alert('Пароль успешно изменен! Войдите снова.');
            localStorage.removeItem('token');
            navigate('/login');
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            if (Array.isArray(detail)) {
                setError(detail[0]?.msg || 'Ошибка валидации');
            } else {
                setError(typeof detail === 'string' ? detail : 'Ошибка при смене пароля');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
            <div className="glass-card animate-scale-in" style={{ maxWidth: '450px', width: '100%', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div className="icon-shape" style={{ width: '64px', height: '64px', margin: '0 auto 20px', background: 'var(--accent-gradient)', color: 'white' }}>
                        <Lock size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Смена пароля</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Ваш пароль был сброшен администратором. Пожалуйста, установите новый.</p>
                </div>

                {error && (
                    <div className="badge badge-danger" style={{ width: '100%', padding: '12px', marginBottom: '24px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Временный пароль</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                name="current"
                                type={showPasswords.current ? "text" : "password"}
                                required
                                placeholder="Введите временный или текущий пароль"
                                value={passwords.current}
                                onChange={handleChange}
                                style={{ width: '100%', paddingRight: '44px' }}
                            />
                            <button type="button" onClick={() => toggleShow('current')} className="eye-button" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                                {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Новый пароль</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                name="new"
                                type={showPasswords.new ? "text" : "password"}
                                required
                                placeholder="Придумайте надежный пароль"
                                value={passwords.new}
                                onChange={handleChange}
                                style={{ width: '100%', paddingRight: '44px' }}
                            />
                            <button type="button" onClick={() => toggleShow('new')} className="eye-button" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                                {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Подтвердите пароль</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                name="confirm"
                                type={showPasswords.confirm ? "text" : "password"}
                                required
                                placeholder="Повторите новый пароль"
                                value={passwords.confirm}
                                onChange={handleChange}
                                style={{ width: '100%', paddingRight: '44px' }}
                            />
                            <button type="button" onClick={() => toggleShow('confirm')} className="eye-button" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                                {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button className="primary" style={{ height: '48px', marginTop: '12px' }} disabled={loading}>
                        {loading ? 'Секунду...' : (
                            <>
                                <ShieldCheck size={18} style={{ marginRight: '8px' }} /> Сохранить пароль
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordPage;
