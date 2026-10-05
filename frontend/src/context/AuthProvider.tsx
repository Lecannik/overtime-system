import React, { useState, useEffect, useCallback } from 'react';
import api, { getAccessToken, setAccessToken, refreshAccessToken, onTokenChange, logout as apiLogout } from '../services/api';
import { AuthContext } from './AuthContext';
import type { User } from '../types';

/**
 * Провайдер контекста аутентификации.
 *
 * Централизованно управляет состоянием текущего пользователя, токена доступа
 * и сессии приложения, изолируя работу с токенами и авторизацией.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(getAccessToken());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUser = useCallback(async (): Promise<User | null> => {
    try {
      const res = await api.get<User>('/auth/me');
      setUser(res.data);
      return res.data;
    } catch {
      setUser(null);
      setAccessToken(null);
      setTokenState(null);
      return null;
    }
  }, []);

  const login = useCallback((newToken: string, newUser?: User) => {
    setAccessToken(newToken);
    setTokenState(newToken);
    if (newUser) {
      setUser(newUser);
    } else {
      fetchUser();
    }
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Игнорируем сетевые ошибки при выходе
    } finally {
      setAccessToken(null);
      setTokenState(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    return await fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    const unsubscribe = onTokenChange((newToken) => {
      setTokenState(newToken);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const freshToken = await refreshAccessToken();
        if (freshToken && isMounted) {
          setTokenState(freshToken);
          await fetchUser();
        }
      } catch {
        // Сессия отсутствует или истекла
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [fetchUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
