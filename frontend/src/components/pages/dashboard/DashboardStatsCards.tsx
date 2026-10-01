import React from 'react';
import { Clock, TrendingUp, AlertCircle } from 'lucide-react';
import type { UserStats, AnalyticsSummary } from '../../../types';

interface DashboardStatsCardsProps {
    activeTab: 'my' | 'all';
    stats: UserStats | null;
    companyStats: AnalyticsSummary | null;
}

/**
 * Карточки ключевых показателей (KPI) переработок:
 * - В режиме "Мои": одобренные часы за текущий и прошлый месяцы, общее число заявок, активные заявки.
 * - В режиме "Все сотрудники": сводные часы и заявки по всей компании.
 */
export const DashboardStatsCards: React.FC<DashboardStatsCardsProps> = ({
    activeTab,
    stats,
    companyStats,
}) => {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '40px' }}>
            {activeTab === 'my' ? (
                [
                    { label: 'Часов одобрено в этом месяце', value: `${stats?.current_month_hours || 0}ч`, icon: Clock, color: 'var(--primary)', sub: 'В текущем месяце' },
                    { label: 'Часов одобрено в прошлом месяце', value: `${stats?.last_month_hours || 0}ч`, icon: Clock, color: 'var(--info)', sub: 'В прошлом месяце' },
                    { label: 'Всего заявок', value: stats?.total_requests || 0, icon: TrendingUp, color: 'var(--success)', sub: 'За всё время' },
                    { label: 'Активных заявок', value: stats?.active_requests || 0, icon: AlertCircle, color: 'var(--warning)', sub: 'В процессе проверки' },
                ].map((stat, i) => (
                    <div key={i} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                {stat.label}
                            </p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stat.value}</h3>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{stat.sub}</p>
                        </div>
                        <div className="icon-shape" style={{ background: 'var(--bg-tertiary)', color: stat.color, width: '48px', height: '48px', borderRadius: '16px' }}>
                            <stat.icon size={24} />
                        </div>
                    </div>
                ))
            ) : (
                [
                    { label: 'Часов согласовано в компании', value: `${companyStats?.total_hours || 0}ч`, icon: Clock, color: 'var(--primary)', sub: 'По всем проектам' },
                    { label: 'Всего заявок в компании', value: companyStats?.total_requests || 0, icon: TrendingUp, color: 'var(--info)', sub: 'Зарегистрировано' },
                    { label: 'Согласовано заявок', value: companyStats?.approved_requests || 0, icon: TrendingUp, color: 'var(--success)', sub: 'Одобрено руководителями' },
                    { label: 'Ожидают согласования', value: companyStats?.pending_requests || 0, icon: AlertCircle, color: 'var(--warning)', sub: 'В процессе проверки' },
                ].map((stat, i) => (
                    <div key={i} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                {stat.label}
                            </p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stat.value}</h3>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{stat.sub}</p>
                        </div>
                        <div className="icon-shape" style={{ background: 'var(--bg-tertiary)', color: stat.color, width: '48px', height: '48px', borderRadius: '16px' }}>
                            <stat.icon size={24} />
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};
