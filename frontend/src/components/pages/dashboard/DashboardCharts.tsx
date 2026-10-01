import React from 'react';
import { Clock } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import type { UserStats } from '../../../types';

interface DashboardChartsProps {
    stats: UserStats | null;
}

const PIE_COLORS = [
    'var(--primary)',
    'var(--success)',
    'var(--warning)',
    'var(--info)',
    '#8b5cf6',
    '#ec4899',
];

/**
 * Графики аналитики для дашборда:
 * 1. Столбчатая диаграмма активности переработок за 30 дней (согласованные vs на проверке).
 * 2. Круговая диаграмма распределения трудозатрат по проектам.
 */
export const DashboardCharts: React.FC<DashboardChartsProps> = ({ stats }) => {
    const hasActivityData =
        stats?.daily_stats?.some(
            (d: { hours?: number; pending_hours?: number }) =>
                Number(d.hours || 0) > 0 || Number(d.pending_hours || 0) > 0
        ) ?? false;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {/* 30 Days Activity Chart */}
            <div className="glass-card" style={{ padding: '24px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        Активность за 30 дней (часы)
                    </h4>
                    {hasActivityData && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.72rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--primary)' }} />
                                <span style={{ color: 'var(--text-secondary)' }}>Согласовано</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f59e0b' }} />
                                <span style={{ color: 'var(--text-secondary)' }}>На проверке</span>
                            </div>
                        </div>
                    )}
                </div>

                {!hasActivityData ? (
                    <div
                        style={{
                            height: '200px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '12px',
                            border: '1px dashed var(--border)',
                            padding: '16px',
                            textAlign: 'center',
                        }}
                    >
                        <div
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '10px',
                            }}
                        >
                            <Clock size={20} />
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                            Нет активности за последние 30 дней
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '300px', lineHeight: 1.4 }}>
                            {stats?.active_requests && stats.active_requests > 0
                                ? `У вас есть ${stats.active_requests} активн. заявок в других периодах или ожидающих проверку.`
                                : 'За последние 30 дней нет согласованных или ожидающих проверку переработок.'}
                        </span>
                    </div>
                ) : (
                    <div style={{ height: '200px', position: 'relative', width: '100%', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                            <BarChart data={stats?.daily_stats || []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    interval={4}
                                    tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                                    tickFormatter={(val: string) => {
                                        if (!val) return '';
                                        const parts = val.split('-');
                                        return parts.length === 3 ? `${parts[2]}.${parts[1]}` : val;
                                    }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                                    tickFormatter={(value) => `${value}ч`}
                                    allowDecimals={false}
                                />
                                <RechartsTooltip
                                    contentStyle={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        boxShadow: 'var(--card-shadow)',
                                        fontSize: '0.78rem',
                                    }}
                                    labelFormatter={(label) => {
                                        if (!label) return '';
                                        const parts = label.split('-');
                                        if (parts.length === 3) {
                                            return `Дата: ${parts[2]}.${parts[1]}.${parts[0]}`;
                                        }
                                        return `Дата: ${label}`;
                                    }}
                                    formatter={(value, name) => {
                                        const valNum = Number(value || 0);
                                        const nameStr = String(name || '');
                                        if (nameStr === 'hours') return [`${valNum} ч.`, 'Согласовано'];
                                        if (nameStr === 'pending_hours') return [`${valNum} ч.`, 'На проверке'];
                                        return [`${valNum} ч.`, nameStr];
                                    }}
                                />
                                <Bar dataKey="hours" name="hours" fill="var(--primary)" stackId="dailyStack" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="pending_hours" name="pending_hours" fill="#f59e0b" stackId="dailyStack" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Project Distribution Pie Chart */}
            <div className="glass-card" style={{ padding: '24px', minWidth: 0 }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
                    Распределение по проектам
                </h4>
                <div className="dashboard-pie-wrap" style={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: '16px' }}>
                    <div style={{ flex: '1 1 200px', height: '180px', position: 'relative', width: '100%', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
                            <PieChart>
                                <Pie
                                    data={stats?.by_project || []}
                                    dataKey="hours"
                                    nameKey="project_name"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                >
                                    {(stats?.by_project || []).map((_entry, index: number) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{
                                        background: 'var(--bg-secondary)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        boxShadow: 'var(--card-shadow)',
                                    }}
                                    formatter={(value, name) => {
                                        return [`${Number(value || 0)} ч.`, String(name || '')];
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="dashboard-pie-legend" style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(stats?.by_project || []).slice(0, 4).map((p, i: number) => {
                            const item = p as { project_name?: string; hours?: number };
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                                    <div
                                        style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '2px',
                                            flexShrink: 0,
                                            background: PIE_COLORS[i % PIE_COLORS.length],
                                        }}
                                    />
                                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.project_name || 'Без названия'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
