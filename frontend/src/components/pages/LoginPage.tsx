import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { login } from '../../services/api';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(email, password);
      localStorage.setItem('token', data.access_token);

      if (data.user?.must_change_password) {
        navigate('/profile');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)',
      backgroundSize: '20px 20px',
      backgroundImage: `radial-gradient(var(--border) 1px, transparent 0)`
    }}>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px'
      }}>
        <div className="glass-card animate-fade-in" style={{ maxWidth: '440px', width: '100%', padding: '48px' }}>
          <Logo />

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Добро пожаловать</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Войдите в учетную запись для управления временем.
            </p>
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Электронная почта</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{
                  position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
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
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Пароль</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{
                  position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '48px' }}
                  required
                />
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

          <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            © 2026 Overtime Pro — Система учета рабочего времени
          </p>
        </div>
      </div>

      {/* Image side - hidden on mobile */}
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
        {/* Decorative elements */}
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