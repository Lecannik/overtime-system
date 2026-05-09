import React, { useState, useEffect } from 'react';
import {
  X, Save, DollarSign, Tag, Briefcase,
  FileText, CheckCircle, Users
} from 'lucide-react';
import { updateDeal, getCRMStages, getUsersList, createProjectFromDeal, getCounterparties, getCRMTasks } from '../../services/api';
import LoadingOverlay from '../atoms/LoadingOverlay';
import type { Deal, Counterparty, Task } from '../../types';

interface DealDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deal: Deal;
}

const DealDetailModal: React.FC<DealDetailModalProps> = ({ isOpen, onClose, onSuccess, deal }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'tasks' | 'docs'>('general');
  const [stages, setStages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    budget: 0,
    currency: 'RUB',
    stage_id: '',
    assigned_id: '',
    counterparty_id: '',
    contract_url: '',
    client_export_url: ''
  });

  useEffect(() => {
    if (isOpen && deal) {
      setFormData({
        title: deal.title || '',
        description: deal.description || '',
        budget: deal.budget || 0,
        currency: deal.currency || 'RUB',
        stage_id: deal.stage_id?.toString() || '',
        assigned_id: deal.assigned_id?.toString() || '',
        counterparty_id: deal.counterparty_id?.toString() || '',
        contract_url: deal.contract_url || '',
        client_export_url: deal.client_export_url || ''
      });
      fetchMetadata();
    }
  }, [isOpen, deal]);

  const fetchMetadata = async () => {
    try {
      const [stagesData, usersData, cpData, tasksData] = await Promise.all([
        getCRMStages('DEAL'),
        getUsersList(),
        getCounterparties(),
        getCRMTasks({ deal_id: deal.id })
      ]);
      setStages(stagesData);
      setUsers(usersData.items || usersData || []);
      setCounterparties(cpData);
      setTasks(tasksData);
    } catch (err) {
      console.error('Ошибка загрузки метаданных', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateDeal(deal.id, {
        ...formData,
        stage_id: formData.stage_id ? Number(formData.stage_id) : null,
        assigned_id: formData.assigned_id ? Number(formData.assigned_id) : null,
        counterparty_id: formData.counterparty_id ? Number(formData.counterparty_id) : null,
        budget: Number(formData.budget)
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert('Ошибка при сохранении сделки');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (window.confirm('Создать проект на основе этой сделки?')) {
      setLoading(true);
      try {
        await createProjectFromDeal(deal.id);
        alert('Проект успешно создан!');
        onSuccess();
        onClose();
      } catch (err) {
        alert('Ошибка при создании проекта');
      } finally {
        setLoading(false);
      }
    }
  };

  if (!isOpen || !deal) return null;

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      style={{
        padding: '10px 16px',
        border: 'none',
        background: activeTab === id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        color: activeTab === id ? 'var(--accent)' : 'var(--text-muted)',
        borderRadius: '10px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.9rem',
        fontWeight: activeTab === id ? 600 : 400
      }}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 3000 }}>
      <div className="modal-content glass-card animate-scale-in"
        style={{ maxWidth: '750px', padding: 0, overflow: 'hidden', borderRadius: '24px' }}
        onClick={e => e.stopPropagation()}>

        {loading && <LoadingOverlay />}

        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Tag size={22} />
            </div>
            <div>
              <h3 style={{ fontWeight: 800, fontSize: '1.3rem', margin: 0 }}>Сделка: {formData.title}</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {deal.id} • {deal.stage?.name || 'Без стадии'}</p>
            </div>
          </div>
          <button onClick={onClose} className="action-button-modern" style={{ width: '40px', height: '40px' }}><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '8px 32px', display: 'flex', gap: '8px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          <TabButton id="general" label="Информация" icon={Briefcase} />
          <TabButton id="tasks" label="Задачи" icon={CheckCircle} />
          <TabButton id="docs" label="Документы и Ссылки" icon={FileText} />
        </div>

        <form onSubmit={handleSave} style={{ padding: '32px' }}>

          {activeTab === 'general' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Название сделки</label>
                <input className="modern-input" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>Бюджет / Сумма</label>
                <div style={{ position: 'relative' }}>
                  <DollarSign size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="number" className="modern-input" style={{ paddingLeft: '36px' }} value={formData.budget} onChange={e => setFormData({ ...formData, budget: Number(e.target.value) })} />
                </div>
              </div>

              <div className="form-group">
                <label>Валюта</label>
                <select className="modern-input" value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })}>
                  <option value="RUB">RUB</option>
                  <option value="KZT">KZT</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div className="form-group">
                <label>Стадия сделки</label>
                <select className="modern-input" value={formData.stage_id} onChange={e => setFormData({ ...formData, stage_id: e.target.value })}>
                  <option value="">Не выбрана</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Контрагент (Клиент)</label>
                <div style={{ position: 'relative' }}>
                  <Users size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <select className="modern-input" style={{ paddingLeft: '36px' }} value={formData.counterparty_id} onChange={e => setFormData({ ...formData, counterparty_id: e.target.value })}>
                    <option value="">Не выбран</option>
                    {counterparties.map(cp => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Ответственный менеджер</label>
                <select className="modern-input" value={formData.assigned_id} onChange={e => setFormData({ ...formData, assigned_id: e.target.value })}>
                  <option value="">Не назначен</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Описание</label>
                <textarea className="modern-input" style={{ minHeight: '80px' }} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tasks.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Задач по сделке пока нет</p>
              ) : (
                tasks.map(t => (
                  <div key={t.id} className="glass-card" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t.title}</span>
                    <span className={`status-badge status-${t.status.toLowerCase()}`}>{t.status}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'docs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label>Ссылка на хранение договора</label>
                <input className="modern-input" value={formData.contract_url} onChange={e => setFormData({ ...formData, contract_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label>Выгрузка клиенту</label>
                <input className="modern-input" value={formData.client_export_url} onChange={e => setFormData({ ...formData, client_export_url: e.target.value })} placeholder="https://..." />
              </div>

              {deal.project_id && (
                <div className="glass-card" style={{ padding: '20px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid #10b981' }}>
                  <p style={{ margin: 0, fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Briefcase size={18} /> ПРОЕКТ ПО СДЕЛКЕ УЖЕ СОЗДАН
                  </p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '12px' }}>Вы можете перейти к управлению технической частью проекта.</p>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', gap: '16px' }}>
            {!deal.project_id && (
              <button type="button" onClick={handleCreateProject} className="btn-secondary" style={{ color: '#10b981' }}>
                <Briefcase size={18} style={{ marginRight: '8px' }} /> ПЕРЕВЕСТИ В ПРОЕКТ
              </button>
            )}
            <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
              <button type="button" onClick={onClose} className="secondary">Отмена</button>
              <button type="submit" className="primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={20} /> СОХРАНИТЬ
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DealDetailModal;
