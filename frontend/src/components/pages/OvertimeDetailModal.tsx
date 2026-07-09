/* eslint-disable */
import React, { useState } from 'react';
import { X, Calendar, Clock, MapPin, Tag, FileText, User as UserIcon, ShieldCheck, AlertCircle } from 'lucide-react';
import { STATUS_LABELS, formatDateTime } from '../../constants/locale';
import type { Overtime, User } from '../../types';

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
    onReview
}) => {
    const [asRole, setAsRole] = useState<string>('');
    const [approvedHours, setApprovedHours] = useState<string>(Math.round(overtime.hours || 0).toString());
    const [comment, setComment] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);

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
                style={{ maxWidth: '600px', padding: 0, overflow: 'hidden', borderRadius: '24px' }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div className="icon-shape" style={{ width: '48px', height: '48px', background: 'var(--accent-gradient)' }}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 800, fontSize: '1.25rem' }}>Детали заявки</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ID: {overtime.id} • {overtime.project?.code || 'Внутренний'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="action-button-modern" style={{ width: '40px', height: '40px' }}><X size={20} /></button>
                </div>

                <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Tag size={16} style={{ color: 'var(--info)' }} />
                                <span style={{ fontWeight: 600 }}>{overtime.project?.name || 'Внутренний'}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Период</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Calendar size={16} style={{ color: 'var(--accent)' }} />
                                <span style={{ fontWeight: 600 }}>
                                    {formatDateTime(overtime.start_time)}
                                    {overtime.end_time ? ` — ${formatDateTime(overtime.end_time)}` : ''}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Длительность</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Clock size={16} style={{ color: 'var(--warning)' }} />
                                <span style={{ fontWeight: 600 }}>{overtime.hours}ч (запрошено)</span>
                            </div>
                        </div>
                    </div>

                    {/* Description & Voice */}
                    {overtime.voice_url ? (
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

                {/* Действия согласования для руководителя */}
                {canReview ? (
                    <div
                        style={{
                            padding: '24px 32px',
                            background: 'var(--bg-secondary)',
                            borderTop: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
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
                    <div style={{ padding: '24px 32px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={onClose} className="primary" style={{ width: 'auto', padding: '0 32px', borderRadius: '10px' }}>Закрыть</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OvertimeDetailModal;
