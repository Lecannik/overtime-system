import React, { useEffect, useState } from 'react';
import { getWorkflows, createWorkflow, deleteWorkflow, getBPMLogs, getCRMStages, getUsers } from '../../services/api';
import LoadingOverlay from '../atoms/LoadingOverlay';
import { Zap, Trash2, Plus, ArrowRight } from 'lucide-react';

const BPMPage: React.FC = () => {
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'workflows' | 'logs'>('workflows');
    const [showModal, setShowModal] = useState(false);

    // Data for modal
    const [users, setUsers] = useState<any[]>([]);
    const [stages, setStages] = useState<any[]>([]);

    // New Workflow state
    const [newWf, setNewWf] = useState({
        name: '',
        description: '',
        entity_type: 'lead',
        trigger_type: 'entity_created',
        action_type: 'create_task',
        target_stage_id: '',
        delay_hours: 24,
        task_title: '',
        task_assigned_id: '',
        new_responsible_id: '',
        notification_text: '',
        notification_recipient: 'assigned'
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [wfData, logData, userData, stageData] = await Promise.all([
                getWorkflows(),
                getBPMLogs(),
                getUsers(),
                getCRMStages()
            ]);
            setWorkflows(Array.isArray(wfData) ? wfData : (wfData?.items || []));
            setLogs(Array.isArray(logData) ? logData : (logData?.items || []));
            setUsers(Array.isArray(userData) ? userData : (userData?.items || []));
            setStages(Array.isArray(stageData) ? stageData : (stageData?.items || []));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateWorkflow = async () => {
        try {
            const payload: any = {
                name: newWf.name,
                description: newWf.description,
                entity_type: newWf.entity_type,
                triggers: [{
                    type: newWf.trigger_type,
                    params: newWf.trigger_type === 'stage_changed'
                        ? { target_stage_id: newWf.target_stage_id }
                        : (newWf.trigger_type === 'time_delay' ? { delay_hours: newWf.delay_hours, target_stage_id: newWf.target_stage_id } : {})
                }],
                actions: [{
                    type: newWf.action_type,
                    params: newWf.action_type === 'create_task' ? {
                        title: newWf.task_title,
                        assigned_id: newWf.task_assigned_id
                    } : (newWf.action_type === 'set_responsible' ? {
                        user_id: newWf.new_responsible_id
                    } : {
                        template: newWf.notification_text,
                        recipient_type: newWf.notification_recipient
                    })
                }]
            };

            await createWorkflow(payload);
            setShowModal(false);
            fetchData();
        } catch (err) {
            alert('Ошибка при создании правила');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Удалить это правило?')) return;
        try {
            await deleteWorkflow(id);
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading && !workflows.length) return <LoadingOverlay />;

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Автоматизация BPM</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Управление бизнес-процессами и триггерами в системе.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={18} /> СОЗДАТЬ ПРАВИЛО
                </button>
            </div>

            <div className="glass-card" style={{ display: 'flex', padding: '4px', borderRadius: '12px', width: 'fit-content', marginBottom: '24px' }}>
                <button
                    onClick={() => setActiveTab('workflows')}
                    style={{
                        padding: '10px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                        background: activeTab === 'workflows' ? 'var(--accent)' : 'transparent',
                        color: activeTab === 'workflows' ? 'white' : 'var(--text-primary)',
                        transition: 'all 0.2s'
                    }}
                >
                    АКТИВНЫЕ ПРАВИЛА
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    style={{
                        padding: '10px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                        background: activeTab === 'logs' ? 'var(--accent)' : 'transparent',
                        color: activeTab === 'logs' ? 'white' : 'var(--text-primary)',
                        transition: 'all 0.2s'
                    }}
                >
                    ЖУРНАЛ ВЫПОЛНЕНИЯ
                </button>
            </div>

            {activeTab === 'workflows' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    {workflows.length === 0 && (
                        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <Zap size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                            <p>У вас пока нет настроенных автоматизаций.</p>
                        </div>
                    )}
                    {Array.isArray(workflows) && workflows.map(wf => (
                        <div key={wf.id} className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
                                <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                                    <Zap size={22} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <h3 style={{ fontWeight: 800, margin: 0 }}>{wf.name}</h3>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                            {wf.entity_type}
                                        </span>
                                    </div>
                                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{wf.description || 'Нет описания'}</p>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-secondary)', padding: '12px 20px', borderRadius: '12px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>Триггер</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{wf.triggers?.[0]?.type || 'N/A'}</div>
                                    </div>
                                    <ArrowRight size={18} color="var(--text-muted)" />
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>Действие</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent)' }}>{wf.actions?.[0]?.type || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginLeft: '40px' }}>
                                <button
                                    onClick={() => handleDelete(wf.id)}
                                    style={{ width: '36px', height: '36px', borderRadius: '10px', border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                    className="btn-danger-hover"
                                >
                                    <Trash2 size={18} />
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
                                <th style={{ padding: '16px', textAlign: 'left' }}>Время</th>
                                <th style={{ padding: '16px', textAlign: 'left' }}>Процесс</th>
                                <th style={{ padding: '16px', textAlign: 'left' }}>Сущность (ID)</th>
                                <th style={{ padding: '16px', textAlign: 'left' }}>Статус</th>
                                <th style={{ padding: '16px', textAlign: 'left' }}>Сообщение / Время выполнения</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.isArray(logs) && logs.map(log => (
                                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontSize: '0.85rem' }}>{new Date(log.created_at).toLocaleString()}</div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>#{log.workflow_id || 'Удален'}</div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: 600 }}>ID: {log.entity_id}</div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{
                                            padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800,
                                            background: log.status === 'success' ? '#10b98122' : '#ef444422',
                                            color: log.status === 'success' ? '#10b981' : '#ef4444'
                                        }}>
                                            {log.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{log.message}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{log.execution_time}ms</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* CREATE MODAL */}
            {showModal && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-card modal-content" style={{ width: '600px', padding: '32px', position: 'relative' }}>
                        <h2 style={{ marginBottom: '24px', fontWeight: 800 }}>Новое правило автоматизации</h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>НАЗВАНИЕ ПРАВИЛА</label>
                                <input
                                    className="glass-input"
                                    placeholder="Напр: Авто-задача на звонок"
                                    style={{ width: '100%' }}
                                    value={newWf.name}
                                    onChange={e => setNewWf({ ...newWf, name: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>ТИП СУЩНОСТИ</label>
                                    <select
                                        className="glass-input"
                                        style={{ width: '100%' }}
                                        value={newWf.entity_type}
                                        onChange={e => setNewWf({ ...newWf, entity_type: e.target.value })}
                                    >
                                        <option value="lead">Лид</option>
                                        <option value="deal">Сделка</option>
                                        <option value="project">Проект</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>ТРИГГЕР (КОГДА?)</label>
                                    <select
                                        className="glass-input"
                                        style={{ width: '100%' }}
                                        value={newWf.trigger_type}
                                        onChange={e => setNewWf({ ...newWf, trigger_type: e.target.value })}
                                    >
                                        <option value="entity_created">Создана новая запись</option>
                                        <option value="stage_changed">Сменилась стадия</option>
                                        <option value="time_delay">Простой на стадии (время)</option>
                                    </select>
                                </div>
                            </div>

                            {newWf.trigger_type === 'time_delay' && (
                                <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>ЗАДЕРЖКА (В ЧАСАХ)</label>
                                    <input
                                        type="number"
                                        className="glass-input"
                                        style={{ width: '100%' }}
                                        value={newWf.delay_hours}
                                        onChange={e => setNewWf({ ...newWf, delay_hours: parseInt(e.target.value) })}
                                    />
                                </div>
                            )}

                            {(newWf.trigger_type === 'stage_changed' || newWf.trigger_type === 'time_delay') && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>ЦЕЛЕВАЯ СТАДИЯ</label>
                                    <select
                                        className="glass-input"
                                        style={{ width: '100%' }}
                                        value={newWf.target_stage_id}
                                        onChange={e => setNewWf({ ...newWf, target_stage_id: e.target.value })}
                                    >
                                        <option value="">Любая стадия</option>
                                        {stages.filter(s => s.module.toLowerCase() === newWf.entity_type).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div style={{ height: '1px', background: 'var(--border)', margin: '10px 0' }}></div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>ДЕЙСТВИЕ (ЧТО СДЕЛАТЬ?)</label>
                                <select
                                    className="glass-input"
                                    style={{ width: '100%', marginBottom: '16px' }}
                                    value={newWf.action_type}
                                    onChange={e => setNewWf({ ...newWf, action_type: e.target.value })}
                                >
                                    <option value="create_task">Создать задачу</option>
                                    <option value="send_notification">Отправить в Telegram</option>
                                    <option value="set_responsible">Сменить ответственного</option>
                                </select>

                                {newWf.action_type === 'create_task' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                                        <input
                                            className="glass-input"
                                            placeholder="Тема задачи"
                                            style={{ width: '100%' }}
                                            value={newWf.task_title}
                                            onChange={e => setNewWf({ ...newWf, task_title: e.target.value })}
                                        />
                                        <select
                                            className="glass-input"
                                            style={{ width: '100%' }}
                                            value={newWf.task_assigned_id}
                                            onChange={e => setNewWf({ ...newWf, task_assigned_id: e.target.value })}
                                        >
                                            <option value="">Исполнитель по умолчанию</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>{u.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : newWf.action_type === 'set_responsible' ? (
                                    <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>ВЫБЕРИТЕ НОВОГО ОТВЕТСТВЕННОГО</label>
                                        <select
                                            className="glass-input"
                                            style={{ width: '100%' }}
                                            value={newWf.new_responsible_id}
                                            onChange={e => setNewWf({ ...newWf, new_responsible_id: e.target.value })}
                                        >
                                            <option value="">Не выбрано</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>{u.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                                        <textarea
                                            className="glass-input"
                                            placeholder="Текст уведомления (используйте {title} для вставки имени)"
                                            style={{ width: '100%', minHeight: '80px', resize: 'none' }}
                                            value={newWf.notification_text}
                                            onChange={e => setNewWf({ ...newWf, notification_text: e.target.value })}
                                        />
                                        <select
                                            className="glass-input"
                                            style={{ width: '100%' }}
                                            value={newWf.notification_recipient}
                                            onChange={e => setNewWf({ ...newWf, notification_recipient: e.target.value })}
                                        >
                                            <option value="assigned">Ответственному</option>
                                            <option value="creator">Создателю</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>Конкретному пользователю: {u.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                            <button className="btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>ОТМЕНА</button>
                            <button className="btn-primary" onClick={handleCreateWorkflow} style={{ flex: 1 }}>СОЗДАТЬ</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BPMPage;
