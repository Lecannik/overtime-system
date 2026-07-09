/* eslint-disable */
import React, { useState, useEffect } from 'react';
import CalendarGrid from './CalendarGrid';
import type { CalendarMode } from './CalendarGrid';
import ReviewCard from './ReviewCard';
import { getCalendarSummary } from '../../../services/api';
import type { CalendarSummary } from '../../../services/api';
import { Calendar, Layers, Clock } from 'lucide-react';
import type { Overtime, User } from '../../../types';

interface ReviewCalendarViewProps {
    overtimes: Overtime[];
    currentUser: User | null;
    selectedIds: number[];
    onToggleSelect: (id: number) => void;
    onOpenDetail: (ot: Overtime) => void;
    reviewingId: number | null;
    onToggleReview: (id: number | null) => void;
    inlineFormRenderer: (ot: Overtime) => React.ReactNode;
    // Callback для уведомления родительского контейнера об изменении периода дат
    onDateRangeChange: (start: string, end: string) => void;
}

const ReviewCalendarView: React.FC<ReviewCalendarViewProps> = ({
    overtimes,
    currentUser,
    selectedIds,
    onToggleSelect,
    onOpenDetail,
    reviewingId,
    onToggleReview,
    inlineFormRenderer,
    onDateRangeChange,
}) => {
    const [mode, setMode] = useState<CalendarMode>(() => {
        return (localStorage.getItem('review_calendar_mode') as CalendarMode) || 'month';
    });
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [selectedDateStr, setSelectedDateStr] = useState<string>('');
    const [summary, setSummary] = useState<CalendarSummary>({});
    const [loadingSummary, setLoadingSummary] = useState<boolean>(false);

    // Сохраняем режим в localStorage
    const handleModeChange = (newMode: CalendarMode) => {
        setMode(newMode);
        localStorage.setItem('review_calendar_mode', newMode);
    };

    // Форматирование даты в YYYY-MM
    const formatToYm = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    };

    const formatDateToYmd = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Загрузка сводки по дням
    useEffect(() => {
        const fetchSummary = async () => {
            setLoadingSummary(true);
            try {
                // Если режим "Год", загрузим сводку для текущего года (12 запросов)
                // Но лучше просто загрузить сводку для текущего месяца. Если режим Год или Квартал, 
                // мы загрузим сводку для текущего месяца, а при переключении дат она обновится.
                // Для простоты делаем запрос для текущего месяца:
                const ym = formatToYm(currentDate);
                const data = await getCalendarSummary(ym);
                
                // Если режим квартал или год, подгрузим также соседние месяцы
                if (mode === 'quarter') {
                    const startMonth = Math.floor(currentDate.getMonth() / 3) * 3;
                    let combined = { ...data };
                    for (let i = 0; i < 3; i++) {
                        const m = startMonth + i;
                        if (m !== currentDate.getMonth()) {
                            const tempDate = new Date(currentDate.getFullYear(), m, 1);
                            const tempYm = formatToYm(tempDate);
                            const tempData = await getCalendarSummary(tempYm);
                            combined = { ...combined, ...tempData };
                        }
                    }
                    setSummary(combined);
                } else if (mode === 'year') {
                    let combined = { ...data };
                    // Чтобы не спамить 12 запросов одновременно, загрузим их параллельно
                    const promises = Array.from({ length: 12 }, (_, i) => {
                        if (i !== currentDate.getMonth()) {
                            const tempDate = new Date(currentDate.getFullYear(), i, 1);
                            return getCalendarSummary(formatToYm(tempDate));
                        }
                        return Promise.resolve({});
                    });
                    const results = await Promise.all(promises);
                    results.forEach(res => {
                        combined = { ...combined, ...res };
                    });
                    setSummary(combined);
                } else {
                    setSummary(data);
                }
            } catch (err) {
                console.error('Error fetching calendar summary:', err);
            } finally {
                setLoadingSummary(false);
            }
        };

        fetchSummary();
    }, [currentDate, mode]);

    // Синхронизация фильтра дат в родительском компоненте
    useEffect(() => {
        let start = '';
        let end = '';

        if (mode === 'day') {
            start = formatDateToYmd(currentDate);
            end = formatDateToYmd(currentDate);
        } else if (mode === 'week') {
            const startOfWeek = new Date(currentDate);
            const dayOfWeek = startOfWeek.getDay();
            const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startOfWeek.setDate(currentDate.getDate() - distanceToMonday);
            
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);

            start = formatDateToYmd(startOfWeek);
            end = formatDateToYmd(endOfWeek);
        } else if (mode === 'month') {
            const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const last = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            start = formatDateToYmd(first);
            end = formatDateToYmd(last);
        } else if (mode === 'quarter') {
            const startMonth = Math.floor(currentDate.getMonth() / 3) * 3;
            const first = new Date(currentDate.getFullYear(), startMonth, 1);
            const last = new Date(currentDate.getFullYear(), startMonth + 3, 0);
            start = formatDateToYmd(first);
            end = formatDateToYmd(last);
        } else if (mode === 'year') {
            const first = new Date(currentDate.getFullYear(), 0, 1);
            const last = new Date(currentDate.getFullYear(), 12, 0);
            start = formatDateToYmd(first);
            end = formatDateToYmd(last);
        }

        onDateRangeChange(start, end);
    }, [currentDate, mode]);

    // Синхронизация выбранного дня при изменении режима или даты
    useEffect(() => {
        if (mode === 'day') {
            setSelectedDateStr(formatDateToYmd(currentDate));
        } else {
            setSelectedDateStr('');
        }
    }, [currentDate, mode]);

    const handleDayClick = (dateStr: string) => {
        if (selectedDateStr === dateStr) {
            setSelectedDateStr(''); // Повторный клик — сброс
        } else {
            setSelectedDateStr(dateStr);
        }
    };

    // Фильтруем овертаймы для правой панели
    const displayedOvertimes = overtimes.filter(ot => {
        if (!selectedDateStr) return true; // Если день не выбран, показываем все
        const otDate = formatDateToYmd(new Date(ot.start_time));
        return otDate === selectedDateStr;
    });

    const getFormattedSelectedDate = () => {
        if (!selectedDateStr) return 'Все заявки за период';
        const parts = selectedDateStr.split('-');
        return `Заявки за ${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Панель выбора масштаба (Режима) */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                background: 'var(--bg-secondary)',
                padding: '12px 20px',
                borderRadius: '16px',
                border: '1px solid var(--border)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={18} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Масштаб календаря:</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-primary)', padding: '4px', borderRadius: '10px' }}>
                    {(['day', 'week', 'month', 'quarter', 'year'] as CalendarMode[]).map(m => {
                        const labels: Record<string, string> = {
                            day: 'День',
                            week: 'Неделя',
                            month: 'Месяц',
                            quarter: 'Квартал',
                            year: 'Год'
                        };
                        const isActive = mode === m;
                        return (
                            <button
                                key={m}
                                onClick={() => handleModeChange(m)}
                                style={{
                                    border: 'none',
                                    background: isActive ? 'var(--primary-gradient)' : 'transparent',
                                    color: isActive ? '#fff' : 'var(--text-secondary)',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: isActive ? 700 : 500,
                                    fontSize: '0.8rem',
                                    transition: 'all 0.15s'
                                }}
                            >
                                {labels[m]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Двухколоночный макет календаря */}
            <div className="calendar-view-layout" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {/* Левая колонка — Календарь */}
                <div style={{ flex: '1 1 500px', minWidth: '300px' }}>
                    <div className="glass-card" style={{ padding: '20px' }}>
                        {loadingSummary && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                <Clock size={12} className="animate-spin" /> Обновление календаря...
                            </div>
                        )}
                        <CalendarGrid
                            mode={mode}
                            currentDate={currentDate}
                            onDateChange={setCurrentDate}
                            summary={summary}
                            selectedDateStr={selectedDateStr}
                            onDayClick={handleDayClick}
                        />
                    </div>
                </div>

                {/* Правая колонка — Список заявок */}
                <div style={{ flex: '0 0 460px', minWidth: '320px' }} className="calendar-sidebar-column">
                    <div className="glass-card" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                                {getFormattedSelectedDate()}
                            </h3>
                            <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                                Найдено: {displayedOvertimes.length}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '550px', paddingRight: '4px' }}>
                            {displayedOvertimes.map(ot => (
                                <ReviewCard
                                    key={ot.id}
                                    overtime={ot}
                                    currentUser={currentUser}
                                    isReviewing={reviewingId === ot.id}
                                    isSelected={selectedIds.includes(ot.id)}
                                    onOpenDetail={onOpenDetail}
                                    onToggleReview={onToggleReview}
                                    onToggleSelect={onToggleSelect}
                                    inlineForm={inlineFormRenderer(ot)}
                                    isCompact={true}
                                />
                            ))}

                            {displayedOvertimes.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                                    <Layers size={36} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                    <p style={{ fontSize: '0.85rem' }}>Нет заявок для отображения за выбранный день.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReviewCalendarView;
