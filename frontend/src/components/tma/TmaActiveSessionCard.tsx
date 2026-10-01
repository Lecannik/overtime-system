import React from 'react';
import { Square, AlertCircle } from 'lucide-react';
import type { Overtime } from '../../types';

interface TmaActiveSessionCardProps {
    activeSession: Overtime;
    elapsedSeconds: number;
    stopComment: string;
    onStopCommentChange: (val: string) => void;
    stopError: string;
    isStopping: boolean;
    onStopSession: () => void;
    formatElapsedTime: (totalSeconds: number) => string;
}

/**
 * Карточка активной сессии сверхурочной работы с живым цифровым секундомером
 * и формой фиксации результатов смены.
 */
export const TmaActiveSessionCard: React.FC<TmaActiveSessionCardProps> = ({
    activeSession,
    elapsedSeconds,
    stopComment,
    onStopCommentChange,
    stopError,
    isStopping,
    onStopSession,
    formatElapsedTime,
}) => {
    return (
        <div
            style={{
                background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
                borderRadius: '20px',
                padding: '24px 20px',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                boxShadow: '0 8px 30px rgba(16, 185, 129, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '16px',
            }}
        >
            {/* Пульсирующий бейдж */}
            <div
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#10b981',
                }}
            >
                <span
                    style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#10b981',
                        boxShadow: '0 0 10px #10b981',
                        display: 'inline-block',
                    }}
                />
                Сессия активна
            </div>

            {/* Цифровой секундомер */}
            <div
                style={{
                    fontFamily: 'monospace, -apple-system',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: '2.8rem',
                    fontWeight: 800,
                    letterSpacing: '2px',
                    color: 'var(--tg-theme-text-color, #f8fafc)',
                    margin: '4px 0',
                }}
            >
                {formatElapsedTime(elapsedSeconds)}
            </div>

            {/* Детали сессии */}
            <div
                style={{
                    width: '100%',
                    background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontSize: '0.86rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    textAlign: 'left',
                }}
            >
                <div style={{ fontWeight: 600 }}>
                    📁 {activeSession.project?.name || 'Проект'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>
                    Начало: {new Date(activeSession.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>

            {/* Поле комментария к закрытию */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                    style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: stopError ? '#ef4444' : 'var(--tg-theme-text-color, #f8fafc)',
                        textAlign: 'left',
                    }}
                >
                    Отчет о выполненных работах <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                    rows={3}
                    value={stopComment}
                    onChange={(e) => onStopCommentChange(e.target.value)}
                    placeholder="Подробно опишите, какие задачи были выполнены за смену (обязательно для завершения)..."
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                        border: stopError ? '1px solid #ef4444' : '1px solid var(--border, rgba(255, 255, 255, 0.12))',
                        color: 'var(--tg-theme-text-color, #f8fafc)',
                        fontSize: '0.88rem',
                        outline: 'none',
                        resize: 'none',
                        boxSizing: 'border-box',
                    }}
                />
                {stopError && (
                    <div
                        style={{
                            color: '#ef4444',
                            fontSize: '0.78rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontWeight: 500,
                        }}
                    >
                        <AlertCircle size={14} style={{ flexShrink: 0 }} />
                        <span>{stopError}</span>
                    </div>
                )}
            </div>

            {/* Большая кнопка завершения */}
            <button
                type="button"
                onClick={onStopSession}
                disabled={isStopping}
                style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                    color: '#ffffff',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: isStopping ? 'not-allowed' : 'pointer',
                    opacity: isStopping ? 0.7 : 1,
                    boxShadow: '0 6px 20px rgba(239, 68, 68, 0.35)',
                }}
            >
                <Square size={20} fill="#ffffff" />
                <span>{isStopping ? 'Завершение...' : 'Завершить переработку'}</span>
            </button>
        </div>
    );
};
