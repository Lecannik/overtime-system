import React from 'react';

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    style?: React.CSSProperties;
    className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = '20px',
    borderRadius = '8px',
    style,
    className = ''
}) => {
    return (
        <div
            className={`skeleton-base ${className}`}
            style={{
                width,
                height,
                borderRadius,
                background: 'linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border) 50%, var(--bg-tertiary) 75%)',
                backgroundSize: '200% 100%',
                animation: 'skeleton-loading 1.5s infinite linear',
                ...style
            }}
        />
    );
};

export default Skeleton;
