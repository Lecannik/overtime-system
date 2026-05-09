import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';

import LoginPage from './components/pages/LoginPage';
import DashboardPage from './components/pages/DashboardPage';
import ReviewPage from './components/pages/ReviewPage';
import UsersPage from './components/pages/UsersPage';
import ProfilePage from './components/pages/ProfilePage';
import AnalyticsPage from './components/pages/AnalyticsPage';
import CRMPage from './components/pages/CRMPage';
import CounterpartiesPage from './components/pages/CounterpartiesPage';
import TasksPage from './components/pages/TasksPage';
import ProjectsPage from './components/pages/ProjectsPage';
import OrgStructurePage from './components/pages/OrgStructurePage';
import CRMSettingsPage from './components/pages/CRMSettingsPage';
import SystemSettingsPage from './components/pages/SystemSettingsPage';
import BPMPage from './components/pages/BPMPage';
import ChangePasswordPage from './components/pages/ChangePasswordPage';
import ProjectDetailPage from './components/pages/ProjectDetailPage';
import ProjectEditPage from './components/pages/ProjectEditPage';
import DealDetailPage from './components/pages/DealDetailPage';
import LeadDetailPage from './components/pages/LeadDetailPage';
import LeadCreatePage from './components/pages/LeadCreatePage';
import DealCreatePage from './components/pages/DealCreatePage';

// Компонент-обертка для защиты маршрутов
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // @ts-ignore
  if (user?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" />;
  }

  return <MainLayout>{children}</MainLayout>;
};

function HomeRedirect() {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Защищенные маршруты */}
            <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
            <Route path="/projects/:id/edit" element={<ProtectedRoute><ProjectEditPage /></ProtectedRoute>} />
            <Route path="/review" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            {/* CRM маршруты */}
            <Route path="/crm" element={<ProtectedRoute><CRMPage /></ProtectedRoute>} />
            <Route path="/leads/new" element={<ProtectedRoute><LeadCreatePage /></ProtectedRoute>} />
            <Route path="/leads/:id" element={<ProtectedRoute><LeadDetailPage /></ProtectedRoute>} />
            <Route path="/deals/new" element={<ProtectedRoute><DealCreatePage /></ProtectedRoute>} />
            <Route path="/deals/:id" element={<ProtectedRoute><DealDetailPage /></ProtectedRoute>} />
            <Route path="/counterparties" element={<ProtectedRoute><CounterpartiesPage /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
            <Route path="/admin/org" element={<ProtectedRoute><OrgStructurePage /></ProtectedRoute>} />
            <Route path="/admin/crm-settings" element={<ProtectedRoute><CRMSettingsPage /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute><SystemSettingsPage /></ProtectedRoute>} />
            <Route path="/admin/bpm" element={<ProtectedRoute><BPMPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
