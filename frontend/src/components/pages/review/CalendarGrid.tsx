/* eslint-disable */
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarSummary, CalendarDayData } from '../../../services/api';

export type CalendarMode = 'day' | 'week' | 'month' | 'quarter' | 'year';

interface CalendarGridProps {
    mode: CalendarMode;
    currentDate: Date;
    onDateChange: (date: Date) => void;
    summary: CalendarSummary;
    selectedDateStr: string;
    onDayClick: (dateStr: string) => void;
}

const DAYS_OF_WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_RU = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const CalendarGrid: React.FC<CalendarGridProps> = ({
    mode,
    currentDate,
    onDateChange,
    summary,
    selectedDateStr,
    onDayClick,
}) => {
    // Хелпер получения цвета heatmap по часам
    const getHeatmapColor = (hours: number) => {
        if (!hours || hours === 0) return 'transparent';
        if (hours <= 8) return 'rgba(59, 130, 246, 0.15)'; // Голубой
        if (hours <= 20) return 'rgba(245, 158, 11, 0.25)'; // Оранжевый
        return 'rgba(239, 68, 68, 0.3)'; // Красный
    };

    const getHeatmapBorder = (hours: number) => {
        if (!hours || hours === 0) return '1px solid var(--border)';
        if (hours <= 8) return '1px solid rgba(59, 130, 246, 0.4)';
        if (hours <= 20) return '1px solid rgba(245, 158, 11, 0.5)';
        return '1px solid rgba(239, 68, 68, 0.6)';
    };

    const formatDateToYmd = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const navigateDate = (direction: 'prev' | 'next') => {
        const offset = direction === 'prev' ? -1 : 1;
        const newDate = new Date(currentDate);

        if (mode === 'day') {
            newDate.setDate(currentDate.getDate() + offset);
        } else if (mode === 'week') {
            newDate.setDate(currentDate.getDate() + offset * 7);
        } else if (mode === 'month') {
            newDate.setMonth(currentDate.getMonth() + offset);
        } else if (mode === 'quarter') {
            newDate.setMonth(currentDate.getMonth() + offset * 3);
        } else if (mode === 'year') {
            newDate.setFullYear(currentDate.getFullYear() + offset);
        }
        onDateChange(newDate);
    };

    // Отрендерить сетку одного месяца
    const renderMonthGrid = (year: number, monthIdx: number, size: 'normal' | 'mini' = 'normal') => {
        const firstDay = new Date(year, monthIdx, 1);
        const lastDay = new Date(year, monthIdx + 1, 0);

        // День недели первого дня (0 - вс, 1 - пн, ..., 6 - сб) -> переводим в 0 - пн, ..., 6 - вс
        let startDayOfWeek = firstDay.getDay() - 1;
        if (startDayOfWeek < 0) startDayOfWeek = 6;

        const daysInMonth = lastDay.getDate();
        const days = [];

        // Пустые ячейки в начале
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(<div key={`empty-${i}`} style={{ opacity: 0.1, border: '1px solid transparent' }} />);
        }

        // Ячейки дней
        for (let day = 1; day <= daysInMonth; day++) {
            const thisDate = new Date(year, monthIdx, day);
            const dateStr = formatDateToYmd(thisDate);
            const dayData: CalendarDayData | undefined = summary[dateStr];
            const isSelected = selectedDateStr === dateStr;
            const hours = dayData?.hours || 0;

            const isToday = formatDateToYmd(new Date()) === dateStr;

            days.push(
                <div
                    key={dateStr}
                    onClick={() => onDayClick(dateStr)}
                    style={{
                        background: getHeatmapColor(hours),
                        border: isSelected ? '2px solid var(--primary)' : getHeatmapBorder(hours),
                        borderRadius: '8px',
                        padding: size === 'normal' ? '8px' : '4px',
                        minHeight: size === 'normal' ? '70px' : '36px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                        boxShadow: isSelected ? '0 0 10px rgba(59, 130, 246, 0.4)' : undefined,
                        position: 'relative'
                    }}
                    className="calendar-day-cell"
                    onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.03)';
                        e.currentTarget.style.zIndex = '2';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.zIndex = '1';
                    }}
                >
                    {/* Номер дня */}
                    <div style={{
                        fontWeight: isToday ? 900 : 600,
                        fontSize: size === 'normal' ? '0.85rem' : '0.7rem',
                        color: isToday ? 'var(--primary)' : 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <span>{day}</span>
                        {hours > 0 && size === 'normal' && (
                            <span style={{ fontSize: '0.7rem', opacity: 0.8, color: 'var(--text-secondary)', fontWeight: 700 }}>
                                {hours}ч
                            </span>
                        )}
                    </div>

                    {/* Нагрузка / Инициалы сотрудников (только для нормального размера на десктопе) */}
                    {size === 'normal' && dayData && dayData.entries.length > 0 && (
                        <div className="desktop-only" style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
                            {dayData.entries.slice(0, 2).map((entry, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        fontSize: '0.62rem',
                                        background: 'rgba(255, 255, 255, 0.06)',
                                        padding: '2px 4px',
                                        borderRadius: '4px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        color: 'var(--text-secondary)',
                                        display: 'flex',
                                        justifyContent: 'space-between'
                                    }}
                                    title={entry.name}
                                >
                                    <span>{entry.initials}</span>
                                    <span style={{ fontWeight: 700 }}>{entry.hours}ч</span>
                                </div>
                            ))}
                            {dayData.entries.length > 2 && (
                                <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>
                                    Еще +{dayData.entries.length - 2}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Маленькие точки для мобильных / мини-сеток */}
                    {dayData && dayData.entries.length > 0 && (size === 'mini' || true) && (
                        <div className={size === 'mini' ? '' : 'mobile-only'} style={{
                            display: 'flex',
                            gap: '3px',
                            justifyContent: 'center',
                            marginTop: '4px'
                        }}>
                            {dayData.pending > 0 && (
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--warning)' }} />
                            )}
                            {dayData.approved > 0 && (
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--success)' }} />
                            )}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: size === 'normal' ? '8px' : '4px' }}>
                {DAYS_OF_WEEK.map(d => (
                    <div key={d} style={{
                        textAlign: 'center',
                        fontWeight: 700,
                        fontSize: size === 'normal' ? '0.75rem' : '0.6rem',
                        color: 'var(--text-muted)',
                        paddingBottom: '4px',
                        borderBottom: '1px solid var(--border)'
                    }}>
                        {d}
                    </div>
                ))}
                {days}
            </div>
        );
    };

    // Рендеринг различных режимов
    const renderContent = () => {
        if (mode === 'day') {
            const dateStr = formatDateToYmd(currentDate);
            const dayData = summary[dateStr];
            const hours = dayData?.hours || 0;
            const isToday = formatDateToYmd(new Date()) === dateStr;

            return (
                <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '16px',
                    border: '1px solid var(--border)',
                    padding: '24px',
                    textAlign: 'center'
                }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', color: isToday ? 'var(--primary)' : 'inherit' }}>
                        {currentDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        {isToday && ' (Сегодня)'}
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', margin: '24px 0' }}>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '16px 24px', borderRadius: '12px', minWidth: '120px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Часов всего</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: hours > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{hours}ч</div>
                        </div>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '16px 24px', borderRadius: '12px', minWidth: '120px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Заявок</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: (dayData?.total || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{dayData?.total || 0}</div>
                        </div>
                    </div>
                    {dayData && dayData.entries.length > 0 ? (
                        <div style={{ textAlign: 'left', marginTop: '20px' }}>
                            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '12px' }}>Сотрудники на переработке:</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {dayData.entries.map((entry, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: '10px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{entry.name}</div>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <span className={`badge badge-${entry.status === 'APPROVED' ? 'success' : entry.status === 'REJECTED' ? 'danger' : 'warning'}`} style={{ fontSize: '0.65rem' }}>
                                                {entry.hours}ч
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '24px' }}>В этот день переработок не зафиксировано</p>
                    )}
                </div>
            );
        }

        if (mode === 'week') {
            // Вычисляем дни текущей недели (пн-вс)
            const startOfWeek = new Date(currentDate);
            const dayOfWeek = startOfWeek.getDay();
            const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startOfWeek.setDate(currentDate.getDate() - distanceToMonday);

            const weekDays = [];
            for (let i = 0; i < 7; i++) {
                const day = new Date(startOfWeek);
                day.setDate(startOfWeek.getDate() + i);
                weekDays.push(day);
            }

            return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                    {weekDays.map(day => {
                        const dateStr = formatDateToYmd(day);
                        const dayData = summary[dateStr];
                        const hours = dayData?.hours || 0;
                        const isSelected = selectedDateStr === dateStr;
                        const isToday = formatDateToYmd(new Date()) === dateStr;

                        return (
                            <div
                                key={dateStr}
                                onClick={() => onDayClick(dateStr)}
                                style={{
                                    background: getHeatmapColor(hours) || 'var(--bg-secondary)',
                                    border: isSelected ? '2px solid var(--primary)' : getHeatmapBorder(hours),
                                    borderRadius: '12px',
                                    padding: '16px',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    minHeight: '140px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    boxShadow: isSelected ? '0 0 10px rgba(59, 130, 246, 0.4)' : undefined,
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                                        {day.toLocaleDateString('ru-RU', { weekday: 'short' })}
                                    </div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: isToday ? 900 : 600, color: isToday ? 'var(--primary)' : 'var(--text-primary)', margin: '4px 0' }}>
                                        {day.getDate()}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                        {day.toLocaleDateString('ru-RU', { month: 'short' })}
                                    </div>
                                </div>
                                <div style={{ marginTop: '12px' }}>
                                    {hours > 0 ? (
                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{hours}ч</div>
                                    ) : (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</div>
                                    )}
                                    {dayData && dayData.total > 0 && (
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Заявок: {dayData.total}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (mode === 'month') {
            return renderMonthGrid(currentDate.getFullYear(), currentDate.getMonth(), 'normal');
        }

        if (mode === 'quarter') {
            const startMonth = Math.floor(currentDate.getMonth() / 3) * 3;
            const quarterMonths = [startMonth, startMonth + 1, startMonth + 2];

            return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                    {quarterMonths.map(mIdx => (
                        <div key={mIdx} style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '16px', border: '1px solid var(--border)' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', textAlign: 'center' }}>
                                {MONTHS_RU[mIdx]}
                            </h4>
                            {renderMonthGrid(currentDate.getFullYear(), mIdx, 'mini')}
                        </div>
                    ))}
                </div>
            );
        }

        if (mode === 'year') {
            return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    {MONTHS_RU.map((name, idx) => (
                        <div key={idx} style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '12px', border: '1px solid var(--border)' }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>
                                {name}
                            </h4>
                            {renderMonthGrid(currentDate.getFullYear(), idx, 'mini')}
                        </div>
                    ))}
                </div>
            );
        }
    };

    // Заголовок навигации по дате
    const getNavigationTitle = () => {
        if (mode === 'day') {
            return currentDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        }
        if (mode === 'week') {
            const startOfWeek = new Date(currentDate);
            const dayOfWeek = startOfWeek.getDay();
            const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startOfWeek.setDate(currentDate.getDate() - distanceToMonday);

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);

            return `${startOfWeek.getDate()}.${startOfWeek.getMonth() + 1} - ${endOfWeek.getDate()}.${endOfWeek.getMonth() + 1}.${endOfWeek.getFullYear()}`;
        }
        if (mode === 'month') {
            return `${MONTHS_RU[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        }
        if (mode === 'quarter') {
            const q = Math.floor(currentDate.getMonth() / 3) + 1;
            return `${q}-й квартал ${currentDate.getFullYear()}`;
        }
        if (mode === 'year') {
            return `${currentDate.getFullYear()} год`;
        }
    };

    return (
        <div>
            {/* Панель навигации по датам */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                padding: '8px 16px',
                border: '1px solid var(--border)'
            }}>
                <button
                    onClick={() => navigateDate('prev')}
                    className="action-button-modern"
                    style={{ width: '32px', height: '32px' }}
                >
                    <ChevronLeft size={16} />
                </button>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {getNavigationTitle()}
                </span>
                <button
                    onClick={() => navigateDate('next')}
                    className="action-button-modern"
                    style={{ width: '32px', height: '32px' }}
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* Сетка календаря */}
            {renderContent()}
        </div>
    );
};

export default CalendarGrid;
