import React, { useState } from 'react';
import { X, Clock, Calendar, Briefcase, User, CheckCircle2, XCircle, Info, MessageSquare, ShieldCheck, MapPin, ExternalLink } from 'lucide-react';
import { reviewOvertime } from '../../services/api';
import { getStatusLabel, getStatusColor } from '../../constants/locale';

interface OvertimeDetailModalProps {
    overtime: any;
    currentUser: any;
    onClose: () => void;
    onStatusUpdate: () => void;
}

const OvertimeDetailModal: React.FC<OvertimeDetailModalProps> = ({ overtime, currentUser, onClose, onStatusUpdate }) => {
    const [reviewMode, setReviewMode] = useState(false);
    const [comment, setComment] = useState('');
    const [asRole, setAsRole] = useState<string>('');
    const [approvedHours, setApprovedHours] = useState<string>(overtime.hours.toString());
    const [submitting, setSubmitting] = useState(false);

    const canReview = (
        (currentUser.role === 'admin') ||
        (
            overtime.status !== 'APPROVED' &&
            overtime.status !== 'REJECTED' &&
            overtime.status !== 'CANCELLED' &&
            (
                (currentUser.role === 'manager' && overtime.project.manager_id === currentUser.id) ||
                (currentUser.role === 'head' && overtime.user.department_id === currentUser.department_id)
            )
        )
    );

    const handleReview = async (approved: boolean) => {
        setSubmitting(true);
        try {
            await reviewOvertime(
                overtime.id,
                approved,
                comment,
                asRole || undefined,
                approved ? parseFloat(approvedHours) : undefined
            );
            onStatusUpdate();
            onClose();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Ошибка при сохранении решения');
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('ru', {
            day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const rawHours = overtime.raw_hours || (new Date(overtime.end_time).getTime() - new Date(overtime.start_time).getTime()) / 3600000;

    return (
        <div className="modal-overlay animate-fade-in" onClick={onClose}>
            <div className="modal-content wide animate-scale-in" onClick={e => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>ЗАЯВКА #{overtime.id}</span>
                            <div style={{
                                padding: '4px 10px',
                                borderRadius: '8px',
                                background: `${getStatusColor(overtime.status)}20`,
                                color: getStatusColor(overtime.status),
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                border: `1px solid ${getStatusColor(overtime.status)}40`
                            }}>
                                {getStatusLabel(overtime.status).toUpperCase()}
                            </div>
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Детали переработки</h3>
                    </div>
                    <button onClick={onClose} style={{ padding: '8px', borderRadius: '50%', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0', minHeight: 'fit-content', maxHeight: '80vh', overflowY: 'auto' }}>
                    <div style={{ flex: '1 1 500px', padding: '32px', borderRight: '1px solid var(--border)', minWidth: '350px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div>
                                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>Описание задачи</h4>
                                <p style={{ fontSize: '1.05rem', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                                    {overtime.description}
                                </p>
                            </div>

                            {overtime.voice_url && (
                                <div className="glass-card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--primary)30' }}>
                                    <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <MessageSquare size={16} /> ОРИГИНАЛ ЗАПИСИ
                                    </h4>
                                    <audio
                                        controls
                                        style={{ width: '100%', height: '40px' }}
                                        src={overtime.voice_url.startsWith('/') ? overtime.voice_url : `/${overtime.voice_url}`}
                                    >
                                        Ваш браузер не поддерживает аудио элемент.
                                    </audio>
                                    {overtime.voice_summary && (
                                        <div style={{ marginTop: '12px', padding: '12px 16px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>🤖 ИИ-резюме</p>
                                            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5', fontStyle: 'italic' }}>
                                                «{overtime.voice_summary}»
                                            </p>
                                        </div>
                                    )}
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
                                        * Аудиозапись хранится в течение 90 дней
                                    </p>
                                </div>
                            )}

                            {overtime.location_name && (
                                <div>
                                    <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>Местоположение</h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <MapPin size={20} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '2px', color: 'var(--text-primary)' }}>{overtime.location_name}</p>
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(overtime.location_name)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                                            >
                                                Посмотреть на карте <ExternalLink size={12} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '24px', borderRadius: '16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 700 }}>
                                        <Calendar size={14} /> Начало
                                    </div>
                                    <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatDate(overtime.start_time)}</p>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 700 }}>
                                        <Calendar size={14} /> Окончание
                                    </div>
                                    <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatDate(overtime.end_time)}</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '40px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                        <Clock size={24} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Запрошено</p>
                                        <p style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{overtime.hours}ч</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                                        <Info size={24} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Фактически</p>
                                        <p style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{(rawHours || 0).toFixed(2)}ч</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: '1 1 350px', padding: '32px', background: 'var(--bg-main)', minWidth: '350px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border)' }}>
                                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <User size={22} style={{ color: 'var(--text-secondary)' }} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Сотрудник</p>
                                    <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{overtime.user?.full_name}</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border)' }}>
                                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Briefcase size={22} style={{ color: 'var(--primary)' }} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Проект</p>
                                    <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{overtime.project?.name}</p>
                                </div>
                            </div>

                            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
                                {reviewMode ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {currentUser.role === 'admin' && (
                                            <div className="input-group">
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <ShieldCheck size={16} /> Согласовать от роли:
                                                </label>
                                                <select value={asRole} onChange={(e) => setAsRole(e.target.value)}>
                                                    <option value="">Автоматически</option>
                                                    <option value="manager">Менеджер проекта</option>
                                                    <option value="head">Начальник отдела</option>
                                                </select>
                                            </div>
                                        )}
                                        <div className="input-group">
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={16} /> Часов</label>
                                            <input type="number" step="0.1" value={approvedHours} onChange={(e) => setApprovedHours(e.target.value)} />
                                        </div>
                                        <div className="input-group">
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MessageSquare size={16} /> Коммент</label>
                                            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button disabled={submitting} onClick={() => handleReview(true)} className="primary" style={{ background: 'var(--success)', flex: 1 }}>Одобрить</button>
                                            <button disabled={submitting} onClick={() => handleReview(false)} className="primary" style={{ background: 'var(--danger)', flex: 1 }}>Отклонить</button>
                                        </div>
                                        <button onClick={() => setReviewMode(false)} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Отмена</button>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ marginBottom: '20px' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Статус согласования</p>
                                            <div style={{ display: 'flex', gap: '20px' }}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>МЕНЕДЖЕР</p>
                                                    {overtime.manager_approved === true ? <CheckCircle2 size={24} style={{ color: 'var(--success)' }} /> : overtime.manager_approved === false ? <XCircle size={24} style={{ color: 'var(--danger)' }} /> : <Clock size={24} style={{ color: 'var(--warning)', opacity: 0.5 }} />}
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>НАЧ. ОТДЕЛА</p>
                                                    {overtime.head_approved === true ? <CheckCircle2 size={24} style={{ color: 'var(--success)' }} /> : overtime.head_approved === false ? <XCircle size={24} style={{ color: 'var(--danger)' }} /> : <Clock size={24} style={{ color: 'var(--warning)', opacity: 0.5 }} />}
                                                </div>
                                            </div>
                                        </div>
                                        {overtime.approved_hours !== null && (
                                            <div style={{ padding: '16px', borderRadius: '12px', background: 'white', border: '1px solid var(--border)', marginBottom: '16px' }}>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Итого согласовано</p>
                                                <p style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--success)' }}>{overtime.approved_hours} ч</p>
                                            </div>
                                        )}
                                        {canReview && (
                                            <button
                                                onClick={() => setReviewMode(true)}
                                                className="secondary"
                                                style={{ marginTop: '16px', width: '100%' }}
                                            >
                                                {overtime.status === 'PENDING' ? 'Рассмотреть заявку' : 'Пересмотреть решение'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OvertimeDetailModal;
