/* eslint-disable */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2, Search, Filter, Calendar, ShieldCheck, ChevronDown, CheckCircle, Info, MapPin, Clock, XCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { api, getOvertimes, reviewOvertime } from '../../services/api';
import Header from '../layout/Header';
import LoadingOverlay from '../atoms/LoadingOverlay';
import OvertimeDetailModal from './OvertimeDetailModal';
import { STATUS_LABELS } from '../../constants/locale';
import type { User, Overtime } from '../../types';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import { Russian } from 'flatpickr/dist/l10n/ru.js';
import { AxiosError } from 'axios';


const formatToYmd = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseToDate = (str: string) => {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
};

/**
 * Безопасно парсит строку даты, предотвращая исключения во flatpickr при некорректном ручном вводе.
 *
 * @param {string} datestr - Входная строка даты.
 * @param {string} format - Формат даты.
 * @returns {Date} Объект даты. При ошибке возвращает невалидную дату new Date(NaN).
 */
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

const ReviewPage: React.FC = () => {
    const navigate = useNavigate();
    const [overtimes, setOvertimes] = useState<Overtime[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [comment, setComment] = useState('');
    const [reviewingId, setReviewingId] = useState<number | null>(null);
    const [asRole, setAsRole] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('search') || '';
    });
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedOvertime, setSelectedOvertime] = useState<Overtime | null>(null);
    const [updateTrigger, setUpdateTrigger] = useState(0);
    const [approvedHours, setApprovedHours] = useState<string>('');

    const startFpRef = useRef<any>(null);
    const endFpRef = useRef<any>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize] = useState(10);

    const startInputCallbackRef = useCallback((node: HTMLInputElement | null) => {
        if (node) {
            if (!startFpRef.current) {
                startFpRef.current = flatpickr(node, {
                    dateFormat: "d/m/Y",
                    locale: Russian,
                    allowInput: true,
                    parseDate: safeParseDate,
                    onClose: (selectedDates) => {
                        if (selectedDates[0]) {
                            setStartDate(formatToYmd(selectedDates[0]));
                        } else {
                            setStartDate('');
                        }
                        setCurrentPage(1);
                    }
                });
            }
        } else {
            if (startFpRef.current) {
                startFpRef.current.destroy();
                startFpRef.current = null;
            }
        }
    }, []);

    const endInputCallbackRef = useCallback((node: HTMLInputElement | null) => {
        if (node) {
            if (!endFpRef.current) {
                endFpRef.current = flatpickr(node, {
                    dateFormat: "d/m/Y",
                    locale: Russian,
                    allowInput: true,
                    parseDate: safeParseDate,
                    onClose: (selectedDates) => {
                        if (selectedDates[0]) {
                            setEndDate(formatToYmd(selectedDates[0]));
                        } else {
                            setEndDate('');
                        }
                        setCurrentPage(1);
                    }
                });
            }
        } else {
            if (endFpRef.current) {
                endFpRef.current.destroy();
                endFpRef.current = null;
            }
        }
    }, []);

    // 1. Загрузка данных пользователя (один раз при монтировании)
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) { navigate('/login'); return; }
                const userRes = await api.get('/auth/me');
                if (userRes.data.role === 'employee') {
                    navigate('/dashboard');
                    return;
                }
                setUser(userRes.data);
            } catch (err) {
                console.error('Fetch user error:', err);
            }
        };
        fetchUser();
    }, [navigate]);

    // 2. Функция загрузки списка овертаймов
    const fetchOvertimes = useCallback(async (showLoader = true) => {
        try {
            if (showLoader) {
                setLoading(true);
            }
            const token = localStorage.getItem('token');
            if (!token) { navigate('/login'); return; }

            const ovtRes = await getOvertimes({
                page: currentPage,
                page_size: pageSize,
                status: statusFilter !== 'ALL' ? statusFilter : undefined,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                view: 'review'
            });

            setOvertimes(ovtRes.items || []);
            setTotalPages(ovtRes.pages || 1);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [currentPage, pageSize, statusFilter, startDate, endDate, navigate]);

    // 3. Загрузка овертаймов при изменении пагинации, статуса или триггера обновления (с лоадером)
    useEffect(() => {
        const init = async () => {
            await fetchOvertimes(true);
        };
        init();
    }, [currentPage, statusFilter, updateTrigger, fetchOvertimes]);

    // 4. Тихое обновление овертаймов при изменении дат (без лоадера)
    useEffect(() => {
        const update = async () => {
            await fetchOvertimes(false);
        };
        update();
    }, [startDate, endDate, fetchOvertimes]);

    // 5. Подписка на обновление данных овертаймов
    useEffect(() => {
        const handleUpdate = () => {
            fetchOvertimes(false);
        };
        window.addEventListener('overtime_update', handleUpdate);
        return () => {
            window.removeEventListener('overtime_update', handleUpdate);
        };
    }, [fetchOvertimes]);

    // 6. Синхронизация стейта во flatpickr
    useEffect(() => {
        if (startFpRef.current) {
            const currentFpDate = startFpRef.current.selectedDates[0];
            const formattedCurrent = currentFpDate ? formatToYmd(currentFpDate) : '';
            if (formattedCurrent !== startDate) {
                const parsed = parseToDate(startDate);
                if (parsed) {
                    startFpRef.current.setDate(parsed, false);
                } else {
                    startFpRef.current.clear();
                }
            }
        }
    }, [startDate]);

    useEffect(() => {
        if (endFpRef.current) {
            const currentFpDate = endFpRef.current.selectedDates[0];
            const formattedCurrent = currentFpDate ? formatToYmd(currentFpDate) : '';
            if (formattedCurrent !== endDate) {
                const parsed = parseToDate(endDate);
                if (parsed) {
                    endFpRef.current.setDate(parsed, false);
                } else {
                    endFpRef.current.clear();
                }
            }
        }
    }, [endDate]);

    const handleReview = async (overtimeId: number, approved: boolean) => {
        try {
            await reviewOvertime(
                overtimeId,
                approved,
                comment || undefined,
                asRole || undefined,
                approved ? parseFloat(approvedHours) : undefined
            );
            fetchOvertimes(true);
            setReviewingId(null);
            setComment('');
            setAsRole('');
            setApprovedHours('');
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ detail?: string }>;
            alert(axiosError.response?.data?.detail || 'Ошибка при согласовании');
        }
    };

    const safeOvertimes = Array.isArray(overtimes) ? overtimes : [];
    const filteredOvertimes = (user?.role === 'admin'
        ? safeOvertimes
        : safeOvertimes.filter(ot =>
            ot.status === 'PENDING' || ot.status === 'MANAGER_APPROVED' || ot.status === 'HEAD_APPROVED'
        )).filter((ot: Overtime) => {
            const empName = (ot.user?.full_name || '').toLowerCase();
            const projName = (ot.project?.name || '').toLowerCase();
            const desc = (ot.description || '').toLowerCase();
            const query = searchQuery.toLowerCase();
            return empName.includes(query) || projName.includes(query) || desc.includes(query) || ot.id.toString() === query;
        });

    if (loading && !overtimes.length) return <LoadingOverlay />;

    return (
        <div className="page-container animate-fade-in">
            {loading && <LoadingOverlay />}
            {user && <Header user={user} />}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Согласование заявок</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Поток входящих запросов на подтверждение работы.</p>
                </div>
                <div className="badge badge-info" style={{ padding: '8px 16px', borderRadius: '12px' }}>
                    <ShieldCheck size={16} /> <span style={{ marginLeft: '8px' }}>Режим {user?.role === 'admin' ? 'Админа' : 'Проверки'}</span>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        placeholder="Поиск по ФИО или проекту..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: '40px', height: '44px', background: 'var(--bg-primary)' }}
                    />
                </div>
                <div style={{ position: 'relative', minWidth: '180px' }}>
                    <Filter size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <select
                        value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                        style={{ height: '44px', padding: '0 32px 0 44px', borderRadius: '10px', width: '100%' }}
                    >
                        <option value="ALL">Все статусы</option>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                </div>
                {/* Фильтр по датам */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                        ref={startInputCallbackRef}
                        type="text"
                        placeholder="дд/мм/гггг"
                        style={{ height: '44px', width: '110px', padding: '0 12px', borderRadius: '10px', fontSize: '0.9rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', textAlign: 'center' }}
                        title="Начало периода"
                    />
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                    <input
                        ref={endInputCallbackRef}
                        type="text"
                        placeholder="дд/мм/гггг"
                        style={{ height: '44px', width: '110px', padding: '0 12px', borderRadius: '10px', fontSize: '0.9rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', textAlign: 'center' }}
                        title="Конец периода"
                    />
                    {(startDate || endDate) && (
                        <button
                            onClick={() => { setStartDate(''); setEndDate(''); setCurrentPage(1); }}
                            className="action-button-modern"
                            title="Сбросить даты"
                            style={{ height: '44px', width: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '16px' }}>
                {filteredOvertimes.map((ot: Overtime) => (
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
                                        onClick={() => { setReviewingId(ot.id); setApprovedHours((ot.hours || 0).toString()); }}
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
