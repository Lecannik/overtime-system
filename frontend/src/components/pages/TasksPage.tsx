import React, { useState, useEffect } from 'react';
import { getProjects, getTasksByProject, getTasks, updateTask, getAssignableUsers, getTaskTypes, getTaskStatuses, type TaskType, type TaskStatus } from '../../services/api';
import LoadingOverlay from '../atoms/LoadingOverlay';
import {
  Plus, AlertCircle, LayoutGrid, List as ListIcon,
  Clock, Eye, User, Briefcase, Building2, Search, Settings
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import CreateTaskModal from '../modals/CreateTaskModal';
import TaskDetailModal from '../modals/TaskDetailModal';
import { useColumnSettings } from '../../hooks/useColumnSettings';
import ColumnSettings from '../molecules/ColumnSettings';

const TasksPage: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | 'all'>('all');
  const [selectedUserId, setSelectedUserId] = useState<number | 'all'>('all');
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>(() => {
    return (localStorage.getItem('tasks_view_mode') as 'kanban' | 'table') || 'kanban';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<number | 'all'>('all');

  // Настройка колонок для таблицы
  const TASK_COLUMNS = [
    { id: 'title', label: 'Задача' },
    { id: 'project', label: 'Проект / Сущность' },
    { id: 'assigned', label: 'Ответственный' },
    { id: 'status', label: 'Статус' },
    { id: 'priority', label: 'Приоритет' },
    { id: 'type', label: 'Тип' },
    { id: 'deadline', label: 'Дедлайн' },
  ];

  const colSettings = useColumnSettings('tasks_table_cols', TASK_COLUMNS);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const kanbanColumns = React.useMemo(() => {
    if (!Array.isArray(taskStatuses)) return [];
    return [...taskStatuses]
      .filter(s => s && typeof s.sort_order === 'number')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(s => ({
        id: s.id.toString(),
        title: s.name,
        color: s.color
      }));
  }, [taskStatuses]);

  useEffect(() => {
    const initData = async () => {
      try {
        const [projectsData, usersData, typesData, statusesData] = await Promise.all([
          getProjects(),
          getAssignableUsers(),
          getTaskTypes(),
          getTaskStatuses()
        ]);
        setProjects(Array.isArray(projectsData) ? projectsData : (projectsData?.items || []));
        setUsers(Array.isArray(usersData) ? usersData : (usersData?.items || []));
        setTaskTypes(typesData);
        setTaskStatuses(statusesData);
      } catch (err) {
        console.error('Error initializing data', err);
      } finally {
        setLoading(false);
      }
    };
    initData();

    const interval = setInterval(() => {
      if (!loading) {
        fetchTasks(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [selectedProjectId, selectedUserId]);

  const fetchTasks = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      let data;
      if (selectedProjectId === 'all') {
        data = await getTasks();
      } else {
        data = await getTasksByProject(selectedProjectId);
      }

      let filtered = Array.isArray(data) ? data : (data?.items || []);

      if (selectedUserId !== 'all') {
        filtered = filtered.filter((t: any) => t.assigned_id === selectedUserId);
      }

      if (selectedTypeId !== 'all') {
        filtered = filtered.filter((t: any) => t.task_type?.id === selectedTypeId);
      }

      setTasks(filtered);
    } catch (err) {
      console.error('Error fetching tasks', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const taskId = Number(draggableId);
    const newStatusId = Number(destination.droppableId);

    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, status_id: newStatusId } : t);
    setTasks(updatedTasks);

    try {
      await updateTask(taskId, { status_id: newStatusId });
      fetchTasks(false);
    } catch (err) {
      alert('Ошибка при сохранении статуса');
      fetchTasks(true);
    }
  };

  const filteredTasks = tasks.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return '#ef4444';
      case 'HIGH': return '#f97316';
      case 'MEDIUM': return '#3b82f6';
      default: return '#64748b';
    }
  };

  if (loading && tasks.length === 0) return <LoadingOverlay />;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
      {/* Header & Controls */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Управление задачами</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {selectedProjectId === 'all' ? 'Все задачи системы' : `Задачи проекта: ${projects.find(p => p.id === selectedProjectId)?.name}`}
            </p>
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
                  columns={colSettings.columns}
                  visibleColumnIds={colSettings.visibleColumnIds}
                  onToggle={colSettings.toggleColumn}
                  onReorder={colSettings.reorderColumns}
                />
              )}
            </div>

            <div className="glass-card" style={{ display: 'flex', padding: '4px', borderRadius: '12px' }}>
              <button
                onClick={() => { setViewMode('table'); localStorage.setItem('tasks_view_mode', 'table'); }}
                className={`icon-button-small ${viewMode === 'table' ? 'active' : ''}`}
                title="Таблица"
                style={{ background: viewMode === 'table' ? 'var(--accent)' : 'transparent', color: viewMode === 'table' ? 'white' : 'inherit' }}
              >
                <ListIcon size={18} />
              </button>
              <button
                onClick={() => { setViewMode('kanban'); localStorage.setItem('tasks_view_mode', 'kanban'); }}
                className={`icon-button-small ${viewMode === 'kanban' ? 'active' : ''}`}
                title="Канбан"
                style={{ background: viewMode === 'kanban' ? 'var(--accent)' : 'transparent', color: viewMode === 'kanban' ? 'white' : 'inherit' }}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}
            >
              <Plus size={18} /> Создать задачу
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card" style={{ padding: '16px 24px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', borderRadius: '16px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Поиск по задачам..."
              className="modern-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', width: '100%', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Briefcase size={16} color="var(--text-muted)" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="modern-input"
              style={{ width: '200px', padding: '8px 12px', fontSize: '0.85rem' }}
            >
              <option value="all">Все проекты</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={16} color="var(--text-muted)" />
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="modern-input"
              style={{ width: '180px', padding: '8px 12px', fontSize: '0.85rem' }}
            >
              <option value="all">Все ответственные</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={16} color="var(--text-muted)" />
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="modern-input"
              style={{ width: '180px', padding: '8px 12px', fontSize: '0.85rem' }}
            >
              <option value="all">Все типы</option>
              {taskTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${kanbanColumns.length}, minmax(300px, 1fr))`,
            gap: '24px',
            minHeight: '600px',
            overflowX: 'auto',
            paddingBottom: '20px'
          }}>
            {kanbanColumns.map(col => (
              <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color, boxShadow: `0 0 10px ${col.color}44` }}></div>
                  <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
                    {col.title}
                  </h3>
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '10px' }}>
                    {filteredTasks.filter(t => t.status_id?.toString() === col.id).length}
                  </span>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      style={{
                        flex: 1,
                        background: snapshot.isDraggingOver ? 'var(--bg-tertiary)' : 'rgba(255,255,255,0.02)',
                        borderRadius: '24px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        minHeight: '500px',
                        border: '1px solid var(--border)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {filteredTasks.filter(t => t.status_id?.toString() === col.id).map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                          {(provided, snapshot) => (
                            <div
                               ref={provided.innerRef}
                               {...provided.draggableProps}
                               {...provided.dragHandleProps}
                               onClick={(e) => {
                                 if (!snapshot.isDragging) {
                                   setSelectedTaskId(task.id);
                                 }
                               }}
                               className="glass-card clickable"
                               style={{
                                 ...provided.draggableProps.style,
                                 padding: '16px',
                                 borderRadius: '18px',
                                 background: snapshot.isDragging ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                                 border: snapshot.isDragging ? '2px solid var(--accent)' : '1px solid var(--border)',
                                 boxShadow: snapshot.isDragging ? '0 12px 32px rgba(0,0,0,0.3)' : 'var(--card-shadow)',
                                 transform: snapshot.isDragging ? 'scale(1.02)' : 'none'
                               }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <span style={{
                                    fontSize: '0.6rem',
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: task.task_type?.color ? task.task_type.color + '22' : 'var(--bg-tertiary)',
                                    color: task.task_type?.color || 'var(--accent)'
                                  }}>
                                    {task.task_type?.name || task.type || 'Другое'}
                                  </span>
                                  {task.lead_id && <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: '#e0f2fe', color: '#0ea5e9' }}>L: {task.lead?.title || 'Лид'}</span>}
                                  {task.deal_id && <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: '#fef3c7', color: '#d97706' }}>D: {task.deal?.title || 'Сделка'}</span>}
                                  {task.project_id && <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#059669' }}>P: {task.project?.name || 'Проект'}</span>}
                                </div>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getPriorityColor(task.priority) }}></div>
                              </div>

                              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px', lineHeight: 1.4 }}>{task.title}</h4>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <User size={12} color="var(--text-muted)" />
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {task.assigned?.full_name || 'Не назначен'}
                                </span>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                                  <Clock size={12} />
                                  <span style={{ fontSize: '0.7rem' }}>{task.deadline ? new Date(task.deadline).toLocaleDateString() : '—'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <Eye size={14} />
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      ) : (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden', borderRadius: '20px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {colSettings.activeColumns.map(col => (
                    <th key={col.id} style={{ padding: '20px', textAlign: 'left' }}>{col.label}</th>
                  ))}
                  <th style={{ padding: '20px', textAlign: 'right' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => (
                  <tr key={task.id} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover clickable" onClick={() => setSelectedTaskId(task.id)}>
                    {colSettings.activeColumns.map(col => (
                      <td key={col.id} style={{ padding: '20px' }}>
                        {col.id === 'title' && (
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{task.title}</div>
                        )}
                        {col.id === 'project' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: task.lead_id ? '#e0f2fe' : task.deal_id ? '#fef3c7' : 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {task.lead_id ? <User size={14} color="#0ea5e9" /> : task.deal_id ? <Building2 size={14} color="#d97706" /> : <Briefcase size={14} color="var(--accent)" />}
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{task.project?.name || (task.lead_id ? 'Лид' : task.deal_id ? 'Сделка' : 'Личное')}</span>
                          </div>
                        )}
                        {col.id === 'assigned' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <User size={14} color="var(--text-muted)" />
                            </div>
                            <span style={{ fontSize: '0.85rem' }}>{task.assigned?.full_name || 'Не назначен'}</span>
                          </div>
                        )}
                        {col.id === 'status' && (
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '4px 12px', borderRadius: '8px', background: (task.task_status?.color || '#94a3b8') + '22', color: task.task_status?.color || '#94a3b8' }}>
                            {task.task_status?.name || task.status}
                          </span>
                        )}
                        {col.id === 'priority' && (
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: getPriorityColor(task.priority) }}>{task.priority}</span>
                        )}
                        {col.id === 'type' && (
                          <span style={{ fontSize: '0.7rem', color: task.task_type?.color }}>{task.task_type?.name || '—'}</span>
                        )}
                        {col.id === 'deadline' && (
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            {task.deadline ? new Date(task.deadline).toLocaleDateString() : '—'}
                          </div>
                        )}
                      </td>
                    ))}
                    <td style={{ padding: '20px', textAlign: 'right' }}>
                      <button className="action-button-modern"><Eye size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateTaskModal
          projectId={selectedProjectId === 'all' ? undefined : selectedProjectId}
          parentName={selectedProjectId === 'all' ? 'Все проекты' : projects.find(p => p.id === selectedProjectId)?.name || ''}
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchTasks}
        />
      )}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => fetchTasks(false)}
        />
      )}
    </div>
  );
};

export default TasksPage;
