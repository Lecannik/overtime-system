import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2, XCircle, Search, Filter,
    Calendar, User, Briefcase, MessageSquare, ShieldCheck,
    Check, Clock, MapPin
} from 'lucide-react';
import api, { getOvertimes, reviewOvertime } from '../../services/api';
import Header from '../layout/Header';
import Skeleton from '../common/Skeleton';
import OvertimeDetailModal from './OvertimeDetailModal';

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

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const s = params.get('search');
        if (s) setSearchQuery(s);
    }, []);

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
    }, [navigate, updateTrigger]);

    const handleReview = async (overtimeId: number, approved: boolean) => {
        try {
            await reviewOvertime(
                overtimeId,
                approved,
                comment || undefined,
                asRole || undefined,
                approved ? parseFloat(approvedHours) : undefined
            );
            const data = await getOvertimes();
            setOvertimes(data);
            setReviewingId(null);
            setComment('');
            setAsRole('');
            setApprovedHours('');
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
            const matchesSearch = empName.includes(query) || projName.includes(query) || desc.includes(query) || ot.id.toString() === query;
            const matchesStatus = statusFilter === 'ALL' || ot.status === statusFilter;
            return matchesSearch && matchesStatus;
        });

    if (loading) return (
        <div className="page-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
                <div style={{ width: '300px' }}><Skeleton height={60} /></div>
                <div style={{ width: '200px' }}><Skeleton height={52} borderRadius={14} /></div>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                <Skeleton height={52} style={{ flex: 1 }} />
                <Skeleton height={52} width={220} borderRadius={14} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                {[1, 2, 3, 4].map(i => <Skeleton key={i} height={350} borderRadius={20} />)}
            </div>
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <h4 className="line-clamp-3" style={{ fontSize: '1.1rem', fontWeight: 700, flex: 1 }}>{ot.description}</h4>
                                    <div style={{
                                        padding: '4px 10px', borderRadius: '10px', background: 'rgba(30, 64, 175, 0.1)',
                                        color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 700, marginLeft: '12px'
                                    }}>
                                        ID {ot.id}
                                    </div>
                                </div>
                                <div className="text-expand-btn" style={{ marginBottom: '16px' }} onClick={() => setSelectedOvertime(ot)}>Подробнее...</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={16} />
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>{ot.user?.full_name || `Сотрудник #${ot.user_id}`}</p>
                                            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{ot.user?.email}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                                        <Briefcase size={16} style={{ color: 'var(--text-muted)' }} />
                                        <span style={{ fontWeight: 600 }}>{ot.project?.name || `Проект #${ot.project_id}`}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                                        <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                                        <span style={{ fontWeight: 600 }}>
                                            {new Date(ot.start_time).toLocaleString('ru', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} — {new Date(ot.end_time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    {ot.location_name && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--accent)' }}>
                                            <MapPin size={16} />
                                            <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {ot.location_name}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ padding: '20px 28px', flex: 1, background: 'var(--bg-primary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px', borderRadius: '10px', background: 'var(--bg-tertiary)' }}>
                                    <Clock size={16} style={{ color: 'var(--accent)' }} />
                                    <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em' }}>
                                        {ot.hours} часа переработки
                                    </span>
                                </div>
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
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Согласовать часов:</label>
                                            <div style={{ position: 'relative' }}>
                                                <Clock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={approvedHours}
                                                    onChange={(e) => setApprovedHours(e.target.value)}
                                                    placeholder="Кол-во часов..."
                                                    style={{ paddingLeft: '40px', height: '42px', borderRadius: '8px', border: '1px solid var(--border)', width: '100%', outline: 'none' }}
                                                />
                                            </div>
                                        </div>
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
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Менеджер</p>
                                                <div style={{
                                                    width: '24px', height: '24px', borderRadius: '50%', margin: '0 auto',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: ot.manager_approved === true ? 'var(--success)' : ot.manager_approved === false ? 'var(--danger)' : 'var(--bg-tertiary)',
                                                    color: ot.manager_approved === null ? 'var(--text-muted)' : 'white'
                                                }}>
                                                    {ot.manager_approved === true ? <Check size={14} strokeWidth={4} /> : ot.manager_approved === false ? <XCircle size={14} /> : <Clock size={14} />}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Отдел</p>
                                                <div style={{
                                                    width: '24px', height: '24px', borderRadius: '50%', margin: '0 auto',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: ot.head_approved === true ? 'var(--success)' : ot.head_approved === false ? 'var(--danger)' : 'var(--bg-tertiary)',
                                                    color: ot.head_approved === null ? 'var(--text-muted)' : 'white'
                                                }}>
                                                    {ot.head_approved === true ? <Check size={14} strokeWidth={4} /> : ot.head_approved === false ? <XCircle size={14} /> : <Clock size={14} />}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setReviewingId(ot.id);
                                                setApprovedHours(ot.hours.toString());
                                            }}
                                            className="primary"
                                            style={{ width: 'auto', padding: '10px 24px', borderRadius: '12px', fontSize: '0.85rem' }}
                                        >
                                            Рассмотреть
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {selectedOvertime && (
                <OvertimeDetailModal
                    overtime={selectedOvertime}
                    currentUser={user}
                    onClose={() => setSelectedOvertime(null)}
                    onStatusUpdate={() => setUpdateTrigger(prev => prev + 1)}
                />
            )}
        </div>
    );
};

export default ReviewPage;