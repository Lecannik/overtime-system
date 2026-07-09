/* eslint-disable */
import React, { useState } from 'react';
import ReviewCard from './ReviewCard';
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import type { Overtime, User } from '../../../types';

interface ReviewTimelineViewProps {
    overtimes: Overtime[];
    currentUser: User | null;
    selectedIds: number[];
    onToggleSelect: (id: number) => void;
    onOpenDetail: (ot: Overtime) => void;
    reviewingId: number | null;
    onToggleReview: (id: number | null) => void;
    inlineFormRenderer: (ot: Overtime) => React.ReactNode;
}

const ReviewTimelineView: React.FC<ReviewTimelineViewProps> = ({
    overtimes,
    currentUser,
    selectedIds,
    onToggleSelect,
    onOpenDetail,
    reviewingId,
    onToggleReview,
    inlineFormRenderer,
}) => {
    // Храним свернутые дни (ключ: YYYY-MM-DD)
    const [collapsedDays, setCollapsedDays] = useState<string[]>([]);

    const toggleCollapse = (dayKey: string) => {
        if (collapsedDays.includes(dayKey)) {
            setCollapsedDays(collapsedDays.filter(d => d !== dayKey));
        } else {
            setCollapsedDays([...collapsedDays, dayKey]);
        }
    };

    const formatDateToYmd = (dateStr: string) => {
        const d = new Date(dateStr);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const formatToRuDate = (ymdStr: string) => {
        const parts = ymdStr.split('-');
        if (parts.length !== 3) return ymdStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    // Группируем овертаймы по дням
    const groups: Record<string, Overtime[]> = {};
    overtimes.forEach(ot => {
        const dayKey = formatDateToYmd(ot.start_time);
        if (!groups[dayKey]) {
            groups[dayKey] = [];
        }
        groups[dayKey].push(ot);
    });

    // Сортируем дни по убыванию
    const sortedDays = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    const getDayHours = (items: Overtime[]) => {
        return items.reduce((sum, ot) => sum + (ot.approved_hours || ot.hours || 0), 0);
    };

    const getIndicatorColor = (hours: number) => {
        if (hours === 0) return 'var(--border)';
        if (hours <= 8) return 'var(--primary)'; // Синий
        if (hours <= 20) return 'var(--warning)'; // Оранжевый
        return 'var(--danger)'; // Красный
    };

    // Выделить/снять выделение со всех заявок за конкретный день
    const handleDaySelectToggle = (dayItems: Overtime[]) => {
        const dayIds = dayItems.map(ot => ot.id);
        const allSelected = dayIds.every(id => selectedIds.includes(id));

        if (allSelected) {
            // Убираем выделение
            dayIds.forEach(id => {
                if (selectedIds.includes(id)) {
                    onToggleSelect(id);
                }
            });
        } else {
            // Добавляем выделение тем, кто не выбран
            dayIds.forEach(id => {
                if (!selectedIds.includes(id)) {
                    onToggleSelect(id);
                }
            });
        }
    };

    return (
        <div style={{ position: 'relative', paddingLeft: '24px' }}>
            {/* Вертикальная ось таймлайна */}
            <div style={{
                position: 'absolute',
                left: '7px',
                top: '16px',
                bottom: '16px',
                width: '2px',
                background: 'var(--border)',
                zIndex: 0
            }} />

            {sortedDays.map(dayKey => {
                const items = groups[dayKey];
                const isCollapsed = collapsedDays.includes(dayKey);
                const totalHours = getDayHours(items);
                const color = getIndicatorColor(totalHours);
                
                const allSelected = items.map(ot => ot.id).every(id => selectedIds.includes(id));

                return (
                    <div key={dayKey} style={{ marginBottom: '24px', position: 'relative', zIndex: 1 }}>
                        {/* Точка на оси */}
                        <div style={{
                            position: 'absolute',
                            left: '-24px',
                            top: '12px',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: color,
                            border: '4px solid var(--bg-primary)',
                            boxShadow: `0 0 8px ${color}`,
                        }} />

                        {/* Шапка группы дня */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'var(--bg-secondary)',
                            borderRadius: '12px',
                            padding: '12px 18px',
                            border: '1px solid var(--border)',
                            marginBottom: isCollapsed ? '0' : '16px',
                            cursor: 'pointer',
                            userSelect: 'none'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }} onClick={() => toggleCollapse(dayKey)}>
                                <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                    {formatToRuDate(dayKey)}
                                </span>
                                <span className="badge badge-info" style={{ fontSize: '0.62rem' }}>
                                    Заявок: {items.length} ({totalHours}ч)
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {/* Чекбокс дня для массового выбора */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={() => handleDaySelectToggle(items)}
                                        style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                    />
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Выбрать день</span>
                                </div>

                                <div onClick={() => toggleCollapse(dayKey)}>
                                    {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                </div>
                            </div>
                        </div>

                        {/* Карточки дня */}
                        {!isCollapsed && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
                                gap: '16px',
                                paddingLeft: '8px'
                            }}>
                                {items.map(ot => (
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
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {sortedDays.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                    Нет данных для отображения таймлайна.
                </div>
            )}
        </div>
    );
};

export default ReviewTimelineView;
