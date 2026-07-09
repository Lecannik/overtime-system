/* eslint-disable */
import React, { useState } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import type { User } from '../../../types';

interface BulkActionsProps {
    selectedIds: number[];
    currentUser: User | null;
    onClear: () => void;
    onSubmit: (approved: boolean, comment: string, role: string) => void;
}

const BulkActions: React.FC<BulkActionsProps> = ({
    selectedIds,
    currentUser,
    onClear,
    onSubmit,
}) => {
    const [asRole, setAsRole] = useState<string>('');
    const [comment, setComment] = useState<string>('');

    if (selectedIds.length === 0) return null;

    return (
        <div
            className="animate-fade-in bulk-actions-overlay"
            style={{
                position: 'sticky',
                top: '16px',
                zIndex: 100,
                background: 'rgba(15, 23, 42, 0.96)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
                borderRadius: '16px',
                padding: '12px 20px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
            }}
        >
            {/* Левая секция: Счетчик и сброс */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                    style={{
                        background: 'var(--primary-gradient)',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                    }}
                >
                    Выбрано: {selectedIds.length}
                </span>
                <button
                    onClick={onClear}
                    className="action-button-modern"
                    style={{
                        height: '32px',
                        padding: '0 12px',
                        gap: '6px',
                        fontSize: '0.78rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    title="Сбросить выбор"
                >
                    <RotateCcw size={12} /> Сбросить
                </button>
            </div>

            {/* Правая секция: Ввод роли, комментария и кнопки согласования */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flex: '1 1 auto',
                justifyContent: 'flex-end',
                flexWrap: 'wrap'
            }}>
                {currentUser?.role === 'admin' && (
                    <select
                        value={asRole}
                        onChange={e => setAsRole(e.target.value)}
                        style={{
                            height: '36px',
                            padding: '0 10px',
                            fontSize: '0.8rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            width: '130px',
                            cursor: 'pointer',
                        }}
                    >
                        <option value="">Как Админ</option>
                        <option value="manager">Как Менеджер</option>
                        <option value="head">Как Нач. отдела</option>
                    </select>
                )}

                <input
                    placeholder="Массовый комментарий (необязательно)..."
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    style={{
                        height: '36px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        padding: '0 12px',
                        flex: '1 1 200px',
                        maxWidth: '280px',
                    }}
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => onSubmit(true, comment, asRole)}
                        className="primary"
                        style={{
                            height: '36px',
                            padding: '0 16px',
                            background: 'var(--success-gradient)',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            borderRadius: '8px',
                        }}
                    >
                        <Check size={14} /> Одобрить
                    </button>
                    <button
                        onClick={() => onSubmit(false, comment, asRole)}
                        className="primary"
                        style={{
                            height: '36px',
                            padding: '0 16px',
                            background: 'var(--danger-gradient)',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            borderRadius: '8px',
                        }}
                    >
                        <X size={14} /> Отклонить
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkActions;
