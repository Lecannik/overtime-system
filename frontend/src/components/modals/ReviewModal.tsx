import React, { useState } from 'react';
import { X, Clock, MapPin, User, Check, ShieldAlert, BadgeCheck } from 'lucide-react';

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    item: any;
    onAction: (id: number, approved: boolean, comment: string, approvedHours?: number) => Promise<void>;
}

const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, onSuccess, item, onAction }) => {
    const [comment, setComment] = useState('');
    const [approvedHours, setApprovedHours] = useState<string>(item?.hours?.toString() || '0');
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen || !item) return null;

    const handleReview = async (isApproved: boolean) => {
        try {
            setSubmitting(true);
            const hours = isApproved ? parseFloat(approvedHours) : undefined;
            await onAction(item.id, isApproved, comment, hours);
            onClose();
            onSuccess();
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const isPartial = parseFloat(approvedHours) < item.hours;

    return (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
            <div className="glass-card" style={{
                width: '560px',
                padding: '0',
                borderRadius: '24px',
                overflow: 'hidden',
                animation: 'slideUp 0.3s ease-out'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px 32px',
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border)'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Детали заявки</h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: #{item.id}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '32px', maxHeight: '70vh', overflowY: 'auto' }}>

                    {/* User & Project Info */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '18px',
                            background: 'linear-gradient(135deg, var(--accent) 0%, #6366f1 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                        }}>
                            <User size={28} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{item.user?.full_name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{item.project?.name}</span>
                                <span>•</span>
                                <span>{item.user?.email}</span>
                            </div>
                        </div>
                    </div>

                    {/* Details Grid */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
                        marginBottom: '32px', padding: '20px', background: 'var(--bg-secondary)',
                        borderRadius: '16px', border: '1px solid var(--border)'
                    }}>
                        <div className="detail-item">
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Начало</label>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <Clock size={14} color="var(--accent)" />
                                {formatDate(item.start_time)}
                            </div>
                        </div>
                        <div className="detail-item">
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Конец</label>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <Clock size={14} color="var(--accent)" />
                                {item.end_time ? formatDate(item.end_time) : '—'}
                            </div>
                        </div>
                        <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Где работал</label>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <MapPin size={14} color="var(--error)" />
                                {item.location_name || 'Не указано'}
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: '32px' }}>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, display: 'block', marginBottom: '8px' }}>Описание работ</label>
                        <div style={{
                            padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px',
                            fontSize: '0.9rem', border: '1px solid var(--border)', lineHeight: '1.5'
                        }}>
                            {item.description}
                        </div>
                    </div>

                    {/* Review Logic */}
                    <div style={{ borderTop: '2px dashed var(--border)', paddingTop: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Ваше решение</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Запрошено:</span>
                                <span className="badge-primary" style={{ padding: '4px 12px', borderRadius: '12px', fontWeight: 800 }}>{item.hours}ч</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label className="label" style={{ fontSize: '0.85rem' }}>Одобрить часов (частично)</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type="number"
                                    step="0.5"
                                    max={item.hours}
                                    min="0"
                                    value={approvedHours}
                                    onChange={(e) => setApprovedHours(e.target.value)}
                                    className="modern-input"
                                    style={{
                                        paddingRight: '60px',
                                        fontSize: '1.25rem',
                                        fontWeight: 800,
                                        color: isPartial ? 'var(--warning)' : 'var(--success)'
                                    }}
                                />
                                <span style={{ position: 'absolute', right: '20px', fontWeight: 700, color: 'var(--text-muted)' }}>ч</span>
                            </div>
                            {isPartial && (
                                <p style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ShieldAlert size={14} /> Вы одобряете меньше, чем запросил сотрудник
                                </p>
                            )}
                        </div>

                        <div style={{ marginBottom: '32px' }}>
                            <label className="label" style={{ fontSize: '0.85rem' }}>Комментарий к решению</label>
                            <textarea
                                rows={3}
                                placeholder="Напишите причину, особенно если одобряете частично или отклоняете..."
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                className="modern-input"
                                style={{ resize: 'none', padding: '12px 16px' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div style={{
                    padding: '24px 32px',
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    gap: '12px',
                    borderTop: '1px solid var(--border)'
                }}>
                    <button
                        disabled={submitting}
                        onClick={() => handleReview(false)}
                        className="btn-secondary"
                        style={{ flex: 1, height: '48px', color: 'var(--error)', borderColor: 'var(--error)', opacity: 0.8 }}
                    >
                        ОТКЛОНИТЬ
                    </button>
                    <button
                        disabled={submitting || parseFloat(approvedHours) <= 0}
                        onClick={() => handleReview(true)}
                        className="primary"
                        style={{ flex: 2, height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        {isPartial ? <Check size={20} /> : <BadgeCheck size={20} />}
                        {isPartial ? 'ОДОБРИТЬ ЧАСТИЧНО' : 'ОДОБРИТЬ ПОЛНОСТЬЮ'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReviewModal;
