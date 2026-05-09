import React, { useEffect, useState } from 'react';
import {
    getCRMStages, createCRMStage, updateCRMStage, deleteCRMStage,
    getJobPositions, createJobPosition, updateJobPosition, deleteJobPosition,
    getSystemSettings, updateSystemSetting, getPermissionsMatrix, syncStagePermissions,
    getRoles, getPermissionList, getAllPermissions, syncRolePermissions, syncPositionPermissions,
    getDepartments
} from '../../services/api';
import { PERMISSION_LABELS } from '../../constants/translations';
import LoadingOverlay from '../atoms/LoadingOverlay';
import {
    Plus, Edit2, Trash2, Settings2, Briefcase,
    Database, ShieldCheck, Lock, Check, X, Save as SaveIcon
} from 'lucide-react';
import type { JobPosition } from '../../types';

const SystemSettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'crm' | 'positions' | 'global' | 'access' | 'modules' | 'tasks'>('crm');
    const [loading, setLoading] = useState(true);

    const MODULE_LABELS: Record<string, string> = {
        'LEAD': 'ЛИДЫ',
        'DEAL': 'СДЕЛКИ',
        'PROJECT': 'ПРОЕКТЫ'
    };

    // CRM Stages State
    const [crmModule, setCrmModule] = useState<'LEAD' | 'DEAL' | 'PROJECT'>('LEAD');
    const [stages, setStages] = useState<any[]>([]);

    // Positions State
    const [positions, setPositions] = useState<JobPosition[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);

    // Global Settings State
    const [settings, setSettings] = useState<any[]>([]);
    const [newSettingValue, setNewSettingValue] = useState<Record<string, string>>({});

    // Access Matrix State
    const [allProjectStages, setAllProjectStages] = useState<any[]>([]);
    const [permissionsMatrix, setPermissionsMatrix] = useState<any[]>([]);

    // Module Access State
    const [roles, setRoles] = useState<any[]>([]);
    const [permissionGroups, setPermissionGroups] = useState<Record<string, string[]>>({});
    const [dbPermissions, setDbPermissions] = useState<any[]>([]);
    const [accessMode, setAccessMode] = useState<'roles' | 'positions'>('roles');
    
    // Task Config State
    const [taskTypes, setTaskTypes] = useState<any[]>([]);
    const [taskStatuses, setTaskStatuses] = useState<any[]>([]);

    const SETTING_INFO: Record<string, { title: string, desc: string }> = {
        'weekly_overtime_limit': {
            title: 'Лимит переработок',
            desc: 'Максимальное количество часов переработки на одного сотрудника в неделю.'
        },
        'company_name': {
            title: 'Название компании',
            desc: 'Отображается в заголовках, отчетах и уведомлениях системы.'
        }
    };

    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<'stage' | 'position' | 'global' | 'role_permissions' | 'task_config'>('stage');
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [formData, setFormData] = useState<any>({});

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'crm') {
                const data = await getCRMStages(crmModule);
                setStages(data);
            } else if (activeTab === 'positions') {
                const [posData, deptsData] = await Promise.all([getJobPositions(), getDepartments()]);
                setPositions(posData);
                setDepartments(deptsData);
            } else if (activeTab === 'global') {
                const data = await getSystemSettings();
                setSettings(data);
                const values: Record<string, string> = {};
                data.forEach((s: any) => { values[s.key] = s.value; });
                setNewSettingValue(values);
            } else if (activeTab === 'access') {
                const [stagesData, posData, matrixData] = await Promise.all([
                    getCRMStages('PROJECT'),
                    getJobPositions(),
                    getPermissionsMatrix()
                ]);
                setAllProjectStages(stagesData);
                setPositions(posData);
                setPermissionsMatrix(matrixData);
            } else if (activeTab === 'modules') {
                const [rolesData, groupsData, allPermsData, posData] = await Promise.all([
                    getRoles(),
                    getPermissionList(),
                    getAllPermissions(),
                    getJobPositions()
                ]);
                setRoles(rolesData);
                setPermissionGroups(groupsData);
                setDbPermissions(allPermsData);
                setPositions(posData);
            } else if (activeTab === 'tasks') {
                const { getAdminTaskTypes, getAdminTaskStatuses } = await import('../../services/api');
                const [types, statuses] = await Promise.all([getAdminTaskTypes(), getAdminTaskStatuses()]);
                setTaskTypes(types);
                setTaskStatuses(statuses);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab, crmModule]);

    const handleSaveStage = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = { ...formData, module: crmModule };
            if (selectedItem) {
                await updateCRMStage(selectedItem.id, data);
            } else {
                await createCRMStage(data);
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            alert('Ошибка при сохранении стадии');
        }
    };

    const handleSavePermissions = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem) return;
        try {
            const enabledPermIds = formData.permissions
                .filter((p: any) => p.enabled)
                .map((p: any) => p.id);

            const currentGroupPermNames = formData.permissions.map((p: any) => p.name);

            const otherGroupsPermIds = (selectedItem.permissions || [])
                .filter((p: any) => !currentGroupPermNames.includes(p.name))
                .map((p: any) => p.id);

            const finalPermIds = [...enabledPermIds, ...otherGroupsPermIds]
                .filter(id => id !== undefined && id !== null)
                .map(id => Number(id));

            if (accessMode === 'roles') {
                await syncRolePermissions(selectedItem.id, finalPermIds);
            } else {
                await syncPositionPermissions(selectedItem.id, finalPermIds);
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            alert('Ошибка при сохранении прав');
        }
    };

    const handleSavePosition = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (selectedItem) {
                await updateJobPosition(selectedItem.id, formData);
            } else {
                await createJobPosition(formData);
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            alert('Ошибка при сохранении должности');
        }
    };

    const handleSaveTaskConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { createTaskType, updateTaskType, createTaskStatus, updateTaskStatus } = await import('../../services/api');
            if (formData.isType) {
                if (selectedItem) await updateTaskType(selectedItem.id, formData);
                else await createTaskType(formData);
            } else {
                if (selectedItem) await updateTaskStatus(selectedItem.id, formData);
                else await createTaskStatus(formData);
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            alert('Ошибка при сохранении конфигурации задачи');
        }
    };

    const handleUpdateGlobal = async (key: string) => {
        try {
            await updateSystemSetting(key, newSettingValue[key]);
            alert('Настройка сохранена');
            fetchData();
        } catch (err) {
            alert('Ошибка при сохранении настройки');
        }
    };

    const togglePermission = async (positionId: number, stageId: number) => {
        setLoading(true);
        try {
            const currentAllowed = permissionsMatrix
                .filter(p => p.position_id === positionId)
                .map(p => p.stage_id);

            let newAllowed: number[];
            if (currentAllowed.includes(stageId)) {
                newAllowed = currentAllowed.filter(id => id !== stageId);
            } else {
                newAllowed = [...currentAllowed, stageId];
            }

            await syncStagePermissions({
                position_id: positionId,
                allowed_stage_ids: newAllowed
            });
            fetchData();
        } catch (err) {
            alert('Ошибка при обновлении прав');
            setLoading(false);
        }
    };

    if (loading && !stages.length && !positions.length && !settings.length && !allProjectStages.length && !taskTypes.length) return <LoadingOverlay />;

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Настройки системы</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Глобальные конфигурации, воронки и матрица прав.</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '14px', width: 'fit-content', marginBottom: '32px', overflowX: 'auto', maxWidth: '100%' }}>
                <button onClick={() => setActiveTab('crm')} style={tabButtonStyle(activeTab === 'crm')}>
                    <Settings2 size={18} /> CRM Воронки
                </button>
                <button onClick={() => setActiveTab('positions')} style={tabButtonStyle(activeTab === 'positions')}>
                    <Briefcase size={18} /> Должности
                </button>
                <button onClick={() => setActiveTab('tasks')} style={tabButtonStyle(activeTab === 'tasks')}>
                    <Check size={18} /> Задачи
                </button>
                <button onClick={() => setActiveTab('access')} style={tabButtonStyle(activeTab === 'access')}>
                    <Lock size={18} /> Стадии Проектов
                </button>
                <button onClick={() => setActiveTab('modules')} style={tabButtonStyle(activeTab === 'modules')}>
                    <ShieldCheck size={18} /> Доступ к модулям
                </button>
                <button onClick={() => setActiveTab('global')} style={tabButtonStyle(activeTab === 'global')}>
                    <Settings2 size={18} /> Глобальные лимиты
                </button>
            </div>

            {activeTab === 'crm' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {['LEAD', 'DEAL', 'PROJECT'].map(m => (
                                <button
                                    key={m}
                                    onClick={() => setCrmModule(m as any)}
                                    style={{
                                        padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--border)',
                                        background: crmModule === m ? 'var(--accent)' : 'transparent',
                                        color: crmModule === m ? 'white' : 'var(--text-primary)',
                                        fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                                    }}
                                >
                                    {MODULE_LABELS[m]}
                                </button>
                            ))}
                        </div>
                        <button className="primary" onClick={() => {
                            setSelectedItem(null);
                            setFormData({ name: '', color: '#3b82f6', sort_order: stages.length });
                            setModalType('stage');
                            setShowModal(true);
                        }}>
                            <Plus size={18} /> ДОБАВИТЬ СТАДИЮ
                        </button>
                    </div>

                    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '16px', textAlign: 'left', width: '50px' }}>#</th>
                                    <th style={{ padding: '16px', textAlign: 'left' }}>Название</th>
                                    <th style={{ padding: '16px', textAlign: 'left' }}>Цвет</th>
                                    <th style={{ padding: '16px', textAlign: 'right' }}>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stages.map(s => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '16px' }}>{s.sort_order}</td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                                                <div style={{ width: 12, height: 12, borderRadius: 4, background: s.color }} />
                                                {s.name}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', fontFamily: 'monospace' }}>{s.color}</td>
                                        <td style={{ padding: '16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => { setSelectedItem(s); setFormData(s); setModalType('stage'); setShowModal(true); }} className="action-button-modern"><Edit2 size={16} /></button>
                                                <button onClick={async () => { if (window.confirm('Удалить?')) { await deleteCRMStage(s.id); fetchData(); } }} className="action-button-modern" style={{ color: 'var(--error)' }}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {activeTab === 'positions' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                        <button className="primary" onClick={() => {
                            setSelectedItem(null);
                            setFormData({ name: '' });
                            setModalType('position');
                            setShowModal(true);
                        }}>
                            <Plus size={18} /> НОВАЯ ДОЛЖНОСТЬ
                        </button>
                    </div>
                    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '16px', textAlign: 'left' }}>Название должности</th>
                                    <th style={{ padding: '16px', textAlign: 'left' }}>Отдел</th>
                                    <th style={{ padding: '16px', textAlign: 'right' }}>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {positions.map(p => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '16px', fontWeight: 700 }}>{p.name}</td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{ fontSize: '0.8rem', opacity: 0.8, background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                                                {p.department?.name || '—'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => { setSelectedItem(p); setFormData(p); setModalType('position'); setShowModal(true); }} className="action-button-modern"><Edit2 size={16} /></button>
                                                <button onClick={async () => { if (window.confirm('Удалить?')) { await deleteJobPosition(p.id); fetchData(); } }} className="action-button-modern" style={{ color: 'var(--error)' }}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {activeTab === 'tasks' && (
                <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Типы задач</h3>
                            <button className="primary-small" onClick={() => {
                                setModalType('task_config');
                                setSelectedItem(null);
                                setFormData({ name: '', color: '#3b82f6', icon: 'Check', isType: true });
                                setShowModal(true);
                            }}>
                                <Plus size={16} /> Добавить тип
                            </button>
                        </div>
                        <div className="custom-table-container">
                            <table className="custom-table" style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '12px' }}>Название</th>
                                        <th style={{ textAlign: 'left', padding: '12px' }}>Цвет</th>
                                        <th style={{ textAlign: 'right', padding: '12px' }}>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.isArray(taskTypes) && taskTypes.map(t => (
                                        <tr key={t.id}>
                                            <td style={{ padding: '12px', fontWeight: 600 }}>{t.name}</td>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: t.color }} />
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.color}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                    <button className="icon-button-small" onClick={() => {
                                                        setModalType('task_config');
                                                        setSelectedItem(t);
                                                        setFormData({ ...t, isType: true });
                                                        setShowModal(true);
                                                    }}><Edit2 size={14} /></button>
                                                    <button className="icon-button-small delete" onClick={async () => {
                                                        if (window.confirm('Удалить тип задачи?')) {
                                                            const { deleteTaskType } = await import('../../services/api');
                                                            await deleteTaskType(t.id);
                                                            fetchData();
                                                        }
                                                    }}><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Статусы задач</h3>
                            <button className="primary-small" onClick={() => {
                                setModalType('task_config');
                                setSelectedItem(null);
                                setFormData({ name: '', color: '#94a3b8', sort_order: taskStatuses.length + 1, isType: false });
                                setShowModal(true);
                            }}>
                                <Plus size={16} /> Добавить статус
                            </button>
                        </div>
                        <div className="custom-table-container">
                            <table className="custom-table" style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '12px' }}>Название</th>
                                        <th style={{ textAlign: 'left', padding: '12px' }}>Сорт.</th>
                                        <th style={{ textAlign: 'right', padding: '12px' }}>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.isArray(taskStatuses) && taskStatuses.map(s => (
                                        <tr key={s.id}>
                                            <td style={{ padding: '12px', fontWeight: 600 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '4px', height: '16px', borderRadius: '2px', background: s.color }} />
                                                    {s.name}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px' }}>{s.sort_order}</td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                    <button className="icon-button-small" onClick={() => {
                                                        setModalType('task_config');
                                                        setSelectedItem(s);
                                                        setFormData({ ...s, isType: false });
                                                        setShowModal(true);
                                                    }}><Edit2 size={14} /></button>
                                                    <button className="icon-button-small delete" onClick={async () => {
                                                        if (window.confirm('Удалить статус?')) {
                                                            const { deleteTaskStatus } = await import('../../services/api');
                                                            await deleteTaskStatus(s.id);
                                                            fetchData();
                                                        }
                                                    }}><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'access' && (
                <div style={{ overflowX: 'auto' }}>
                    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)' }}>
                                    <th style={{ padding: '24px 16px', textAlign: 'left', minWidth: '200px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Должность / Стадия Проекта
                                    </th>
                                    {allProjectStages.map(stage => (
                                        <th key={stage.id} style={{ padding: '16px', textAlign: 'center', minWidth: '120px' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>#{stage.sort_order}</div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{stage.name}</div>
                                            <div style={{ width: '100%', height: '4px', background: stage.color, marginTop: '8px', borderRadius: '2px' }}></div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {positions.map(pos => (
                                    <tr key={pos.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '16px 24px', fontWeight: 700, background: 'rgba(255,255,255,0.02)' }}>
                                            <div>{pos.name}</div>
                                            {pos.department && (
                                                <div style={{ fontSize: '0.65rem', fontWeight: 400, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                    {pos.department.name}
                                                </div>
                                            )}
                                        </td>
                                        {allProjectStages.map(stage => {
                                            const hasAccess = permissionsMatrix.some(p => p.position_id === pos.id && p.stage_id === stage.id);
                                            return (
                                                <td key={stage.id} style={{ padding: '16px', textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => togglePermission(pos.id, stage.id)}
                                                        style={{
                                                            width: '32px', height: '32px', borderRadius: '8px',
                                                            background: hasAccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                                                            color: hasAccess ? '#10b981' : 'var(--text-muted)',
                                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            margin: '0 auto', transition: 'all 0.2s', border: hasAccess ? '1px solid #10b981' : '1px solid var(--border)'
                                                        }}
                                                    >
                                                        {hasAccess ? <Check size={18} /> : <X size={14} />}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'modules' && (
                <div style={{ overflowX: 'auto' }} className="animate-fade-in">
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
                        <button
                            onClick={() => setAccessMode('roles')}
                            style={{
                                padding: '6px 16px', borderRadius: '8px', border: 'none',
                                background: accessMode === 'roles' ? 'var(--bg-secondary)' : 'transparent',
                                color: accessMode === 'roles' ? 'var(--accent)' : 'var(--text-secondary)',
                                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                            }}
                        >
                            ПО РОЛЯМ
                        </button>
                        <button
                            onClick={() => setAccessMode('positions')}
                            style={{
                                padding: '6px 16px', borderRadius: '8px', border: 'none',
                                background: accessMode === 'positions' ? 'var(--bg-secondary)' : 'transparent',
                                color: accessMode === 'positions' ? 'var(--accent)' : 'var(--text-secondary)',
                                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                            }}
                        >
                            ПО ДОЛЖНОСТЯМ
                        </button>
                    </div>

                    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)' }}>
                                    <th style={{ padding: '24px 16px', textAlign: 'left', minWidth: '200px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        {accessMode === 'roles' ? 'Роль' : 'Должность'} / Модуль
                                    </th>
                                    {Object.keys(permissionGroups).map(groupName => (
                                        <th key={groupName} style={{ padding: '16px', textAlign: 'center', minWidth: '150px' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{groupName}</div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400 }}>{permissionGroups[groupName].length} прав</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(accessMode === 'roles' ? roles : positions).map(item => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '16px 24px', fontWeight: 700, background: 'rgba(255,255,255,0.02)' }}>
                                            {item.name}
                                            {accessMode === 'roles' ? (
                                                <div style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>{item.description || 'Нет описания'}</div>
                                            ) : (
                                                item.department && (
                                                    <div style={{ fontSize: '0.65rem', fontWeight: 400, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                        {item.department.name}
                                                    </div>
                                                )
                                            )}
                                        </td>
                                        {Object.keys(permissionGroups).map(groupName => {
                                            const groupPermNames = permissionGroups[groupName];
                                            const itemPermNames = (item.permissions || []).map((p: any) => p.name);
                                            const allowedInGroup = groupPermNames.filter(name => itemPermNames.includes(name));
                                            const isAll = allowedInGroup.length === groupPermNames.length;
                                            const isSome = allowedInGroup.length > 0 && !isAll;

                                            return (
                                                <td key={groupName} style={{ padding: '16px', textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedItem(item);
                                                            setFormData({
                                                                groupName,
                                                                permissions: groupPermNames.map(name => ({
                                                                    name,
                                                                    id: dbPermissions.find(p => p.name === name)?.id,
                                                                    enabled: itemPermNames.includes(name)
                                                                }))
                                                            });
                                                            setModalType('role_permissions');
                                                            setShowModal(true);
                                                        }}
                                                        style={{
                                                            padding: '6px 12px', borderRadius: '8px',
                                                            background: isAll ? 'rgba(16, 185, 129, 0.15)' : isSome ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.05)',
                                                            color: isAll ? '#10b981' : isSome ? '#f59e0b' : 'var(--text-muted)',
                                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            margin: '0 auto', transition: 'all 0.2s', border: (isAll || isSome) ? `1px solid ${isAll ? '#10b981' : '#f59e0b'}` : '1px solid var(--border)',
                                                            fontSize: '0.75rem', fontWeight: 600, gap: '6px'
                                                        }}
                                                    >
                                                        {isAll ? <Check size={14} /> : isSome ? <Edit2 size={12} /> : <X size={12} />}
                                                        {allowedInGroup.length} / {groupPermNames.length}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'global' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                    {settings
                        .filter(s => !!SETTING_INFO[s.key])
                        .map(s => {
                            const info = SETTING_INFO[s.key];
                            return (
                                <div key={s.key} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                            <Database size={20} color="var(--accent)" />
                                            <h3 style={{ fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase' }}>{info.title}</h3>
                                        </div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.4' }}>
                                            {info.desc}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <input
                                            className="modern-input"
                                            style={{ height: '44px' }}
                                            value={newSettingValue[s.key] || ''}
                                            onChange={e => setNewSettingValue({ ...newSettingValue, [s.key]: e.target.value })}
                                        />
                                        <button className="primary" onClick={() => handleUpdateGlobal(s.key)} style={{ padding: '0 16px' }}>
                                            <SaveIcon size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" style={{ zIndex: 2000 }}>
                    <div className="glass-card" style={{ width: '450px', padding: '32px', borderRadius: '24px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '24px' }}>
                            {modalType === 'role_permissions' ? `Права модуля: ${formData.groupName}` : (selectedItem ? 'Редактировать' : 'Добавить')}
                        </h2>
                        <form onSubmit={
                            modalType === 'stage' ? handleSaveStage :
                            modalType === 'position' ? handleSavePosition :
                            modalType === 'task_config' ? (e: any) => handleSaveTaskConfig(e) :
                            handleSavePermissions
                        }>
                            {(modalType === 'stage' || modalType === 'position') && (
                                <div style={{ marginBottom: '16px' }}>
                                    <label className="label">Название</label>
                                    <input
                                        className="modern-input" required
                                        value={formData.name || ''}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                            )}

                            {modalType === 'position' && (
                                <>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label className="label">Отдел</label>
                                        <select
                                            className="modern-input"
                                            value={formData.department_id || ''}
                                            onChange={e => setFormData({ ...formData, department_id: e.target.value ? parseInt(e.target.value) : null })}
                                        >
                                            <option value="">Без отдела</option>
                                            {departments.map(dept => (
                                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ marginBottom: '24px' }}>
                                        <label className="label">Вышестоящая должность (Начальник)</label>
                                        <select
                                            className="modern-input"
                                            value={formData.parent_id || ''}
                                            onChange={e => setFormData({ ...formData, parent_id: e.target.value ? parseInt(e.target.value) : null })}
                                        >
                                            <option value="">Нет (Верхний уровень)</option>
                                            {positions.filter(p => p.id !== selectedItem?.id).map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            {modalType === 'role_permissions' && (
                                <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                        Настройте права для {accessMode === 'roles' ? 'роли' : 'должности'} <strong>{selectedItem?.name}</strong> в модуле {formData.groupName}.
                                    </p>
                                    {formData.permissions.map((p: any, idx: number) => (
                                        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', marginBottom: '8px' }}>
                                            <input
                                                type="checkbox"
                                                checked={p.enabled}
                                                onChange={e => {
                                                    const newPerms = [...formData.permissions];
                                                    newPerms[idx].enabled = e.target.checked;
                                                    setFormData({ ...formData, permissions: newPerms });
                                                }}
                                                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                            />
                                            <div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{PERMISSION_LABELS[p.name] || p.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.name}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {modalType === 'stage' && (
                                <>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label className="label">Цвет</label>
                                        <input type="color" value={formData.color || '#3b82f6'} onChange={e => setFormData({ ...formData, color: e.target.value })} style={{ width: '100%', height: '40px', borderRadius: '8px' }} />
                                    </div>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label className="label">Порядок</label>
                                        <input type="number" className="modern-input" value={formData.sort_order || 0} onChange={e => setFormData({ ...formData, sort_order: Number(e.target.value) })} />
                                    </div>
                                </>
                            )}

                            {modalType === 'task_config' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>{selectedItem ? 'Редактировать' : 'Добавить'} {formData.isType ? 'тип' : 'статус'}</h3>
                                    <div>
                                        <label className="label">Название</label>
                                        <input className="modern-input" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Название..." required />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <label className="label">Цвет</label>
                                            <input type="color" value={formData.color || '#3b82f6'} onChange={e => setFormData({ ...formData, color: e.target.value })} style={{ width: '100%', height: '40px', borderRadius: '8px' }} />
                                        </div>
                                        {!formData.isType && (
                                            <div>
                                                <label className="label">Порядок</label>
                                                <input type="number" className="modern-input" value={formData.sort_order || 0} onChange={e => setFormData({ ...formData, sort_order: Number(e.target.value) })} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
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

const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 24px',
    borderRadius: '10px',
    border: 'none',
    background: isActive ? 'var(--bg-secondary)' : 'transparent',
    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
    fontWeight: isActive ? 700 : 500,
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
    whiteSpace: 'nowrap'
});

export default SystemSettingsPage;
