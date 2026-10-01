import React from 'react';
import {
    CheckCircle2,
    XCircle,
    Clock,
    ChevronDown,
    ChevronUp,
    MapPin,
    Edit2,
} from 'lucide-react';
import type { Overtime, User, Project } from '../../types';

interface TmaReviewCardProps {
    ot: Overtime;
    currentUser?: User | null;
    deptName?: string;
    isProcessing: boolean;
    isExpanded: boolean;
    onToggleExpand: () => void;
    approvedHoursInput: string;
    onApprovedHoursInputChange: (val: string) => void;
    isRejecting: boolean;
    rejectComment: string;
    onRejectCommentChange: (val: string) => void;
    onStartReject: () => void;
    onCancelReject: () => void;
    onSubmitReject: () => void;
    onApprove: (approvedHours?: number) => void;
    isEditingAdmin: boolean;
    onToggleAdminEdit: () => void;
    allProjects: Project[];
    adminEditProjectId: string;
    onAdminEditProjectIdChange: (val: string) => void;
    adminEditStartTime: string;
    onAdminEditStartTimeChange: (val: string) => void;
    adminEditEndTime: string;
    onAdminEditEndTimeChange: (val: string) => void;
    adminEditDesc: string;
    onAdminEditDescChange: (val: string) => void;
    isAdminUpdating: boolean;
    adminUpdateError: string;
    onSubmitAdminUpdate: () => void;
    haptic: {
        selection: () => void;
    };
    formatPeriod: (start: string, end?: string | null) => string;
}

/**
 * Карточка заявки на переработку в мобильном интерфейсе согласования TMA:
 * - Отображает информацию о сотруднике, проекте, времени и геолокации
 * - Позволяет скорректировать согласованные часы
 * - Поддерживает отклонение с обязательным указанием причины
 * - Предоставляет форму редактирования заявки администратором
 */
