import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { Mail, Lock, ArrowRight, ShieldCheck, Key, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { login, requestPasswordReset, confirmPasswordReset, verify2FA } from '../../services/api';

const Logo: React.FC = () => (
  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
      <div style={{ width: '12px', height: '12px', background: '#dc2626', borderRadius: '4px' }}></div>
      <div style={{ width: '12px', height: '12px', background: '#16a34a', borderRadius: '4px' }}></div>
      <div style={{ width: '12px', height: '12px', background: '#1e40af', borderRadius: '4px' }}></div>
      <div style={{ width: '12px', height: '12px', background: '#dc2626', borderRadius: '4px' }}></div>
    </div>
    <span style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.04em' }}>Overtime<span style={{ color: 'var(--accent)' }}>Pro</span></span>
  </div>
);

const LoginPage: React.FC = () => {
  // Common states
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Login states
  const [password, setPassword] = useState('');

  // 2FA states
  const [is2FARequired, setIs2FARequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Password Reset states
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleLoginSuccess = (data: any) => {
    localStorage.setItem('token', data.access_token);
    if (data.user?.must_change_password) {
      navigate('/profile');
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(email, password);
      if (data.status === '2fa_required') {
        setIs2FARequired(true);
      } else {
        handleLoginSuccess(data);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await verify2FA(email, otpCode);
      handleLoginSuccess(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Неверный код подтверждения');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await requestPasswordReset(email);
      setSuccess(res.detail);
      setResetStep('confirm');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка при запросе сброса пароля');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmNewPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      const res = await confirmPasswordReset({
        email,
        code: resetCode,
        new_password: newPassword
      });
      setSuccess(res.detail);
      setTimeout(() => {
        setIsResetMode(false);
        setResetStep('request');
        setSuccess('');
        setPassword('');
        setError('');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка при сбросе пароля');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (is2FARequired) {
      return (
        <form onSubmit={handleVerify2FA} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Код подтверждения</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="123456"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                style={{ paddingLeft: '48px', letterSpacing: '8px', fontSize: '1.2rem', fontWeight: 700 }}
                required
                autoFocus
              />
            </div>
          </div>
          <button type="submit" className="primary" disabled={loading} style={{ padding: '14px' }}>
            {loading ? 'Проверка...' : 'Подтвердить вход'}
          </button>
          <button type="button" onClick={() => setIs2FARequired(false)} className="secondary" style={{ border: 'none', background: 'none' }}>
            Вернуться к логину
          </button>
        </form>
      );
    }

    if (isResetMode) {
      if (resetStep === 'request') {
        return (
          <form onSubmit={handleRequestReset} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ваша почта</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '48px' }}
                  required
                />
              </div>
            </div>
            <button type="submit" className="primary" disabled={loading} style={{ padding: '14px' }}>
              {loading ? 'Отправка...' : 'Отправить код'}
            </button>
            <button type="button" onClick={() => setIsResetMode(false)} className="secondary" style={{ border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <ArrowLeft size={16} /> Назад к входу
            </button>
          </form>
        );
      } else {
        return (
          <form onSubmit={handleConfirmReset} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Код из письма</label>
              <div style={{ position: 'relative' }}>
                <Key size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  style={{ paddingLeft: '48px', letterSpacing: '4px', fontWeight: 700 }}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Новый пароль</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ paddingLeft: '48px', paddingRight: '48px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'
                  }}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Повторите пароль</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  style={{ paddingLeft: '48px', paddingRight: '48px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="primary" disabled={loading} style={{ padding: '14px' }}>
              {loading ? 'Сброс...' : 'Установить пароль'}
            </button>
            <button type="button" onClick={() => setResetStep('request')} className="secondary" style={{ border: 'none', background: 'none' }}>
              Отправить код повторно
            </button>
          </form>
        );
      }
    }

    return (
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Электронная почта</label>
          <div style={{ position: 'relative' }}>
            <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ paddingLeft: '48px' }}
              required
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Пароль</label>
            <button
              type="button"
              onClick={() => { setIsResetMode(true); setError(''); setSuccess(''); }}
              style={{ fontSize: '0.8rem', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
            >
              Забыли пароль?
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingLeft: '48px', paddingRight: '48px' }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" className="primary" disabled={loading} style={{ marginTop: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loading ? 'Авторизация...' : (
              <>
                Войти в систему <ArrowRight size={18} />
              </>
            )}
          </div>
        </button>
      </form>
    );
  };

  const getTitle = () => {
    if (is2FARequired) return 'Подтвердите вход';
    if (isResetMode) return 'Восстановление пароля';
    return 'Добро пожаловать';
  };

  const getSubtitle = () => {
    if (is2FARequired) return `Мы отправили код на почту ${email}`;
    if (isResetMode && resetStep === 'confirm') return 'Введите код из письма и новый пароль';
    if (isResetMode) return 'Введите ваш email для получения кода сброса';
    return 'Войдите в учетную запись для управления временем.';
  };

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)',
      backgroundSize: '20px 20px',
      backgroundImage: `radial-gradient(var(--border) 1px, transparent 0)`
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div className="glass-card animate-fade-in" style={{ maxWidth: '440px', width: '100%', padding: '48px' }}>
          <Logo />

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>{getTitle()}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{getSubtitle()}</p>
          </div>

          {error && (
            <div style={{
              padding: '16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px',
              fontWeight: 500
            }}>
              <ShieldCheck size={18} /> {error}
            </div>
          )}

          {success && (
            <div style={{
              padding: '16px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)',
              color: '#22c55e', fontSize: '0.9rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px',
              fontWeight: 500
            }}>
              <CheckCircle2 size={18} /> {success}
            </div>
          )}

          {renderContent()}

          <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            © 2026 Overtime Pro — Система учета рабочего времени
          </p>
        </div>
      </div>

      <div style={{
        flex: 1.2, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '80px', color: 'white',
        background: `linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)`,
        position: 'relative', overflow: 'hidden'
      }} className="desktop-only">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-0.02em' }}>
            Прозрачный учет <br />вашего времени.
          </h1>
          <p style={{ fontSize: '1.25rem', opacity: 0.9, maxWidth: '500px', lineHeight: 1.6 }}>
            Корпоративный стандарт управления переработками. Автоматизация согласований и детальная аналитика проектов.
          </p>
        </div>
        <div style={{
          position: 'absolute', bottom: '-10%', right: '-10%', width: '600px', height: '600px',
          background: 'rgba(255,255,255,0.05)', borderRadius: '50%', border: '40px solid rgba(255,255,255,0.05)'
        }}></div>
      </div>

      <style>{`
                @media (max-width: 900px) {
                    .desktop-only { display: none !important; }
                }
            `}</style>
    </div>
  );
};

export default LoginPage;