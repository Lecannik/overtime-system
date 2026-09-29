import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeProvider';
import { AuthProvider } from './context/AuthProvider';
import { useAuth } from './context/AuthContext';
import ToastNotification from './components/atoms/ToastNotification';

// Динамический импорт страниц для оптимизации размера бандла (Code Splitting)
const LoginPage = React.lazy(() => import('./components/pages/LoginPage'));
const DashboardPage = React.lazy(() => import('./components/pages/DashboardPage'));
const ReviewPage = React.lazy(() => import('./components/pages/ReviewPage'));
const UsersPage = React.lazy(() => import('./components/pages/UsersPage'));
const ProfilePage = React.lazy(() => import('./components/pages/ProfilePage'));
const AnalyticsPage = React.lazy(() => import('./components/pages/AnalyticsPage'));
const ChangePasswordPage = React.lazy(() => import('./components/pages/ChangePasswordPage'));
const AuthSuccessPage = React.lazy(() => import('./components/pages/AuthSuccessPage'));

/**
 * Индикатор загрузки для Suspense и инициализации приложения.
 */
const PageLoadingFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
    }}
  >
    <div
      style={{
        width: '40px',
        height: '40px',
        border: '3px solid var(--border)',
        borderTop: '3px solid var(--primary)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

/**
 * Защищенный маршрут: пропускает только авторизованных пользователей.
 * Если требуется смена пароля — перенаправляет на /change-password.
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <PageLoadingFallback />;
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} />;
  }

  // Если пользователю назначен временный пароль — принудительно направляем на смену
  if (user?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" />;
  }

  return <>{children}</>;
};

/**
 * Перенаправление с корня: на /dashboard для авторизованных, иначе на /login.
 */
const HomeRedirect: React.FC = () => {
  const { token, isLoading } = useAuth();
  if (isLoading) return <PageLoadingFallback />;
  return token ? <Navigate to="/dashboard" /> : <Navigate to="/login" />;
};

/**
 * Роутинг приложения с ленивой загрузкой компонентов через Suspense.
 */
const AppRoutes: React.FC = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <PageLoadingFallback />;
  }

  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/success" element={<AuthSuccessPage />} />

        {/* Защищенные маршруты */}
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/review"
          element={
            <ProtectedRoute>
              <ReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />

        {/* Fallback для неизвестных маршрутов */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <ToastNotification />
    </Suspense>
  );
};

/**
 * Корневой компонент приложения.
 */
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
