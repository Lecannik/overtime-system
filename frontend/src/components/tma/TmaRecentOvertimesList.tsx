import React from 'react';
import { Edit2 } from 'lucide-react';
import type { Overtime, Project } from '../../types';
import { STATUS_LABELS } from '../../constants/locale';

interface TmaRecentOvertimesListProps {
    recentOvertimes: Overtime[];
    editingOt: Overtime | null;
    onStartEdit: (ot: Overtime) => void;
    onCancelEdit: () => void;
    editProjectId: string;
    onEditProjectIdChange: (val: string) => void;
    editStartTime: string;
    onEditStartTimeChange: (val: string) => void;
    editEndTime: string;
    onEditEndTimeChange: (val: string) => void;
    editDesc: string;
    onEditDescChange: (val: string) => void;
    isUpdating: boolean;
    updateError: string;
    onSubmitUpdate: () => void;
    projects: Project[];
    maxAllowedDateTime: string;
    haptic: {
        selection: () => void;
    };
}

/**
 * Список недавних заявок на переработку сотрудника с отображением статусов
 * и возможностью редактирования заявок, находящихся на согласовании.
 */
export const TmaRecentOvertimesList: React.FC<TmaRecentOvertimesListProps> = ({
    recentOvertimes,
    editingOt,
    onStartEdit,
    onCancelEdit,
    editProjectId,
    onEditProjectIdChange,
    editStartTime,
    onEditStartTimeChange,
    editEndTime,
    onEditEndTimeChange,
    editDesc,
    onEditDescChange,
    isUpdating,
    updateError,
    onSubmitUpdate,
    projects,
    maxAllowedDateTime,
    haptic,
}) => {
    if (recentOvertimes.length === 0) return null;

    const getStatusBadgeProps = (status: string) => {
        const text = STATUS_LABELS[status] || status;
        switch (status) {
            case 'APPROVED':
                return { text, bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
            case 'REJECTED':
            case 'CANCELLED':
                return { text, bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
            case 'IN_PROGRESS':
                return { text, bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' };
            case 'MANAGER_APPROVED':
                return { text: 'Одобрено менеджером', bg: 'rgba(8, 145, 178, 0.15)', color: '#0891b2' };
            case 'HEAD_APPROVED':
                return { text: 'Одобрено нач. отдела', bg: 'rgba(37, 99, 235, 0.15)', color: '#2563eb' };
            case 'PENDING':
            default:
                return { text: 'На согласовании', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0 4px', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>
                Недавние переработки
            </div>
            {recentOvertimes.map((ot) => {
                const { text: badgeText, bg: badgeBg, color: badgeColor } = getStatusBadgeProps(ot.status);
                const isApproved =
                    ot.status === 'APPROVED' ||
                    ot.status === 'MANAGER_APPROVED' ||
                    ot.status === 'HEAD_APPROVED';
                const canEdit =
                    ot.status === 'PENDING' ||
                    ot.status === 'HEAD_APPROVED' ||
                    ot.status === 'MANAGER_APPROVED';
                const isBeingEdited = editingOt?.id === ot.id;

                return (
                    <div
                        key={ot.id}
                        style={{
                            background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
                            borderRadius: '14px',
                            padding: '12px 14px',
                            border: isBeingEdited
                                ? '1px solid rgba(59, 130, 246, 0.4)'
                                : '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                <span
                                    style={{
                                        fontWeight: 600,
                                        fontSize: '0.88rem',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    📁 {ot.project?.name || 'Проект'}
                                </span>
                                <span style={{ fontSize: '0.74rem', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>
                                    {new Date(ot.start_time).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })},{' '}
                                    {new Date(ot.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                    {ot.end_time && ` — ${new Date(ot.end_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: isApproved ? '#10b981' : '#60a5fa' }}>
                                    {ot.hours || ot.raw_hours || 0} ч
                                </span>
                                <span
                                    style={{
                                        background: badgeBg,
                                        color: badgeColor,
                                        fontSize: '0.74rem',
                                        fontWeight: 700,
                                        padding: '4px 8px',
                                        borderRadius: '8px',
                                    }}
                                >
                                    {badgeText}
                                </span>

                                {canEdit && !isBeingEdited && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            haptic.selection();
                                            onStartEdit(ot);
                                        }}
                                        style={{
                                            background: 'rgba(59, 130, 246, 0.12)',
                                            border: '1px solid rgba(59, 130, 246, 0.25)',
                                            color: '#60a5fa',
                                            padding: '5px 8px',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '0.74rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <Edit2 size={12} />
                                        <span>Изменить</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Описание заявки если не редактируется */}
                        {!isBeingEdited && ot.description && (
                            <div
                                style={{
                                    fontSize: '0.8rem',
                                    color: 'var(--tg-theme-text-color, var(--text-secondary, #cbd5e1))',
                                    lineHeight: 1.35,
                                }}
                            >
                                💬 {ot.description}
                            </div>
                        )}

                        {/* Форма редактирования */}
                        {isBeingEdited && (
                            <div
                                style={{
                                    marginTop: '4px',
                                    paddingTop: '10px',
                                    borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px',
                                }}
                            >
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#60a5fa' }}>
                                    Редактирование заявки #{ot.id}
                                </div>

                                {updateError && (
                                    <div
                                        style={{
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            background: 'rgba(239, 68, 68, 0.12)',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            color: '#ef4444',
                                            fontSize: '0.78rem',
                                        }}
                                    >
                                        {updateError}
                                    </div>
                                )}

                                <div>
                                    <label
                                        style={{
                                            display: 'block',
                                            fontSize: '0.74rem',
                                            color: 'var(--tg-theme-hint-color, #94a3b8)',
                                            marginBottom: '4px',
                                        }}
                                    >
                                        Проект
                                    </label>
                                    <select
                                        value={editProjectId}
                                        onChange={(e) => onEditProjectIdChange(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                                            border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                                            color: 'var(--tg-theme-text-color, #f8fafc)',
                                            fontSize: '0.82rem',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                        }}
                                    >
                                        <option value="" style={{ background: '#1e293b', color: '#f8fafc' }}>
                                            Выберите проект...
                                        </option>
                                        {projects.map((p) => (
                                            <option key={p.id} value={p.id.toString()} style={{ background: '#1e293b', color: '#f8fafc' }}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div>
                                        <label
                                            style={{
                                                display: 'block',
                                                fontSize: '0.74rem',
                                                color: 'var(--tg-theme-hint-color, #94a3b8)',
                                                marginBottom: '4px',
                                            }}
                                        >
                                            Время начала
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={editStartTime}
                                            max={maxAllowedDateTime}
                                            onChange={(e) => onEditStartTimeChange(e.target.value)}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '8px 10px',
                                                borderRadius: '8px',
                                                background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                                                border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                                                color: 'var(--tg-theme-text-color, #f8fafc)',
                                                fontSize: '0.82rem',
                                                outline: 'none',
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label
                                            style={{
                                                display: 'block',
                                                fontSize: '0.74rem',
                                                color: 'var(--tg-theme-hint-color, #94a3b8)',
                                                marginBottom: '4px',
                                            }}
                                        >
                                            Время окончания
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={editEndTime}
                                            max={maxAllowedDateTime}
                                            onChange={(e) => onEditEndTimeChange(e.target.value)}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '8px 10px',
                                                borderRadius: '8px',
                                                background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                                                border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                                                color: 'var(--tg-theme-text-color, #f8fafc)',
                                                fontSize: '0.82rem',
                                                outline: 'none',
                                            }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label
                                        style={{
                                            display: 'block',
                                            fontSize: '0.74rem',
                                            color: 'var(--tg-theme-hint-color, #94a3b8)',
                                            marginBottom: '4px',
                                        }}
                                    >
                                        Описание выполненных работ
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={editDesc}
                                        onChange={(e) => onEditDescChange(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                                            border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                                            color: 'var(--tg-theme-text-color, #f8fafc)',
                                            fontSize: '0.82rem',
                                            outline: 'none',
                                            resize: 'none',
                                            boxSizing: 'border-box',
                                        }}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        disabled={isUpdating}
                                        onClick={onSubmitUpdate}
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            background: 'var(--tg-theme-button-color, var(--primary, #3b82f6))',
                                            color: 'var(--tg-theme-button-text-color, #ffffff)',
                                            border: 'none',
                                            fontWeight: 600,
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {isUpdating ? 'Сохранение...' : 'Сохранить'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            haptic.selection();
                                            onCancelEdit();
                                        }}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            color: 'var(--tg-theme-text-color, #f8fafc)',
                                            border: 'none',
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Отмена
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
