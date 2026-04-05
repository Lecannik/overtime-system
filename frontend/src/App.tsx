import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import api from './services/api';

import LoginPage from './components/pages/LoginPage';
import DashboardPage from './components/pages/DashboardPage';
import ReviewPage from './components/pages/ReviewPage';
import UsersPage from './components/pages/UsersPage';
import ProfilePage from './components/pages/ProfilePage';
import AnalyticsPage from './components/pages/AnalyticsPage';
import ChangePasswordPage from './components/pages/ChangePasswordPage';

// Компонент-обертка для защиты маршрутов
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    const fetchUser = async () => {
      try {
        // console.log('ProtectedRoute: fetching user...');
        const res = await api.get('/auth/me');
        setUser(res.data);
      } catch (err) {
        console.error('ProtectedRoute: Auth error', err);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [token]);

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
  const token = localStorage.getItem('token');
  return token ? <Navigate to="/dashboard" /> : <Navigate to="/login" />;
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Защищенные маршруты */}
          <Route path="/change-password" element={<ChangePasswordPage />} />
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