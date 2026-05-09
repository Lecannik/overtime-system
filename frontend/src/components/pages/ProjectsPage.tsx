import React, { useEffect, useState } from 'react';
import { getProjects } from '../../services/api';
import LoadingOverlay from '../atoms/LoadingOverlay';
import {
  Briefcase, User, Users, ExternalLink, Settings,
  DollarSign, Clock, LayoutGrid, List as ListIcon,
  Search, ChevronUp, ChevronDown
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import ProjectDetailModal from '../modals/ProjectDetailModal';
import { useColumnSettings } from '../../hooks/useColumnSettings';
import ColumnSettings from '../molecules/ColumnSettings';

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    return (localStorage.getItem('projects_view_mode') as 'cards' | 'table') || 'cards';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const navigate = useNavigate();

  // Список всех возможных колонок
  const PROJECT_COLUMNS = [
    { id: 'name', label: 'Проект' },
    { id: 'manager', label: 'Менеджер' },
    { id: 'gip', label: 'ГИП' },
    { id: 'status', label: 'Статус' },
    { id: 'stage', label: 'Стадия' },
    { id: 'weekly_limit', label: 'Лимит (ч/нед)' },
    { id: 'budget', label: 'Бюджет' },
    { id: 'aup', label: 'АУП (%)' },
    { id: 'margin', label: 'Маржа (%)' },
    { id: 'profit', label: 'Прибыль' },
  ];

  const colSettings = useColumnSettings('projects_cols_v2', PROJECT_COLUMNS);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // Получаем уникальные статусы и стадии для фильтров
  const uniqueStatuses = Array.from(new Set(projects.map(p => p.status))).filter(Boolean);
  const uniqueStages = Array.from(new Set(projects.map(p => p.stage?.name))).filter(Boolean);

  const fetchData = async () => {
    setLoading(true);
    try {
      const projData = await getProjects();
      setProjects(Array.isArray(projData) ? projData : (projData?.items || []));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredProjects = projects.filter(p => {
    const searchString = searchQuery.toLowerCase();

    // Текстовый поиск
    const matchesSearch = (
      (p.name?.toLowerCase() || '').includes(searchString) ||
      (p.manager?.full_name?.toLowerCase() || '').includes(searchString) ||
      (p.gip?.full_name?.toLowerCase() || '').includes(searchString)
    );

    // Фильтр по статусу
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    // Фильтр по стадии
    const matchesStage = stageFilter === 'all' || p.stage?.name === stageFilter;

    return matchesSearch && matchesStatus && matchesStage;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (!sortConfig) return 0;

    let aValue: any;
    let bValue: any;

    if (sortConfig.key === 'manager') {
      aValue = a.manager?.full_name || '';
      bValue = b.manager?.full_name || '';
    } else if (sortConfig.key === 'gip') {
      aValue = a.gip?.full_name || '';
      bValue = b.gip?.full_name || '';
    } else if (sortConfig.key === 'stage') {
      aValue = a.stage?.name || '';
      bValue = b.stage?.name || '';
    } else if (sortConfig.key === 'budget') {
      aValue = a.extra_data?.budget || 0;
      bValue = b.extra_data?.budget || 0;
    } else if (sortConfig.key === 'aup') {
      aValue = a.extra_data?.aup_percent || 0;
      bValue = b.extra_data?.aup_percent || 0;
    } else if (sortConfig.key === 'margin') {
      aValue = a.extra_data?.margin_percent || 0;
      bValue = b.extra_data?.margin_percent || 0;
    } else if (sortConfig.key === 'profit') {
      aValue = a.extra_data?.profit || 0;
      bValue = b.extra_data?.profit || 0;
    } else {
      aValue = (a as any)[sortConfig.key] || '';
      bValue = (b as any)[sortConfig.key] || '';
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading && !projects.length) return <LoadingOverlay />;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Проекты</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Управление производственными проектами и командами.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>СТАТУС:</span>
            <select
              className="modern-input"
              style={{ width: '130px', height: '40px', fontSize: '0.8rem' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">Все</option>
              {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>СТАДИЯ:</span>
            <select
              className="modern-input"
              style={{ width: '160px', height: '40px', fontSize: '0.8rem' }}
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
            >
              <option value="all">Все</option>
              {uniqueStages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Поиск по названию или ГИП..."
              className="modern-input"
              style={{ width: '250px', paddingLeft: '36px', height: '40px' }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              style={{
                width: '40px', height: '40px', borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                background: showColumnSettings ? 'var(--accent)' : 'var(--bg-secondary)',
                color: showColumnSettings ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              title="Настройка колонок"
            >
              <Settings size={20} className={showColumnSettings ? 'rotate-90' : ''} />
            </button>

            {showColumnSettings && (
              <ColumnSettings 
                columns={colSettings.columns}
                visibleColumnIds={colSettings.visibleColumnIds}
                onToggle={colSettings.toggleColumn}
                onReorder={colSettings.reorderColumns}
              />
            )}
          </div>

          <div className="glass-card" style={{ display: 'flex', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => { setViewMode('table'); localStorage.setItem('projects_view_mode', 'table'); }}
              style={{
                padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: viewMode === 'table' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'table' ? 'white' : 'var(--text-primary)',
                display: 'flex', alignItems: 'center'
              }}
              title="Таблица"
            >
              <ListIcon size={18} />
            </button>
            <button
              onClick={() => { setViewMode('cards'); localStorage.setItem('projects_view_mode', 'cards'); }}
              style={{
                padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: viewMode === 'cards' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'cards' ? 'white' : 'var(--text-primary)',
                display: 'flex', alignItems: 'center'
              }}
              title="Карточки"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {sortedProjects.map(project => (
            <div key={project.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <Briefcase size={24} />
                  </div>
                  <div>
                    <Link to={`/projects/${project.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <h3 className="hover-link" style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>{project.name}</h3>
                    </Link>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: project.status === 'ACTIVE' ? '#10b981' : 'var(--text-muted)' }}>
                        {project.status}
                      </span>
                      {project.stage && (
                        <span style={{
                          fontSize: '0.6rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: project.stage.color + '22',
                          color: project.stage.color,
                          border: `1px solid ${project.stage.color}44`
                        }}>
                          {project.stage.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedProject(project); setShowDetailModal(true); }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <Settings size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <User size={14} color="var(--text-muted)" />
                    <span style={{ color: 'var(--text-secondary)' }}>Менеджер:</span>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{project.manager?.full_name || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <Users size={14} color="var(--accent)" />
                    <span style={{ color: 'var(--text-secondary)' }}>ГИП:</span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)' }}>{project.gip?.full_name || 'Не назначен'}</span>
                </div>

                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }}></div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <Clock size={14} color="var(--text-muted)" />
                    <span style={{ color: 'var(--text-secondary)' }}>Лимит:</span>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{project.weekly_limit}ч/нед</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <DollarSign size={14} color="#10b981" />
                    <span style={{ color: 'var(--text-secondary)' }}>Бюджет:</span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#10b981' }}>{project.extra_data?.budget?.toLocaleString() || 0} RUB</span>
                </div>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => navigate('/tasks')}
                  className="btn-secondary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem' }}
                >
                  ЗАДАЧИ <ExternalLink size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                {colSettings.activeColumns.map(col => (
                  <th
                    key={col.id}
                    style={{ padding: '16px', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => handleSort(col.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {col.label} {sortConfig?.key === col.id && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                ))}
                <th style={{ padding: '16px', textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody style={{ color: 'var(--text-primary)' }}>
              {sortedProjects.map(project => (
                <tr key={project.id} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                  {colSettings.activeColumns.map(col => (
                    <td key={col.id} style={{ padding: '16px' }}>
                      {col.id === 'name' && (
                        <>
                          <Link to={`/projects/${project.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div style={{ fontWeight: 700 }} className="hover-link">{project.name}</div>
                          </Link>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {project.id}</div>
                        </>
                      )}
                      {col.id === 'manager' && (
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{project.manager?.full_name || '—'}</div>
                      )}
                      {col.id === 'gip' && (
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)' }}>{project.gip?.full_name || '—'}</div>
                      )}
                      {col.id === 'status' && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: project.status === 'ACTIVE' ? '#10b981' : 'var(--text-muted)' }}>
                          {project.status}
                        </span>
                      )}
                      {col.id === 'stage' && project.stage && (
                        <span style={{
                          fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                          background: project.stage.color + '22', color: project.stage.color,
                          border: `1px solid ${project.stage.color}44`
                        }}>
                          {project.stage.name}
                        </span>
                      )}
                      {col.id === 'weekly_limit' && (
                        <span style={{ fontWeight: 600 }}>{project.weekly_limit}ч</span>
                      )}
                      {col.id === 'budget' && (
                        <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.9rem' }}>
                          {project.extra_data?.budget?.toLocaleString() || 0} RUB
                        </div>
                      )}
                      {col.id === 'aup' && (
                        <span style={{ color: 'var(--text-secondary)' }}>{project.extra_data?.aup_percent?.toFixed(1) || 0}%</span>
                      )}
                      {col.id === 'margin' && (
                        <span style={{ fontWeight: 700, color: (project.extra_data?.margin_percent || 0) > 20 ? '#10b981' : '#f59e0b' }}>
                          {project.extra_data?.margin_percent?.toFixed(1) || 0}%
                        </span>
                      )}
                      {col.id === 'profit' && (
                        <span style={{ fontWeight: 700 }}>{project.extra_data?.profit?.toLocaleString() || 0} RUB</span>
                      )}
                    </td>
                  ))}
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => { setSelectedProject(project); setShowDetailModal(true); }} className="action-button-modern"><Settings size={16} /></button>
                      <button onClick={() => navigate('/tasks')} className="action-button-modern" title="Задачи"><ExternalLink size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProjectDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onSuccess={fetchData}
        project={selectedProject}
      />
    </div>
  );
};

export default ProjectsPage;
