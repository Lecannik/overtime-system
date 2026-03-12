import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Clock, CheckCircle2, XCircle, Calendar, Briefcase, FileText,
  Search, ChevronRight, User
} from 'lucide-react';
import api, { getOvertimes, cancelOvertime } from '../../services/api';
import CreateOvertimeModal from './CreateOvertimeModal';
import Header from '../layout/Header';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [overtimes, setOvertimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editOvertimeData, setEditOvertimeData] = useState<any>(null);

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

      const otData = await getOvertimes();
      setOvertimes(otData);
    } catch (err) {
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
    <div className="page-container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
      <div className="loading-bar" style={{ width: '40%' }}></div>
    </div>
  );

  return (
    <div className="page-container animate-fade-in">
      <Header user={user} />

      {/* Welcome Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '48px' }}>
        <div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '8px' }}>
            Привет, {user?.full_name?.split(' ')[1] || 'Сотрудник'}! 👋
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 500 }}>
            У вас {overtimes.filter(ot => ot.status === 'PENDING').length} активных заявок на переработку.
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
              <div key={ot.id} className="glass-card" style={{ padding: '0', overflow: 'hidden', display: 'flex', transition: 'all 0.2s', border: '1px solid var(--border)', opacity: canEdit ? 1 : 0.9 }}>
                <div style={{ width: '6px', background: status.color }} />
                <div style={{ padding: '24px 32px', flex: 1, display: 'flex', alignItems: 'center', gap: '32px' }}>

                  {/* Проект и Автор */}
                  <div style={{ flex: 1.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>#{ot.id}</span>
                      <div style={{ padding: '4px 10px', borderRadius: '8px', background: status.bg, color: status.color, fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <StatusIcon size={12} /> {status.label}
                      </div>
                    </div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', lineHeight: 1.3 }}>{ot.description}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem' }}>
                        <Briefcase size={14} /> {ot.project?.name || 'Внутренний проект'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        <User size={14} /> {ot.user?.full_name || 'Сотрудник'}
                      </div>
                    </div>
                  </div>

                  {/* Дата и Время */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                      <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                      {new Date(ot.start_time).toLocaleDateString('ru', { month: 'long', day: 'numeric' })}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '24px' }}>
                      {new Date(ot.start_time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })} — {new Date(ot.end_time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* Длительность */}
                  <div style={{ flex: 0.8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Длительность</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {ot.hours}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginLeft: '2px' }}>ч</span>
                    </div>
                  </div>

                  {/* Статусы согласования */}
                  <div style={{ display: 'flex', gap: '12px', padding: '0 20px', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>МЕН</span>
                      {ot.manager_approved === true ? <CheckCircle2 size={18} style={{ color: 'var(--success)' }} /> : ot.manager_approved === false ? <XCircle size={18} style={{ color: 'var(--danger)' }} /> : <Clock size={18} style={{ color: 'var(--warning)', opacity: 0.5 }} />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>НАЧ</span>
                      {ot.head_approved === true ? <CheckCircle2 size={18} style={{ color: 'var(--success)' }} /> : ot.head_approved === false ? <XCircle size={18} style={{ color: 'var(--danger)' }} /> : <Clock size={18} style={{ color: 'var(--warning)', opacity: 0.5 }} />}
                    </div>
                  </div>

                  {/* Действия */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {ot.status === 'PENDING' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCancel(ot.id); }}
                        style={{ width: '40px', height: '40px', borderRadius: '12px', border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        title="Отменить заявку"
                      >
                        <XCircle size={18} />
                      </button>
                    )}
                    <button
                      disabled={!canEdit}
                      onClick={() => handleEdit(ot)}
                      style={{
                        width: '40px', height: '40px', borderRadius: '12px', border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: canEdit ? 'pointer' : 'not-allowed',
                        opacity: canEdit ? 1 : 0.5,
                        transition: 'all 0.2s'
                      }}
                      title="Редактировать"
                    >
                      <ChevronRight size={20} />
                    </button>
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
    </div>
  );
};

export default DashboardPage;