export const TmaReviewCard: React.FC<TmaReviewCardProps> = ({
    ot,
    currentUser,
    deptName,
    isProcessing,
    isExpanded,
    onToggleExpand,
    approvedHoursInput,
    onApprovedHoursInputChange,
    isRejecting,
    rejectComment,
    onRejectCommentChange,
    onStartReject,
    onCancelReject,
    onSubmitReject,
    onApprove,
    isEditingAdmin,
    onToggleAdminEdit,
    allProjects,
    adminEditProjectId,
    onAdminEditProjectIdChange,
    adminEditStartTime,
    onAdminEditStartTimeChange,
    adminEditEndTime,
    onAdminEditEndTimeChange,
    adminEditDesc,
    onAdminEditDescChange,
    isAdminUpdating,
    adminUpdateError,
    onSubmitAdminUpdate,
    haptic,
    formatPeriod,
}) => {
    const empName = ot.user?.full_name || ot.user?.email || 'Сотрудник';
    const projName = ot.project?.name || 'Внутренний проект';
    const hoursDisplay = ot.hours || ot.raw_hours || 0;

    return (
        <div
            style={{
                background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                opacity: isProcessing ? 0.5 : 1,
                pointerEvents: isProcessing ? 'none' : 'auto',
                transition: 'all 0.2s',
            }}
        >
            {/* Верхняя строка карточки: Сотрудник и Часы */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                        style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            flexShrink: 0,
                        }}
                    >
                        {empName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{empName}</div>
                        <div
                            style={{
                                fontSize: '0.78rem',
                                color: 'var(--tg-theme-hint-color, var(--text-muted, #94a3b8))',
                            }}
                        >
                            Заявка #{ot.id} {deptName ? `• ${deptName}` : ''}
                        </div>
                    </div>
                </div>

                {/* Бейдж часов */}
                <div
                    style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#60a5fa',
                        padding: '4px 10px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {hoursDisplay} ч
                </div>
            </div>

            {/* Проект и период */}
            <div
                style={{
                    background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                }}
            >
                <div style={{ fontWeight: 600, color: 'var(--tg-theme-text-color, #f8fafc)' }}>📁 {projName}</div>
                <div
                    style={{
                        fontSize: '0.8rem',
                        color: 'var(--tg-theme-hint-color, var(--text-muted, #94a3b8))',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                    }}
                >
                    <Clock size={13} />
                    <span>{formatPeriod(ot.start_time, ot.end_time)}</span>
                </div>
            </div>

            {/* Комментарий сотрудника */}
            {ot.description && (
                <div
                    style={{
                        fontSize: '0.86rem',
                        lineHeight: 1.4,
                        color: 'var(--tg-theme-text-color, var(--text-secondary, #cbd5e1))',
                    }}
                >
                    💬 {ot.description}
                </div>
            )}

            {/* Местоположение (если есть) */}
            {ot.location_name && (
                <div
                    style={{
                        fontSize: '0.78rem',
                        color: 'var(--tg-theme-hint-color, #94a3b8)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}
                >
                    <MapPin size={13} />
                    <span>{ot.location_name}</span>
                </div>
            )}

            {/* Корректировка часов (аккордеон) и Редактирование (для админа) */}
            <div style={{ borderTop: '1px solid var(--border, rgba(255,255,255,0.06))', paddingTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={onToggleExpand}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--tg-theme-hint-color, var(--text-muted, #94a3b8))',
                            fontSize: '0.78rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            padding: 0,
                        }}
                    >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span>{isExpanded ? 'Скрыть параметры согласования' : 'Скорректировать часы...'}</span>
                    </button>

                    {currentUser?.role === 'admin' && (
                        <button
                            type="button"
                            onClick={onToggleAdminEdit}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#60a5fa',
                                fontSize: '0.78rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                padding: 0,
                                fontWeight: 600,
                            }}
                        >
                            <Edit2 size={13} />
                            <span>{isEditingAdmin ? 'Скрыть правку' : 'Править заявку'}</span>
                        </button>
                    )}
                </div>

                {/* Форма полного редактирования заявки админом */}
                {isEditingAdmin && (
                    <div
                        style={{
                            marginTop: '10px',
                            padding: '12px',
                            borderRadius: '12px',
                            background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                        }}
                    >
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa' }}>
                            Редактирование заявки администратором (ID #{ot.id})
                        </div>

                        {adminUpdateError && (
                            <div
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: '8px',
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#ef4444',
                                    fontSize: '0.76rem',
                                }}
                            >
                                {adminUpdateError}
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
                                value={adminEditProjectId}
                                onChange={(e) => onAdminEditProjectIdChange(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    borderRadius: '8px',
                                    background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
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
                                {allProjects.map((p) => (
                                    <option key={p.id} value={p.id} style={{ background: '#1e293b', color: '#f8fafc' }}>
                                        {p.code ? `[${p.code}] ` : ''}
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.74rem',
                                        color: 'var(--tg-theme-hint-color, #94a3b8)',
                                        marginBottom: '4px',
                                    }}
                                >
                                    Начало
                                </label>
                                <input
                                    type="datetime-local"
                                    value={adminEditStartTime}
                                    onChange={(e) => onAdminEditStartTimeChange(e.target.value)}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '7px 8px',
                                        borderRadius: '8px',
                                        background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
                                        border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                                        color: 'var(--tg-theme-text-color, #f8fafc)',
                                        fontSize: '0.78rem',
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
                                    Конец
                                </label>
                                <input
                                    type="datetime-local"
                                    value={adminEditEndTime}
                                    onChange={(e) => onAdminEditEndTimeChange(e.target.value)}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '7px 8px',
                                        borderRadius: '8px',
                                        background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
                                        border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                                        color: 'var(--tg-theme-text-color, #f8fafc)',
                                        fontSize: '0.78rem',
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
                                Описание
                            </label>
                            <textarea
                                rows={2}
                                value={adminEditDesc}
                                onChange={(e) => onAdminEditDescChange(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '7px 8px',
                                    borderRadius: '8px',
                                    background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
                                    border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                                    color: 'var(--tg-theme-text-color, #f8fafc)',
                                    fontSize: '0.8rem',
                                    outline: 'none',
                                    resize: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                            <button
                                type="button"
                                onClick={onSubmitAdminUpdate}
                                disabled={isAdminUpdating}
                                style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    background: '#3b82f6',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                }}
                            >
                                {isAdminUpdating ? 'Сохранение...' : 'Сохранить изменения'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    haptic.selection();
                                    onToggleAdminEdit();
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

                {/* Поле корректировки часов (в раскрытом аккордеоне) */}
                {isExpanded && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>
                            Утвердить часов:
                        </span>
                        <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="24"
                            value={approvedHoursInput}
                            onChange={(e) => onApprovedHoursInputChange(e.target.value)}
                            placeholder={String(hoursDisplay)}
                            style={{
                                width: '130px',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                                border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                                color: 'var(--tg-theme-text-color, #f8fafc)',
                                fontSize: '0.85rem',
                                outline: 'none',
                            }}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>ч</span>
                    </div>
                )}
            </div>

            {/* Блок отказа (ввод причины) */}
            {isRejecting ? (
                <div
                    style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        borderRadius: '10px',
                        padding: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                    }}
                >
                    <textarea
                        rows={2}
                        value={rejectComment}
                        onChange={(e) => onRejectCommentChange(e.target.value)}
                        placeholder="Укажите причину отклонения (обязательно)..."
                        style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: 'var(--tg-theme-text-color, #f8fafc)',
                            fontSize: '0.85rem',
                            outline: 'none',
                            resize: 'none',
                            boxSizing: 'border-box',
                        }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={onSubmitReject}
                            disabled={isProcessing}
                            style={{
                                flex: 1,
                                padding: '8px',
                                borderRadius: '8px',
                                background: '#ef4444',
                                color: '#ffffff',
                                border: 'none',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                            }}
                        >
                            Подтвердить отказ
                        </button>
                        <button
                            type="button"
                            onClick={onCancelReject}
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
            ) : (
                /* Кнопки действий Одобрить / Отклонить */
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button
                        type="button"
                        onClick={() => {
                            const parsedHours = approvedHoursInput ? parseFloat(approvedHoursInput) : undefined;
                            onApprove(parsedHours);
                        }}
                        disabled={isProcessing}
                        style={{
                            flex: 1,
                            padding: '11px 14px',
                            borderRadius: '12px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        }}
                    >
                        <CheckCircle2 size={18} />
                        <span>Одобрить</span>
                    </button>

                    <button
                        type="button"
                        onClick={onStartReject}
                        disabled={isProcessing}
                        style={{
                            padding: '11px 16px',
                            borderRadius: '12px',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                        }}
                    >
                        <XCircle size={18} />
                        <span>Отклонить</span>
                    </button>
                </div>
            )}
        </div>
    );
};
