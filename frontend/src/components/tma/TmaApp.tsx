import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp';
import { useAuth } from '../../context/AuthContext';
import { authTelegramWebApp } from '../../services/api';
import TmaLinkAccount from './TmaLinkAccount';
import TmaTrackerView from './TmaTrackerView';
import TmaReviewView from './TmaReviewView';
import { Clock, CheckSquare } from 'lucide-react';

/**
 * Корневой контейнер Telegram Mini App (TMA).
 *
 * Отвечает за:
 * 1. Валидацию криптографической подписи initData через бэкенд;
 * 2. Автоматический бесшовный вход без пароля для привязанных Telegram ID;
 * 3. Отображение экрана привязки TmaLinkAccount для новых пользователей;
 * 4. Ролевое переключение интерфейса (Таймер сотрудника vs Карточная лента руководителя);
 * 5. Нативную интеграцию Telegram WebApp SDK (HapticFeedback, темы, expand).
 *
 * @returns {JSX.Element} Полноэкранное мини-приложение Telegram.
 */
export const TmaApp: React.FC = () => {
  const { initData, telegramUser, haptic, backButton } = useTelegramWebApp();

  const { user: authUser, login, token } = useAuth();

  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'link_required' | 'guest'>('checking');
  const [activeTab, setActiveTab] = useState<'tracker' | 'review'>('tracker');
  const [pendingReviewCount, setPendingReviewCount] = useState<number>(0);
  const authAttemptedRef = useRef(false);

  const handleCountChange = useCallback((count: number) => {
    setPendingReviewCount(count);
  }, []);

  // Проверка сессии при запуске
  useEffect(() => {
    let isMounted = true;

    // 1. Если пользователь уже авторизован в общем AuthContext
    if (token && authUser) {
      setAuthStatus('authenticated');
      if (['admin', 'head', 'manager'].includes(authUser.role)) {
        setActiveTab('review');
      }
      return;
    }

    // 2. Предотвращаем повторный запуск аутентификации в рамках текущей сессии
    if (authAttemptedRef.current) {
      return;
    }

    const authenticate = async () => {
      // Если есть initData от Telegram — проверяем на бэкенде
      if (initData) {
        authAttemptedRef.current = true;
        try {
          const res = await authTelegramWebApp(initData);
          if (!isMounted) return;

          const isAuthed = Boolean(
            (res.authenticated || res.status === 'authenticated') && res.access_token && res.user
          );

          if (isAuthed && res.access_token && res.user) {
            login(res.access_token, res.user);
            setAuthStatus('authenticated');
            // Если пользователь руководитель/менеджер — по умолчанию открываем ленту согласования
            if (['admin', 'head', 'manager'].includes(res.user.role)) {
              setActiveTab('review');
            }
          } else {
            // Требуется привязка аккаунта
            setAuthStatus('link_required');
          }
        } catch (err) {
          console.error('[TMA] Ошибка авторизации через initData:', err);
          if (isMounted) {
            setAuthStatus('link_required');
          }
        }
      } else {
        // Fallback для запуска вне Telegram (браузер / DevTools)
        const timer = setTimeout(() => {
          if (!initData && isMounted && !authAttemptedRef.current) {
            authAttemptedRef.current = true;
            setAuthStatus('link_required');
          }
        }, 300);
        return () => clearTimeout(timer);
      }
    };

    authenticate();

    return () => {
      isMounted = false;
    };
  }, [initData, login, token, authUser]);

  const canReview = Boolean(
    authUser && ['admin', 'head', 'manager'].includes(authUser.role)
  );

  // 1. Состояние проверки / авторизации
  if (authStatus === 'checking') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--tg-theme-bg-color, var(--bg-primary, #020617))',
        color: 'var(--tg-theme-text-color, #f8fafc)',
        fontFamily: 'Inter, -apple-system, sans-serif',
        gap: '16px',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '3px solid rgba(59, 130, 246, 0.2)',
          borderTopColor: '#3b82f6',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ fontSize: '0.92rem', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>
          Авторизация в OvertimePro...
        </div>
      </div>
    );
  }

  // 2. Требуется привязка Telegram ID к аккаунту
  if (authStatus === 'link_required') {
    return (
      <TmaLinkAccount
        initData={initData}
        telegramUser={telegramUser}
        haptic={haptic}
        onLinked={() => {
          setAuthStatus('authenticated');
        }}
      />
    );
  }

  // 3. Авторизованный режим TMA
  const roleNameMap: Record<string, string> = {
    admin: 'Администратор',
    head: 'Начальник отдела',
    manager: 'Менеджер проектов',
    employee: 'Сотрудник',
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--tg-theme-bg-color, var(--bg-primary, #020617))',
      color: 'var(--tg-theme-text-color, var(--text-primary, #f8fafc))',
      fontFamily: 'Inter, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '600px',
      margin: '0 auto',
      overscrollBehavior: 'none',
    }}>
      {/* Верхняя навигационная панель */}
      <header style={{
        padding: '14px 16px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
        background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '0.85rem',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
          }}>
            OP
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.2 }}>
              {authUser?.full_name || telegramUser?.first_name || 'Сотрудник'}
            </div>
            <div style={{
              fontSize: '0.74rem',
              color: 'var(--tg-theme-hint-color, var(--text-muted, #94a3b8))',
            }}>
              {roleNameMap[authUser?.role || ''] || 'Пользователь'}
            </div>
          </div>
        </div>

        {/* Индикатор роли */}
        <span style={{
          background: 'rgba(59, 130, 246, 0.12)',
          color: '#60a5fa',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          fontSize: '0.72rem',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: '8px',
        }}>
          TMA v1.0
        </span>
      </header>

      {/* Сегментированный переключатель ролей для руководителей */}
      {canReview && (
        <div style={{
          padding: '10px 14px 4px',
          background: 'var(--tg-theme-bg-color, var(--bg-primary, #020617))',
        }}>
          <div style={{
            display: 'flex',
            background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
            borderRadius: '12px',
            padding: '3px',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          }}>
            <button
              type="button"
              onClick={() => {
                haptic.selection();
                setActiveTab('tracker');
              }}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'tracker' ? 'var(--tg-theme-button-color, var(--primary, #3b82f6))' : 'transparent',
                color: activeTab === 'tracker' ? 'var(--tg-theme-button-text-color, #ffffff)' : 'var(--tg-theme-hint-color, #94a3b8)',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Clock size={16} />
              <span>Мой трекер</span>
            </button>

            <button
              type="button"
              onClick={() => {
                haptic.selection();
                setActiveTab('review');
              }}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'review' ? 'var(--tg-theme-button-color, var(--primary, #3b82f6))' : 'transparent',
                color: activeTab === 'review' ? 'var(--tg-theme-button-text-color, #ffffff)' : 'var(--tg-theme-hint-color, #94a3b8)',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <CheckSquare size={16} />
              <span>Согласование</span>
              {pendingReviewCount > 0 && (
                <span style={{
                  background: activeTab === 'review' ? '#ffffff' : '#ef4444',
                  color: activeTab === 'review' ? '#1d4ed8' : '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  marginLeft: '2px',
                }}>
                  {pendingReviewCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Основной контент */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'tracker' ? (
          <TmaTrackerView haptic={haptic} currentUser={authUser} backButton={backButton} />
        ) : (
          <TmaReviewView
            haptic={haptic}
            currentUser={authUser}
            onCountChange={handleCountChange}
            backButton={backButton}
          />
        )}
      </main>
    </div>
  );
};

export default TmaApp;
