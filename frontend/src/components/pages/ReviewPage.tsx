import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2, XCircle, Search, Filter,
    Calendar, User, Briefcase, MessageSquare, ShieldCheck,
    ChevronRight, Clock
} from 'lucide-react';
import api, { getOvertimes, reviewOvertime } from '../../services/api';
import Header from '../layout/Header';

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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) { navigate('/login'); return; }
                const userRes = await api.get('/auth/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUser(userRes.data);

                const ovtData = await getOvertimes();
                setOvertimes(ovtData);
            } catch {
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [navigate]);

    const handleReview = async (overtimeId: number, approved: boolean) => {
        try {
            await reviewOvertime(overtimeId, approved, comment || undefined, asRole || undefined);
            const data = await getOvertimes();
            setOvertimes(data);
            setReviewingId(null);
            setComment('');
            setAsRole('');
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Ошибка при согласовании');
        }
    };


    const filteredOvertimes = (user?.role === 'admin'
        ? overtimes
        : overtimes.filter(ot =>
            ot.status === 'PENDING' || ot.status === 'MANAGER_APPROVED' || ot.status === 'HEAD_APPROVED'
        )).filter(ot => {
            const empName = (ot.user?.full_name || '').toLowerCase();
            const projName = (ot.project?.name || '').toLowerCase();
            const desc = (ot.description || '').toLowerCase();
            const query = searchQuery.toLowerCase();
            const matchesSearch = empName.includes(query) || projName.includes(query) || desc.includes(query);
            const matchesStatus = statusFilter === 'ALL' || ot.status === statusFilter;
            return matchesSearch && matchesStatus;
        });

    if (loading) return (
        <div className="page-container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
            <div className="loading-bar" style={{ width: '40%' }}></div>
        </div>
    );

    return (
        <div className="page-container animate-fade-in">
            <Header user={user} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '8px' }}>Согласование заявок</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Поток входящих запросов на подтверждение сверхурочной работы.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ padding: '12px 20px', borderRadius: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user?.role === 'admin' ? 'Права суперадмина' : 'Режим проверки'}</span>
                    </div>
                </div>
            </div>

            {/* List Header / Filters */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        placeholder="Поиск по ФИО или описанию..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', paddingLeft: '52px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', height: '52px' }}
                    />
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Filter size={18} style={{ position: 'absolute', left: '16px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                            padding: '0 24px 0 44px', borderRadius: '14px', border: '1px solid var(--border)',
                            background: 'var(--bg-secondary)', color: 'var(--text-primary)', height: '52px',
                            fontWeight: 600, cursor: 'pointer', outline: 'none', width: '220px'
                        }}
                    >
                        <option value="ALL">Все статусы</option>
                        <option value="PENDING">Ожидает</option>
                        <option value="MANAGER_APPROVED">Менеджер OK</option>
                        <option value="HEAD_APPROVED">Начальник OK</option>
                        <option value="APPROVED">Завершено</option>
                        <option value="REJECTED">Отклонено</option>
                    </select>
                </div>
            </div>

            {filteredOvertimes.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '120px 40px' }}>
                    <div style={{
                        width: '80px', height: '80px', background: 'rgba(21, 128, 61, 0.1)', borderRadius: '24px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'var(--success)'
                    }}>
                        <CheckCircle2 size={40} />
                    </div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Ничего не найдено</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                        Попробуйте изменить параметры поиска или фильтр по статусу.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                    {filteredOvertimes.map((ot: any) => (
                        <div key={ot.id} className="glass-card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{ot.description}</h4>
                                    <div style={{
                                        padding: '4px 10px', borderRadius: '10px', background: 'rgba(30, 64, 175, 0.1)',
                                        color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 700
                                    }}>
                                        ID {ot.id}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        <User size={16} style={{ color: 'var(--accent)' }} />
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ot.user?.full_name || `Сотрудник #${ot.user_id}`}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        <Briefcase size={16} />
                                        <span>{ot.project?.name || `Проект #${ot.project_id}`}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        <Clock size={16} style={{ color: 'var(--accent)' }} />
                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                            Длительность: {ot.hours}ч
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        <Calendar size={16} />
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {new Date(ot.start_time).toLocaleString('ru', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} — {new Date(ot.end_time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ padding: '24px 28px', flex: 1 }}>
                                {reviewingId === ot.id ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {user?.role === 'admin' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Действовать как:</label>
                                                <select value={asRole} onChange={(e) => setAsRole(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}>
                                                    <option value="">Автоматически</option>
                                                    <option value="manager">Менеджер проекта</option>
                                                    <option value="head">Начальник отдела</option>
                                                </select>
                                            </div>
                                        )}
                                        <div style={{ position: 'relative' }}>
                                            <MessageSquare size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                            <textarea
                                                value={comment}
                                                onChange={(e) => setComment(e.target.value)}
                                                placeholder="Введите ваш комментарий..."
                                                style={{ paddingLeft: '40px', minHeight: '80px', fontSize: '0.9rem' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button
                                                onClick={() => handleReview(ot.id, true)}
                                                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: 'var(--success)', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                            >
                                                <CheckCircle2 size={16} /> Подтвердить
                                            </button>
                                            <button
                                                onClick={() => handleReview(ot.id, false)}
                                                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                            >
                                                <XCircle size={16} /> Отклонить
                                            </button>
                                        </div>
                                        <button onClick={() => setReviewingId(null)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Отмена</button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Менеджер</p>
                                                {ot.manager_approved === true ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} /> : ot.manager_approved === false ? <XCircle size={16} style={{ color: 'var(--danger)' }} /> : <Clock size={16} style={{ color: 'var(--warning)' }} />}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Начальник</p>
                                                {ot.head_approved === true ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} /> : ot.head_approved === false ? <XCircle size={16} style={{ color: 'var(--danger)' }} /> : <Clock size={16} style={{ color: 'var(--warning)' }} />}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setReviewingId(ot.id)}
                                            className="primary"
                                            style={{ width: 'auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            Рассмотреть <ChevronRight size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReviewPage;