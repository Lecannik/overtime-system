import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Search, Edit2, Key, Trash2, Plus, Globe, RefreshCcw, Briefcase, Download, X as XIcon
} from 'lucide-react';

import api, {
    getUsers, getDepartments, getAdminProjects, getAuditLogs, updateUser, resetUserPassword,
    deleteUser, deleteDepartment, deleteProject, createDepartment, createProject,
    updateDepartment, updateProject, getOdooStatus, getOdooProjects, importOdooProjects,
    getAccessToken, getOdooIntegrationStatus, getOdooIntegrationProjects, importOdooIntegrationProjects
} from '../../services/api';

import type { OdooProjectPreview, User, Department, Project, AuditLog, OdooIntegrationProject } from '../../types';
import Header from '../layout/Header';

import Skeleton from '../common/Skeleton';
import ImportMSUsersModal from '../modals/ImportMSUsersModal';
import UserModal from '../modals/UserModal';
import ConfirmModal from '../modals/ConfirmModal';
import { ROLE_LABELS, COMPANY_LABELS, ROLE_COLORS, formatDateTime } from '../../constants/locale';
import { AxiosError } from 'axios';

const UsersPage: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'projects' | 'audit'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [authChecked, setAuthChecked] = useState(false);
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [companyFilter] = useState('ALL');

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [sortBy, setSortBy] = useState<string>('id');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const [isImportMSModalOpen, setIsImportMSModalOpen] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<() => void>(() => { });
    const [confirmInfo, setConfirmInfo] = useState<{ title: string; message: string; type: 'warning' | 'danger' | 'info' }>({ title: '', message: '', type: 'warning' });

    const [editUserData, setEditUserData] = useState<User | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Состояние модала создания проекта
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [projectForm, setProjectForm] = useState({ name: '', code: '' });
    const [projectFormError, setProjectFormError] = useState('');
    const [projectFormLoading, setProjectFormLoading] = useState(false);

    // Regex для валидации формата кода проекта YYYY-NNNNN
    const PROJECT_CODE_RE = /^\d{4}-\d{5}$/;

    // Инлайн редактирование отдела: id=null — ничего не редактируется
    const [editDeptId, setEditDeptId] = useState<number | null>(null);
    const [editDeptName, setEditDeptName] = useState('');

    // Инлайн редактирование проекта
    const [editProjectId, setEditProjectId] = useState<number | null>(null);
    const [editProjectName, setEditProjectName] = useState('');
    const [editProjectActive, setEditProjectActive] = useState(true);

    // Локальные значения лимита для number input (чтобы не дергать API на каждый символ)
    const [localLimits, setLocalLimits] = useState<Record<number, number>>({});

    // ==================== Состояние Odoo-модала ====================
    const [isOdooConfigured, setIsOdooConfigured] = useState(false);
    const [isOdooModalOpen, setIsOdooModalOpen] = useState(false);
    const [odooProjects, setOdooProjects] = useState<OdooProjectPreview[]>([]);
    const [odooLoading, setOdooLoading] = useState(false);
    const [odooError, setOdooError] = useState('');
    const [selectedOdooIds, setSelectedOdooIds] = useState<Set<number>>(new Set());
    const [importLoading, setImportLoading] = useState(false);
    const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

    // ==================== Состояние Odoo Integration (Микросервис) ====================
    const [isOdooIntConfigured, setIsOdooIntConfigured] = useState(false);
    const [isOdooIntModalOpen, setIsOdooIntModalOpen] = useState(false);
    const [odooIntProjects, setOdooIntProjects] = useState<OdooIntegrationProject[]>([]);
    const [odooIntLoading, setOdooIntLoading] = useState(false);
    const [odooIntError, setOdooIntError] = useState('');
    const [selectedOdooIntIds, setSelectedOdooIntIds] = useState<Set<number>>(new Set());
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(['name', 'code']));
    const [odooIntSearch, setOdooIntSearch] = useState('');
    const [odooIntImportLoading, setOdooIntImportLoading] = useState(false);
    const [odooIntImportResult, setOdooIntImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
        setCurrentPage(1);
    };

    const renderSortIcon = (field: string) => {
        if (sortBy !== field) return <span style={{ opacity: 0.3, marginLeft: '6px' }}>↕</span>;
        return sortOrder === 'asc' 
            ? <span style={{ color: '#38bdf8', marginLeft: '6px' }}>↑</span> 
            : <span style={{ color: '#38bdf8', marginLeft: '6px' }}>↓</span>;
    };

    const refreshData = useCallback(async () => {
        setLoading(true);
        try {
            if (activeTab === 'users') {
                const res = await getUsers({
                    page: currentPage,
                    page_size: pageSize,
                    search: searchQuery,
                    role: roleFilter !== 'ALL' ? roleFilter : undefined,
                    department_id: deptFilter !== 'ALL' ? parseInt(deptFilter) : undefined,
                    company: companyFilter !== 'ALL' ? companyFilter : undefined,
                    sort_by: sortBy,
                    sort_order: sortOrder
                });
                setUsers(res.items);
                setTotalPages(res.pages);
            } else if (activeTab === 'audit') {
                const res = await getAuditLogs(pageSize, (currentPage - 1) * pageSize, searchQuery);
                if (res.items) {
                    setAuditLogs(res.items);
                    setTotalPages(Math.ceil(res.total / pageSize));
                } else {
                    // Fallback if backend returns simple list
                    const logs = res as unknown as AuditLog[];
                    setAuditLogs(logs);
                    setTotalPages(1);
                }
            } else if (activeTab === 'departments') {
                const [deptRes, userRes] = await Promise.all([
                    getDepartments(),
                    getUsers({ page_size: 1000 })
                ]);
                setDepartments(deptRes);
                setUsers(userRes.items || []);
                setTotalPages(1);
            } else if (activeTab === 'projects') {
                const [projRes, userRes] = await Promise.all([
                    getAdminProjects(),
                    getUsers({ page_size: 1000 })
                ]);
                setProjects(projRes);
                setUsers(userRes.items || []);
                setTotalPages(1);
            }
        } catch (err) {
            console.error('Refresh error:', err);
        } finally {
            setLoading(false);
        }
    }, [activeTab, currentPage, pageSize, searchQuery, roleFilter, deptFilter, companyFilter, sortBy, sortOrder]);

    /** Открыть Odoo-модал и загрузить список проектов из CRM. */
    const handleOpenOdooModal = async () => {
        setIsOdooModalOpen(true);
        setOdooError('');
        setImportResult(null);
        setSelectedOdooIds(new Set());
        setOdooLoading(true);
        try {
            const data = await getOdooProjects();
            setOdooProjects(data.projects);
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ detail?: string }>;
            setOdooError(axiosError.response?.data?.detail || 'Ошибка подключения к Odoo CRM');
        } finally {
            setOdooLoading(false);
        }
    };

    /** Переключить выбор проекта в Odoo-модале. */
    const toggleOdooProject = (id: number) => {
        setSelectedOdooIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    /** Выбрать все / снять выбор. */
    const toggleSelectAll = () => {
        if (selectedOdooIds.size === odooProjects.length) {
            setSelectedOdooIds(new Set());
        } else {
            setSelectedOdooIds(new Set(odooProjects.map(p => p.odoo_id)));
        }
    };

    /** Запустить импорт выбранных проектов. */
    const handleImportSelected = async () => {
        const toImport = odooProjects
            .filter(p => selectedOdooIds.has(p.odoo_id))
            .map(p => ({
                odoo_id: p.odoo_id,
                name: p.name,
                code: p.code,
                manager_email: p.manager_email,
            }));
        if (!toImport.length) return;
        setImportLoading(true);
        try {
            const result = await importOdooProjects(toImport);
            setImportResult(result);
            refreshData();
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ detail?: string }>;
            setOdooError(axiosError.response?.data?.detail || 'Ошибка при импорте проектов');
        } finally {
            setImportLoading(false);
        }
    };

    /** Проверить статус интеграции Odoo при монтировании */
    useEffect(() => {
        getOdooStatus()
            .then(res => setIsOdooConfigured(res.configured))
            .catch(err => console.error('Error checking legacy Odoo status:', err));

        getOdooIntegrationStatus()
            .then(res => setIsOdooIntConfigured(res.configured))
            .catch(err => console.error('Error checking Odoo microservice status:', err));
    }, []);

    /** Загрузить проекты из микросервиса по выбранным полям. */
    const loadOdooIntProjects = async (fields: string[], search?: string) => {
        setOdooIntLoading(true);
        setOdooIntError('');
        try {
            // Обязательно запрашиваем 'id', 'name' и 'code', так как они нужны для работы интерфейса и импорта
            const queryFields = Array.from(new Set(['id', 'name', 'code', ...fields]));
            const trimmedSearch = search?.trim() || undefined;
            const data = await getOdooIntegrationProjects(queryFields, trimmedSearch, trimmedSearch);
            setOdooIntProjects(data);
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ detail?: string }>;
            setOdooIntError(axiosError.response?.data?.detail || 'Ошибка подключения к сервису Odoo CRM');
        } finally {
            setOdooIntLoading(false);
        }
    };

    /** Обновить список проектов (поиск производится на клиенте). */
    const handleOdooIntSearch = () => {
        loadOdooIntProjects(Array.from(selectedFields), odooIntSearch);
    };

    /** Открыть модал выгрузки Odoo. */
    const handleOpenOdooIntModal = () => {
        setIsOdooIntModalOpen(true);
        setOdooIntError('');
        setOdooIntImportResult(null);
        setSelectedOdooIntIds(new Set());
        setOdooIntSearch('');
        loadOdooIntProjects(Array.from(selectedFields), '');
    };

    /** Переключить выбор проекта в модале. */
    const toggleOdooIntProject = (id: number) => {
        setSelectedOdooIntIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    /** Переключить выбор поля для запроса. */
    const toggleFieldSelection = (field: string) => {
        // 'name' и 'code' обязательны для импорта, не позволяем их снимать
        if (field === 'name' || field === 'code') return;
        
        const next = new Set(selectedFields);
        if (next.has(field)) {
            next.delete(field);
        } else {
            next.add(field);
        }
        setSelectedFields(next);
        loadOdooIntProjects(Array.from(next), odooIntSearch);
    };

    /** Выбрать все отфильтрованные проекты / снять выбор. */
    const toggleSelectAllOdooInt = (filteredProjects: OdooIntegrationProject[]) => {
        const allSelected = filteredProjects.every(p => selectedOdooIntIds.has(p.id));
        setSelectedOdooIntIds(prev => {
            const next = new Set(prev);
            filteredProjects.forEach(p => {
                if (allSelected) {
                    next.delete(p.id);
                } else {
                    next.add(p.id);
                }
            });
            return next;
        });
    };

    /** Запустить импорт выбранных проектов из микросервиса. */
    const handleImportOdooIntSelected = async () => {
        const toImport = odooIntProjects
            .filter(p => selectedOdooIntIds.has(p.id))
            .map(p => ({
                id: p.id,
                name: p.name,
                code: p.code,
                status: p.status,
            }));
            
        if (!toImport.length) return;
        
        setOdooIntImportLoading(true);
        setOdooIntError('');
        try {
            const result = await importOdooIntegrationProjects(toImport);
            setOdooIntImportResult(result);
            refreshData();
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ detail?: string }>;
            setOdooIntError(axiosError.response?.data?.detail || 'Ошибка при импорте проектов');
        } finally {
            setOdooIntImportLoading(false);
        }
    };

    // Загрузка отделов для фильтра один раз
    useEffect(() => {
        getDepartments().then(setDepartments).catch(err => console.error(err));
    }, []);

    useEffect(() => {
        const checkAuth = async () => {
            const token = getAccessToken();
            if (!token) { navigate('/login'); return; }
            try {
                const res = await api.get('/auth/me');
                setCurrentUser(res.data);
                if (res.data.role !== 'admin') { navigate('/dashboard'); return; }
                setAuthChecked(true);
            } catch { navigate('/login'); }
        };
        checkAuth();
    }, [navigate]);

    useEffect(() => {
        if (authChecked) {
            Promise.resolve().then(() => {
                refreshData();
            });
        }
    }, [authChecked, refreshData]);

    const handleAdd = async () => {
        if (activeTab === 'users') {
            setEditUserData(null);
            setIsUserModalOpen(true);
        } else if (activeTab === 'departments') {
            const name = window.prompt('Название отдела:');
            if (name) {
                await createDepartment({ name });
                refreshData();
            }
        } else if (activeTab === 'projects') {
            setProjectForm({ name: '', code: '' });
            setProjectFormError('');
            setIsProjectModalOpen(true);
        }
    };

    /** Создать проект после прохождения валидации формы. */
    const handleSubmitProject = async () => {
        const { name, code } = projectForm;
        if (!name.trim()) { setProjectFormError('Введите название проекта'); return; }
        if (!PROJECT_CODE_RE.test(code.trim())) {
            setProjectFormError('Номер должен быть в формате ГГГГ-ННННН, например: 2026-00001');
            return;
        }
        setProjectFormLoading(true);
        try {
            await createProject({ name: name.trim(), code: code.trim() });
            setIsProjectModalOpen(false);
            refreshData();
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ detail?: string }>;
            setProjectFormError(axiosError.response?.data?.detail || 'Ошибка при создании проекта');
        } finally {
            setProjectFormLoading(false);
        }
    };

    const handleEditUser = (user: User) => {
        setEditUserData(user);
        setIsUserModalOpen(true);
    };

    const handleToggleStatus = (user: User) => {
        setConfirmInfo({
            title: 'Изменить статус?',
            message: `Вы действительно хотите ${user.is_active ? 'отключить' : 'активировать'} пользователя ${user.full_name}?`,
            type: 'warning'
        });
        setConfirmAction(() => async () => {
            setActionLoading(true);
            try {
                await updateUser(user.id, { is_active: !user.is_active });
                refreshData();
            } catch (err) {
                console.error(err);
            } finally {
                setActionLoading(false);
                setIsConfirmOpen(false);
            }
        });
        setIsConfirmOpen(true);
    };

    const handleResetPasswordAction = (id: number) => {
        setConfirmInfo({
            title: 'Сброс пароля',
            message: 'Пользователь получит временный пароль на почту. Продолжить?',
            type: 'info'
        });
        setConfirmAction(() => async () => {
            setActionLoading(true);
            try {
                const res = await resetUserPassword(id);
                alert(res.detail || 'Пароль сброшен успешно.');
            } catch (err: unknown) {
                const axiosError = err as AxiosError<{ detail?: string }>;
                alert('Ошибка: ' + (axiosError.response?.data?.detail || axiosError.message));
            } finally {
                setActionLoading(false);
                setIsConfirmOpen(false);
            }
        });
        setIsConfirmOpen(true);
    };

    const handleDeleteAction = (id: number, type: 'user' | 'dept' | 'project') => {
        setConfirmInfo({
            title: 'Удаление записи',
            message: 'Это действие необратимо. Продолжить?',
            type: 'danger'
        });
        setConfirmAction(() => async () => {
            setActionLoading(true);
            try {
                if (type === 'user') await deleteUser(id);
                if (type === 'dept') await deleteDepartment(id);
                if (type === 'project') await deleteProject(id);
                refreshData();
            } catch (err: unknown) {
                console.error(err);
                const axiosError = err as AxiosError<{ detail?: string }>;
                alert(axiosError.response?.data?.detail || 'Ошибка при удалении записи. Возможно, она связана с существующими переработками.');
            } finally {
                setActionLoading(false);
                setIsConfirmOpen(false);
            }
        });
        setIsConfirmOpen(true);
    };

    if (loading && currentPage === 1) return <div className="page-container"><Skeleton height={800} /></div>;

    return (
        <>
        <div className="page-container animate-fade-in">
            <ConfirmModal
                isOpen={isConfirmOpen}
                {...confirmInfo}
                onConfirm={confirmAction}
                onClose={() => setIsConfirmOpen(false)}
                loading={actionLoading}
            />
            <UserModal
                isOpen={isUserModalOpen}
                onClose={() => setIsUserModalOpen(false)}
                onSuccess={refreshData}
                editData={editUserData}
            />
            {isImportMSModalOpen && (
                <ImportMSUsersModal
                    isOpen={isImportMSModalOpen}
                    onClose={() => setIsImportMSModalOpen(false)}
                    onSuccess={refreshData}
                />
            )}

            {currentUser && <Header user={currentUser} />}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Система управления</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Администрирование пользователей, отделов и проектов организации.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button onClick={refreshData} className="secondary" style={{ padding: '0 11px', borderRadius: '12px' }}><RefreshCcw size={18} /></button>
                    <button onClick={() => setIsImportMSModalOpen(true)} className="secondary" style={{ color: 'var(--primary)', borderRadius: '12px' }}>
                        <Globe size={18} /> <span style={{ marginLeft: '8px' }}>Импорт MS</span>
                    </button>
                    <button onClick={handleAdd} className="primary">
                        <Plus size={18} /> <span style={{ marginLeft: '8px' }}>Добавить</span>
                    </button>
                </div>
            </div>

            <div className="glass-card scrollbar-hidden" style={{ padding: '8px', display: 'flex', gap: '8px', marginBottom: '32px', background: 'var(--bg-tertiary)', borderRadius: '12px', width: '100%', overflowX: 'auto' }}>
                {(['users', 'departments', 'projects', 'audit'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setCurrentPage(1); setSearchQuery(''); setSearchInput(''); }}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '10px',
                            background: activeTab === tab ? 'var(--bg-secondary)' : 'transparent',
                            color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            boxShadow: activeTab === tab ? 'var(--card-shadow)' : 'none',
                            fontSize: '0.85rem',
                            flexShrink: 0
                        }}
                    >
                        {tab === 'users' ? 'Пользователи' : tab === 'departments' ? 'Отделы' : tab === 'projects' ? 'Проекты' : 'История'}
                    </button>
                ))}
            </div>

            <div className="glass-card" style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '300px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                        <input
                            placeholder="Поиск..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    setSearchQuery(searchInput);
                                    setCurrentPage(1);
                                }
                            }}
                            style={{ paddingLeft: '40px' }}
                        />
                    </div>
                    <button
                        onClick={() => {
                            setSearchQuery(searchInput);
                            setCurrentPage(1);
                        }}
                        className="primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '10px 18px',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            whiteSpace: 'nowrap',
                            height: '42px'
                        }}
                    >
                        <Search size={15} />
                        Найти
                    </button>
                </div>
                {activeTab === 'users' && (
                    <>
                        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }} style={{ width: 'auto', flex: '1 1 150px' }}>
                            <option value="ALL">Все роли</option>
                            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }} style={{ width: 'auto', flex: '1 1 150px' }}>
                            <option value="ALL">Все отделы</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </>
                )}
            </div>

            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                {activeTab === 'users' && (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table-container" style={{ minWidth: '850px' }}>
                            <thead>
                                <tr>
                                    <th className="table-header" onClick={() => handleSort('full_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        Пользователь {renderSortIcon('full_name')}
                                    </th>
                                    <th className="table-header" onClick={() => handleSort('role')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        Роль / Компания {renderSortIcon('role')}
                                    </th>
                                    <th className="table-header" onClick={() => handleSort('department_id')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        Отдел {renderSortIcon('department_id')}
                                    </th>
                                    <th className="table-header" onClick={() => handleSort('is_active')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        Статус {renderSortIcon('is_active')}
                                    </th>
                                    <th className="table-header" style={{ textAlign: 'right' }}>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id}>
                                        <td className="table-cell">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div className="icon-shape" style={{ width: '36px', height: '36px', fontSize: '0.9rem', color: 'white', background: `linear-gradient(310deg, ${ROLE_COLORS[u.role] || '#2152ff'}, #21d4fd)` }}>
                                                    {u.full_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.full_name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="table-cell">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span className="badge badge-info" style={{ width: 'fit-content' }}>{ROLE_LABELS[u.role]}</span>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{COMPANY_LABELS[u.company ?? ''] ?? u.company}</span>
                                            </div>
                                        </td>
                                        <td className="table-cell">
                                            {departments.find(d => d.id === u.department_id)?.name || '—'}
                                        </td>
                                        <td className="table-cell">
                                            <div onClick={() => handleToggleStatus(u)} className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`} style={{ cursor: 'pointer' }}>
                                                {u.is_active ? 'Активен' : 'Отключен'}
                                            </div>
                                        </td>
                                        <td className="table-cell" style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => handleEditUser(u)} className="action-button-modern" title="Редактировать"><Edit2 size={16} /></button>
                                                <button onClick={() => handleResetPasswordAction(u.id)} className="action-button-modern" title="Сбросить пароль"><Key size={16} /></button>
                                                <button onClick={() => handleDeleteAction(u.id, 'user')} className="action-button-modern delete" title="Удалить"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'departments' && (
                    <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {departments.map(d => (
                            <div key={d.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                        <div className="icon-shape" style={{ width: '48px', height: '48px', background: 'var(--bg-tertiary)', color: 'var(--primary)', borderRadius: '12px', flexShrink: 0 }}><Building2 size={24} /></div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 800, fontSize: '1.1rem', wordBreak: 'break-word' }}>{d.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ID: {d.id}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                        <button onClick={() => { setEditDeptId(d.id); setEditDeptName(d.name); }} className="action-button-modern" title="Редактировать"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDeleteAction(d.id, 'dept')} className="action-button-modern delete" title="Удалить"><Trash2 size={16} /></button>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Начальник отдела</label>
                                    <select
                                        value={d.head_id || ''}
                                        onChange={(e) => updateDepartment(d.id, { head_id: e.target.value ? Number(e.target.value) : null }).then(refreshData)}
                                        style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                                    >
                                        <option value="">Не назначен</option>
                                        {(Array.isArray(users) ? users : []).filter(u => u.role === 'head' || u.role === 'admin').map(u => (
                                            <option key={u.id} value={u.id}>{u.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'projects' && (
                    <div style={{ padding: '16px 24px 0', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {isOdooConfigured && (
                            <button
                                onClick={handleOpenOdooModal}
                                className="secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '10px 20px', fontWeight: 700 }}
                            >
                                <Download size={16} />
                                Импорт из Odoo CRM (XML-RPC)
                            </button>
                        )}
                        {isOdooIntConfigured && (
                            <button
                                onClick={handleOpenOdooIntModal}
                                className="primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', padding: '10px 20px', fontWeight: 700 }}
                            >
                                <Globe size={16} />
                                Выгрузка Odoo (API)
                            </button>
                        )}
                    </div>
                )}

                {activeTab === 'projects' && (
                    <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {projects.map(p => (
                            <div key={p.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                        <div className="icon-shape" style={{ width: '48px', height: '48px', background: 'var(--bg-tertiary)', color: p.is_active ? 'var(--info)' : 'var(--text-muted)', borderRadius: '12px', flexShrink: 0 }}><Briefcase size={24} /></div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 800, fontSize: '1.1rem', wordBreak: 'break-word', color: p.is_active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{p.name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.05em', userSelect: 'all', cursor: 'default' }} title="Номер проекта нельзя изменить после создания">{p.code || '—'}</span>
                                                <span 
                                                    onClick={() => updateProject(p.id, { is_active: !p.is_active }).then(refreshData)}
                                                    className={`badge ${p.is_active ? 'badge-success' : 'badge-danger'}`} 
                                                    style={{ cursor: 'pointer', fontSize: '0.65rem', padding: '2px 8px', lineHeight: 'normal' }}
                                                    title="Нажмите, чтобы изменить статус проекта"
                                                >
                                                    {p.is_active ? 'Активен' : 'Архив'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                        <button onClick={() => { setEditProjectId(p.id); setEditProjectName(p.name); setEditProjectActive(p.is_active ?? true); }} className="action-button-modern" title="Редактировать"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDeleteAction(p.id, 'project')} className="action-button-modern delete" title="Удалить"><Trash2 size={16} /></button>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Менеджер проекта</label>
                                        <select
                                            value={p.manager_id || ''}
                                            onChange={(e) => updateProject(p.id, { manager_id: e.target.value ? Number(e.target.value) : null }).then(refreshData)}
                                            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                                        >
                                            <option value="">Не назначен</option>
                                            {(Array.isArray(users) ? users : []).filter(u => u.role === 'manager' || u.role === 'admin').map(u => (
                                                <option key={u.id} value={u.id}>{u.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Лимит (ч/нед)</label>
                                        <input
                                            type="number"
                                            value={localLimits[p.id] ?? p.weekly_limit}
                                            onChange={e => setLocalLimits(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                                            onBlur={async e => {
                                                const val = Number(e.target.value);
                                                if (val !== p.weekly_limit && val > 0) {
                                                    await updateProject(p.id, { weekly_limit: val });
                                                    refreshData();
                                                }
                                            }}
                                            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'audit' && (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table-container" style={{ minWidth: '700px' }}>
                            <thead>
                                <tr>
                                    <th className="table-header">Дата</th>
                                    <th className="table-header">Кто</th>
                                    <th className="table-header">Действие</th>
                                    <th className="table-header">Объект</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="table-cell" style={{ fontSize: '0.8rem' }}>{formatDateTime(log.timestamp)}</td>
                                        <td className="table-cell" style={{ fontWeight: 600 }}>{log.user?.full_name || 'System'}</td>
                                        <td className="table-cell"><span className="badge badge-info">{log.action}</span></td>
                                        <td className="table-cell" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.target_type} ({log.target_id})</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {totalPages > 1 && (activeTab === 'users' || activeTab === 'audit') && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', marginTop: '32px', paddingBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Строк на странице:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                            style={{ padding: '4px 12px', width: 'auto', borderRadius: '100px', fontSize: '0.8rem', fontWeight: 600 }}
                        >
                            {[10, 20, 50, 100, 1000].map(v => (
                                <option key={v} value={v}>{v === 1000 ? 'Все' : v}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="secondary" style={{ padding: '6px 16px' }}>Назад</button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px', fontWeight: 700, fontSize: '0.9rem' }}>{currentPage} / {totalPages}</div>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="secondary" style={{ padding: '6px 16px' }}>Далее</button>
                    </div>
                </div>
            )}
        </div>

            {/* Модал создания проекта с валидацией формата кода */}
            {isProjectModalOpen && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, backdropFilter: 'blur(4px)'
                }}>
                    <div className="glass-card" style={{ width: '440px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Новый проект</h3>
                            <button onClick={() => setIsProjectModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.5rem', lineHeight: 1 }}>×</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Номер проекта <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input
                                type="text"
                                placeholder="2026-00001"
                                maxLength={10}
                                value={projectForm.code}
                                onChange={(e) => {
                                    setProjectFormError('');
                                    setProjectForm(f => ({ ...f, code: e.target.value }));
                                }}
                                style={{ fontFamily: 'monospace', letterSpacing: '0.1em', fontSize: '1rem' }}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                                Формат: ГГГГ-ННННН (например, 2026-00001). <strong>После создания изменить нельзя.</strong>
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Название проекта <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input
                                type="text"
                                placeholder="Разработка модуля аналитики"
                                value={projectForm.name}
                                onChange={(e) => {
                                    setProjectFormError('');
                                    setProjectForm(f => ({ ...f, name: e.target.value }));
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitProject(); }}
                            />
                        </div>

                        {projectFormError && (
                            <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600 }}>
                                {projectFormError}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                            <button
                                onClick={handleSubmitProject}
                                className="primary"
                                disabled={projectFormLoading}
                                style={{ flex: 1 }}
                            >
                                {projectFormLoading ? 'Создание...' : 'Создать проект'}
                            </button>
                            <button
                                onClick={() => setIsProjectModalOpen(false)}
                                style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== Odoo CRM Модал импорта ==================== */}
            {isOdooModalOpen && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1100, backdropFilter: 'blur(6px)'
                }}>
                    <div className="glass-card" style={{
                        width: '680px', maxWidth: '95vw', maxHeight: '85vh',
                        display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden'
                    }}>
                        {/* Заголовок */}
                        <div style={{
                            padding: '24px 28px 20px', borderBottom: '1px solid var(--border)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'var(--bg-secondary)'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                                    Импорт проектов из Odoo CRM
                                </h3>
                                {!odooLoading && !odooError && odooProjects.length > 0 && (
                                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        Найдено проектов: <strong>{odooProjects.length}</strong> · Выбрано: <strong>{selectedOdooIds.size}</strong>
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setIsOdooModalOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                            >
                                <XIcon size={22} />
                            </button>
                        </div>

                        {/* Тело */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px' }}>
                            {odooLoading && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px' }}>
                                    <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Подключение к Odoo CRM...</p>
                                </div>
                            )}

                            {odooError && !odooLoading && (
                                <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 600 }}>
                                    ⚠️ {odooError}
                                </div>
                            )}

                            {/* Результат импорта */}
                            {importResult && (
                                <div style={{ marginBottom: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(34,197,94,0.08)', border: '1px solid var(--success)' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: '8px' }}>
                                        ✅ Импорт завершён
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        Импортировано: <strong>{importResult.imported}</strong> · Пропущено (дубликаты): <strong>{importResult.skipped}</strong>
                                    </div>
                                    {importResult.errors.length > 0 && (
                                        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--warning)' }}>
                                            {importResult.errors.map((e, i) => <div key={i}>⚠️ {e}</div>)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {!odooLoading && !odooError && odooProjects.length > 0 && (
                                <>
                                    {/* Строка «Выбрать все» */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedOdooIds.size === odooProjects.length}
                                            onChange={toggleSelectAll}
                                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                                        />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={toggleSelectAll}>
                                            {selectedOdooIds.size === odooProjects.length ? 'Снять всё' : 'Выбрать все'}
                                        </span>
                                    </div>

                                    {/* Список проектов */}
                                    {odooProjects.map(p => (
                                        <div
                                            key={p.odoo_id}
                                            onClick={() => toggleOdooProject(p.odoo_id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                padding: '12px', borderRadius: '10px', cursor: 'pointer',
                                                background: selectedOdooIds.has(p.odoo_id) ? 'rgba(59,130,246,0.07)' : 'transparent',
                                                border: `1px solid ${selectedOdooIds.has(p.odoo_id) ? 'var(--accent)' : 'transparent'}`,
                                                marginBottom: '6px', transition: 'all 0.15s'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedOdooIds.has(p.odoo_id)}
                                                onChange={() => toggleOdooProject(p.odoo_id)}
                                                onClick={e => e.stopPropagation()}
                                                style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', flexShrink: 0 }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {p.name}
                                                </div>
                                                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                    {p.code && (
                                                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                                                            {p.code}
                                                        </span>
                                                    )}
                                                    {!p.code && (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--warning)', fontStyle: 'italic' }}>
                                                            Без кода
                                                        </span>
                                                    )}
                                                    {p.manager_name && (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            👤 {p.manager_name}
                                                            {p.manager_email && <span style={{ color: 'var(--text-muted)', opacity: 0.7 }}> ({p.manager_email})</span>}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                                                #{p.odoo_id}
                                            </span>
                                        </div>
                                    ))}
                                </>
                            )}

                            {!odooLoading && !odooError && odooProjects.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    <Download size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                    <p>Проекты в Odoo не найдены или Odoo не настроен</p>
                                </div>
                            )}
                        </div>

                        {/* Футер с кнопками */}
                        <div style={{
                            padding: '16px 28px', borderTop: '1px solid var(--border)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'var(--bg-secondary)', gap: '12px'
                        }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {selectedOdooIds.size > 0
                                    ? `Выбрано ${selectedOdooIds.size} из ${odooProjects.length} проектов`
                                    : 'Выберите проекты для импорта'}
                            </span>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setIsOdooModalOpen(false)}
                                    style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}
                                >
                                    Закрыть
                                </button>
                                <button
                                    onClick={handleImportSelected}
                                    disabled={selectedOdooIds.size === 0 || importLoading}
                                    className="primary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    {importLoading ? (
                                        <>Импорт...</>
                                    ) : (
                                        <><Download size={16} /> Импортировать ({selectedOdooIds.size})</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== Odoo CRM Выгрузка (API) Модал ==================== */}
            {isOdooIntModalOpen && (() => {
                const filteredProjects = odooIntProjects.filter(p => {
                    const search = odooIntSearch.toLowerCase().trim();
                    if (!search) return true;
                    const nameMatch = p.name ? p.name.toLowerCase().includes(search) : false;
                    const codeMatch = p.code ? p.code.toLowerCase().includes(search) : false;
                    return nameMatch || codeMatch;
                });

                const allFilteredSelected = filteredProjects.length > 0 && filteredProjects.every(p => selectedOdooIntIds.has(p.id));

                return (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1100, backdropFilter: 'blur(6px)'
                    }}>
                        <div className="glass-card" style={{
                            width: '800px', maxWidth: '95vw', maxHeight: '90vh',
                            display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden'
                        }}>
                            {/* Заголовок */}
                            <div style={{
                                padding: '24px 28px 20px', borderBottom: '1px solid var(--border)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: 'var(--bg-secondary)'
                            }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                                        Выгрузка проектов из Odoo CRM (API)
                                    </h3>
                                    {!odooIntLoading && !odooIntError && odooIntProjects.length > 0 && (
                                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            Всего проектов: <strong>{odooIntProjects.length}</strong> · Отфильтровано: <strong>{filteredProjects.length}</strong> · Выбрано: <strong>{selectedOdooIntIds.size}</strong>
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setIsOdooIntModalOpen(false)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                                >
                                    <XIcon size={22} />
                                </button>
                            </div>

                            {/* Панель фильтров и полей */}
                            {!odooIntLoading && !odooIntError && (
                                <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* Выбор полей */}
                                    <div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                            Выбор полей для выгрузки из Odoo:
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                            {[
                                                { id: 'name', label: 'Имя проекта', required: true },
                                                { id: 'code', label: 'Код проекта', required: true },
                                                { id: 'status', label: 'Статус', required: false },
                                                { id: 'project_amount', label: 'Сумма', required: false },
                                                { id: 'partner', label: 'Клиент', required: false },
                                                { id: 'partner_company', label: 'Компания клиента', required: false },
                                                { id: 'project_manager_ids', label: 'Менеджеры', required: false },
                                            ].map(f => {
                                                const isSelected = f.required || selectedFields.has(f.id);
                                                return (
                                                    <label
                                                        key={f.id}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '6px',
                                                            fontSize: '0.8rem', fontWeight: 600, padding: '4px 10px',
                                                            borderRadius: '8px', background: isSelected ? 'rgba(59,130,246,0.1)' : 'var(--bg-secondary)',
                                                            border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                                                            cursor: f.required ? 'not-allowed' : 'pointer',
                                                            opacity: f.required ? 0.7 : 1,
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            disabled={f.required}
                                                            onChange={() => toggleFieldSelection(f.id)}
                                                            style={{ accentColor: 'var(--accent)' }}
                                                        />
                                                        {f.label}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Текстовый поиск с кнопкой */}
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <div style={{ position: 'relative', flex: 1 }}>
                                            <input
                                                type="text"
                                                value={odooIntSearch}
                                                onChange={e => setOdooIntSearch(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleOdooIntSearch()}
                                                placeholder="Поиск по названию или номеру проекта..."
                                                style={{
                                                    width: '100%', padding: '10px 16px 10px 42px',
                                                    borderRadius: '10px', border: '1px solid var(--border)',
                                                    background: 'var(--bg-secondary)', color: 'var(--text-main)',
                                                    fontSize: '0.85rem', boxSizing: 'border-box'
                                                }}
                                            />
                                            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                        </div>
                                        <button
                                            onClick={handleOdooIntSearch}
                                            disabled={odooIntLoading}
                                            className="primary"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '10px 18px', borderRadius: '10px',
                                                fontWeight: 700, fontSize: '0.85rem',
                                                whiteSpace: 'nowrap', flexShrink: 0
                                            }}
                                        >
                                            <Search size={15} />
                                            Найти
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Тело со списком проектов */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px' }}>
                                {odooIntLoading && (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px' }}>
                                        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Загрузка проектов из Odoo CRM API...</p>
                                    </div>
                                )}

                                {odooIntError && !odooIntLoading && (
                                    <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 600 }}>
                                        ⚠️ {odooIntError}
                                    </div>
                                )}

                                {/* Результат импорта */}
                                {odooIntImportResult && (
                                    <div style={{ marginBottom: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(34,197,94,0.08)', border: '1px solid var(--success)' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: '8px' }}>
                                            ✅ Импорт успешно завершён
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            Создано проектов: <strong>{odooIntImportResult.imported}</strong> · Пропущено (уже существуют): <strong>{odooIntImportResult.skipped}</strong>
                                        </div>
                                        {odooIntImportResult.errors.length > 0 && (
                                            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--warning)' }}>
                                                {odooIntImportResult.errors.map((e, i) => <div key={i}>⚠️ {e}</div>)}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!odooIntLoading && !odooIntError && filteredProjects.length > 0 && (
                                    <>
                                        {/* Строка «Выбрать все» */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
                                            <input
                                                type="checkbox"
                                                checked={allFilteredSelected}
                                                onChange={() => toggleSelectAllOdooInt(filteredProjects)}
                                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                                            />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => toggleSelectAllOdooInt(filteredProjects)}>
                                                {allFilteredSelected ? 'Снять выделение со всех отфильтрованных' : 'Выбрать все отфильтрованные'}
                                            </span>
                                        </div>

                                        {/* Список проектов */}
                                        {filteredProjects.map(p => {
                                            const isSelected = selectedOdooIntIds.has(p.id);
                                            return (
                                                <div
                                                    key={p.id}
                                                    onClick={() => toggleOdooIntProject(p.id)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '16px',
                                                        padding: '14px 16px', borderRadius: '10px', cursor: 'pointer',
                                                        background: isSelected ? 'rgba(59,130,246,0.07)' : 'transparent',
                                                        border: `1px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                                                        marginBottom: '6px', transition: 'all 0.15s'
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleOdooIntProject(p.id)}
                                                        onClick={e => e.stopPropagation()}
                                                        style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', flexShrink: 0 }}
                                                    />
                                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {p.name}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                {p.code && (
                                                                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                                                                        {p.code}
                                                                    </span>
                                                                )}
                                                                {!p.code && (
                                                                    <span style={{ fontSize: '0.75rem', color: 'var(--warning)', fontStyle: 'italic' }}>
                                                                        Без кода
                                                                    </span>
                                                                )}
                                                                {/* Дополнительные поля в зависимости от выбора */}
                                                                {selectedFields.has('partner') && p.partner && (
                                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                        🤝 Клиент: <strong>{Array.isArray(p.partner) ? p.partner[1] : (typeof p.partner === 'object' ? p.partner.name : p.partner)}</strong>
                                                                    </span>
                                                                )}
                                                                {selectedFields.has('partner_company') && p.partner_company && (
                                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                        🏢 Компания: <strong>{Array.isArray(p.partner_company) ? p.partner_company[1] : (typeof p.partner_company === 'object' ? p.partner_company.name : p.partner_company)}</strong>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Блок с дополнительной информацией справа */}
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                                                            {selectedFields.has('status') && p.status && (
                                                                <span style={{
                                                                    fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase',
                                                                    padding: '2px 6px', borderRadius: '6px',
                                                                    background: p.status === 'worked' || p.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)',
                                                                    color: p.status === 'worked' || p.status === 'active' ? 'var(--success)' : 'var(--text-muted)'
                                                                }}>
                                                                    {p.status}
                                                                </span>
                                                            )}
                                                            {selectedFields.has('project_amount') && p.project_amount !== undefined && (
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                                    {new Intl.NumberFormat('ru-RU').format(p.project_amount ?? 0)} ₸
                                                                </span>
                                                            )}
                                                            {selectedFields.has('project_manager_ids') && Array.isArray(p.project_manager_ids) && p.project_manager_ids.length > 0 && (
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                                    PM: {p.project_manager_ids.join(', ')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                                                        #{p.id}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}

                                {!odooIntLoading && !odooIntError && filteredProjects.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        <Globe size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                        <p>Проекты с такими параметрами не найдены в Odoo CRM API</p>
                                    </div>
                                )}
                            </div>

                            {/* Футер с кнопками */}
                            <div style={{
                                padding: '16px 28px', borderTop: '1px solid var(--border)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: 'var(--bg-secondary)', gap: '12px'
                            }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {selectedOdooIntIds.size > 0
                                        ? `Выбрано ${selectedOdooIntIds.size} из ${filteredProjects.length} отфильтрованных`
                                        : 'Выберите проекты для добавления'}
                                </span>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={() => setIsOdooIntModalOpen(false)}
                                        style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}
                                    >
                                        Закрыть
                                    </button>
                                    <button
                                        onClick={handleImportOdooIntSelected}
                                        disabled={selectedOdooIntIds.size === 0 || odooIntImportLoading}
                                        className="primary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        {odooIntImportLoading ? (
                                            <>Импорт...</>
                                        ) : (
                                            <><Plus size={16} /> Добавить выбранные ({selectedOdooIntIds.size})</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Модал редактирования отдела */}
            {editDeptId !== null && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, backdropFilter: 'blur(4px)'
                }}>
                    <div className="glass-card" style={{ width: '440px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Редактировать отдел</h3>
                            <button onClick={() => setEditDeptId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.5rem', lineHeight: 1 }}>×</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Название отдела <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input
                                type="text"
                                value={editDeptName}
                                onChange={(e) => setEditDeptName(e.target.value)}
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                        if (editDeptName.trim()) {
                                            await updateDepartment(editDeptId, { name: editDeptName.trim() });
                                            refreshData();
                                            setEditDeptId(null);
                                        }
                                    }
                                }}
                                autoFocus
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                            <button
                                onClick={async () => {
                                    if (editDeptName.trim()) {
                                        await updateDepartment(editDeptId, { name: editDeptName.trim() });
                                        refreshData();
                                        setEditDeptId(null);
                                    }
                                }}
                                className="primary"
                                style={{ flex: 1, justifyContent: 'center' }}
                            >
                                Сохранить
                            </button>
                            <button
                                onClick={() => setEditDeptId(null)}
                                className="secondary"
                                style={{ flex: 1, justifyContent: 'center' }}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модал редактирования проекта */}
            {editProjectId !== null && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, backdropFilter: 'blur(4px)'
                }}>
                    <div className="glass-card" style={{ width: '440px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Редактировать проект</h3>
                            <button onClick={() => setEditProjectId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.5rem', lineHeight: 1 }}>×</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Название проекта <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input
                                type="text"
                                value={editProjectName}
                                onChange={(e) => setEditProjectName(e.target.value)}
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                        if (editProjectName.trim()) {
                                            await updateProject(editProjectId, { name: editProjectName.trim(), is_active: editProjectActive });
                                            refreshData();
                                            setEditProjectId(null);
                                        }
                                    }
                                }}
                                autoFocus
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                            <input
                                type="checkbox"
                                id="edit-project-active"
                                checked={editProjectActive}
                                onChange={(e) => setEditProjectActive(e.target.checked)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                            />
                            <label htmlFor="edit-project-active" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                Проект активен
                            </label>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                            <button
                                onClick={async () => {
                                    if (editProjectName.trim()) {
                                        await updateProject(editProjectId, { name: editProjectName.trim(), is_active: editProjectActive });
                                        refreshData();
                                        setEditProjectId(null);
                                    }
                                }}
                                className="primary"
                                style={{ flex: 1, justifyContent: 'center' }}
                            >
                                Сохранить
                            </button>
                            <button
                                onClick={() => setEditProjectId(null)}
                                className="secondary"
                                style={{ flex: 1, justifyContent: 'center' }}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default UsersPage;
