import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import React, { useEffect, useState, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeProvider';
import api, { setAccessToken, getAccessToken, refreshAccessToken } from './services/api';
import type { User } from './types';

import LoginPage from './components/pages/LoginPage';
import DashboardPage from './components/pages/DashboardPage';
import ReviewPage from './components/pages/ReviewPage';
import UsersPage from './components/pages/UsersPage';
import ProfilePage from './components/pages/ProfilePage';
import AnalyticsPage from './components/pages/AnalyticsPage';
import ChangePasswordPage from './components/pages/ChangePasswordPage';
import AuthSuccessPage from './components/pages/AuthSuccessPage';

// Компонент-обертка для защиты маршрутов
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = getAccessToken();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!token);

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch (err) {
      console.error('ProtectedRoute: Auth error', err);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }
    const init = async () => {
      await fetchUser();
    };
    init();
  }, [token, fetchUser]);

  if (!token) return <Navigate to="/login" state={{ from: location }} />;

  // Пока грузим — показываем простую заглушку
  if (loading) return <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}></div>;

  // Если пользователь должен сменить пароль и он НЕ на странице смены пароля
  if (user?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" />;
  }

  return <>{children}</>;
};

function HomeRedirect() {
  const token = getAccessToken();
  return token ? <Navigate to="/dashboard" /> : <Navigate to="/login" />;
}

function App() {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        await refreshAccessToken();
      } catch (err) {
        console.log('No active session on startup / token refresh failed', err);
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };
    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  if (isInitializing) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border)',
          borderTop: '3px solid var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/success" element={<AuthSuccessPage />} />

          {/* Защищенные маршруты */}
          <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/review" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;