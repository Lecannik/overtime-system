import React from 'react';
import { Building2, X } from 'lucide-react';
import type { Department } from '../../types';

export type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

export interface DatePresetOption {
    id: DatePreset;
    label: string;
}

const DATE_PRESETS: DatePresetOption[] = [
    { id: 'all', label: 'Все даты' },
    { id: 'today', label: 'Сегодня' },
    { id: 'week', label: '7 дней' },
    { id: 'month', label: 'Этот месяц' },
    { id: 'custom', label: 'Период...' },
];

interface TmaReviewFilterBarProps {
    departments: Department[];
    selectedDeptId: string;
    onSelectDeptId: (id: string) => void;
    datePreset: DatePreset;
    onSelectDatePreset: (preset: DatePreset) => void;
    hasActiveFilters: boolean;
    onResetFilters: () => void;
    customStartDate: string;
    onCustomStartDateChange: (val: string) => void;
    customEndDate: string;
    onCustomEndDateChange: (val: string) => void;
    todayStr: string;
    haptic: {
        selection: () => void;
    };
}

/**
 * Панель фильтров для экрана согласования TMA: выбор отдела, быстрые пресеты дат и кастомный период.
 */
export const TmaReviewFilterBar: React.FC<TmaReviewFilterBarProps> = ({
    departments,
    selectedDeptId,
    onSelectDeptId,
    datePreset,
    onSelectDatePreset,
    hasActiveFilters,
    onResetFilters,
    customStartDate,
    onCustomStartDateChange,
    customEndDate,
    onCustomEndDateChange,
    todayStr,
    haptic,
}) => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
                borderRadius: '14px',
                padding: '10px 12px',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            }}
        >
            {/* Строка с выбором отдела и кнопкой сброса */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flex: 1,
                        background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                        borderRadius: '10px',
                        padding: '6px 10px',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                        minWidth: 0,
                    }}
                >
                    <Building2 size={15} style={{ color: 'var(--tg-theme-hint-color, #94a3b8)', flexShrink: 0 }} />
                    <select
                        value={selectedDeptId}
                        onChange={(e) => {
                            haptic.selection();
                            onSelectDeptId(e.target.value);
                        }}
                        style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--tg-theme-text-color, #f8fafc)',
                            fontSize: '0.82rem',
                            outline: 'none',
                            cursor: 'pointer',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                        }}
                    >
                        <option value="" style={{ background: '#1e293b', color: '#f8fafc' }}>
                            Все отделы {departments.length > 0 ? `(${departments.length})` : ''}
                        </option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id} style={{ background: '#1e293b', color: '#f8fafc' }}>
                                {d.name}
                            </option>
                        ))}
                    </select>
                </div>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onResetFilters}
                        style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#ef4444',
                            padding: '6px 10px',
                            borderRadius: '10px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                        }}
                    >
                        <X size={13} />
                        <span>Сбросить</span>
                    </button>
                )}
            </div>

            {/* Горизонтальный скролл чипсов дат */}
            <div
                style={{
                    display: 'flex',
                    gap: '6px',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    WebkitOverflowScrolling: 'touch',
                    paddingBottom: '2px',
                }}
            >
                {DATE_PRESETS.map((preset) => {
                    const isActive = datePreset === preset.id;
                    return (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                                haptic.selection();
                                onSelectDatePreset(preset.id);
                            }}
                            style={{
                                padding: '5px 12px',
                                borderRadius: '10px',
                                border: 'none',
                                background: isActive
                                    ? 'var(--tg-theme-button-color, var(--primary, #3b82f6))'
                                    : 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                                color: isActive
                                    ? 'var(--tg-theme-button-text-color, #ffffff)'
                                    : 'var(--tg-theme-text-color, #f8fafc)',
                                fontSize: '0.78rem',
                                fontWeight: isActive ? 700 : 500,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                transition: 'all 0.15s ease',
                            }}
                        >
                            {preset.label}
                        </button>
                    );
                })}
            </div>

            {/* Выбор произвольного диапазона дат (при выборе "custom") */}
            {datePreset === 'custom' && (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        paddingTop: '4px',
                        borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                    }}
                >
                    <div>
                        <label
                            style={{
                                display: 'block',
                                fontSize: '0.72rem',
                                color: 'var(--tg-theme-hint-color, #94a3b8)',
                                marginBottom: '3px',
                            }}
                        >
                            С даты
                        </label>
                        <input
                            type="date"
                            value={customStartDate}
                            max={todayStr}
                            onChange={(e) => onCustomStartDateChange(e.target.value)}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                                border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                                color: 'var(--tg-theme-text-color, #f8fafc)',
                                fontSize: '0.8rem',
                                outline: 'none',
                            }}
                        />
                    </div>
                    <div>
                        <label
                            style={{
                                display: 'block',
                                fontSize: '0.72rem',
                                color: 'var(--tg-theme-hint-color, #94a3b8)',
                                marginBottom: '3px',
                            }}
                        >
                            По дату
                        </label>
                        <input
                            type="date"
                            value={customEndDate}
                            min={customStartDate || undefined}
                            max={todayStr}
                            onChange={(e) => onCustomEndDateChange(e.target.value)}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                                border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                                color: 'var(--tg-theme-text-color, #f8fafc)',
                                fontSize: '0.8rem',
                                outline: 'none',
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
