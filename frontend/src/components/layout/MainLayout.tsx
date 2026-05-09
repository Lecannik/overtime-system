import React from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import LoadingOverlay from '../atoms/LoadingOverlay';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useAuth();

  if (loading) return <LoadingOverlay />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main style={{ 
        flex: 1, 
        marginLeft: '280px', 
        padding: '40px',
        width: 'calc(100% - 280px)'
      }}>
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
