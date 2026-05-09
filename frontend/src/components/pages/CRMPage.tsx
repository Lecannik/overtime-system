import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getLeads, getDeals, convertLeadToDeal
} from '../../services/api';
import LoadingOverlay from '../atoms/LoadingOverlay';
import {
  Plus, ArrowRight, Eye, LayoutGrid, List as ListIcon,
  Edit3, Building2, Link as LinkIcon, ChevronRight, Settings,
  User, DollarSign, Mail, Phone
} from 'lucide-react';
import { useColumnSettings } from '../../hooks/useColumnSettings';
import ColumnSettings from '../molecules/ColumnSettings';

const CRMPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'leads' | 'deals'>(() => {
    return (localStorage.getItem('crm_active_tab') as 'leads' | 'deals') || 'leads';
  });
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    return (localStorage.getItem('crm_view_mode') as 'table' | 'cards') || 'table';
  });
  const [leads, setLeads] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Конфигурация колонок для Лидов
  const LEAD_COLUMNS = [
    { id: 'title', label: 'Название' },
    { id: 'counterparty', label: 'Контрагент' },
    { id: 'contact', label: 'Контакт' },
    { id: 'stage', label: 'Стадия' },
    { id: 'assigned', label: 'Ответственный' },
    { id: 'created_at', label: 'Создан' },
  ];

  // Конфигурация колонок для Сделок
  const DEAL_COLUMNS = [
    { id: 'title', label: 'Название' },
    { id: 'counterparty', label: 'Контрагент' },
    { id: 'budget', label: 'Сумма' },
    { id: 'stage', label: 'Стадия' },
    { id: 'assigned', label: 'Ответственный' },
    { id: 'project', label: 'Проект' },
  ];

  const leadColSettings = useColumnSettings('crm_leads_cols', LEAD_COLUMNS);
  const dealColSettings = useColumnSettings('crm_deals_cols', DEAL_COLUMNS);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [leadsData, dealsData] = await Promise.all([
        getLeads(), getDeals()
      ]);
      setLeads(Array.isArray(leadsData) ? leadsData : (leadsData?.items || []));
      setDeals(Array.isArray(dealsData) ? dealsData : (dealsData?.items || []));
    } catch (err) {
      console.error('Ошибка загрузки CRM:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertLead = async (id: number) => {
    if (window.confirm('Конвертировать лид в сделку?')) {
      try {
        await convertLeadToDeal(id);
        fetchData();
        setActiveTab('deals');
      } catch { alert('Ошибка при конвертации'); }
    }
  };

  const handleCreateNew = () => {
    if (activeTab === 'leads') {
      navigate('/leads/new');
    } else {
      navigate('/deals/new');
    }
  };

  if (loading && !leads.length && !deals.length) return <LoadingOverlay />;
  
  const currentItems = activeTab === 'leads' ? leads : deals;
  const currentSettings = activeTab === 'leads' ? leadColSettings : dealColSettings;

  const getLeadTitle = (leadId: number | null) => {
    if (!leadId) return null;
    const l = leads.find(x => x.id === leadId);
    return l ? l.title : `Лид #${leadId}`;
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>CRM Платформа</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Управление лидами, сделками и связями с контрагентами.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              style={{
                width: '40px', height: '40px', borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                background: showColumnSettings ? 'var(--accent)' : 'var(--bg-secondary)',
                color: showColumnSettings ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border)',
                transition: 'all 0.3s'
              }}
              title="Настройка колонок"
            >
              <Settings size={20} className={showColumnSettings ? 'rotate-90' : ''} />
            </button>

            {showColumnSettings && (
              <ColumnSettings 
                columns={currentSettings.columns}
                visibleColumnIds={currentSettings.visibleColumnIds}
                onToggle={currentSettings.toggleColumn}
                onReorder={currentSettings.reorderColumns}
              />
            )}
          </div>

          <div className="glass-card" style={{ display: 'flex', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => { setViewMode('table'); localStorage.setItem('crm_view_mode', 'table'); }}
              style={{ padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: viewMode === 'table' ? 'var(--accent)' : 'transparent', color: viewMode === 'table' ? 'white' : 'var(--text-primary)', display: 'flex', alignItems: 'center' }}
              title="Таблица"
            ><ListIcon size={18} /></button>
            <button
              onClick={() => { setViewMode('cards'); localStorage.setItem('crm_view_mode', 'cards'); }}
              style={{ padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: viewMode === 'cards' ? 'var(--accent)' : 'transparent', color: viewMode === 'cards' ? 'white' : 'var(--text-primary)', display: 'flex', alignItems: 'center' }}
              title="Карточки"
            ><LayoutGrid size={18} /></button>
          </div>
          <button onClick={handleCreateNew} className="primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
            <Plus size={18} /> Добавить {activeTab === 'leads' ? 'лид' : 'сделку'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '12px', width: 'fit-content', marginBottom: '32px' }}>
        <button
          onClick={() => { setActiveTab('leads'); localStorage.setItem('crm_active_tab', 'leads'); setShowColumnSettings(false); }}
          style={{ padding: '8px 24px', borderRadius: '10px', background: activeTab === 'leads' ? 'var(--bg-secondary)' : 'transparent', color: activeTab === 'leads' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeTab === 'leads' ? 700 : 500, border: 'none', cursor: 'pointer' }}
        >Лиды ({leads.length})</button>
        <button
          onClick={() => { setActiveTab('deals'); localStorage.setItem('crm_active_tab', 'deals'); setShowColumnSettings(false); }}
          style={{ padding: '8px 24px', borderRadius: '10px', background: activeTab === 'deals' ? 'var(--bg-secondary)' : 'transparent', color: activeTab === 'deals' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeTab === 'deals' ? 700 : 500, border: 'none', cursor: 'pointer' }}
        >Сделки ({deals.length})</button>
      </div>

      {/* ========= TABLE VIEW ========= */}
      {viewMode === 'table' ? (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                {currentSettings.activeColumns.map(col => (
                  <th key={col.id} style={{ padding: '16px', textAlign: 'left' }}>{col.label}</th>
                ))}
                <th style={{ padding: '16px', textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody style={{ color: 'var(--text-primary)' }}>
              {currentItems.map(item => (
                <tr
                  key={item.id}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => {
                    navigate(`/${activeTab === 'leads' ? 'leads' : 'deals'}/${item.id}`);
                  }}
                  className="table-row-hover"
                >
                  {currentSettings.activeColumns.map(col => (
                    <td key={col.id} style={{ padding: '16px' }}>
                      {col.id === 'title' && (
                        <>
                          <div style={{ fontWeight: 700 }}>{item.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {item.id}</div>
                        </>
                      )}
                      {col.id === 'counterparty' && (
                        item.counterparty ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Building2 size={14} color="var(--accent)" />
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.counterparty.name}</span>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                      {col.id === 'contact' && (
                        <div style={{ fontSize: '0.85rem' }}>
                          <div style={{ fontWeight: 600 }}>{item.contact_name || '—'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.contact_email}</div>
                        </div>
                      )}
                      {col.id === 'budget' && (
                        <div style={{ fontWeight: 800, color: 'var(--accent)' }}>
                          {(item.budget || 0).toLocaleString()} {item.currency}
                        </div>
                      )}
                      {col.id === 'stage' && (
                        item.stage ? (
                          <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, background: item.stage.color + '22', color: item.stage.color, border: `1px solid ${item.stage.color}44` }}>
                            {item.stage.name}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>{item.status}</span>
                      )}
                      {col.id === 'assigned' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={12} />
                          </div>
                          <span>{item.assigned?.full_name || 'Не назначен'}</span>
                        </div>
                      )}
                      {col.id === 'project' && (
                        item.project_id ? (
                          <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>Проект #{item.project_id}</div>
                        ) : '—'
                      )}
                      {col.id === 'created_at' && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                  ))}
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/${activeTab === 'leads' ? 'leads' : 'deals'}/${item.id}`); }}
                        className="action-button-modern"
                      ><Edit3 size={16} /></button>
                      {activeTab === 'leads' && item.status !== 'CONVERTED' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConvertLead(item.id); }}
                          title="Конвертировать в сделку"
                          className="action-button-modern"
                          style={{ color: '#10b981' }}
                        ><ArrowRight size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ========= CARDS VIEW ========= */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {currentItems.map(item => (
            <div key={item.id} className="glass-card" style={{ padding: '24px', cursor: 'pointer', position: 'relative' }}
              onClick={() => {
                navigate(`/${activeTab === 'leads' ? 'leads' : 'deals'}/${item.id}`);
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                {item.stage ? (
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '4px 10px', borderRadius: '8px', background: item.stage.color + '22', color: item.stage.color }}>{item.stage.name}</span>
                ) : (
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '4px 10px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{item.status}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/${activeTab === 'leads' ? 'leads' : 'deals'}/${item.id}`); }}
                  title="Редактировать"
                  className="action-button-modern"
                ><Edit3 size={14} /></button>
              </div>

              <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '8px' }}>{item.title}</h3>

              {item.counterparty && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: 'var(--accent)', fontSize: '0.8rem' }}>
                  <Building2 size={14} />
                  <span style={{ fontWeight: 600 }}>{item.counterparty.name}</span>
                </div>
              )}

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', minHeight: '32px' }}>
                {item.description?.substring(0, 100)}{item.description?.length > 100 ? '...' : ''}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '12px' }}>
                {activeTab === 'leads' ? (
                  <div style={{ fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={12} color="var(--text-muted)" />
                      {item.contact_name || 'Нет контакта'}
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginLeft: '18px' }}>{item.contact_email}</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>БЮДЖЕТ</div>
                    <div style={{ fontWeight: 800, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <DollarSign size={14} />
                      {(item.budget || 0).toLocaleString()} {item.currency}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/${activeTab === 'leads' ? 'leads' : 'deals'}/${item.id}`); }} className="action-button-modern"><Eye size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CRMPage;
