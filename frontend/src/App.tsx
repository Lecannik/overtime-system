import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';

import LoginPage from './components/pages/LoginPage';
import DashboardPage from './components/pages/DashboardPage';
import ReviewPage from './components/pages/ReviewPage';
import UsersPage from './components/pages/UsersPage';
import ProfilePage from './components/pages/ProfilePage';
import AnalyticsPage from './components/pages/AnalyticsPage';

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
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;