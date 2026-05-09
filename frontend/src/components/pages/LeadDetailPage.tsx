import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    getLead, updateLead, getBPMLogs, getCRMTasks, getCounterparties, getCRMStages
} from '../../services/api';
import {
    User, Phone, Mail, CheckCircle, Clock, Zap,
    ChevronLeft, Plus, MessageSquare, Building2, Globe, Tag, Save, ArrowRight
} from 'lucide-react';
import Skeleton from '../common/Skeleton';
import CreateTaskModal from '../modals/CreateTaskModal';
import TaskDetailModal from '../modals/TaskDetailModal';
import type { Lead, Counterparty, Task } from '../../types';

const LeadDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [lead, setLead] = useState<Lead | null>(null);
    const [bpmLogs, setBpmLogs] = useState<any[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
    const [stages, setStages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        source: '',
        stage_id: '',
        counterparty_id: ''
    });

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const fetchData = async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const [leadData, logs, tasksData, cpData, stagesData] = await Promise.all([
                getLead(Number(id)),
                getBPMLogs({ entity_type: 'lead', entity_id: Number(id), limit: 20 }),
                getCRMTasks({ lead_id: Number(id) }),
                getCounterparties(),
                getCRMStages('LEAD')
            ]);
            setLead(leadData);
            setBpmLogs(Array.isArray(logs) ? logs : (logs.items || []));
            setTasks(tasksData);
            setCounterparties(cpData);
            setStages(stagesData);

            setFormData({
                title: leadData.title || '',
                description: leadData.description || '',
                contact_name: leadData.contact_name || '',
                contact_phone: leadData.contact_phone || '',
                contact_email: leadData.contact_email || '',
                source: leadData.source || '',
                stage_id: leadData.stage_id?.toString() || '',
                counterparty_id: leadData.counterparty_id?.toString() || ''
            });
        } catch (err) {
            console.error('Ошибка загрузки лида:', err);
        } finally {
            if (!quiet) setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateLead(Number(id), {
                ...formData,
                stage_id: formData.stage_id ? Number(formData.stage_id) : null,
                counterparty_id: formData.counterparty_id ? Number(formData.counterparty_id) : null
            });
            alert('Данные успешно сохранены');
            fetchData();
        } catch (err) {
            alert('Ошибка при сохранении');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ padding: '40px' }}><Skeleton height={600} /></div>;
    if (!lead) return <div className="text-center py-20">Лид не найден</div>;

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
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{lead.title}</h2>
                            <span className="status-badge" style={{ background: lead.stage?.color || 'var(--accent)' }}>
                                {lead.stage?.name || 'Новый'}
                            </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
                            Лид #{lead.id} • Источник: {lead.source || 'Не указан'}
                        </p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                {/* Main Content Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Edit Form Card */}
                    <div className="glass-card" style={{ padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h4 style={{ fontWeight: 800, margin: 0 }}>Основная информация</h4>
                            <button onClick={handleSave} className="primary btn-sm" disabled={saving}>
                                <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить изменения'}
                            </button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Название / Компания</label>
                                <input
                                    className="modern-input"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Контактное лицо</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input className="modern-input" style={{ paddingLeft: '36px' }} value={formData.contact_name} onChange={e => setFormData({ ...formData, contact_name: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Стадия</label>
                                <select className="modern-input" value={formData.stage_id} onChange={e => setFormData({ ...formData, stage_id: e.target.value })}>
                                    <option value="">Не выбрана</option>
                                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Телефон</label>
                                <div style={{ position: 'relative' }}>
                                    <Phone size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input className="modern-input" style={{ paddingLeft: '36px' }} value={formData.contact_phone} onChange={e => setFormData({ ...formData, contact_phone: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Email</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input type="email" className="modern-input" style={{ paddingLeft: '36px' }} value={formData.contact_email} onChange={e => setFormData({ ...formData, contact_email: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Контрагент</label>
                                <select className="modern-input" value={formData.counterparty_id} onChange={e => setFormData({ ...formData, counterparty_id: e.target.value })}>
                                    <option value="">Не выбран</option>
                                    {counterparties.map(cp => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Источник</label>
                                <input className="modern-input" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} />
                            </div>

                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Описание / Комментарии</label>
                                <textarea className="modern-input" style={{ minHeight: '100px' }} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                        </form>
                    </div>

                    {/* Tasks Section */}
                    <div className="glass-card" style={{ padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h4 style={{ fontWeight: 800, margin: 0 }}>Задачи по лиду ({tasks.length})</h4>
                            <button
                                onClick={() => setShowCreateTaskModal(true)}
                                className="secondary btn-sm"
                            >
                                <Plus size={16} /> Новая задача
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {tasks.map((task: any) => (
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
                                        <span className={`priority-tag ${(task.priority || 'MEDIUM').toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{task.priority}</span>
                                    </div>
                                </div>
                            ))}
                            {tasks.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                                    <MessageSquare size={32} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                    <p>Задач пока нет</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* BPM Logs Card */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h4 style={{ fontWeight: 800, marginBottom: '24px' }}>Активность (BPM)</h4>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {bpmLogs.map((log, idx) => (
                                <div key={log.id} style={{ display: 'flex', gap: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: log.status === 'success' ? 'var(--accent)' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Zap size={8} color="white" />
                                        </div>
                                        {idx !== bpmLogs.length - 1 && <div style={{ width: '1px', flex: 1, background: 'var(--border)' }}></div>}
                                    </div>
                                    <div style={{ paddingBottom: '20px' }}>
                                        <p style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>{log.workflow?.name || 'Система'}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{log.message}</p>
                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>{new Date(log.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {showCreateTaskModal && (
                <CreateTaskModal
                    leadId={Number(id)}
                    parentName={lead.title}
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

export default LeadDetailPage;
