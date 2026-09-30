import React, { useState } from 'react';
import { Send, Lock, Mail, AlertCircle, ShieldCheck } from 'lucide-react';
import { linkTelegramAccount } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { TelegramWebAppUser } from '../../types';

interface TmaLinkAccountProps {
  initData: string;
  telegramUser: TelegramWebAppUser | null;
  onLinked: () => void;
  haptic: {
    notification: (type: 'error' | 'success' | 'warning') => void;
    impact: (style?: 'light' | 'medium' | 'heavy') => void;
  };
}

/**
 * Компонент экрана привязки Telegram аккаунта к учетной записи OvertimePro.
 *
 * Отображается, если Telegram ID пользователя еще не зарегистрирован в системе.
 * Позволяет выполнить быструю авторизацию через корпоративный Email и пароль,
 * автоматически связывая Telegram ID с профилем сотрудника.
 *
 * @param {TmaLinkAccountProps} props - Свойства компонента.
 * @returns {JSX.Element} Экран привязки аккаунта.
 */
export const TmaLinkAccount: React.FC<TmaLinkAccountProps> = ({
  initData,
  telegramUser,
  onLinked,
  haptic,
}) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Пожалуйста, введите Email и пароль');
      haptic.notification('warning');
      return;
    }

    setLoading(true);
    setError('');
    haptic.impact('medium');

    try {
      const res = await linkTelegramAccount(initData, email.trim(), password);
      const isAuthed = Boolean(
        (res.authenticated || res.status === 'authenticated') && res.access_token && res.user
      );
      if (isAuthed && res.access_token && res.user) {
        haptic.notification('success');
        login(res.access_token, res.user);
        onLinked();
      } else {
        setError(res.detail || 'Не удалось привязать аккаунт');
        haptic.notification('error');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'Ошибка привязки аккаунта. Проверьте правильность Email и пароля.';
      setError(msg);
      haptic.notification('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '20px 16px',
      background: 'var(--tg-theme-bg-color, var(--bg-primary, #020617))',
      color: 'var(--tg-theme-text-color, var(--text-primary, #f8fafc))',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <div style={{
        maxWidth: '420px',
        margin: '0 auto',
        width: '100%',
        background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
        borderRadius: '20px',
        padding: '28px 22px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
      }}>
        {/* Иконка и заголовок */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 16px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(59, 130, 246, 0.4)',
          }}>
            <ShieldCheck size={36} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 6px' }}>
            Привязка к OvertimePro
          </h2>
          <p style={{
            fontSize: '0.88rem',
            color: 'var(--tg-theme-hint-color, var(--text-muted, #94a3b8))',
            margin: 0,
            lineHeight: 1.4,
          }}>
            {telegramUser?.first_name ? (
              <>Здравствуйте, <b>{telegramUser.first_name}</b>! Введите данные вашей корпоративной учётной записи.</>
            ) : (
              'Войдите в систему для привязки вашего Telegram к учётной записи.'
            )}
          </p>
        </div>

        {/* Ошибка */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '18px',
            color: '#ef4444',
            fontSize: '0.86rem',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Форма входа */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--tg-theme-hint-color, var(--text-secondary, #cbd5e1))',
              marginBottom: '6px',
            }}>
              Корпоративный Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--tg-theme-hint-color, #94a3b8)',
              }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  borderRadius: '12px',
                  background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                  color: 'var(--tg-theme-text-color, #f8fafc)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--tg-theme-hint-color, var(--text-secondary, #cbd5e1))',
              marginBottom: '6px',
            }}>
              Пароль
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--tg-theme-hint-color, #94a3b8)',
              }} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  borderRadius: '12px',
                  background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                  color: 'var(--tg-theme-text-color, #f8fafc)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--tg-theme-button-color, var(--primary, #3b82f6))',
              color: 'var(--tg-theme-button-text-color, #ffffff)',
              fontSize: '1rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 6px 16px rgba(59, 130, 246, 0.3)',
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? (
              <span>Привязка...</span>
            ) : (
              <>
                <Send size={18} />
                <span>Привязать и войти</span>
              </>
            )}
          </button>
        </form>

        {telegramUser?.id && (
          <div style={{
            marginTop: '20px',
            textAlign: 'center',
            fontSize: '0.78rem',
            color: 'var(--tg-theme-hint-color, var(--text-muted, #94a3b8))',
          }}>
            Telegram ID: <code>{telegramUser.id}</code>
          </div>
        )}
      </div>
    </div>
  );
};

export default TmaLinkAccount;
