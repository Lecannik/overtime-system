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
            className="animate-fade-in"
            style={{
                position: 'sticky',
                top: '16px',
                zIndex: 100,
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--primary)',
                boxShadow: '0 8px 32px rgba(59, 130, 246, 0.25)',
                borderRadius: '16px',
                padding: '16px 24px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                    style={{
                        background: 'var(--primary-gradient)',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                    }}
                >
                    Выбрано: {selectedIds.length}
                </div>
                <button
                    onClick={onClear}
                    className="action-button-modern"
                    style={{ height: '36px', padding: '0 12px', gap: '6px', fontSize: '0.85rem' }}
                    title="Сбросить выбор"
                >
                    <RotateCcw size={14} /> Сбросить
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '300px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {currentUser?.role === 'admin' && (
                    <select
                        value={asRole}
                        onChange={e => setAsRole(e.target.value)}
                        style={{
                            height: '38px',
                            padding: '0 12px',
                            fontSize: '0.8rem',
                            borderRadius: '10px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
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
                        height: '38px',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        padding: '0 12px',
                        flex: 1,
                        maxWidth: '300px',
                    }}
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => onSubmit(true, comment, asRole)}
                        className="primary"
                        style={{
                            height: '38px',
                            padding: '0 20px',
                            background: 'var(--success-gradient)',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <Check size={16} /> Одобрить
                    </button>
                    <button
                        onClick={() => onSubmit(false, comment, asRole)}
                        className="primary"
                        style={{
                            height: '38px',
                            padding: '0 20px',
                            background: 'var(--danger-gradient)',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <X size={16} /> Отклонить
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkActions;
