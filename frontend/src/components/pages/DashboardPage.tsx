import React, { useEffect, useState } from 'react';
import {
  Plus, Clock, CheckCircle, AlertCircle, TrendingUp,
  Trash2, Search, FileDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMyOvertimes, getMyStats, cancelOvertime, exportMyAnalytics } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import CreateOvertimeModal from './CreateOvertimeModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { STATUS_LABELS } from '../../constants/locale';
import LoadingOverlay from '../atoms/LoadingOverlay';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [overtimes, setOvertimes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ovRes, statsRes] = await Promise.all([
        getMyOvertimes(),
        getMyStats()
      ]);
      setOvertimes(Array.isArray(ovRes) ? ovRes : (ovRes.items || []));
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  return (
    <div className="animate-fade-in">
      {loading && <LoadingOverlay />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Рабочий стол</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Добро пожаловать, {user?.full_name}.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleExport} className="btn-secondary" style={{
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px'
          }}>
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

      {/* Admin/Manager Financial Widgets */}
      {(user?.role === 'admin' || user?.role === 'manager') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h4 style={{ fontWeight: 800 }}>Воронка сделок (Стадии)</h4>
              <Link to="/crm" style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>ВСЕ СДЕЛКИ</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Новые', val: 12, color: '#60a5fa', p: 100 },
                { label: 'ТКП', val: 8, color: '#fbbf24', p: 65 },
                { label: 'Договор', val: 5, color: '#f97316', p: 40 },
                { label: 'Оплата', val: 3, color: '#10b981', p: 25 }
              ].map((s, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 700 }}>{s.label}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{s.val} сделок</span>
                  </div>
                  <div style={{ height: '10px', background: 'var(--bg-tertiary)', borderRadius: '5px' }}>
                    <div style={{ width: `${s.p}%`, height: '100%', background: s.color, borderRadius: '5px' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <h4 style={{ fontWeight: 800, marginBottom: '24px' }}>Эффективность производства</h4>
            <div style={{ display: 'flex', gap: '20px', height: '180px' }}>
              <div style={{ flex: 1, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.0) 100%)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 800 }}>МАРЖИНАЛЬНОСТЬ (AVG)</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>32.4%</div>
                <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>↑ 2.1% с прошлого мес</div>
              </div>
              <div style={{ flex: 1, background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.0) 100%)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 800 }}>ЧИСТАЯ ПРИБЫЛЬ</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>8.4M</div>
                <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>В пределах плана</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="glass-card" style={{ padding: '24px' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>Активность за 30 дней (часы)</h4>
          <div style={{ height: '300px', minHeight: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.daily_stats || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="date" hide />
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
          <div style={{ height: '300px', minHeight: '300px', display: 'flex', alignItems: 'center' }}>
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

      {/* Requests Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontWeight: 700 }}>Мои переработки</h3>
          <div style={{ position: 'relative', width: '250px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              placeholder="Найти по описанию..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="modern-input"
              style={{ paddingLeft: '36px', height: '36px', fontSize: '0.8rem', background: 'var(--bg-tertiary)' }}
            />
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table-container" style={{ width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '16px', textAlign: 'left' }}>Дата</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Проект</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Часы</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Статус</th>
                <th style={{ padding: '16px', textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredOvertimes.map((ot: any) => (
                <tr key={ot.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px' }}>{new Date(ot.start_time).toLocaleDateString()}</td>
                  <td style={{ padding: '16px' }}>
                    {/* Link to project details page */}
                    <Link to={`/projects/${ot.project?.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <span className="hover-link" style={{ fontWeight: 600 }}>{ot.project?.name || 'Внутренний'}</span>
                    </Link>
                  </td>
                  <td style={{ padding: '16px', fontWeight: 700 }}>{ot.hours}ч</td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: ot.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      color: ot.status === 'APPROVED' ? '#10b981' : '#f59e0b'
                    }}>
                      {STATUS_LABELS[ot.status] || ot.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    {ot.status === 'PENDING' && (
                      <button onClick={() => handleCancel(ot.id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateOvertimeModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
};

export default DashboardPage;
