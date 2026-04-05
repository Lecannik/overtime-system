import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2, Search, Filter, Calendar, ShieldCheck, ChevronDown, CheckCircle, Info, MapPin, Clock, XCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { api, getOvertimes, reviewOvertime } from '../../services/api';
import Header from '../layout/Header';
import Skeleton from '../common/Skeleton';
import OvertimeDetailModal from './OvertimeDetailModal';
import { STATUS_LABELS } from '../../constants/locale';


const ReviewPage: React.FC = () => {
    const navigate = useNavigate();
    const [overtimes, setOvertimes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [comment, setComment] = useState('');
    const [reviewingId, setReviewingId] = useState<number | null>(null);
    const [asRole, setAsRole] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [selectedOvertime, setSelectedOvertime] = useState<any | null>(null);
    const [updateTrigger, setUpdateTrigger] = useState(0);
    const [approvedHours, setApprovedHours] = useState<string>('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize] = useState(10);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const s = params.get('search');
        if (s) setSearchQuery(s);
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            if (!token) { navigate('/login'); return; }

            const [userRes, ovtRes] = await Promise.all([
                api.get('/auth/me'),
                getOvertimes({
                    page: currentPage,
                    page_size: pageSize,
                    status: statusFilter !== 'ALL' ? statusFilter : undefined
                })
            ]);

            setUser(userRes.data);
            setOvertimes(ovtRes.items || []);
            setTotalPages(ovtRes.pages || 1);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentPage, statusFilter, updateTrigger]);

    const handleReview = async (overtimeId: number, approved: boolean) => {
        try {
            await reviewOvertime(
                overtimeId,
                approved,
                comment || undefined,
                asRole || undefined,
                approved ? parseFloat(approvedHours) : undefined
            );
            fetchData();
            setReviewingId(null);
            setComment('');
            setAsRole('');
            setApprovedHours('');
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Ошибка при согласовании');
        }
    };

    const safeOvertimes = Array.isArray(overtimes) ? overtimes : [];
    const filteredOvertimes = (user?.role === 'admin'
        ? safeOvertimes
        : safeOvertimes.filter(ot =>
            ot.status === 'PENDING' || ot.status === 'MANAGER_APPROVED' || ot.status === 'HEAD_APPROVED'
        )).filter((ot: any) => {
            const empName = (ot.user?.full_name || '').toLowerCase();
            const projName = (ot.project?.name || '').toLowerCase();
            const desc = (ot.description || '').toLowerCase();
            const query = searchQuery.toLowerCase();
            return empName.includes(query) || projName.includes(query) || desc.includes(query) || ot.id.toString() === query;
        });

    if (loading) return <div className="page-container"><Skeleton height={800} /></div>;

    return (
        <div className="page-container animate-fade-in">
            <Header user={user} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Согласование заявок</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Поток входящих запросов на подтверждение работы.</p>
                </div>
                <div className="badge badge-info" style={{ padding: '8px 16px', borderRadius: '12px' }}>
                    <ShieldCheck size={16} /> <span style={{ marginLeft: '8px' }}>Режим {user?.role === 'admin' ? 'Админа' : 'Проверки'}</span>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        placeholder="Поиск по ФИО или проекту..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: '40px', height: '44px', background: 'var(--bg-primary)' }}
                    />
                </div>
                <div style={{ position: 'relative' }}>
                    <Filter size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        style={{ height: '44px', padding: '0 32px 0 44px', borderRadius: '10px', minWidth: '180px' }}
                    >
                        <option value="ALL">Все статусы</option>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '16px' }}>
                {filteredOvertimes.map((ot: any) => (
                    <div key={ot.id} className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div className="icon-shape" style={{ width: '44px', height: '44px', background: 'var(--accent-gradient)' }}>
                                        {ot.user?.full_name?.charAt(0)}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{ot.user?.full_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{ot.project?.name || 'Внутренний'}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span className="badge badge-info" style={{ fontSize: '0.6rem' }}>ID {ot.id}</span>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                        {ot.start_lat && ot.start_lng && (
                                            <a
                                                href={`https://www.google.com/maps?q=${ot.start_lat},${ot.start_lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="action-button-modern"
                                                title="Точка начала (карта)"
                                                style={{ color: 'var(--success)' }}
                                            >
                                                <MapPin size={16} />
                                            </a>
                                        )}
                                        {ot.end_lat && ot.end_lng && (
                                            <a
                                                href={`https://www.google.com/maps?q=${ot.end_lat},${ot.end_lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="action-button-modern"
                                                title="Точка финиша (карта)"
                                                style={{ color: 'var(--error)' }}
                                            >
                                                <MapPin size={16} />
                                            </a>
                                        )}
                                        {!ot.start_lat && ot.location_name && (
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ot.location_name)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="action-button-modern"
                                                title={ot.location_name}
                                                style={{ color: 'var(--accent)' }}
                                            >
                                                <MapPin size={16} />
                                            </a>
                                        )}
                                        <button
                                            onClick={() => setSelectedOvertime(ot)}
                                            className="action-button-modern"
                                            style={{ width: '28px', height: '28px', minWidth: '28px' }}
                                            title="Подробнее"
                                        >
                                            <Info size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <h4
                                className="line-clamp-3"
                                style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', cursor: 'pointer' }}
                                onClick={() => setSelectedOvertime(ot)}
                            >
                                {ot.description}
                            </h4>
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    <Calendar size={14} /> {new Date(ot.start_time).toLocaleDateString()}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    <Clock size={14} /> {ot.hours}ч
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '20px 24px', background: 'var(--bg-primary)' }}>
                            {reviewingId === ot.id ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {user?.role === 'admin' && (
                                        <select value={asRole} onChange={e => setAsRole(e.target.value)} style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                                            <option value="">Как Админ</option>
                                            <option value="manager">Как Менеджер</option>
                                            <option value="head">Как Нач. отдела</option>
                                        </select>
                                    )}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="number" step="0.5"
                                            value={approvedHours}
                                            onChange={e => setApprovedHours(e.target.value)}
                                            placeholder="Часов..."
                                            style={{ height: '40px', background: 'var(--bg-secondary)', width: '100px' }}
                                        />
                                        <input
                                            placeholder="Комментарий..."
                                            value={comment}
                                            onChange={e => setComment(e.target.value)}
                                            style={{ height: '40px', borderRadius: '8px', fontSize: '0.85rem', flex: 1 }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => handleReview(ot.id, true)} className="primary" style={{ flex: 1, height: '40px', background: 'var(--success-gradient)' }}>Одобрить</button>
                                        <button onClick={() => handleReview(ot.id, false)} className="primary" style={{ flex: 1, height: '40px', background: 'var(--danger-gradient)' }}>Отклонить</button>
                                    </div>
                                    <button onClick={() => setReviewingId(null)} style={{ background: 'none', border: '1px solid var(--error)', color: 'var(--error)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', padding: '8px', borderRadius: '8px', marginTop: '4px' }}>ОТМЕНА</button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Менеджер</p>
                                            <div style={{ color: ot.manager_approved === true ? 'var(--success)' : ot.manager_approved === false ? 'var(--danger)' : 'var(--text-muted)', opacity: ot.manager_approved === null ? 0.3 : 1 }}>
                                                {ot.manager_approved === true ? <CheckCircle size={20} /> : ot.manager_approved === false ? <XCircle size={20} /> : <Clock size={20} />}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Глава отдела</p>
                                            <div style={{ color: ot.head_approved === true ? 'var(--success)' : ot.head_approved === false ? 'var(--danger)' : 'var(--text-muted)', opacity: ot.head_approved === null ? 0.3 : 1 }}>
                                                {ot.head_approved === true ? <CheckCircle size={20} /> : ot.head_approved === false ? <XCircle size={20} /> : <Clock size={20} />}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setReviewingId(ot.id); setApprovedHours(ot.hours.toString()); }}
                                        className="primary"
                                        style={{ width: 'auto', padding: '0 20px', height: '40px' }}
                                    >
                                        Рассмотреть
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Страница <b>{currentPage}</b> из <b>{totalPages}</b>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="action-button-modern"
                            style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', opacity: currentPage === 1 ? 0.5 : 1 }}
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="action-button-modern"
                            style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', opacity: currentPage === totalPages ? 0.5 : 1 }}
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}

            {filteredOvertimes.length === 0 && (
                <div style={{ textAlign: 'center', padding: '100px' }}>
                    <CheckCircle2 size={60} style={{ color: 'var(--success)', opacity: 0.2 }} />
                    <p style={{ color: 'var(--text-muted)', marginTop: '20px' }}>Нет активных заявок для согласования.</p>
                </div>
            )}

            {selectedOvertime && (
                <OvertimeDetailModal
                    overtime={selectedOvertime}
                    currentUser={user}
                    onClose={() => setSelectedOvertime(null)}
                    onStatusUpdate={() => {
                        setUpdateTrigger(prev => prev + 1);
                        setSelectedOvertime(null);
                    }}
                />
            )}
        </div>
    );
};

export default ReviewPage;