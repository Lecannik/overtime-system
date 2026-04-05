import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Clock, CheckCircle, AlertCircle, TrendingUp,
  MapPin, Trash2, Edit2, Search, ChevronLeft, ChevronRight, FileDown
} from 'lucide-react';
import { api, getMyOvertimes, getMyStats, cancelOvertime, exportMyAnalytics } from '../../services/api';
import Header from '../layout/Header';
import CreateOvertimeModal from './CreateOvertimeModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { STATUS_LABELS } from '../../constants/locale';
import LoadingOverlay from '../atoms/LoadingOverlay';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [overtimes, setOvertimes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editOvertime, setEditOvertime] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) { navigate('/login'); return; }

      const userRes = await api.get('/auth/me');
      setUser(userRes.data);

      const [ovRes, statsRes] = await Promise.all([
        getMyOvertimes({ page: currentPage, page_size: pageSize }),
        getMyStats()
      ]);
      setOvertimes(ovRes.items || []);
      setTotalPages(ovRes.pages || 1);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      // Don't auto-navigate to login on every error, maybe just token error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage]);

  const handleCancel = async (id: number) => {
    if (window.confirm('Отменить заявку?')) {
      await cancelOvertime(id);
      fetchData();
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportMyAnalytics();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my_overtime_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Ошибка при экспорте отчета');
    }
  };

  const filteredOvertimes = (Array.isArray(overtimes) ? overtimes : []).filter(ot =>
    (ot.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ot.project?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && !overtimes.length) return <LoadingOverlay />;

  return (
    <div className="page-container animate-fade-in">
      {loading && <LoadingOverlay />}
      <Header user={user} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Дашборд сотрудника</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ваша активность и статус переработок за последнее время.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleExport} style={{
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px'
          }} className="btn-secondary">
            <FileDown size={18} /> ЭКСПОРТ (EXCEL)
          </button>
          <button onClick={() => setIsCreateModalOpen(true)} className="primary">
            <Plus size={20} /> НОВАЯ ЗАЯВКА
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '40px' }}>
        {[
          { label: 'Часов одобрено', value: `${stats?.total_approved_hours || 0}ч`, icon: Clock, color: 'var(--primary)', sub: 'Всего подтверждено' },
          { label: 'Всего заявок', value: stats?.total_requests || 0, icon: TrendingUp, color: 'var(--success)', sub: 'За всё время' },
          { label: 'Активных заявок', value: stats?.active_requests || 0, icon: AlertCircle, color: 'var(--warning)', sub: 'В процессе проверки' },
          { label: 'Проектов', value: stats?.projects_count || '0', icon: CheckCircle, color: 'var(--info)', sub: 'Участие в проектах' },
        ].map((stat, i) => (
          <div key={i} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{stat.label}</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stat.value}</h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{stat.sub}</p>
            </div>
            <div className="icon-shape" style={{ background: 'var(--bg-tertiary)', color: stat.color, width: '48px', height: '48px', borderRadius: '16px' }}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="glass-card" style={{ padding: '24px' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>Активность за 30 дней (часы)</h4>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.daily_stats || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis
                  dataKey="date"
                  hide
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                <RechartsTooltip
                  contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px', boxShadow: 'var(--card-shadow)' }}
                  itemStyle={{ color: 'var(--primary)' }}
                />
                <Bar dataKey="hours" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>Распределение по проектам</h4>
          <div style={{ height: '200px', display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.by_project || []}
                    dataKey="hours"
                    nameKey="project_name"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                  >
                    {(stats?.by_project || []).map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={[
                        'var(--primary)', 'var(--success)', 'var(--warning)', 'var(--info)', '#8b5cf6', '#ec4899'
                      ][index % 6]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px', boxShadow: 'var(--card-shadow)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '20px' }}>
              {(stats?.by_project || []).slice(0, 4).map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '2px', background: [
                      'var(--primary)', 'var(--success)', 'var(--warning)', 'var(--info)', '#8b5cf6', '#ec4899'
                    ][i % 6]
                  }} />
                  <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.project_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '16px' }}>
        {/* Left: Table */}
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 700 }}>Мои переработки</h3>
            <div style={{ position: 'relative', width: '250px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                placeholder="Найти по описанию..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px', height: '36px', fontSize: '0.8rem', background: 'var(--bg-tertiary)' }}
              />
            </div>
          </div>
          <div style={{ overflowX: 'auto', flex: 1 }}>
            <table className="table-container">
              <thead>
                <tr>
                  <th className="table-header">Дата</th>
                  <th className="table-header">Проект</th>
                  <th className="table-header">Часы</th>
                  <th className="table-header">Статус</th>
                  <th className="table-header" style={{ textAlign: 'right' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredOvertimes.map((ot: any) => (
                  <tr key={ot.id}>
                    <td className="table-cell">{new Date(ot.start_time).toLocaleDateString()}</td>
                    <td className="table-cell">
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ot.project?.name || 'Внутренний'}</div>
                    </td>
                    <td className="table-cell">{ot.hours}ч</td>
                    <td className="table-cell">
                      <span className={`badge badge-${ot.status === 'APPROVED' ? 'success' : ot.status === 'REJECTED' || ot.status === 'CANCELLED' ? 'danger' : 'warning'}`}>
                        {STATUS_LABELS[ot.status] || ot.status}
                      </span>
                    </td>
                    <td className="table-cell" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {(ot.status === 'PENDING' || ot.status === 'MANAGER_APPROVED' || ot.status === 'HEAD_APPROVED' || user?.role === 'admin') &&
                          ot.status !== 'APPROVED' && ot.status !== 'REJECTED' && ot.status !== 'CANCELLED' && (
                            <>
                              <button
                                onClick={() => { setEditOvertime(ot); setIsCreateModalOpen(true); }}
                                className="action-button-modern"
                                title="Редактировать"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleCancel(ot.id)}
                                className="action-button-modern delete"
                                title="Удалить/Отменить"
                                style={{ color: 'var(--error)' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
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
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredOvertimes.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Ничего не найдено</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination UI */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Страница <b>{currentPage}</b> из <b>{totalPages}</b>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="action-button-modern"
                style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="action-button-modern"
                style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Info Widget */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-card" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', color: 'white', border: 'none' }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.8, marginBottom: '16px' }}>Текущий месяц</h4>
            <div style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px' }}>{stats?.current_month_hours || 0}ч</div>
            <p style={{ fontSize: '0.85rem', opacity: 0.9 }}>Всего одобренных часов за текущий месяц.</p>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)' }}>
                <Clock size={20} />
              </div>
              <h4 style={{ fontWeight: 700 }}>Информация</h4>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Не забывайте прикреплять геолокацию к заявкам для более быстрого согласования менеджером.
            </p>
          </div>
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateOvertimeModal
          editData={editOvertime}
          onClose={() => { setIsCreateModalOpen(false); setEditOvertime(null); }}
          onCreated={() => {
            setIsCreateModalOpen(false);
            setEditOvertime(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default DashboardPage;