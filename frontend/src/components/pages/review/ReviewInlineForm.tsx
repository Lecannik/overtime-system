/* eslint-disable */
import React, { useState } from 'react';
import type { Overtime, User } from '../../../types';

interface ReviewInlineFormProps {
    overtime: Overtime;
    currentUser: User | null;
    onCancel: () => void;
    onSubmit: (approved: boolean, comment: string, role: string, approvedHours: number) => void;
}

const ReviewInlineForm: React.FC<ReviewInlineFormProps> = ({
    overtime: ot,
    currentUser,
    onCancel,
    onSubmit,
}) => {
    const [asRole, setAsRole] = useState<string>('');
    const [approvedHours, setApprovedHours] = useState<string>(Math.round(ot.hours || 0).toString());
    const [comment, setComment] = useState<string>('');

    const handleAction = (approved: boolean) => {
        const hoursVal = parseFloat(approvedHours);
        if (isNaN(hoursVal) || hoursVal < 0) {
            alert('Пожалуйста, введите корректное количество часов.');
            return;
        }
        onSubmit(approved, comment, asRole, hoursVal);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentUser?.role === 'admin' && (
                <select
                    value={asRole}
                    onChange={e => setAsRole(e.target.value)}
                    style={{
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        width: '100%'
                    }}
                >
                    <option value="">Как Админ</option>
                    <option value="manager">Как Менеджер</option>
                    <option value="head">Как Нач. отдела</option>
                </select>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
                <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={approvedHours}
                    onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setApprovedHours(val);
                    }}
                    placeholder="Часов..."
                    style={{
                        height: '36px',
                        background: 'var(--bg-secondary)',
                        width: '80px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        textAlign: 'center',
                        fontSize: '0.85rem'
                    }}
                />
                <input
                    placeholder="Комментарий..."
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    style={{
                        height: '36px',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        flex: 1,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        padding: '0 10px'
                    }}
                />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    onClick={() => handleAction(true)}
                    className="primary"
                    style={{ flex: 1, height: '36px', background: 'var(--success-gradient)', fontSize: '0.85rem' }}
                >
                    Одобрить
                </button>
                <button
                    onClick={() => handleAction(false)}
                    className="primary"
                    style={{ flex: 1, height: '36px', background: 'var(--danger-gradient)', fontSize: '0.85rem' }}
                >
                    Отклонить
                </button>
            </div>
            <button
                onClick={onCancel}
                style={{
                    background: 'none',
                    border: '1px solid var(--error)',
                    color: 'var(--error)',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '8px',
                    width: '100%',
                    transition: 'background 0.2s'
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
                ОТМЕНА
            </button>
        </div>
    );
};

export default ReviewInlineForm;
