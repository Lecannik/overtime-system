import React, { useEffect, useState } from 'react';
import { getCRMStages, createCRMStage, updateCRMStage, deleteCRMStage } from '../../services/api';
import LoadingOverlay from '../atoms/LoadingOverlay';
import { Plus, Edit2, Trash2 } from 'lucide-react';

const CRMSettingsPage: React.FC = () => {
  const [activeModule, setActiveModule] = useState<'LEAD' | 'DEAL' | 'PROJECT'>('LEAD');
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedStage, setSelectedStage] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', color: '#3b82f6', sort_order: 0 });

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getCRMStages(activeModule);
      setStages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeModule]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...formData, module: activeModule };
      if (selectedStage) {
        await updateCRMStage(selectedStage.id, data);
      } else {
        await createCRMStage(data);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert('Ошибка при сохранении');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Удалить стадию? Это может повлиять на существующие записи.')) {
      await deleteCRMStage(id);
      fetchData();
    }
  };

  if (loading && !stages.length) return <LoadingOverlay />;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Настройка CRM</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Управление стадиями воронки продаж.</p>
        </div>
        <button className="primary" onClick={() => {
          setSelectedStage(null);
          setFormData({ name: '', color: '#3b82f6', sort_order: stages.length });
          setShowModal(true);
        }}>
          <Plus size={18} /> ДОБАВИТЬ СТАДИЮ
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '12px', width: 'fit-content', marginBottom: '32px' }}>
        <button
          onClick={() => setActiveModule('LEAD')}
          style={{
            padding: '8px 24px',
            borderRadius: '10px',
            background: activeModule === 'LEAD' ? 'var(--bg-secondary)' : 'transparent',
            color: activeModule === 'LEAD' ? 'var(--accent)' : 'var(--text-secondary)',
            fontWeight: activeModule === 'LEAD' ? 700 : 500,
            border: 'none', cursor: 'pointer'
          }}
        >
          ЛИДЫ
        </button>
        <button
          onClick={() => setActiveModule('DEAL')}
          style={{
            padding: '8px 24px',
            borderRadius: '10px',
            background: activeModule === 'DEAL' ? 'var(--bg-secondary)' : 'transparent',
            color: activeModule === 'DEAL' ? 'var(--accent)' : 'var(--text-secondary)',
            fontWeight: activeModule === 'DEAL' ? 700 : 500,
            border: 'none', cursor: 'pointer'
          }}
        >
          СДЕЛКИ
        </button>
        <button
          onClick={() => setActiveModule('PROJECT')}
          style={{
            padding: '8px 24px',
            borderRadius: '10px',
            background: activeModule === 'PROJECT' ? 'var(--bg-secondary)' : 'transparent',
            color: activeModule === 'PROJECT' ? 'var(--accent)' : 'var(--text-secondary)',
            fontWeight: activeModule === 'PROJECT' ? 700 : 500,
            border: 'none', cursor: 'pointer'
          }}
        >
          ПРОЕКТЫ
        </button>
      </div>

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '16px', textAlign: 'left', width: '50px' }}>#</th>
              <th style={{ padding: '16px', textAlign: 'left' }}>Название стадии</th>
              <th style={{ padding: '16px', textAlign: 'left' }}>Цвет</th>
              <th style={{ padding: '16px', textAlign: 'right' }}>Действия</th>
            </tr>
          </thead>
          <tbody style={{ color: 'var(--text-primary)' }}>
            {stages.map((stage) => (
              <tr key={stage.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{stage.sort_order}</td>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: stage.color }}></div>
                    <span style={{ fontWeight: 700 }}>{stage.name}</span>
                  </div>
                </td>
                <td style={{ padding: '16px', fontFamily: 'monospace', fontSize: '0.85rem' }}>{stage.color}</td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setSelectedStage(stage);
                        setFormData({ name: stage.name, color: stage.color, sort_order: stage.sort_order });
                        setShowModal(true);
                      }}
                      style={{ color: 'var(--text-primary)', background: 'var(--bg-tertiary)', padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(stage.id)}
                      style={{ color: '#ef4444', background: 'var(--bg-tertiary)', padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="glass-card" style={{ width: '400px', padding: '32px', borderRadius: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '24px' }}>
              {selectedStage ? 'Редактировать стадию' : 'Новая стадия'}
            </h2>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '16px' }}>
                <label className="label">Название стадии</label>
                <input
                  className="modern-input"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Например: Переговоры"
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="label">Цвет (HEX)</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="color"
                    style={{ width: '50px', height: '42px', padding: '2px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                  />
                  <input
                    className="modern-input"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label className="label">Порядок сортировки</label>
                <input
                  className="modern-input"
                  type="number"
                  required
                  value={formData.sort_order}
                  onChange={e => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ flex: 1 }}>Отмена</button>
                <button type="submit" className="primary" style={{ flex: 1 }}>Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMSettingsPage;
