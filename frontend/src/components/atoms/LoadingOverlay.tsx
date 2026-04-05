import React from 'react';
import Logo from './Logo';

const LoadingOverlay: React.FC = () => {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'var(--bg-main)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            gap: '32px'
        }}>
            <Logo size="lg" animated={true} />
            <div style={{
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontWeight: 600
            }}>
                Загрузка данных...
            </div>
        </div>
    );
};

export default LoadingOverlay;
