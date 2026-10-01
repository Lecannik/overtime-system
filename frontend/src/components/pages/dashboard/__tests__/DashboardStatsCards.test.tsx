import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardStatsCards } from '../DashboardStatsCards';
import type { UserStats, AnalyticsSummary } from '../../../../types';

describe('DashboardStatsCards', () => {
  const mockUserStats: UserStats = {
    total_approved_hours: 42.5,
    projects_count: 2,
    daily_stats: [],
    by_project: [],
    current_month_hours: 18.5,
    last_month_hours: 24,
    total_requests: 12,
    active_requests: 3,
  };

  const mockCompanyStats: AnalyticsSummary = {
    total_overtimes: 85,
    approved_count: 70,
    rejected_count: 0,
    pending_count: 15,
    avg_hours_per_overtime: 1.67,
    total_hours: 142.5,
    total_requests: 85,
    approved_requests: 70,
    pending_requests: 15,
  };

  it('рендерит персональные KPI пользователя в режиме "my"', () => {
    render(
      <DashboardStatsCards
        activeTab="my"
        stats={mockUserStats}
        companyStats={null}
      />
    );

    expect(screen.getByText(/часов одобрено в этом месяце/i)).toBeInTheDocument();
    expect(screen.getByText('18.5ч')).toBeInTheDocument();

    expect(screen.getByText(/часов одобрено в прошлом месяце/i)).toBeInTheDocument();
    expect(screen.getByText('24ч')).toBeInTheDocument();

    expect(screen.getByText(/всего заявок/i)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    expect(screen.getByText(/активных заявок/i)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('корректно отображает нулевые значения при отсутствии данных пользователя (stats=null)', () => {
    render(
      <DashboardStatsCards
        activeTab="my"
        stats={null}
        companyStats={null}
      />
    );

    expect(screen.getAllByText('0ч')).toHaveLength(2); // текущий и прошлый месяцы
    expect(screen.getAllByText('0')).toHaveLength(2); // всего и активных
  });

  it('рендерит корпоративные KPI в режиме "all"', () => {
    render(
      <DashboardStatsCards
        activeTab="all"
        stats={null}
        companyStats={mockCompanyStats}
      />
    );

    expect(screen.getByText(/часов согласовано в компании/i)).toBeInTheDocument();
    expect(screen.getByText('142.5ч')).toBeInTheDocument();

    expect(screen.getByText(/всего заявок в компании/i)).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();

    expect(screen.getByText(/согласовано заявок/i)).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();

    expect(screen.getByText(/ожидают согласования/i)).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('корректно отображает нулевые значения при отсутствии данных компании (companyStats=null)', () => {
    render(
      <DashboardStatsCards
        activeTab="all"
        stats={null}
        companyStats={null}
      />
    );

    expect(screen.getByText('0ч')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(3);
  });
});
