import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    getDeal, updateDeal, getBPMLogs, createProjectFromDeal, getCounterparties, getCRMStages, getUsers
} from '../../services/api';
import {
    Briefcase, Building2, User, Phone,
    Mail, CheckCircle, Clock, Zap,
    ChevronLeft, Plus, Rocket, FileText, MessageSquare, Save
} from 'lucide-react';
import Skeleton from '../common/Skeleton';
import CreateTaskModal from '../modals/CreateTaskModal';
import TaskDetailModal from '../modals/TaskDetailModal';

/**
 * Страница детальной информации о сделке.
 * Позволяет управлять стадиями, задачами и конвертировать сделку в проект.
 */
const DealDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [deal, setDeal] = useState<any>(null);
    const [bpmLogs, setBpmLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

    const [counterparties, setCounterparties] = useState<any[]>([]);
    const [stages, setStages] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

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
        if (id) {
            fetchData();
        }
    }, [id]);

    const fetchData = async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const [dealData, logs, cpData, stagesData, usersData] = await Promise.all([
                getDeal(Number(id)),
                getBPMLogs({ entity_type: 'deal', entity_id: Number(id), limit: 20 }),
                getCounterparties(),
                getCRMStages('DEAL'),
                getUsers({ page_size: 1000 })
            ]);
            setDeal(dealData);
            setBpmLogs(Array.isArray(logs) ? logs : (logs.items || []));
            setCounterparties(cpData);
            setStages(stagesData);
            setUsers(usersData.items || usersData || []);

            setFormData({
                title: dealData.title || '',
                description: dealData.description || '',
                budget: dealData.budget || 0,
                currency: dealData.currency || 'RUB',
                stage_id: dealData.stage_id?.toString() || '',
                assigned_id: dealData.assigned_id?.toString() || '',
                counterparty_id: dealData.counterparty_id?.toString() || '',
                contract_url: dealData.contract_url || '',
                client_export_url: dealData.client_export_url || ''
            });
        } catch (err) {
            console.error('Ошибка загрузки сделки:', err);
        } finally {
            if (!quiet) setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateDeal(Number(id), {
                ...formData,
                stage_id: formData.stage_id ? Number(formData.stage_id) : null,
                assigned_id: formData.assigned_id ? Number(formData.assigned_id) : null,
                counterparty_id: formData.counterparty_id ? Number(formData.counterparty_id) : null,
                budget: Number(formData.budget)
            });
            alert('Сделка обновлена');
            fetchData();
        } catch (err) {
            alert('Ошибка при сохранении');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateProject = async () => {
        if (!window.confirm('Создать рабочий проект на основе этой сделки?')) return;
        try {
            const project = await createProjectFromDeal(deal.id);
            alert('Проект успешно создан!');
            navigate(`/projects/${project.id}`);
        } catch (err) {
            alert('Ошибка при создании проекта');
        }
    };

    if (loading) return <div style={{ padding: '40px' }}><Skeleton height={600} /></div>;
    if (!deal) return <div className="text-center py-20">Сделка не найдена</div>;

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Link to="/crm" className="icon-button" style={{ background: 'var(--bg-secondary)' }}>
                        <ChevronLeft size={20} />
                    </Link>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{deal.title}</h2>
                            <span className="status-badge" style={{ background: deal.stage?.color || 'var(--primary)' }}>
                                {deal.stage?.name || 'В работе'}
                            </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
                            Сделка #{deal.id} • Контрагент: {deal.counterparty?.name || 'Не указан'}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {deal.status !== 'WON' && (
                        <button className="primary" onClick={handleCreateProject}>
                            <Rocket size={18} /> В проект
                        </button>
                    )}
                    {deal.project_id && (
                        <Link to={`/projects/${deal.project_id}`} className="button secondary">
                            <Briefcase size={18} /> Перейти к проекту
                        </Link>
                    )}
                </div>
            </div>

            {/* Grid Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>

                {/* Main Content Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Overview Card */}
                    <div className="glass-card" style={{ padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h4 style={{ fontWeight: 800, margin: 0 }}>Редактирование сделки</h4>
                            <button onClick={handleSave} className="primary btn-sm" disabled={saving}>
                                <Save size={16} style={{ marginRight: '8px' }} /> {saving ? 'Сохранение...' : 'Сохранить'}
                            </button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Название сделки</label>
                                <input className="modern-input" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                            </div>

                            <div className="form-group">
                                <label>Бюджет</label>
                                <input type="number" className="modern-input" value={formData.budget} onChange={e => setFormData({ ...formData, budget: Number(e.target.value) })} />
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
                                <label>Стадия</label>
                                <select className="modern-input" value={formData.stage_id} onChange={e => setFormData({ ...formData, stage_id: e.target.value })}>
                                    <option value="">Не выбрана</option>
                                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Ответственный</label>
                                <select className="modern-input" value={formData.assigned_id} onChange={e => setFormData({ ...formData, assigned_id: e.target.value })}>
                                    <option value="">Не назначен</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Контрагент</label>
                                <select className="modern-input" value={formData.counterparty_id} onChange={e => setFormData({ ...formData, counterparty_id: e.target.value })}>
                                    <option value="">Не выбран</option>
                                    {counterparties.map(cp => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                                </select>
                            </div>

                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Описание</label>
                                <textarea className="modern-input" style={{ minHeight: '100px' }} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                        </form>
                    </div>

                    {/* Tasks Section */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h4 style={{ fontWeight: 800, margin: 0 }}>Задачи по сделке ({deal.tasks?.length || 0})</h4>
                            <button
                                onClick={() => setShowCreateTaskModal(true)}
                                className="secondary btn-sm"
                            >
                                <Plus size={16} /> Новая задача
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {deal.tasks?.map((task: any) => (
                                <div 
                                    key={task.id} 
                                    onClick={() => setSelectedTaskId(task.id)}
                                    className="table-row-hover clickable"
                                    style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', border: '1px solid var(--border)', borderRadius: '12px', transition: 'all 0.2s' }}
                                >
                                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: task.task_status?.name.includes('DONE') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {task.task_status?.name.includes('DONE') ? <CheckCircle size={18} color="#10b981" /> : <Clock size={18} color="#3b82f6" />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontWeight: 700, margin: 0 }}>{task.title}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{task.assigned?.full_name || 'Не назначен'}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: 700 }}>{task.deadline ? new Date(task.deadline).toLocaleDateString() : 'Без срока'}</p>
                                        <span className={`priority-tag ${(task.priority || 'MEDIUM').toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{task.priority || 'MEDIUM'}</span>
                                    </div>
                                </div>
                            ))}
                            {(!deal.tasks || deal.tasks.length === 0) && (
                                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                                    <MessageSquare size={32} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                    <p>Задач пока нет</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Timeline History */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h4 style={{ fontWeight: 800, marginBottom: '24px' }}>История изменений (BPM)</h4>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {bpmLogs.map((log, idx) => (
                                <div key={log.id} style={{ display: 'flex', gap: '20px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: log.status === 'success' ? 'var(--primary)' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Zap size={10} color="white" />
                                        </div>
                                        {idx !== bpmLogs.length - 1 && <div style={{ width: '1.5px', flex: 1, background: 'var(--border)' }}></div>}
                                    </div>
                                    <div style={{ paddingBottom: '24px' }}>
                                        <p style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>{log.workflow?.name || 'Системное событие'}</p>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{log.message}</p>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>{new Date(log.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar Info Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Counterparty Card */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <Building2 size={20} color="var(--primary)" />
                            <h4 style={{ fontWeight: 800, margin: 0 }}>Контрагент</h4>
                        </div>

                        {deal.counterparty ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Компания</p>
                                    <p style={{ fontWeight: 700, margin: '4px 0 0' }}>{deal.counterparty.name}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ИНН: {deal.counterparty.inn || 'Не указан'}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Контактное лицо</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                        <User size={14} color="var(--text-secondary)" />
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{deal.counterparty.contact_person || 'Не указано'}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.875rem' }}>
                                        <Phone size={14} color="var(--text-muted)" />
                                        <span>{deal.counterparty.phone || '—'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.875rem' }}>
                                        <Mail size={14} color="var(--text-muted)" />
                                        <span>{deal.counterparty.email || '—'}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Контрагент не привязан</p>
                        )}
                    </div>

                    {/* Files / Attachments */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h4 style={{ fontWeight: 800, marginBottom: '20px' }}>Документация</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <a href={deal.contract_url || '#'} className={`doc-link ${!deal.contract_url ? 'disabled' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '10px', textDecoration: 'none' }}>
                                <FileText size={18} color="var(--primary)" />
                                <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: deal.contract_url ? 'var(--text-primary)' : 'var(--text-muted)' }}>Договор / КП</span>
                            </a>
                            <a href={deal.client_export_url || '#'} className={`doc-link ${!deal.client_export_url ? 'disabled' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '10px', textDecoration: 'none' }}>
                                <FileText size={18} color="var(--primary)" />
                                <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: deal.client_export_url ? 'var(--text-primary)' : 'var(--text-muted)' }}>Оффер клиенту</span>
                            </a>
                        </div>
                    </div>

                </div>
            </div>
            {showCreateTaskModal && (
                <CreateTaskModal
                    dealId={Number(id)}
                    parentName={deal.title}
                    onClose={() => setShowCreateTaskModal(false)}
                    onSuccess={() => fetchData(true)}
                />
            )}
            {selectedTaskId && (
                <TaskDetailModal
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                    onUpdate={() => fetchData(true)}
                />
            )}
        </div>
    );
};

export default DealDetailPage;
