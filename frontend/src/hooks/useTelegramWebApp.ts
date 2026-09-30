import { useEffect, useState, useCallback, useMemo } from 'react';
import type { TelegramWebAppSDK, TelegramWebAppUser, TelegramThemeParams } from '../types';
import { setTmaInitData } from '../services/api';

/**
 * Интерфейс результата хука `useTelegramWebApp`.
 */
export interface UseTelegramWebAppResult {
  /** Флаг запуска приложения внутри Telegram Mini App. */
  isTma: boolean;
  /** Нативный инстанс SDK Telegram WebApp (если доступен). */
  webApp: TelegramWebAppSDK | null;
  /** Данные пользователя из Telegram (из initDataUnsafe). */
  telegramUser: TelegramWebAppUser | null;
  /** Сырая криптографически подписанная строка параметров запуска. */
  initData: string;
  /** Текущая цветовая схема Telegram ('light' | 'dark'). */
  colorScheme: 'light' | 'dark';
  /** Цветовые параметры темы Telegram клиента. */
  themeParams: TelegramThemeParams;
  /** Набор методов тактильного отклика (Haptic Feedback). */
  haptic: {
    impact: (style?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notification: (type: 'error' | 'success' | 'warning') => void;
    selection: () => void;
  };
  /** Развернуть WebApp на весь экран. */
  expand: () => void;
  /** Закрыть WebApp и вернуться в чат бота. */
  close: () => void;
}

/**
 * Хук для нативной интеграции с Telegram WebApp SDK.
 *
 * Автоматически инициализирует приложение (`ready`, `expand`),
 * подстраивает тему под настройки клиента Telegram и предоставляет
 * удобные обёртки для тактильного отклика (Haptics) и навигации.
 *
 * @returns {UseTelegramWebAppResult} Состояние и нативные методы TMA.
 */
export const useTelegramWebApp = (): UseTelegramWebAppResult => {
  const [webApp, setWebApp] = useState<TelegramWebAppSDK | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      setWebApp(tg);
      if (tg.initData) {
        setTmaInitData(tg.initData);
      }
      try {
        tg.ready();
        tg.expand();
        if (typeof tg.disableVerticalSwipes === 'function') {
          tg.disableVerticalSwipes();
        }
      } catch (err) {
        console.warn('[TMA] Ошибка при инициализации Telegram WebApp:', err);
      }
    }
  }, []);

  const initData = useMemo(() => {
    return webApp?.initData || '';
  }, [webApp]);

  const telegramUser = useMemo(() => {
    return webApp?.initDataUnsafe?.user || null;
  }, [webApp]);

  const isTma = useMemo(() => {
    return Boolean(webApp && initData.length > 0);
  }, [webApp, initData]);

  const colorScheme = useMemo(() => {
    return webApp?.colorScheme || 'dark';
  }, [webApp]);

  const themeParams = useMemo(() => {
    return webApp?.themeParams || {};
  }, [webApp]);

  const expand = useCallback(() => {
    try {
      webApp?.expand();
    } catch {
      // Игнорируем в веб-режиме
    }
  }, [webApp]);

  const close = useCallback(() => {
    try {
      webApp?.close();
    } catch {
      // Игнорируем в веб-режиме
    }
  }, [webApp]);

  const haptic = useMemo(() => ({
    impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
      try {
        webApp?.HapticFeedback?.impactOccurred(style);
      } catch {
        // Fallback если устройство не поддерживает вибрацию
      }
    },
    notification: (type: 'error' | 'success' | 'warning') => {
      try {
        webApp?.HapticFeedback?.notificationOccurred(type);
      } catch {
        // Fallback
      }
    },
    selection: () => {
      try {
        webApp?.HapticFeedback?.selectionChanged();
      } catch {
        // Fallback
      }
    },
  }), [webApp]);

  return {
    isTma,
    webApp,
    telegramUser,
    initData,
    colorScheme,
    themeParams,
    haptic,
    expand,
    close,
  };
};

export default useTelegramWebApp;
