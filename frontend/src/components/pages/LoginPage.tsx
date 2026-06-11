import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Eye, EyeOff, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { api, requestPasswordReset, confirmPasswordReset, verify2FA, setAccessToken, getAccessToken } from '../../services/api';
import Logo from '../atoms/Logo';
import { AxiosError } from 'axios';

type PageMode = 'login' | 'forgot' | 'reset-code' | '2fa';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [mode, setMode] = useState<PageMode>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 2FA state
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaEmail, setTwoFaEmail] = useState('');

  useEffect(() => {
    if (getAccessToken()) navigate('/dashboard');
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      const res = await api.post('/auth/login', formData);

      if (res.data.status === '2fa_required') {
        setTwoFaEmail(res.data.email);
        setMode('2fa');
        setSuccess('Код подтверждения отправлен на вашу почту.');
      } else {
        setAccessToken(res.data.access_token);
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      setError(axiosError.response?.data?.detail || 'Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await verify2FA(twoFaEmail, twoFaCode);
      setAccessToken(res.access_token);
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      setError(axiosError.response?.data?.detail || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await requestPasswordReset(resetEmail);
      setSuccess(res.detail || 'Код восстановления отправлен на почту.');
      setMode('reset-code');
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      setError(axiosError.response?.data?.detail || 'Ошибка при запросе сброса');
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmNewPassword) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset({ email: resetEmail, code: resetCode, new_password: newPassword });
      setSuccess('Пароль успешно сброшен! Войдите с новым паролем.');
      setMode('login');
      setPassword('');
      setEmail(resetEmail);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      setError(axiosError.response?.data?.detail || 'Ошибка при сбросе пароля');
    } finally {
      setLoading(false);
    }
  };

  const goBackToLogin = () => {
    setMode('login');
    setError('');
    setSuccess('');
  };

  const renderForm = () => {
    if (mode === 'login') {
      return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '8px' }}>Вход в систему</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Введите данные вашей корпоративной учетной записи.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block', letterSpacing: '0.05em' }}>Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 5 }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@polymedia.ru"
                  style={{ paddingLeft: '50px', height: '54px' }} required />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'flex-end' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Пароль</label>
                <button type="button" onClick={() => { setMode('forgot'); setResetEmail(email); }}
                  style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Забыли пароль?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 5 }} />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" style={{ paddingLeft: '50px', height: '54px' }} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="primary" disabled={loading} style={{ height: '56px', fontSize: '1rem', fontWeight: 800, borderRadius: '16px', marginTop: '12px' }}>
            {loading ? 'Вход...' : 'ВОЙТИ В СИСТЕМУ'} <ArrowRight size={20} style={{ marginLeft: '12px' }} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0', gap: '10px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>ИЛИ</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
          </div>

          <button
            type="button"
            onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || ''}/api/v1/auth/microsoft/login`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              height: '56px',
              fontSize: '0.9rem',
              fontWeight: 800,
              borderRadius: '16px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              width: '100%',
              transition: 'all 0.2s ease'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 21 21">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            ВОЙТИ ЧЕРЕЗ MICROSOFT
          </button>
        </form>
      );
    }

    if (mode === 'forgot') {
      return (
        <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Сброс пароля</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Введите email для получения кода восстановления.</p>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Email</label>
            <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="name@polymedia.ru"
              style={{ height: '50px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }} required />
          </div>
          <button type="submit" className="primary" disabled={loading}>ОТПРАВИТЬ КОД</button>
          <button type="button" onClick={goBackToLogin} style={{ background: 'none', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <ArrowLeft size={16} /> Назад к входу
          </button>
        </form>
      );
    }

    if (mode === 'reset-code') {
      return (
        <form onSubmit={handleResetConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Новый пароль</h1>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Код из письма</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" value={resetCode} onChange={e => setResetCode(e.target.value)} placeholder="000000"
                style={{ paddingLeft: '44px', height: '50px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', letterSpacing: '8px', fontSize: '1.2rem', textAlign: 'center' }} maxLength={6} required />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Новый пароль</label>
            <div style={{ position: 'relative' }}>
              <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                style={{ height: '50px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }} required />
              <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none' }}>
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Подтверждение</label>
            <div style={{ position: 'relative' }}>
              <input type={showConfirmPassword ? 'text' : 'password'} value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)}
                style={{ height: '50px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }} required />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none' }}>
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" className="primary" disabled={loading}>СБРОСИТЬ ПАРОЛЬ</button>
        </form>
      );
    }

    if (mode === '2fa') {
      return (
        <form onSubmit={handle2FA} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Подтверждение</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Введите 6-значный код из письма.</p>
          <div style={{ position: 'relative' }}>
            <ShieldCheck size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" value={twoFaCode} onChange={e => setTwoFaCode(e.target.value)} placeholder="000000"
              style={{ paddingLeft: '44px', height: '54px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', letterSpacing: '8px', fontSize: '1.2rem', textAlign: 'center' }} maxLength={6} required />
          </div>
          <button type="submit" className="primary" disabled={loading}>ПОДТВЕРДИТЬ</button>
        </form>
      );
    }
  };

  return (
    <div className="login-container">
      <div className="login-left-section">
        <div style={{ marginBottom: '60px' }}>
          <Logo size="md" />
        </div>

        {error && <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', marginBottom: '24px', fontSize: '0.9rem', fontWeight: 600 }}>{error}</div>}
        {success && <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)', marginBottom: '24px', fontSize: '0.9rem', fontWeight: 600 }}>{success}</div>}

        {renderForm()}

        <div style={{ marginTop: 'auto', paddingTop: '40px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          © 2026 Polymedia Overtime Pro. Все права защищены.
        </div>
      </div>

      <div className="login-right-section">
        <div style={{ maxWidth: '600px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <Logo size="lg" />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Система учета переработок</p>
          </div>

          <div style={{ display: 'flex', gap: '32px', marginTop: '48px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.5rem' }}>100%</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Точность данных</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ color: 'var(--success)', fontWeight: 800, fontSize: '1.5rem' }}>24/7</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Доступность</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .login-container {
          display: grid;
          grid-template-columns: minmax(450px, 1fr) 1.5fr;
          min-height: 100vh;
          background: var(--bg-main);
        }
        .login-left-section {
          background: var(--bg-secondary);
          padding: 60px 50px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          border-right: 1px solid var(--border);
        }
        .login-right-section {
          background: linear-gradient(rgba(2, 6, 23, 0.85), rgba(2, 6, 23, 0.6)), url("/login_bg.jpg");
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px;
        }
        @media (max-width: 900px) {
          .login-container {
            grid-template-columns: 1fr;
          }
          .login-right-section {
            display: none !important;
          }
          .login-left-section {
            padding: 40px 24px;
            border-right: none;
            min-height: 100vh;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
