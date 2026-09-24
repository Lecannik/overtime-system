import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { getStatusLabel } from '../../constants/locale';

export interface ToastItem {
    id: string;
    title: string;
    message: string;
    type?: 'success' | 'danger' | 'warning' | 'info';
    overtimeId?: number;
}

const ToastNotification: React.FC = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        const handleShowToast = (event: Event) => {
            const customEvent = event as CustomEvent;
            const data = customEvent.detail;
            if (!data) return;

            let title = 'Обновление заявки';
            let message: string;
            let type: 'success' | 'danger' | 'warning' | 'info' = 'info';

            const statusText = data.new_status ? getStatusLabel(data.new_status) : '';
            const empName = data.employee_name || 'Сотрудник';
            const reviewerName = data.reviewer_name ? ` (${data.reviewer_name})` : '';

            if (data.action === 'approved') {
                title = 'Заявка одобрена';
                message = `Заявка #${data.overtime_id} (${empName}) согласована${reviewerName}`;
                type = 'success';
            } else if (data.action === 'rejected') {
                title = 'Заявка отклонена';
                message = `Заявка #${data.overtime_id} (${empName}) отклонена${reviewerName}`;
                type = 'danger';
            } else if (data.action === 'create') {
                title = 'Новая заявка';
                message = `${empName} создал новую заявку на переработку`;
                type = 'info';
            } else if (data.action === 'cancel') {
                title = 'Заявка отменена';
                message = `Заявка #${data.overtime_id} (${empName}) отменена`;
                type = 'warning';
            } else if (data.action === 'restore') {
                title = 'Заявка восстановлена';
                message = `Заявка #${data.overtime_id} (${empName}) возвращена на рассмотрение`;
                type = 'info';
            } else if (data.message) {
                title = data.title || 'Уведомление';
                message = data.message;
                type = data.level || 'info';
            } else {
                message = `Заявка #${data.overtime_id}: ${statusText}${reviewerName}`;
            }

            const newToast: ToastItem = {
                id: `${Date.now()}_${Math.random()}`,
                title,
                message,
                type,
                overtimeId: data.overtime_id,
            };

            setToasts(prev => [newToast, ...prev].slice(0, 4));

            // Автоматическое удаление через 5 секунд
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== newToast.id));
            }, 5000);
        };

        window.addEventListener('show_toast', handleShowToast);
        return () => {
            window.removeEventListener('show_toast', handleShowToast);
        };
    }, []);

    const handleDismiss = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const handleClick = (toast: ToastItem) => {
        // Переход на страницу согласования или в дашборд
        if (window.location.pathname !== '/review') {
            navigate('/review');
        }
        setToasts(prev => prev.filter(t => t.id !== toast.id));
    };

    if (toasts.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: '380px',
            width: '100%',
            pointerEvents: 'none'
        }}>
            {toasts.map(toast => {
                const isSuccess = toast.type === 'success';
                const isDanger = toast.type === 'danger';
                const isWarning = toast.type === 'warning';

                const borderLeftColor = isSuccess ? 'var(--success)' : isDanger ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--primary)';

                return (
                    <div
                        key={toast.id}
                        onClick={() => handleClick(toast)}
                        style={{
                            pointerEvents: 'auto',
                            background: 'var(--bg-secondary)',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            borderLeft: `4px solid ${borderLeftColor}`,
                            padding: '14px 16px',
                            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease, opacity 0.2s ease',
                            backdropFilter: 'blur(10px)',
                            animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                    >
                        <div style={{ marginTop: '2px', flexShrink: 0 }}>
                            {isSuccess && <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />}
                            {isDanger && <XCircle size={18} style={{ color: 'var(--danger)' }} />}
                            {isWarning && <AlertCircle size={18} style={{ color: 'var(--warning)' }} />}
                            {!isSuccess && !isDanger && !isWarning && <Info size={18} style={{ color: 'var(--primary)' }} />}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                                {toast.title}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                {toast.message}
                            </div>
                        </div>

                        <button
                            onClick={(e) => handleDismiss(toast.id, e)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px'
                            }}
                        >
                            <X size={15} />
                        </button>
                    </div>
                );
            })}
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default ToastNotification;
