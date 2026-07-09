/* eslint-disable */
import React, { useEffect, useState } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import type { Overtime, User } from '../../../types';

interface BulkActionsProps {
    selectedIds: number[];
    overtimes: Overtime[];
    currentUser: User | null;
    onClear: () => void;
    onSubmit: (approved: boolean, comment: string, role: string, approvedHours?: number) => void;
}

const BulkActions: React.FC<BulkActionsProps> = ({
    selectedIds,
    overtimes,
    currentUser,
    onClear,
    onSubmit,
}) => {
    const [asRole, setAsRole] = useState<string>('');
    const [comment, setComment] = useState<string>('');
    const [approvedHours, setApprovedHours] = useState<string>('');

    // Если выбрана ровно одна заявка, разрешаем скорректировать её часы перед согласованием
    const singleOvertime = selectedIds.length === 1
        ? overtimes.find(ot => ot.id === selectedIds[0])
        : undefined;

    useEffect(() => {
        setApprovedHours(singleOvertime ? Math.round(singleOvertime.hours || 0).toString() : '');
    }, [singleOvertime?.id]);

    if (selectedIds.length === 0) return null;

    const handleSubmit = (approved: boolean) => {
        if (singleOvertime) {
            const hoursVal = parseFloat(approvedHours);
            if (isNaN(hoursVal) || hoursVal < 0) {
                alert('Пожалуйста, введите корректное количество часов.');
                return;
            }
            onSubmit(approved, comment, asRole, hoursVal);
        } else {
            onSubmit(approved, comment, asRole);
        }
    };

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
                        padding: '0 12px',
                        height: '32px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    Выбрано: {selectedIds.length}
                </span>
                <button
                    onClick={onClear}
                    className="action-button-modern"
                    style={{
                        width: 'auto',
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

                {singleOvertime && (
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={approvedHours}
                        onChange={e => setApprovedHours(e.target.value.replace(/\D/g, ''))}
                        placeholder="Часов..."
                        title="Утвержденное количество часов"
                        style={{
                            height: '36px',
                            width: '80px',
                            borderRadius: '8px',
                            fontSize: '0.82rem',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            padding: '0 10px',
                            textAlign: 'center',
                        }}
                    />
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
                        onClick={() => handleSubmit(true)}
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
                        onClick={() => handleSubmit(false)}
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
