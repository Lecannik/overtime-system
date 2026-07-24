import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { refreshAccessToken } from '../../services/api';

const AuthSuccessPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const handleAuthSuccess = async () => {
      try {
        // Попытка безопасно восстановить сессию по HTTPOnly куке refresh_token,
        // установленной сервером при редиректе с Authentik SSO
        const token = await refreshAccessToken();
        if (token && isMounted) {
          navigate('/dashboard');
        } else if (isMounted) {
          navigate('/login');
        }
      } catch (err) {
        console.error('Ошибка автоматического входа SSO:', err);
        if (isMounted) {
          navigate('/login');
        }
      }
    };

    handleAuthSuccess();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg-main)',
      color: 'var(--text-primary)'
    }}>
      <h2 style={{ marginBottom: '16px', fontWeight: 800 }}>Авторизация успешна</h2>
      <p style={{ color: 'var(--text-secondary)' }}>Перенаправление в систему...</p>
      <div style={{ 
        marginTop: '24px', 
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
};

export default AuthSuccessPage;

