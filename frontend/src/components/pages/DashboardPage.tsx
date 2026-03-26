import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Clock, CheckCircle2, XCircle, Calendar, Briefcase, FileText,
  Search, User, Activity, Edit2
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import api, { getOvertimes, cancelOvertime, getMyStats, getWeeklyStats } from '../../services/api';
import CreateOvertimeModal from './CreateOvertimeModal';
import OvertimeDetailModal from './OvertimeDetailModal';
import Header from '../layout/Header';
import Skeleton from '../common/Skeleton';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [overtimes, setOvertimes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editOvertimeData, setEditOvertimeData] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [selectedOvertime, setSelectedOvertime] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const userRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(userRes.data);

      if (userRes.data.must_change_password) {
        navigate('/profile');
        return;
      }

      const [otData, statsData, weekRes] = await Promise.all([
        getOvertimes(),
        getMyStats(),
        getWeeklyStats()
      ]);
      setOvertimes(otData);
      setStats(statsData);
      setWeeklyData(weekRes);
    } catch (err) {
      console.error(err);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate]);

  const handleCancel = async (id: number) => {
    if (window.confirm('Вы уверены, что хотите отменить эту заявку?')) {
      await cancelOvertime(id);
      fetchData();
    }
  };

  const handleEdit = (ot: any) => {
    setEditOvertimeData(ot);
    setIsModalOpen(true);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'APPROVED': return { label: 'Одобрено', icon: CheckCircle2, color: 'var(--success)', bg: 'rgba(22, 163, 74, 0.1)' };
      case 'REJECTED': return { label: 'Отклонено', icon: XCircle, color: 'var(--danger)', bg: 'rgba(220, 38, 38, 0.1)' };
      case 'CANCELLED': return { label: 'Отменено', icon: XCircle, color: 'var(--text-muted)', bg: 'var(--bg-tertiary)' };
      default: return { label: 'В обработке', icon: Clock, color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)' };
    }
  };

  const filteredOvertimes = overtimes.filter(ot => {
    const matchesSearch = (ot.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ot.project?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || ot.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return (
    <div className="page-container">
      <div style={{ height: '60px', marginBottom: '40px' }}><Skeleton height={60} /></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ width: '400px' }}>
          <Skeleton height={48} width="80%" />
          <Skeleton height={20} width="60%" style={{ marginTop: '12px' }} />
        </div>
        <Skeleton height={56} width={220} borderRadius={14} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '32px', marginBottom: '48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <Skeleton height={160} borderRadius={24} /><Skeleton height={160} borderRadius={24} />
          <Skeleton height={140} style={{ gridColumn: 'span 2' }} borderRadius={24} />
        </div>
        <Skeleton height={320} borderRadius={32} />
      </div>
      <div style={{ marginBottom: '24px' }}><Skeleton height={32} width={200} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {[1, 2, 3].map(i => <Skeleton key={i} height={120} borderRadius={20} />)}
      </div>
    </div>
  );

  return (
    <div className="page-container animate-fade-in">
      <Header user={user} />

      {/* Welcome Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
        <div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '8px' }}>
            Личный кабинет 👋
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 500 }}>
            Добро пожаловать, {user?.full_name || 'Сотрудник'}. Вот ваша статистика по переработкам.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="primary"
          style={{ width: 'auto', padding: '0 32px', height: '56px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <Plus size={22} /> Создать заявку
        </button>
      </div>

      {/* Stats Cards & Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '32px', marginBottom: '48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="glass-card animate-scale-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Этот месяц</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.04em' }}>{stats?.current_month_hours || 0}</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-muted)' }}>ч</span>
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData.slice(-5)}>
                  <Area type="monotone" dataKey="hours" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card animate-scale-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', animationDelay: '0.1s' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Прошлый месяц</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em' }}>{stats?.last_month_hours || 0}</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-muted)' }}>ч</span>
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px', opacity: 0.5 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData.slice(0, 5)}>
                  <Area type="monotone" dataKey="hours" stroke="var(--text-muted)" fill="var(--text-muted)" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card animate-scale-in" style={{ gridColumn: 'span 2', padding: '28px', animationDelay: '0.2s' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.05em' }}>Общий прогресс</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-0.06em', color: 'var(--text-primary)' }}>
                {stats?.total_hours || 0}<span style={{ fontSize: '1.5rem', color: 'var(--text-muted)', marginLeft: '8px', letterSpacing: '0' }}>часов</span>
              </div>
              <div style={{ height: '60px', width: '2px', background: 'var(--border)', borderRadius: '2px' }} />
              <div>
                <p style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '2px' }}>{stats?.by_project?.length || 0} проектов</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>За всё время работы</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={20} style={{ color: 'var(--accent)' }} /> Тенденции за неделю
          </h3>
          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--text-secondary)' }} />
                <YAxis hide />
                <RechartsTooltip
                  contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '12px' }}
                />
                <Area type="monotone" dataKey="hours" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Последние заявки</h3>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder="Поиск по описанию или проекту..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '52px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', height: '54px' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '0 24px', borderRadius: '14px', border: '1px solid var(--border)',
            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            fontWeight: 600, cursor: 'pointer', outline: 'none', width: '220px'
          }}
        >
          <option value="ALL">Все статусы</option>
          <option value="PENDING">В обработке</option>
          <option value="APPROVED">Одобрено</option>
          <option value="REJECTED">Отклонено</option>
        </select>
      </div>

      {/* Overtimes List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {filteredOvertimes.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '100px 40px' }}>
            <div style={{ width: '80px', height: '80px', background: 'var(--bg-tertiary)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <FileText size={40} style={{ color: 'var(--text-muted)' }} />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Записей не найдено</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Попробуйте изменить параметры поиска или фильтрации.</p>
          </div>
        ) : (
          filteredOvertimes.map((ot: any) => {
            const status = getStatusInfo(ot.status);
            const StatusIcon = status.icon;
            const canEdit = ot.status === 'PENDING' || user?.role === 'admin';

            return (
              <div key={ot.id} className="glass-card animate-scale-in" style={{ padding: '0', overflow: 'hidden', display: 'flex', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', border: '1px solid var(--border)', opacity: canEdit ? 1 : 0.9 }}>
                <div style={{ width: '6px', background: status.color }} />
                {/* Контент карточки с использованием Grid для идеального выравнивания */}
                <div style={{
                  padding: '20px 32px',
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: '3fr 2fr 1.2fr 1.5fr 100px',
                  alignItems: 'center',
                  gap: '24px'
                }}>

                  {/* 1. Проект и Автор */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>#{ot.id}</span>
                      <div style={{ padding: '4px 10px', borderRadius: '8px', background: status.bg, color: status.color, fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                        <StatusIcon size={12} /> {status.label}
                      </div>
                    </div>
                    <h4 className="line-clamp-3" style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px', overflow: 'hidden' }}>{ot.description}</h4>
                    <div className="text-expand-btn" onClick={(e) => { e.stopPropagation(); setSelectedOvertime(ot); }}>Подробнее...</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: 700, fontSize: '0.8rem' }}>
                        <Briefcase size={14} /> {ot.project?.name || 'Внутренний'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        <User size={14} /> {ot.user?.full_name?.split(' ')[0] || 'Сотрудник'}
                      </div>
                    </div>
                  </div>

                  {/* 2. Дата и Время */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
                      <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                      {new Date(ot.start_time).toLocaleDateString('ru', { month: 'long', day: 'numeric' })}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '24px', fontWeight: 500 }}>
                      {new Date(ot.start_time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })} — {new Date(ot.end_time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* 3. Длительность */}
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Длительность</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 850, color: 'var(--text-primary)' }}>
                      {ot.hours}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginLeft: '2px' }}>ч</span>
                    </div>
                  </div>

                  {/* 4. Статусы согласования */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', padding: '0 10px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>МЕН</span>
                      {ot.manager_approved === true ? <CheckCircle2 size={18} style={{ color: 'var(--success)' }} /> : ot.manager_approved === false ? <XCircle size={18} style={{ color: 'var(--danger)' }} /> : <Clock size={18} style={{ color: 'var(--warning)', opacity: 0.5 }} />}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>НАЧ</span>
                      {ot.head_approved === true ? <CheckCircle2 size={18} style={{ color: 'var(--success)' }} /> : ot.head_approved === false ? <XCircle size={18} style={{ color: 'var(--danger)' }} /> : <Clock size={18} style={{ color: 'var(--warning)', opacity: 0.5 }} />}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {ot.status === 'PENDING' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(ot); }}
                        className="action-button-modern"
                        style={{ width: '38px', height: '38px', padding: 0, background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                        title="Редактировать"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedOvertime(ot); }}
                      className="action-button-modern"
                      style={{ height: '38px', padding: '0 16px', fontSize: '0.85rem', fontWeight: 700, borderRadius: '12px', background: 'var(--accent)', color: 'white', border: 'none' }}
                    >
                      {ot.status === 'PENDING' ? 'Просмотр' : 'Детали'}
                    </button>
                    {ot.status === 'PENDING' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCancel(ot.id); }}
                        className="action-button-modern delete"
                        style={{ width: '38px', height: '38px', padding: 0 }}
                        title="Отменить"
                      >
                        <XCircle size={18} />
                      </button>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {isModalOpen && (
        <CreateOvertimeModal
          editData={editOvertimeData}
          onCreated={() => {
            fetchData();
            setIsModalOpen(false);
            setEditOvertimeData(null);
          }}
          onClose={() => {
            setIsModalOpen(false);
            setEditOvertimeData(null);
          }}
        />
      )}
      {selectedOvertime && (
        <OvertimeDetailModal
          overtime={selectedOvertime}
          currentUser={user}
          onClose={() => setSelectedOvertime(null)}
          onStatusUpdate={fetchData}
        />
      )}
    </div>
  );
};

export default DashboardPage;