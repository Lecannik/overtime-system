import React, { useState, useEffect } from 'react';
import {
  X, Save, DollarSign, Briefcase,
  TrendingUp, FileText, CheckCircle, ExternalLink, Activity
} from 'lucide-react';
import { updateProject, getCRMStages, getUsersList, getCRMTasks } from '../../services/api';
import LoadingOverlay from '../atoms/LoadingOverlay';
import type { Project, Task } from '../../types';

interface ProjectDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  project: Project;
}

const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({ isOpen, onClose, onSuccess, project }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'finance' | 'docs' | 'tasks'>('general');
  const [stages, setStages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    manager_id: '',
    gip_id: '',
    stage_id: '',
    status: '',
    weekly_limit: 50,
    budget: 0,
    gross_profit: 0,
    net_profit: 0,
    turnover: 0,
    labor_cost: 0,
    ntk: 0,
    aup: 0,
    doc_spec_url: '',
    doc_tech_spec_url: '',
    doc_schemes_url: '',
    doc_client_export_url: ''
  });

  useEffect(() => {
    if (isOpen && project) {
      setFormData({
        name: project.name || '',
        manager_id: project.manager_id?.toString() || '',
        gip_id: project.gip_id?.toString() || '',
        stage_id: project.stage_id?.toString() || '',
        status: project.status || 'ACTIVE',
        weekly_limit: project.weekly_limit || 50,
        budget: project.budget || 0,
        gross_profit: project.gross_profit || 0,
        net_profit: project.net_profit || 0,
        turnover: project.turnover || 0,
        labor_cost: project.labor_cost || 0,
        ntk: project.ntk || 0,
        aup: project.aup || 0,
        doc_spec_url: project.doc_spec_url || '',
        doc_tech_spec_url: project.doc_tech_spec_url || '',
        doc_schemes_url: project.doc_schemes_url || '',
        doc_client_export_url: project.doc_client_export_url || ''
      });
      fetchMetadata();
    }
  }, [isOpen, project]);

  const fetchMetadata = async () => {
    try {
      const [stagesData, usersData, tasksData] = await Promise.all([
        getCRMStages('PROJECT'),
        getUsersList(),
        getCRMTasks({ project_id: project.id })
      ]);
      setStages(stagesData);
      setUsers(usersData.items || usersData || []);
      setTasks(tasksData);
    } catch (err) {
      console.error('Ошибка загрузки метаданных', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProject(project.id, {
        ...formData,
        manager_id: formData.manager_id ? Number(formData.manager_id) : null,
        gip_id: formData.gip_id ? Number(formData.gip_id) : null,
        stage_id: formData.stage_id ? Number(formData.stage_id) : null,
        status: formData.status
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert('Ошибка при сохранении проекта');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !project) return null;

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      style={{
        padding: '12px 20px',
        border: 'none',
        background: activeTab === id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
        color: activeTab === id ? 'var(--accent)' : 'var(--text-muted)',
        borderRadius: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontWeight: activeTab === id ? 700 : 500,
        transition: 'all 0.2s'
      }}
    >
      <Icon size={18} />
      {label}
    </button>
  );

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 3000 }}>
      <div className="modal-content glass-card animate-scale-in"
        style={{ maxWidth: '850px', padding: 0, overflow: 'hidden', borderRadius: '24px' }}
        onClick={e => e.stopPropagation()}>

        {loading && <LoadingOverlay />}

        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900 }}>
              {project.name.substring(0, 1).toUpperCase()}
            </div>
            <div>
              <h3 style={{ fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>{project.name}</h3>
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <span className={`status-badge status-${project.status?.toLowerCase()}`}>{project.status}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ID: {project.id}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="action-button-modern" style={{ width: '44px', height: '44px' }}><X size={24} /></button>
        </div>

        {/* Tabs Navigation */}
        <div style={{ padding: '8px 32px', display: 'flex', gap: '8px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          <TabButton id="general" label="Общее" icon={Briefcase} />
          <TabButton id="finance" label="Экономика" icon={TrendingUp} />
          <TabButton id="docs" label="Документы" icon={FileText} />
          <TabButton id="tasks" label="Задачи" icon={CheckCircle} />
        </div>

        <form onSubmit={handleSave} style={{ padding: '32px', minHeight: '400px', maxHeight: '70vh', overflowY: 'auto' }}>

          {activeTab === 'general' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Название проекта</label>
                <input
                  className="modern-input"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Введите название проекта..."
                />
              </div>

              <div className="form-group">
                <label>Статус</label>
                <select className="modern-input" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                  <option value="PLANNED">Запланирован</option>
                  <option value="ACTIVE">Активен</option>
                  <option value="ON_HOLD">На паузе</option>
                  <option value="COMPLETED">Завершен</option>
                </select>
              </div>

              <div className="form-group">
                <label>Стадия</label>
                <select className="modern-input" value={formData.stage_id} onChange={e => setFormData({ ...formData, stage_id: e.target.value })}>
                  <option value="">Не выбрана</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Менеджер проекта</label>
                <select className="modern-input" value={formData.manager_id} onChange={e => setFormData({ ...formData, manager_id: e.target.value })}>
                  <option value="">Не назначен</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>ГИП (Главный инженер)</label>
                <select className="modern-input" value={formData.gip_id} onChange={e => setFormData({ ...formData, gip_id: e.target.value })}>
                  <option value="">Не назначен</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Недельный лимит Overtime (ч)</label>
                <input type="number" className="modern-input" value={formData.weekly_limit} onChange={e => setFormData({ ...formData, weekly_limit: Number(e.target.value) })} />
              </div>
            </div>
          )}

          {activeTab === 'finance' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>

              {/* Финансовые карточки-индикаторы */}
              {[
                { label: 'Бюджет', key: 'budget', icon: DollarSign, color: '#3b82f6' },
                { label: 'Оборот', key: 'turnover', icon: Activity, color: '#8b5cf6' },
                { label: 'Сумма работ', key: 'labor_cost', icon: Briefcase, color: '#ec4899' },
                { label: 'Валовая прибыль', key: 'gross_profit', icon: TrendingUp, color: '#10b981' },
                { label: 'Чистая прибыль', key: 'net_profit', icon: TrendingUp, color: '#059669' },
                { label: 'НТК', key: 'ntk', icon: Activity, color: '#f59e0b' },
                { label: 'АУП', key: 'aup', icon: Activity, color: '#f43f5e' },
              ].map(field => (
                <div key={field.key} className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    <field.icon size={14} style={{ color: field.color }} />
                    {field.label.toUpperCase()}
                  </label>
                  <input
                    type="number"
                    className="modern-input"
                    style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', padding: '8px 0', fontWeight: 800 }}
                    value={(formData as any)[field.key]}
                    onChange={e => setFormData({ ...formData, [field.key]: Number(e.target.value) })}
                  />
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>₸ (Тенге)</div>
                </div>
              ))}

              <div style={{ gridColumn: '1/-1', background: 'rgba(59, 130, 246, 0.05)', padding: '20px', borderRadius: '16px', border: '1px dashed var(--accent)', marginTop: '12px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong>Подсказка:</strong> Эти показатели могут быть автоматически обновлены при загрузке спецификации в формате Excel.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'docs' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
              {[
                { label: 'Спецификация (Excel)', key: 'doc_spec_url' },
                { label: 'Техническая спецификация (ТЗ)', key: 'doc_tech_spec_url' },
                { label: 'Схемы подключения', key: 'doc_schemes_url' },
                { label: 'Выгрузка для клиента', key: 'doc_client_export_url' },
              ].map(doc => (
                <div key={doc.key} className="form-group">
                  <label>{doc.label}</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                      className="modern-input"
                      placeholder="https://..."
                      value={(formData as any)[doc.key]}
                      onChange={e => setFormData({ ...formData, [doc.key]: e.target.value })}
                    />
                    {(formData as any)[doc.key] && (
                      <a href={(formData as any)[doc.key]} target="_blank" rel="noreferrer" className="action-button-modern" style={{ width: '48px', height: '48px' }}>
                        <ExternalLink size={20} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <CheckCircle size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                  <p>Задач по проекту пока нет</p>
                </div>
              ) : (
                tasks.map(t => (
                  <div key={t.id} className="glass-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{t.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Срок: {t.deadline ? new Date(t.deadline).toLocaleDateString() : 'Не задан'}</div>
                    </div>
                    <span className={`status-badge status-${t.status.toLowerCase()}`}>{t.status}</span>
                  </div>
                ))
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px', gap: '16px' }}>
            <button type="button" onClick={onClose} className="secondary">Отмена</button>
            <button type="submit" className="primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 32px' }}>
              <Save size={20} /> СОХРАНИТЬ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectDetailModal;
