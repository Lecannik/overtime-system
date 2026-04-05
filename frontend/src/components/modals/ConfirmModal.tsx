import React from 'react';
import { AlertCircle, Info, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onClose: () => void;
    loading?: boolean;
    type?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen, title, message, onConfirm, onClose, loading, confirmText = 'Подтвердить', cancelText = 'Отмена', type = 'warning'
}) => {
    if (!isOpen) return null;

    const config = {
        danger: { color: 'var(--danger)', bg: '#fee2e2', icon: Trash2 },
        warning: { color: 'var(--warning)', bg: '#fef3c7', icon: AlertCircle },
        info: { color: 'var(--info)', bg: '#e0f2fe', icon: Info }
    };

    const active = config[type];
    const Icon = active.icon;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 3000 }}>
            <div className="modal-content glass-card animate-scale-in"
                style={{ maxWidth: '420px', padding: '32px', borderRadius: '24px' }}
                onClick={e => e.stopPropagation()}>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                    <div className="icon-shape" style={{ width: '64px', height: '64px', background: active.bg, color: active.color, borderRadius: '20px' }}>
                        <Icon size={32} />
                    </div>
                </div>

                <h3 style={{ textAlign: 'center', marginBottom: '12px', fontWeight: 800, fontSize: '1.25rem' }}>{title}</h3>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '1rem', lineHeight: '1.5' }}>{message}</p>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={onClose} className="secondary" style={{ flex: 1 }} disabled={loading}>{cancelText}</button>
                    <button
                        onClick={onConfirm}
                        className="primary"
                        style={{ flex: 1.5, background: type === 'danger' ? 'var(--danger)' : 'var(--primary)', color: 'white' }}
                        disabled={loading}
                    >
                        {loading ? 'Секунду...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
