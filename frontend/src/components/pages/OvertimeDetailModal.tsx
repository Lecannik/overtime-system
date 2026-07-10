/* eslint-disable */
import React, { useState, useRef, useCallback } from 'react';
import { X, Calendar, Clock, MapPin, Tag, FileText, User as UserIcon, ShieldCheck, AlertCircle, Edit2 } from 'lucide-react';
import { STATUS_LABELS, formatDateTime } from '../../constants/locale';
import type { Overtime, User } from '../../types';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import { Russian } from 'flatpickr/dist/l10n/ru.js';
import { updateOvertime, getAdminProjects } from '../../services/api';

const toLocalISOString = (date: Date): string => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

interface OvertimeDetailModalProps {
    overtime: Overtime;
    onClose: () => void;
    onStatusUpdate?: () => void;
    currentUser?: User | null;
    onReview?: (
        id: number,
        approved: boolean,
        commentText?: string,
        roleText?: string,
        approvedHoursVal?: number
    ) => Promise<void>;
}

const OvertimeDetailModal: React.FC<OvertimeDetailModalProps> = ({
    overtime,
    onClose,
    currentUser,
    onReview,
    onStatusUpdate
}) => {
    const [asRole, setAsRole] = useState<string>('');
    const [approvedHours, setApprovedHours] = useState<string>(Math.round(overtime.hours || 0).toString());
    const [comment, setComment] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);

    // Стейты админ-редактирования
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [editProjectId, setEditProjectId] = useState<string>((overtime.project_id || '').toString());
    const [editStartTime, setEditStartTime] = useState<string>(overtime.start_time);
    const [editEndTime, setEditEndTime] = useState<string>(overtime.end_time || '');
    const [editDescription, setEditDescription] = useState<string>(overtime.description);
    const [projects, setProjects] = useState<any[]>([]);
    const [loadingProjects, setLoadingProjects] = useState<boolean>(false);

    const editStartFpRef = useRef<any>(null);
    const editEndFpRef = useRef<any>(null);

    const safeParseDate = (datestr: string, _format: string): Date => {
        if (!datestr) return new Date(NaN);
        try {
            const trimmed = datestr.trim();
            const parts = trimmed.split(/[\/\s:\.-]+/).filter(Boolean);
            if (parts.length >= 3) {
                let day = parseInt(parts[0], 10);
                let month = parseInt(parts[1], 10) - 1;
                let year = parseInt(parts[2], 10);
                if (parts[0].length === 4) {
                    year = parseInt(parts[0], 10);
                    day = parseInt(parts[2], 10);
                }
                if (year < 100) {
                    year += 2000;
                }
                const hour = parts[3] ? parseInt(parts[3], 10) : 0;
                const minute = parts[4] ? parseInt(parts[4], 10) : 0;
                if (!isNaN(day) && !isNaN(month) && !isNaN(year) && !isNaN(hour) && !isNaN(minute)) {
                    const date = new Date(year, month, day, hour, minute);
                    if (!isNaN(date.getTime())) return date;
                }
            }
            const d = new Date(trimmed);
            return isNaN(d.getTime()) ? new Date(NaN) : d;
        } catch (e) {
            return new Date(NaN);
        }
    };

    const editStartInputRef = useCallback((node: HTMLInputElement | null) => {
        if (node) {
            if (!editStartFpRef.current) {
                editStartFpRef.current = flatpickr(node, {
                    enableTime: true,
                    time_24hr: true,
                    dateFormat: "d/m/Y H:i",
                    locale: Russian,
                    allowInput: true,
                    defaultDate: editStartTime ? new Date(editStartTime) : undefined,
                    parseDate: safeParseDate,
                    onChange: (selectedDates) => {
                        if (selectedDates[0]) {
                            setEditStartTime(toLocalISOString(selectedDates[0]));
                        } else {
                            setEditStartTime('');
                        }
                    },
                    onClose: (selectedDates) => {
                        if (selectedDates[0]) {
                            setEditStartTime(toLocalISOString(selectedDates[0]));
                        }
                    }
                });
            }
        } else {
            if (editStartFpRef.current) {
                editStartFpRef.current.destroy();
                editStartFpRef.current = null;
            }
        }
    }, [editStartTime]);

    const editEndInputRef = useCallback((node: HTMLInputElement | null) => {
        if (node) {
            if (!editEndFpRef.current) {
                editEndFpRef.current = flatpickr(node, {
                    enableTime: true,
                    time_24hr: true,
                    dateFormat: "d/m/Y H:i",
                    locale: Russian,
                    allowInput: true,
                    defaultDate: editEndTime ? new Date(editEndTime) : undefined,
                    parseDate: safeParseDate,
                    onChange: (selectedDates) => {
                        if (selectedDates[0]) {
                            let endDate = selectedDates[0];
                            const startVal = editStartFpRef.current?.selectedDates?.[0];
                            if (startVal && endDate <= startVal) {
                                endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
                                editEndFpRef.current?.setDate(endDate, false);
                            }
                            setEditEndTime(toLocalISOString(endDate));
                        } else {
                            setEditEndTime('');
                        }
                    },
                    onClose: (selectedDates) => {
                        if (selectedDates[0]) {
                            let endDate = selectedDates[0];
                            const startVal = editStartFpRef.current?.selectedDates?.[0];
                            if (startVal && endDate <= startVal) {
                                endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
                                editEndFpRef.current?.setDate(endDate, false);
                            }
                            setEditEndTime(toLocalISOString(endDate));
                        }
                    }
                });
            }
        } else {
            if (editEndFpRef.current) {
                editEndFpRef.current.destroy();
                editEndFpRef.current = null;
            }
        }
    }, [editEndTime]);

    const handleStartEdit = async () => {
        setIsEditing(true);
        if (projects.length === 0) {
            setLoadingProjects(true);
            try {
                const data = await getAdminProjects();
                setProjects(data || []);
            } catch (err) {
                console.error('Failed to load projects:', err);
            } finally {
                setLoadingProjects(false);
            }
        }
    };

    const handleSaveChanges = async () => {
        if (!editProjectId) {
            alert('Пожалуйста, выберите проект.');
            return;
        }
        if (!editStartTime) {
            alert('Пожалуйста, выберите время начала.');
            return;
        }
        if (!editDescription.trim()) {
            alert('Пожалуйста, введите описание работ.');
            return;
        }

        const startD = new Date(editStartTime);
        const endD = editEndTime ? new Date(editEndTime) : null;
        if (endD && startD && endD <= startD) {
            alert('Время окончания должно быть позже времени начала.');
            return;
        }

        if (window.confirm('Вы уверены, что хотите применить эти изменения к заявке? Изменения будут записаны в аудит-лог.')) {
            setSubmitting(true);
            try {
                await updateOvertime(overtime.id, {
                    project_id: parseInt(editProjectId),
                    start_time: startD.toISOString(),
                    end_time: endD ? endD.toISOString() : undefined,
                    description: editDescription,
                });
                setIsEditing(false);
                if (onStatusUpdate) {
                    onStatusUpdate();
                }
                window.dispatchEvent(new Event('overtime_update'));
            } catch (err: any) {
                console.error('Failed to update overtime:', err);
                alert(err.response?.data?.detail || 'Не удалось сохранить изменения.');
            } finally {
                setSubmitting(false);
            }
        }
    };

    const canReview =
        currentUser &&
        currentUser.role !== 'employee' &&
        overtime.status !== 'APPROVED' &&
        overtime.status !== 'REJECTED' &&
        overtime.status !== 'CANCELLED';

    const handleAction = async (approved: boolean) => {
        if (!onReview) return;
        const hoursVal = parseFloat(approvedHours);
        if (isNaN(hoursVal) || hoursVal < 0) {
            alert('Пожалуйста, введите корректное количество часов.');
            return;
        }
        setSubmitting(true);
        try {
            await onReview(overtime.id, approved, comment, asRole, hoursVal);
        } catch (err) {
            console.error('Modal review error:', err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
            <div className="modal-content glass-card animate-scale-in"
                style={{ maxWidth: '600px', padding: 0, overflow: 'hidden', borderRadius: '24px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div className="icon-shape" style={{ width: '48px', height: '48px', background: 'var(--accent-gradient)' }}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 800, fontSize: '1.25rem' }}>Детали заявки</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ID: {overtime.id} • {overtime.project?.code || 'Внутренний'}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {currentUser?.role === 'admin' && !isEditing && (
                            <button
                                onClick={handleStartEdit}
                                className="action-button-modern"
                                title="Редактировать заявку"
                                style={{ width: '40px', height: '40px', color: 'var(--primary)' }}
                            >
                                <Edit2 size={18} />
                            </button>
                        )}
                        <button onClick={onClose} className="action-button-modern" style={{ width: '40px', height: '40px' }}><X size={20} /></button>
                    </div>
                </div>

                <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', overflowY: 'auto', flex: 1 }}>

                    {/* Status Banner */}
                    <div style={{
                        padding: '16px 24px',
                        borderRadius: '16px',
                        background: overtime.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.1)' : overtime.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid',
                        borderColor: overtime.status === 'APPROVED' ? 'var(--success)' : overtime.status === 'REJECTED' ? 'var(--error)' : 'var(--warning)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <ShieldCheck size={20} style={{ color: overtime.status === 'APPROVED' ? 'var(--success)' : overtime.status === 'REJECTED' ? 'var(--error)' : 'var(--warning)' }} />
                            <span style={{ fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {STATUS_LABELS[overtime.status] || overtime.status}
                            </span>
                        </div>
                        {overtime.approved_hours !== null && (
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                Утверждено: <span style={{ color: 'var(--primary)' }}>{overtime.approved_hours}ч</span>
                            </div>
                        )}
                    </div>

                    {/* Info Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Сотрудник</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <UserIcon size={16} style={{ color: 'var(--primary)' }} />
                                <span style={{ fontWeight: 600 }}>{overtime.user?.full_name}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Проект</label>
                            {isEditing ? (
                                <select
                                    value={editProjectId}
                                    onChange={e => setEditProjectId(e.target.value)}
                                    style={{
                                        height: '38px',
                                        padding: '0 10px',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg-tertiary)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.85rem'
                                    }}
                                    disabled={loadingProjects}
                                >
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id.toString()}>{p.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Tag size={16} style={{ color: 'var(--info)' }} />
                                    <span style={{ fontWeight: 600 }}>{overtime.project?.name || 'Внутренний'}</span>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 2' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Период (начало и окончание)</label>
                            {isEditing ? (
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: '180px' }}>
                                        <input
                                            ref={editStartInputRef}
                                            type="text"
                                            placeholder="Время начала"
                                            style={{
                                                height: '38px',
                                                padding: '0 12px',
                                                borderRadius: '10px',
                                                border: '1px solid var(--border)',
                                                background: 'var(--bg-tertiary)',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.85rem',
                                                width: '100%'
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: 1, minWidth: '180px' }}>
                                        <input
                                            ref={editEndInputRef}
                                            type="text"
                                            placeholder="Время окончания (опционально)"
                                            style={{
                                                height: '38px',
                                                padding: '0 12px',
                                                borderRadius: '10px',
                                                border: '1px solid var(--border)',
                                                background: 'var(--bg-tertiary)',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.85rem',
                                                width: '100%'
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Calendar size={16} style={{ color: 'var(--accent)' }} />
                                    <span style={{ fontWeight: 600 }}>
                                        {formatDateTime(overtime.start_time)}
                                        {overtime.end_time ? ` — ${formatDateTime(overtime.end_time)}` : ''}
                                    </span>
                                </div>
                            )}
                        </div>
                        {!isEditing && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Длительность</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Clock size={16} style={{ color: 'var(--warning)' }} />
                                    <span style={{ fontWeight: 600 }}>{overtime.hours}ч (запрошено)</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Description & Voice */}
                    {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Описание выполненных работ</label>
                            <textarea
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                                style={{
                                    padding: '12px 16px',
                                    borderRadius: '16px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.95rem',
                                    lineHeight: 1.5,
                                    minHeight: '120px',
                                    resize: 'vertical',
                                    fontFamily: 'inherit',
                                    width: '100%'
                                }}
                            />
                        </div>
                    ) : overtime.voice_url ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Оригинальная запись</label>
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '12px', 
                                    padding: '12px 16px', 
                                    background: 'var(--bg-tertiary)', 
                                    borderRadius: '16px', 
                                    border: '1px solid var(--border)' 
                                }}>
                                    <audio 
                                        controls 
                                        src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/${overtime.voice_url}`} 
                                        style={{ width: '100%', height: '40px' }}
                                    />
                                </div>
                            </div>
                            {overtime.voice_summary && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Краткое содержание (AI-резюме)</label>
                                    <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '16px', fontSize: '0.95rem', lineHeight: 1.6, border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--text-primary)' }}>
                                        {overtime.voice_summary}
                                    </div>
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Полная расшифровка текста</label>
                                <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '16px', fontSize: '0.95rem', lineHeight: 1.6, border: '1px solid var(--border)' }}>
                                    {overtime.description}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Описание работ</label>
                            <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '16px', fontSize: '0.95rem', lineHeight: 1.6, border: '1px solid var(--border)' }}>
                                {overtime.description}
                            </div>
                        </div>
                    )}

                    {/* Geolocation */}
                    {(overtime.location_name || (overtime.start_lat && overtime.start_lng)) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Геолокация</label>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {overtime.location_name && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                        <MapPin size={16} style={{ color: 'var(--accent)' }} />
                                        {overtime.location_name}
                                    </div>
                                )}
                                {overtime.start_lat && overtime.start_lng && (
                                    <a
                                        href={`https://www.google.com/maps?q=${overtime.start_lat},${overtime.start_lng}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="action-button-modern" style={{ width: 'auto', padding: '0 16px', gap: '8px', borderRadius: '12px', fontSize: '0.85rem' }}
                                    >
                                        <MapPin size={16} /> Карта (Начало)
                                    </a>
                                )}
                                {overtime.end_lat && overtime.end_lng && (
                                    <a
                                        href={`https://www.google.com/maps?q=${overtime.end_lat},${overtime.end_lng}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="action-button-modern" style={{ width: 'auto', padding: '0 16px', gap: '8px', borderRadius: '12px', fontSize: '0.85rem' }}
                                    >
                                        <MapPin size={16} /> Карта (Финиш)
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Manager Comments */}
                    {(overtime.manager_comment || overtime.head_comment) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Комментарии руководства</label>
                            {overtime.manager_comment && (
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', minWidth: '80px' }}>Менеджер:</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{overtime.manager_comment}</div>
                                </div>
                            )}
                            {overtime.head_comment && (
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', minWidth: '80px' }}>Рук. отдела:</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{overtime.head_comment}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Панель редактирования или согласования */}
                {isEditing ? (
                    <div
                        style={{
                            padding: '24px 32px',
                            background: 'var(--bg-secondary)',
                            borderTop: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px',
                            flexShrink: 0
                        }}
                    >
                        <button
                            onClick={() => setIsEditing(false)}
                            className="action-button-modern"
                            style={{ width: 'auto', height: '40px', padding: '0 20px', borderRadius: '10px', fontSize: '0.9rem' }}
                            disabled={submitting}
                        >
                            Отмена
                        </button>
                        <button
                            onClick={handleSaveChanges}
                            className="primary"
                            style={{ width: 'auto', height: '40px', padding: '0 24px', borderRadius: '10px', background: 'var(--primary-gradient)', fontSize: '0.9rem' }}
                            disabled={submitting}
                        >
                            Сохранить
                        </button>
                    </div>
                ) : canReview ? (
                    <div
                        style={{
                            padding: '24px 32px',
                            background: 'var(--bg-secondary)',
                            borderTop: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            flexShrink: 0
                        }}
                    >
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertCircle size={14} /> Согласование переработки
                        </h4>
                        
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {currentUser?.role === 'admin' && (
                                <select
                                    value={asRole}
                                    onChange={e => setAsRole(e.target.value)}
                                    style={{
                                        height: '40px',
                                        padding: '0 12px',
                                        fontSize: '0.85rem',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg-primary)',
                                        color: 'var(--text-primary)',
                                        width: '150px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <option value="">Как Админ</option>
                                    <option value="manager">Как Менеджер</option>
                                    <option value="head">Как Нач. отдела</option>
                                </select>
                            )}

                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={approvedHours}
                                onChange={e => setApprovedHours(e.target.value.replace(/\D/g, ''))}
                                placeholder="Часов..."
                                style={{
                                    height: '40px',
                                    background: 'var(--bg-primary)',
                                    width: '100px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-primary)',
                                    textAlign: 'center',
                                    fontSize: '0.9rem',
                                }}
                                title="Утвержденное количество часов"
                            />

                            <input
                                placeholder="Комментарий к согласованию..."
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                style={{
                                    height: '40px',
                                    borderRadius: '10px',
                                    fontSize: '0.85rem',
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-primary)',
                                    padding: '0 14px',
                                    flex: 1,
                                    minWidth: '200px',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <button
                                onClick={onClose}
                                className="action-button-modern"
                                style={{ width: 'auto', height: '40px', padding: '0 20px', borderRadius: '10px', fontSize: '0.9rem' }}
                                disabled={submitting}
                            >
                                Отмена
                            </button>
                            <button
                                onClick={() => handleAction(false)}
                                className="primary"
                                style={{ height: '40px', padding: '0 24px', background: 'var(--danger-gradient)', fontSize: '0.9rem', borderRadius: '10px' }}
                                disabled={submitting}
                            >
                                Отклонить
                            </button>
                            <button
                                onClick={() => handleAction(true)}
                                className="primary"
                                style={{ height: '40px', padding: '0 24px', background: 'var(--success-gradient)', fontSize: '0.9rem', borderRadius: '10px' }}
                                disabled={submitting}
                            >
                                Одобрить
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: '24px 32px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                        <button onClick={onClose} className="primary" style={{ width: 'auto', height: '40px', padding: '0 32px', borderRadius: '10px' }}>Закрыть</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OvertimeDetailModal;
