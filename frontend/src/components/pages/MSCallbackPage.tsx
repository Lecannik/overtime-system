import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';

const MSCallbackPage: React.FC = () => {
    const [status, setStatus] = useState('Обработка авторизации...');
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const handleCallback = async () => {
            const params = new URLSearchParams(location.search);
            const code = params.get('code');

            if (!code) {
                setError('Код авторизации не найден');
                return;
            }

            try {
                const response = await api.get(`/auth/microsoft/callback?code=${code}`);
                const { access_token } = response.data;

                if (access_token) {
                    localStorage.setItem('token', access_token);
                    setStatus('Успешно! Перенаправление...');
                    setTimeout(() => navigate('/dashboard'), 1000);
                } else {
                    setError('Не удалось получить токен доступа');
                }
            } catch (err: any) {
                console.error('MS Callback Error:', err);
                setError(err.response?.data?.detail || 'Ошибка при обмене кода на токен');
            }
        };

        handleCallback();
    }, [location, navigate]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'sans-serif'
        }}>
            {error ? (
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ color: '#ef4444' }}>Ошибка</h2>
                    <p>{error}</p>
                    <button
                        onClick={() => navigate('/login')}
                        style={{
                            marginTop: '20px',
                            padding: '10px 20px',
                            background: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer'
                        }}
                    >
                        Вернуться на страницу входа
                    </button>
                </div>
            ) : (
                <div style={{ textAlign: 'center' }}>
                    <div className="loader" style={{
                        border: '4px solid #f3f3f3',
                        borderTop: '4px solid #2563eb',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 20px'
                    }}></div>
                    <h2>{status}</h2>
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
};

export default MSCallbackPage;
