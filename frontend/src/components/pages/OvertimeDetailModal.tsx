import React from 'react';
import { X, Calendar, Clock, MapPin, Tag, FileText, User as UserIcon, ShieldCheck } from 'lucide-react';
import { STATUS_LABELS, formatDateTime } from '../../constants/locale';
import type { Overtime } from '../../types';

interface OvertimeDetailModalProps {
    overtime: Overtime;
    onClose: () => void;
    onStatusUpdate?: () => void;
}

const OvertimeDetailModal: React.FC<OvertimeDetailModalProps> = ({ overtime, onClose }) => {
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
                                {STATUS_LABELS[overtime.status]}
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
                                <span style={{ fontWeight: 600 }}>{formatDateTime(overtime.start_time)}</span>
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

                    {/* Description */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Описание работ</label>
                        <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '16px', fontSize: '0.95rem', lineHeight: 1.6, border: '1px solid var(--border)' }}>
                            {overtime.description}
                        </div>
                    </div>

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

                <div style={{ padding: '24px 32px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} className="primary" style={{ width: 'auto', padding: '0 32px' }}>Закрыть</button>
                </div>
            </div>
        </div>
    );
};

export default OvertimeDetailModal;
