/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Eye, EyeOff, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { api, changePassword } from '../../services/api';
import Logo from '../atoms/Logo';
import { User } from '../../types';
import { AxiosError } from 'axios';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get('/auth/me');
        setUser(res.data);
      } catch (err) {
        navigate('/login');
      }
    };
    fetchUser();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      await changePassword({ old_password: oldPassword, new_password: newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      setError(axiosError.response?.data?.detail || 'Ошибка при смене пароля');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="login-container">
      <div className="login-left-section">
        <div style={{ marginBottom: '40px' }}>
          <Logo size="md" />
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }} className="animate-fade-in">
            <CheckCircle2 size={64} style={{ color: 'var(--success)', marginBottom: '24px' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Пароль изменен!</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Перенаправление на главную страницу...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShieldCheck size={24} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Безопасность</h1>
                </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Пожалуйста, смените временный пароль на новый для защиты вашего аккаунта.</p>
            </div>

            {error && <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', fontSize: '0.85rem', fontWeight: 600 }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Старый пароль</label>
                <div style={{ position: 'relative' }}>
                  <input type={showOld ? 'text' : 'password'} value={oldPassword} onChange={e => setOldPassword(e.target.value)}
                    placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowOld(!showOld)}
                    style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {showOld ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Новый пароль</label>
                <div style={{ position: 'relative' }}>
                  <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="Придумайте надежный пароль" required />
                  <button type="button" onClick={() => setShowNew(!showNew)}
                    style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Подтверждение</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Повторите новый пароль" required />
              </div>
            </div>

            <button type="submit" className="primary" disabled={loading} style={{ height: '54px', fontSize: '1rem', fontWeight: 800, marginTop: '12px' }}>
              {loading ? 'СОХРАНЕНИЕ...' : 'ОБНОВИТЬ ПАРОЛЬ'} <ArrowRight size={20} style={{ marginLeft: '12px' }} />
            </button>
          </form>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '40px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          © 2026 Polymedia Overtime Pro
        </div>
      </div>

      <div className="login-right-section">
        <div style={{ maxWidth: '500px', textAlign: 'center' }}>
            <div style={{ padding: '40px', borderRadius: '32px', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <Lock size={32} />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '16px' }}>Безопасность прежде всего</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Мы заботимся о сохранности ваших данных. Смена пароля — обязательный шаг при первом входе или сбросе доступа администратором.</p>
            </div>
        </div>
      </div>

      <style>{`
        .login-container {
          display: grid;
          grid-template-columns: 500px 1fr;
          min-height: 100vh;
          background: var(--bg-main);
        }
        .login-left-section {
          background: var(--bg-secondary);
          padding: 60px;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border);
        }
        .login-right-section {
          background: linear-gradient(rgba(2, 6, 23, 0.8), rgba(2, 6, 23, 0.5)), url("https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80");
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px;
        }
        @media (max-width: 900px) {
          .login-container { grid-template-columns: 1fr; }
          .login-right-section { display: none; }
        }
      `}</style>
    </div>
  );
};

export default ChangePasswordPage;
