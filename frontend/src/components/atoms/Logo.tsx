import React from 'react';

const Logo: React.FC<{ size?: 'sm' | 'md' | 'lg', animated?: boolean }> = ({ size = 'md', animated = false }) => {
    const squareSize = size === 'sm' ? '12px' : size === 'md' ? '16px' : '22px';
    const gap = size === 'sm' ? '2px' : '3px';
    const fontSize = size === 'sm' ? '1.1rem' : size === 'md' ? '1.5rem' : '2rem';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: gap,
                width: 'fit-content',
                animation: animated ? 'logoPulse 2s infinite' : 'none'
            }}>
                {/* Точное соответствие цветов с картинки */}
                <div style={{ width: squareSize, height: squareSize, backgroundColor: '#ff0000', borderRadius: '3px' }} />
                <div style={{ width: squareSize, height: squareSize, backgroundColor: '#00663a', borderRadius: '3px' }} />
                <div style={{ width: squareSize, height: squareSize, backgroundColor: '#00bf8e', borderRadius: '3px' }} />
                <div style={{ width: squareSize, height: squareSize, backgroundColor: '#3366cc', borderRadius: '3px' }} />
            </div>
            <div style={{
                fontSize,
                fontWeight: 900,
                fontFamily: "'Inter', system-ui, sans-serif",
                letterSpacing: '-0.04em',
                display: 'flex',
                alignItems: 'center'
            }}>
                <span style={{ color: 'var(--text-primary)' }}>Overtime</span>
                <span style={{ color: '#2563eb', marginLeft: '1px' }}>Pro</span>
            </div>

            <style>{`
                @keyframes logoPulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.9; }
                }
            `}</style>
        </div>
    );
};

export default Logo;
