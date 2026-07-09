/* eslint-disable */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2, Search, Filter, ShieldCheck, ChevronDown, 
    ChevronLeft, ChevronRight, LayoutGrid, Calendar, AlignLeft
} from 'lucide-react';
import { api, getOvertimes, reviewOvertime, getAccessToken } from '../../services/api';
import Header from '../layout/Header';
import LoadingOverlay from '../atoms/LoadingOverlay';
import OvertimeDetailModal from './OvertimeDetailModal';
import { STATUS_LABELS } from '../../constants/locale';
import type { User, Overtime } from '../../types';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import { Russian } from 'flatpickr/dist/l10n/ru.js';
import { AxiosError } from 'axios';

// Компоненты представлений
import ReviewTableView from './review/ReviewTableView';
import ReviewCalendarView from './review/ReviewCalendarView';
import ReviewTimelineView from './review/ReviewTimelineView';
import ReviewInlineForm from './review/ReviewInlineForm';
import BulkActions from './review/BulkActions';

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
    const [reviewingId, setReviewingId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('search') || '';
    });
    const [debouncedSearch, setDebouncedSearch] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('search') || '';
    });
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedOvertime, setSelectedOvertime] = useState<Overtime | null>(null);
    const [updateTrigger, setUpdateTrigger] = useState(0);

    // Массовые действия
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Виды отображения ('table' | 'calendar' | 'timeline')
    const [viewMode, setViewMode] = useState<'table' | 'calendar' | 'timeline'>(() => {
        return (localStorage.getItem('review_view_mode') as 'table' | 'calendar' | 'timeline') || 'table';
    });

    const startFpRef = useRef<any>(null);
    const endFpRef = useRef<any>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize] = useState(12);

    // Сохранение выбора вида в localStorage
    const handleViewModeChange = (mode: 'table' | 'calendar' | 'timeline') => {
        setViewMode(mode);
        localStorage.setItem('review_view_mode', mode);
        setCurrentPage(1);
    };

    // Debounce поиска — 350мс
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setCurrentPage(1);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);

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
                const token = getAccessToken();
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
            const token = getAccessToken();
            if (!token) { navigate('/login'); return; }

            // Если выбран вид "calendar", загружаем больше элементов за раз,
            // так как в календаре показываются данные за целый месяц.
            const currentSize = viewMode === 'calendar' ? 100 : pageSize;

            const ovtRes = await getOvertimes({
                page: currentPage,
                page_size: currentSize,
                status: statusFilter !== 'ALL' ? statusFilter : undefined,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                search: debouncedSearch || undefined,
                view: 'review'
            });

            setOvertimes(ovtRes.items || []);
            setTotalPages(ovtRes.pages || 1);
            setSelectedIds([]);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [currentPage, pageSize, statusFilter, startDate, endDate, debouncedSearch, viewMode, navigate]);

    // 3. Загрузка овертаймов при изменении пагинации, статуса, поиска, вида или триггера обновления (с лоадером)
    useEffect(() => {
        const init = async () => {
            await fetchOvertimes(true);
        };
        init();
    }, [currentPage, statusFilter, debouncedSearch, viewMode, updateTrigger, fetchOvertimes]);

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

    // Обработка одиночного согласования
    const handleReview = async (
        overtimeId: number,
        approved: boolean,
        commentText?: string,
        roleText?: string,
        approvedHoursVal?: number
    ) => {
        try {
            await reviewOvertime(
                overtimeId,
                approved,
                commentText || undefined,
                roleText || undefined,
                approvedHoursVal
            );
            fetchOvertimes(true);
            setReviewingId(null);
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ detail?: string }>;
            alert(axiosError.response?.data?.detail || 'Ошибка при согласовании');
        }
    };

    // Обработка массового согласования
    const handleBulkReview = async (approved: boolean, bulkComment: string, bulkRole: string) => {
        setLoading(true);
        try {
            await Promise.all(
                selectedIds.map(id =>
                    reviewOvertime(
                        id,
                        approved,
                        bulkComment || undefined,
                        bulkRole || undefined,
                        undefined // Одобряем по исходным часам
                    )
                )
            );
            setSelectedIds([]);
            fetchOvertimes(true);
        } catch (err: unknown) {
            console.error('Bulk review error:', err);
            const axiosError = err as AxiosError<{ detail?: string }>;
            alert(axiosError.response?.data?.detail || 'Некоторые заявки не удалось согласовать');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSelect = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(x => x !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleClearSelection = () => {
        setSelectedIds([]);
    };

    const handleCalendarDateRangeChange = (start: string, end: string) => {
        setStartDate(start);
        setEndDate(end);
    };

    const safeOvertimes = Array.isArray(overtimes) ? overtimes : [];

    // Рендер инлайн формы согласования для карточки
    const renderInlineForm = (ot: Overtime) => (
        <ReviewInlineForm
            overtime={ot}
            currentUser={user}
            onCancel={() => setReviewingId(null)}
            onSubmit={(approved, comment, role, hours) =>
                handleReview(ot.id, approved, comment, role, hours)
            }
        />
    );

    // Рендер контента в зависимости от выбранного вида
    const renderViewContent = () => {
        if (viewMode === 'calendar') {
            return (
                <ReviewCalendarView
                    overtimes={safeOvertimes}
                    currentUser={user}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onOpenDetail={setSelectedOvertime}
                    reviewingId={reviewingId}
                    onToggleReview={setReviewingId}
                    inlineFormRenderer={renderInlineForm}
                    onDateRangeChange={handleCalendarDateRangeChange}
                />
            );
        }

        if (viewMode === 'timeline') {
            return (
                <ReviewTimelineView
                    overtimes={safeOvertimes}
                    currentUser={user}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onOpenDetail={setSelectedOvertime}
                    reviewingId={reviewingId}
                    onToggleReview={setReviewingId}
                    inlineFormRenderer={renderInlineForm}
                />
            );
        }

        // По умолчанию - табличный вид
        return (
            <ReviewTableView
                overtimes={safeOvertimes}
                currentUser={user}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onOpenDetail={setSelectedOvertime}
                reviewingId={reviewingId}
                onToggleReview={setReviewingId}
                inlineFormRenderer={renderInlineForm}
            />
        );
    };

    if (!user) return <LoadingOverlay />;

    return (
        <div className="page-container animate-fade-in">
            {loading && <LoadingOverlay />}
            {user && <Header user={user} />}

            {/* Шапка страницы */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Согласование заявок</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Поток входящих запросов на подтверждение работы.</p>
                </div>
                <div className="badge badge-info" style={{ padding: '8px 16px', borderRadius: '12px' }}>
                    <ShieldCheck size={16} /> <span style={{ marginLeft: '8px' }}>Режим {user?.role === 'admin' ? 'Админа' : 'Проверки'}</span>
                </div>
            </div>

            {/* Переключатель режимов представления */}
            <div className="review-view-toggle" style={{
                display: 'flex',
                background: 'var(--bg-secondary)',
                padding: '6px',
                borderRadius: '14px',
                border: '1px solid var(--border)',
                marginBottom: '24px',
                width: 'fit-content',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            }}>
                <button
                    onClick={() => handleViewModeChange('table')}
                    style={{
                        border: 'none',
                        background: viewMode === 'table' ? 'var(--primary-gradient)' : 'transparent',
                        color: viewMode === 'table' ? 'white' : 'var(--text-secondary)',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        transition: 'all 0.2s ease-in-out'
                    }}
                >
                    <LayoutGrid size={16} />
                    Таблица заявок
                </button>
                <button
                    onClick={() => handleViewModeChange('calendar')}
                    style={{
                        border: 'none',
                        background: viewMode === 'calendar' ? 'var(--primary-gradient)' : 'transparent',
                        color: viewMode === 'calendar' ? 'white' : 'var(--text-secondary)',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        transition: 'all 0.2s ease-in-out'
                    }}
                >
                    <Calendar size={16} />
                    Календарный вид
                </button>
                <button
                    onClick={() => handleViewModeChange('timeline')}
                    style={{
                        border: 'none',
                        background: viewMode === 'timeline' ? 'var(--primary-gradient)' : 'transparent',
                        color: viewMode === 'timeline' ? 'white' : 'var(--text-secondary)',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        transition: 'all 0.2s ease-in-out'
                    }}
                >
                    <AlignLeft size={16} />
                    Временная лента
                </button>
            </div>

            {/* Фильтры и переключатель видов */}
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

                {/* Поля календаря (скрываем в режиме Календаря, так как там встроенный выбор) */}
                {viewMode !== 'calendar' && (
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
                )}
            </div>

            {/* Массовые действия */}
            <BulkActions
                selectedIds={selectedIds}
                currentUser={user}
                onClear={handleClearSelection}
                onSubmit={handleBulkReview}
            />

            {/* Основное содержимое */}
            {renderViewContent()}

            {/* Пагинация (только для табличного вида, чтобы не путать пользователя в календаре/таймлайне) */}
            {viewMode === 'table' && totalPages > 1 && (
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

            {safeOvertimes.length === 0 && (
                <div style={{ textAlign: 'center', padding: '100px' }}>
                    <CheckCircle2 size={60} style={{ color: 'var(--success)', opacity: 0.2 }} />
                    <p style={{ color: 'var(--text-muted)', marginTop: '20px' }}>Нет активных заявок для согласования.</p>
                </div>
            )}

            {selectedOvertime && (
                <OvertimeDetailModal
                    overtime={selectedOvertime}
                    onClose={() => setSelectedOvertime(null)}
                    currentUser={user}
                    onReview={async (id, approved, commentText, roleText, approvedHoursVal) => {
                        await handleReview(id, approved, commentText, roleText, approvedHoursVal);
                        setSelectedOvertime(null);
                    }}
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
