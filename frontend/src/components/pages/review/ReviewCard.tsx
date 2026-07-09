/* eslint-disable */
import React from 'react';
import { CheckCircle, XCircle, Clock, Info, MapPin, Calendar } from 'lucide-react';
import { STATUS_LABELS, formatDateTime } from '../../../constants/locale';
import type { Overtime, User } from '../../../types';

/**
 * Пропсы компонента карточки заявки на переработку.
 */
interface ReviewCardProps {
    overtime: Overtime;
    currentUser: User | null;
    isReviewing: boolean;
    isSelected: boolean;
    onOpenDetail: (ot: Overtime) => void;
    onToggleReview: (id: number | null) => void;
    onToggleSelect: (id: number) => void;
    inlineForm?: React.ReactNode;
}

/**
 * Единая карточка заявки на переработку.
 * Переиспользуется в табличном, календарном и таймлайн-видах страницы согласования.
 */
const ReviewCard: React.FC<ReviewCardProps> = ({
    overtime: ot,
    currentUser,
    isReviewing,
    isSelected,
    onOpenDetail,
    onToggleReview,
    onToggleSelect,
    inlineForm,
}) => {
    const canReview =
        currentUser?.role === 'admin' ||
        (ot.status !== 'APPROVED' && ot.status !== 'REJECTED' && ot.status !== 'CANCELLED');

    const statusBadgeClass =
        ot.status === 'APPROVED' ? 'badge-success' :
        ot.status === 'REJECTED' || ot.status === 'CANCELLED' ? 'badge-danger' : 'badge-warning';

    return (
        <div
            className="glass-card"
            style={{
                padding: 0,
                overflow: 'hidden',
                border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: isSelected ? '0 0 0 3px rgba(59,130,246,0.12)' : undefined,
            }}
        >
            <div style={{ padding: '20px 20px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelect(ot.id)}
                            style={{ width: '15px', height: '15px', flexShrink: 0, cursor: 'pointer', accentColor: 'var(--primary)' }}
                        />
                        <div className="icon-shape" style={{ width: '38px', height: '38px', flexShrink: 0, background: 'var(--accent-gradient)', fontSize: '0.82rem', fontWeight: 700 }}>
                            {ot.user?.full_name?.charAt(0) ?? '?'}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ot.user?.full_name ?? '—'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                {ot.project?.name ?? 'Внутренний'}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
                        <span className="badge badge-info" style={{ fontSize: '0.57rem' }}>ID {ot.id}</span>
                        <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '0.57rem' }}>{STATUS_LABELS[ot.status] ?? ot.status}</span>
                        {ot.start_lat && ot.start_lng && (
                            <a href={`https://www.google.com/maps?q=${ot.start_lat},${ot.start_lng}`} target="_blank" rel="noopener noreferrer"
                                className="action-button-modern" title="Точка начала" style={{ color: 'var(--success)', width: '24px', height: '24px', minWidth: '24px' }}>
                                <MapPin size={12} />
                            </a>
                        )}
                        {ot.end_lat && ot.end_lng && (
                            <a href={`https://www.google.com/maps?q=${ot.end_lat},${ot.end_lng}`} target="_blank" rel="noopener noreferrer"
                                className="action-button-modern" title="Точка финиша" style={{ color: 'var(--error)', width: '24px', height: '24px', minWidth: '24px' }}>
                                <MapPin size={12} />
                            </a>
                        )}
                        <button onClick={() => onOpenDetail(ot)} className="action-button-modern" style={{ width: '24px', height: '24px', minWidth: '24px' }} title="Подробнее">
                            <Info size={12} />
                        </button>
                    </div>
                </div>

                <p className="line-clamp-2" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer', marginBottom: '10px' }} onClick={() => onOpenDetail(ot)}>
                    {ot.description}
                </p>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <Calendar size={12} />{formatDateTime(ot.start_time)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <Clock size={12} />
                        {ot.approved_hours != null ? (
                            <><span style={{ color: 'var(--success)', fontWeight: 700 }}>{ot.approved_hours}ч</span>&nbsp;/&nbsp;{ot.hours}ч</>
                        ) : (<>{ot.hours}ч</>)}
                    </div>
                </div>
            </div>

            <div style={{ padding: '12px 20px', background: 'var(--bg-primary)', borderTop: '1px solid var(--border)' }}>
                {isReviewing ? (
                    inlineForm
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '14px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '0.57rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Менеджер</p>
                                <div style={{ color: ot.manager_approved === true ? 'var(--success)' : ot.manager_approved === false ? 'var(--danger)' : 'var(--text-muted)', opacity: ot.manager_approved == null ? 0.3 : 1 }}>
                                    {ot.manager_approved === true ? <CheckCircle size={16} /> : ot.manager_approved === false ? <XCircle size={16} /> : <Clock size={16} />}
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '0.57rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Нач. отдела</p>
                                <div style={{ color: ot.head_approved === true ? 'var(--success)' : ot.head_approved === false ? 'var(--danger)' : 'var(--text-muted)', opacity: ot.head_approved == null ? 0.3 : 1 }}>
                                    {ot.head_approved === true ? <CheckCircle size={16} /> : ot.head_approved === false ? <XCircle size={16} /> : <Clock size={16} />}
                                </div>
                            </div>
                        </div>
                        {canReview && (
                            <button onClick={() => onToggleReview(ot.id)} className="primary" style={{ padding: '0 14px', height: '34px', fontSize: '0.8rem' }}>
                                Рассмотреть
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewCard;
