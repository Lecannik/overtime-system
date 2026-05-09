import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    getProject, getBPMLogs, updateTask
} from '../../services/api';
import {
    Clock, CheckCircle, AlertCircle,
    User, TrendingUp,
    FileText, Zap, ChevronLeft, Edit3,
    Plus, History, Activity, Calendar, Settings
} from 'lucide-react';
import Skeleton from '../common/Skeleton';

import CreateTaskModal from '../modals/CreateTaskModal';

/**
 * Страница детальной информации о проекте.
 * Содержит финансовую аналитику, список задач, историю переработок и логи BPM.
 */
const ProjectDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<any>(null);
    const [bpmLogs, setBpmLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'gantt' | 'overtimes' | 'bpm'>('overview');
    const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [projData, logs] = await Promise.all([
                getProject(Number(id)),
                getBPMLogs({ entity_type: 'project', entity_id: Number(id), limit: 20 })
            ]);
            setProject(projData);
            setBpmLogs(logs);
        } catch (err) {
            console.error('Ошибка загрузки данных проекта:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleGanttClick = async (e: React.MouseEvent, taskId: number) => {
        // Проверка прав (упрощенно)
        const clickX = e.nativeEvent.offsetX;
        const width = (e.currentTarget as HTMLElement).offsetWidth;
        const percent = (clickX / width) * 100;

        const totalDays = 90;
        const daysToAdd = Math.floor((percent / 100) * totalDays);

        const newDeadline = new Date(project.created_at);
        newDeadline.setDate(newDeadline.getDate() + daysToAdd);

        try {
            await updateTask(taskId, { deadline: newDeadline.toISOString() });
            fetchData(); // Рефреш
        } catch (err) {
            alert('Ошибка при обновлении срока');
        }
    };

    if (loading) return <div style={{ padding: '40px' }}><Skeleton height={600} /></div>;
    if (!project) return <div className="text-center py-20">Проект не найден</div>;

    const renderGantt = () => {
        const tasks = project.tasks || [];
        const projectStart = new Date(project.created_at);
        const minDate = tasks.length > 0 ? new Date(Math.min(...tasks.map((t: any) => new Date(t.start_date || project.created_at).getTime()))) : projectStart;
        const maxDate = tasks.length > 0 ? new Date(Math.max(...tasks.map((t: any) => new Date(t.deadline || Date.now()).getTime()))) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        maxDate.setDate(maxDate.getDate() + 7);
        const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

        const handleGanttClick = async (e: React.MouseEvent, taskId: number) => {
            const clickX = e.nativeEvent.offsetX;
            const width = (e.currentTarget as HTMLElement).offsetWidth;
            const percent = (clickX / width) * 100;
            const daysToAdd = Math.floor((percent / 100) * totalDays);
            const newDeadline = new Date(minDate);
            newDeadline.setDate(newDeadline.getDate() + daysToAdd);
            try {
                await updateTask(taskId, { deadline: newDeadline.toISOString() });
                fetchData();
            } catch (err) {
                alert('Ошибка при обновлении срока');
            }
        };

        return (
            <div className="glass-card" style={{ padding: '24px', overflowX: 'auto' }}>
                <h4 style={{ fontWeight: 800, marginBottom: '24px' }}>График реализации (Гант)</h4>
                <div style={{ minWidth: '800px', position: 'relative', padding: '20px 0' }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
                        <div style={{ width: '200px', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)' }}>ЗАДАЧА / ПЕРИОД</div>
                        <div style={{ flex: 1, display: 'flex' }}>
                            {[...Array(10)].map((_, i) => {
                                const d = new Date(minDate);
                                d.setDate(d.getDate() + (i * totalDays / 10));
                                return (
                                    <div key={i} style={{ flex: 1, textAlign: 'left', paddingLeft: '4px', fontSize: '0.65rem', color: 'var(--text-muted)', borderLeft: '1px solid var(--border)' }}>
                                        {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {tasks.map((task: any) => {
                            const start = task.start_date ? new Date(task.start_date) : projectStart;
                            const end = task.deadline ? new Date(task.deadline) : new Date();
                            const offsetDays = Math.max(0, (start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
                            const durationDays = Math.max(0.5, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                            const leftPercent = (offsetDays / totalDays) * 100;
                            const widthPercent = (durationDays / totalDays) * 100;

                            return (
                                <div key={task.id} style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={{ width: '200px', fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingRight: '12px' }}>
                                        {task.title}
                                    </div>
                                    <div
                                        onClick={(e) => handleGanttClick(e, task.id)}
                                        className="hover-subtle"
                                        style={{ flex: 1, height: '32px', position: 'relative', background: 'var(--bg-tertiary)', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: `${Math.min(99, leftPercent)}%`,
                                                width: `${Math.max(1, Math.min(100 - leftPercent, widthPercent))}%`,
                                                height: '100%',
                                                background: task.status === 'DONE' ? '#10b981' : (task.status === 'IN_PROGRESS' ? 'var(--primary)' : 'var(--border)'),
                                                borderRadius: '4px',
                                                opacity: 0.8,
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '0 8px',
                                                color: 'white',
                                                fontSize: '0.6rem',
                                                fontWeight: 800,
                                                pointerEvents: 'none',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden'
                                            }}
                                            title={`${task.title}: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`}
                                        >
                                            {task.status === 'DONE' ? 'DONE' : (widthPercent > 10 ? task.status : '')}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const margin = project.turnover ? (project.net_profit / project.turnover * 100) : 0;

    return (
        <div className="animate-fade-in">
            {/* Header / Breadcrumbs */}
            <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Link to="/projects" className="icon-button" style={{ background: 'var(--bg-secondary)' }}>
                        <ChevronLeft size={20} />
                    </Link>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{project.name}</h2>
                            <span className={`status-badge ${project.status?.toLowerCase()}`}>
                                {project.status}
                            </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
                            ID: #{project.id} • ГИП: {project.gip?.full_name || 'Не назначен'}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {project.deal_id && (
                        <Link
                            to={`/deals/${project.deal_id}`}
                            className="btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
                            title="Перейти к сделке CRM"
                        >
                            <Zap size={18} /> К СДЕЛКЕ
                        </Link>
                    )}
                    <button
                        onClick={() => navigate(`/projects/${id}/edit`)}
                        className="primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Settings size={18} /> РЕДАКТИРОВАТЬ
                    </button>
                </div>
            </div>

            {/* Top Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <div className="glass-card" style={{ padding: '20px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Оборот</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
                            {project.turnover?.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₸
                        </h3>
                    </div>
                    <div style={{ marginTop: '12px', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px' }}>
                        <div style={{ width: '100%', height: '100%', background: 'var(--primary)', borderRadius: '2px' }}></div>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '20px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Чистая прибыль</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: project.net_profit > 0 ? '#10b981' : '#ef4444' }}>
                            {project.net_profit?.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₸
                        </h3>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Маржа: <b>{margin.toFixed(2)}%</b></p>
                </div>
                <div className="glass-card" style={{ padding: '20px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Бюджет ОТ</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
                            {(project.extra_data?.total_overtime_cost || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₸
                        </h3>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Часов: <b>{project.overtimes?.length || 0}</b></p>
                </div>
                <div className="glass-card" style={{ padding: '20px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Задачи</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
                            {project.tasks?.filter((t: any) => t.status === 'DONE').length} / {project.tasks?.length}
                        </h3>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Завершено</p>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid var(--border)', marginBottom: '32px' }}>
                {[
                    { id: 'overview', label: 'Обзор', icon: Activity },
                    { id: 'tasks', label: 'Задачи', icon: CheckCircle },
                    { id: 'gantt', label: 'Гант', icon: Calendar },
                    { id: 'overtimes', label: 'Переработки', icon: Clock },
                    { id: 'bpm', label: 'BPM Логи', icon: History }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        style={{
                            padding: '12px 4px',
                            background: 'none',
                            border: 'none',
                            color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div style={{ minHeight: '400px' }}>
                {activeTab === 'overview' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <h4 style={{ fontWeight: 800, marginBottom: '20px' }}>О проекте</h4>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                {project.extra_data?.description || 'Описание проекта отсутствует.'}
                            </p>

                            <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Менеджер</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={16} />
                                        </div>
                                        <span style={{ fontWeight: 600 }}>{project.manager?.full_name || 'Не назначен'}</span>
                                    </div>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Текущая стадия</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: project.stage?.color || 'var(--primary)' }}></div>
                                        <span style={{ fontWeight: 600 }}>{project.stage?.name || 'Нет данных'}</span>
                                    </div>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>АУП</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Activity size={16} color="#f43f5e" />
                                        </div>
                                        <span style={{ fontWeight: 600 }}>{(project.aup * 100).toFixed(2)}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-card" style={{ padding: '24px' }}>
                            <h4 style={{ fontWeight: 800, marginBottom: '20px' }}>Документы</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[
                                    { label: 'Спецификация', url: project.doc_spec_url },
                                    { label: 'Техзадание (ТЗ)', url: project.doc_tech_spec_url },
                                    { label: 'Схемы подключения', url: project.doc_schemes_url },
                                    { label: 'Выгрузка клиенту', url: project.doc_client_export_url }
                                ].map((doc, idx) => (
                                    <a
                                        key={idx}
                                        href={doc.url || '#'}
                                        className={`doc-link ${!doc.url ? 'disabled' : ''}`}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '12px',
                                            borderRadius: '10px',
                                            background: 'var(--bg-secondary)',
                                            textDecoration: 'none',
                                            color: doc.url ? 'var(--text-primary)' : 'var(--text-muted)'
                                        }}
                                    >
                                        <FileText size={18} color="var(--primary)" />
                                        <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600 }}>{doc.label}</span>
                                        {doc.url ? <TrendingUp size={14} color="#10b981" /> : <AlertCircle size={14} color="#ef4444" />}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'tasks' && (
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h4 style={{ fontWeight: 800, margin: 0 }}>Задачи проекта ({project.tasks?.length || 0})</h4>
                            <button
                                onClick={() => setShowCreateTaskModal(true)}
                                className="primary btn-sm"
                            >
                                <Plus size={16} /> Создать задачу
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {project.tasks?.map((task: any) => (
                                <div key={task.id} className="task-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', border: '1px solid var(--border)', borderRadius: '12px' }}>
                                    <div className={`status-icon ${task.status?.toLowerCase()}`}>
                                        {task.status === 'DONE' ? <CheckCircle size={20} /> : <Clock size={20} />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontWeight: 700, margin: 0 }}>{task.title}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Исполнитель: {task.assigned?.full_name || 'Не назначен'}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'Без срока'}
                                        </p>
                                        <span className={`priority-tag ${task.priority?.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{task.priority}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'gantt' && renderGantt()}

                {activeTab === 'overtimes' && (
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h4 style={{ fontWeight: 800, marginBottom: '24px' }}>История переработок</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '12px' }}>Сотрудник</th>
                                    <th style={{ padding: '12px' }}>Дата</th>
                                    <th style={{ padding: '12px' }}>Описание</th>
                                    <th style={{ padding: '12px' }}>Часов</th>
                                    <th style={{ padding: '12px' }}>Статус</th>
                                </tr>
                            </thead>
                            <tbody>
                                {project.overtimes?.map((ot: any) => (
                                    <tr key={ot.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '12px', fontWeight: 600 }}>{ot.user?.full_name}</td>
                                        <td style={{ padding: '12px', fontSize: '0.875rem' }}>{new Date(ot.start_time).toLocaleDateString()}</td>
                                        <td style={{ padding: '12px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{ot.description}</td>
                                        <td style={{ padding: '12px', fontWeight: 700 }}>{ot.approved_hours || ot.hours}ч</td>
                                        <td style={{ padding: '12px' }}>
                                            <span className={`status-badge ${ot.status?.toLowerCase()}`}>{ot.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'bpm' && (
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h4 style={{ fontWeight: 800, marginBottom: '24px' }}>История автоматизаций</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                            {bpmLogs.map((log, idx) => (
                                <div key={log.id} style={{ display: 'flex', gap: '20px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: log.status === 'success' ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Zap size={12} color="white" />
                                        </div>
                                        {idx !== bpmLogs.length - 1 && <div style={{ width: '2px', flex: 1, background: 'var(--border)' }}></div>}
                                    </div>
                                    <div style={{ paddingBottom: '24px' }}>
                                        <p style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>{log.workflow?.name || 'Автоматизация'}</p>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{log.message}</p>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            {new Date(log.created_at).toLocaleString()} • {log.execution_time}ms
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {bpmLogs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Логов автоматизации пока нет.</p>}
                        </div>
                    </div>
                )}
            </div>
            {showCreateTaskModal && (
                <CreateTaskModal
                    projectId={Number(id)}
                    parentName={project.name}
                    onClose={() => setShowCreateTaskModal(false)}
                    onSuccess={() => fetchData()}
                />
            )}
        </div>
    );
};

export default ProjectDetailPage;
