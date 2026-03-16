import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users as UsersIcon, Building2, FolderKanban,
    Shield, Search, Filter, Edit2, Key, Trash2, Plus, CheckCircle2, XCircle, User as UserIcon, X, Activity, Clock, ExternalLink, Globe, UserPlus, ShieldCheck
} from 'lucide-react';
import api, {
    getUsers,
    getDepartments,
    getProjects,
    updateUser,
    resetUserPassword,
    deleteUser,
    updateDepartment,
    deleteDepartment,
    updateProject,
    deleteProject,
    createUser,
    createDepartment,
    createProject,
    getAuditLogs
} from '../../services/api';
import Header from '../layout/Header';
import Skeleton from '../common/Skeleton';
import ImportMSUsersModal from '../modals/ImportMSUsersModal';

const ROLE_LABELS: Record<string, string> = {
    admin: 'Администратор',
    head: 'Начальник отдела',
    manager: 'Менеджер проектов',
    employee: 'Сотрудник'
};

const ROLE_COLORS: Record<string, string> = {
    admin: '#7c3aed', // Purple
    head: '#2563eb',  // Blue
    manager: '#0891b2', // Cyan
    employee: '#64748b' // Slate
};

const ACTION_LABELS: Record<string, string> = {
    'LOGIN': 'Вход в систему',
    'REVIEW_ADMIN': 'Решение администратора',
    'REVIEW_MANAGER': 'Решение менеджера',
    'REVIEW_HEAD': 'Решение начальника',
    'CANCEL_OVERTIME': 'Отмена заявки',
    'CREATE_USER': 'Создание пользователя',
    'UPDATE_USER': 'Изменение профиля',
    'RESET_PASSWORD': 'Сброс пароля',
    'CHANGE_PASSWORD': 'Смена пароля',
    'CREATE_DEPT': 'Создание отдела',
    'UPDATE_DEPT': 'Изменение отдела',
    'CREATE_PROJECT': 'Создание проекта',
    'UPDATE_PROJECT': 'Изменение проекта',
    'IMPORT_USER_MS': 'Импорт из Office 365'
};

const UsersPage: React.FC = () => {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'projects' | 'audit'>('users');
    const [searchQuery, setSearchQuery] = useState('');
    const [isImportMSModalOpen, setIsImportMSModalOpen] = useState(false);
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [sortConfig, setSortConfig] = useState<{ field: 'name' | 'dept', direction: 'asc' | 'desc' }>({ field: 'name', direction: 'asc' });

    const [users, setUsers] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'user' | 'dept' | 'project' | null>(null);
    const [editData, setEditData] = useState<any>(null);

    const refreshData = async () => {
        try {
            const [usersData, deptsData, projectsData, auditData] = await Promise.all([
                getUsers(),
                getDepartments(),
                getProjects().catch(() => []),
                getAuditLogs().catch(() => [])
            ]);
            setUsers(usersData);
            setDepartments(deptsData);
            setProjects(projectsData);
            setAuditLogs(auditData);
        } catch (err) {
            console.error('Failed to refresh data:', err);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) { navigate('/login'); return; }
                const meRes = await api.get('/auth/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setCurrentUser(meRes.data);
                await refreshData();
            } catch {
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [navigate]);

    const handleEditUser = (user: any) => {
        setModalType('user');
        setEditData({ ...user });
        setIsModalOpen(true);
    };

    const handleEditDept = (dept: any) => {
        setModalType('dept');
        setEditData({ ...dept });
        setIsModalOpen(true);
    };

    const handleEditProject = (proj: any) => {
        setModalType('project');
        setEditData({ ...proj });
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        if (activeTab === 'users') {
            setModalType('user');
            setEditData({ email: '', full_name: '', role: 'employee', department_id: null, is_active: true });
        } else if (activeTab === 'departments') {
            setModalType('dept');
            setEditData({ name: '', head_id: null });
        } else if (activeTab === 'projects') {
            setModalType('project');
            setEditData({ name: '', manager_id: currentUser?.id || null, weekly_limit: 50 });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            if (modalType === 'user') {
                if (editData.id) {
                    await updateUser(editData.id, {
                        full_name: editData.full_name,
                        role: editData.role,
                        department_id: editData.department_id ? parseInt(editData.department_id) : null,
                        is_active: editData.is_active
                    });
                } else {
                    await createUser({ ...editData, password: 'changeme123' });
                }
            } else if (modalType === 'dept') {
                if (editData.id) {
                    await updateDepartment(editData.id, {
                        name: editData.name,
                        head_id: editData.head_id ? parseInt(editData.head_id) : null
                    });
                } else {
                    await createDepartment({
                        name: editData.name,
                        head_id: editData.head_id ? parseInt(editData.head_id) : null
                    });
                }
            } else if (modalType === 'project') {
                if (editData.id) {
                    await updateProject(editData.id, {
                        name: editData.name,
                        manager_id: editData.manager_id ? parseInt(editData.manager_id) : null,
                        weekly_limit: editData.weekly_limit ? parseInt(editData.weekly_limit) : 50
                    });
                } else {
                    await createProject({
                        name: editData.name,
                        manager_id: editData.manager_id ? Number(editData.manager_id) : undefined,
                        weekly_limit: editData.weekly_limit ? parseInt(editData.weekly_limit) : 50
                    });
                }
            }
            await refreshData();
            setIsModalOpen(false);
            setEditData(null);
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Ошибка сохранения');
        }
    };

    const handleResetPasswordAction = async (userId: number) => {
        if (!confirm('Вы уверены, что хотите сбросить пароль этого пользователя? Пароль будет установлен в "changeme123"')) return;
        try {
            const res = await resetUserPassword(userId);
            alert(res.detail || 'Пароль сброшен');
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Ошибка при сбросе пароля');
        }
    };

    const handleToggleStatus = async (user: any) => {
        try {
            await updateUser(user.id, { is_active: !user.is_active });
            await refreshData();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Ошибка при изменении статуса');
        }
    };

    const handleDeleteAction = async (id: number, type: 'user' | 'dept' | 'project') => {
        let msg = 'Это действие нельзя отменить. Продолжить?';
        if (type === 'user') msg = 'ВЫ УВЕРЕНЫ? Пользователь будет полностью удален из системы.';
        if (!confirm(msg)) return;

        try {
            if (type === 'user') await deleteUser(id);
            if (type === 'dept') await deleteDepartment(id);
            if (type === 'project') await deleteProject(id);
            await refreshData();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Ошибка при удалении');
        }
    };

    if (loading) return (
        <div className="page-container">
            <div style={{ height: '60px', marginBottom: '40px' }}><Skeleton height={60} /></div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
                <Skeleton height={48} width={120} /><Skeleton height={48} width={120} />
                <Skeleton height={48} width={120} /><Skeleton height={48} width={120} />
            </div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                <Skeleton height={52} style={{ flex: 1 }} />
                <Skeleton height={52} width={200} />
                <Skeleton height={52} width={200} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} height={200} borderRadius={20} />)}
            </div>
        </div>
    );

    const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));

    const filteredUsers = users
        .filter(u => {
            const matchesSearch = u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.email.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
            const matchesDept = deptFilter === 'ALL' || u.department_id === parseInt(deptFilter);
            return matchesSearch && matchesRole && matchesDept;
        })
        .sort((a, b) => {
            if (sortConfig.field === 'name') {
                const nameA = a.full_name || '';
                const nameB = b.full_name || '';
                return sortConfig.direction === 'asc'
                    ? nameA.localeCompare(nameB, 'ru')
                    : nameB.localeCompare(nameA, 'ru');
            } else {
                const deptA = deptMap[a.department_id] || '';
                const deptB = deptMap[b.department_id] || '';
                return sortConfig.direction === 'asc'
                    ? deptA.localeCompare(deptB, 'ru')
                    : deptB.localeCompare(deptA, 'ru');
            }
        });

    const filteredDepts = departments.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredAuditLogs = auditLogs.filter(log =>
        log.user_full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.target_type?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button
            onClick={() => { setActiveTab(id); setSearchQuery(''); }}
            style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                borderRadius: '14px', border: 'none', cursor: 'pointer',
                background: activeTab === id ? 'var(--accent)' : 'transparent',
                color: activeTab === id ? 'white' : 'var(--text-secondary)',
                fontWeight: 600, fontSize: '0.95rem', transition: 'all 0.2s',
                fontFamily: 'inherit'
            }}
        >
            <Icon size={18} /> {label}
        </button>
    );

    return (
        <div className="page-container animate-fade-in">
            <Header user={currentUser} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '8px' }}>Управление системой</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Конфигурация пользователей, организационной структуры и проектов.</p>
                </div>
                <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '6px', borderRadius: '18px', border: '1px solid var(--border)' }}>
                    <TabButton id="users" label="Пользователи" icon={UsersIcon} />
                    <TabButton id="departments" label="Отделы" icon={Building2} />
                    <TabButton id="projects" label="Проекты" icon={FolderKanban} />
                    <TabButton id="audit" label="История" icon={Activity} />
                </div>
            </div>

            {/* Dashboard Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
                <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', padding: '12px', borderRadius: '12px' }}>
                        <UsersIcon size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Всего пользователей</p>
                        <h4 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{users.length}</h4>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '12px', borderRadius: '12px' }}>
                        <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Активные аккаунты</p>
                        <h4 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{users.filter(u => u.is_active).length}</h4>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', padding: '12px', borderRadius: '12px' }}>
                        <Building2 size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Отделы</p>
                        <h4 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{departments.length}</h4>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ background: 'rgba(8, 145, 178, 0.1)', color: '#0891b2', padding: '12px', borderRadius: '12px' }}>
                        <FolderKanban size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Проекты</p>
                        <h4 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{projects.length}</h4>
                    </div>
                </div>
            </div>

            {/* List Toolbar */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        placeholder={`Поиск по ${activeTab === 'users' ? 'имени или email' : 'названию'}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', paddingLeft: '52px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', height: '52px' }}
                    />
                </div>

                {activeTab === 'users' && (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Filter size={18} style={{ position: 'absolute', left: '16px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            style={{
                                padding: '0 24px 0 44px', borderRadius: '14px', border: '1px solid var(--border)',
                                background: 'var(--bg-secondary)', color: 'var(--text-primary)', height: '52px',
                                fontWeight: 600, cursor: 'pointer', outline: 'none', width: '220px'
                            }}
                        >
                            <option value="ALL">Все роли</option>
                            <option value="admin">Администраторы</option>
                            <option value="head">Начальники</option>
                            <option value="manager">Менеджеры</option>
                            <option value="employee">Сотрудники</option>
                        </select>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Building2 size={18} style={{ position: 'absolute', left: '16px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <select
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                            style={{
                                padding: '0 24px 0 44px', borderRadius: '14px', border: '1px solid var(--border)',
                                background: 'var(--bg-secondary)', color: 'var(--text-primary)', height: '52px',
                                fontWeight: 600, cursor: 'pointer', outline: 'none', width: '220px'
                            }}
                        >
                            <option value="ALL">Все отделы</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Clock size={18} style={{ position: 'absolute', left: '16px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <select
                            value={`${sortConfig.field}_${sortConfig.direction}`}
                            onChange={(e) => {
                                const [field, dir] = e.target.value.split('_');
                                setSortConfig({ field: field as any, direction: dir as any });
                            }}
                            style={{
                                padding: '0 24px 0 44px', borderRadius: '14px', border: '1px solid var(--border)',
                                background: 'var(--bg-secondary)', color: 'var(--text-primary)', height: '52px',
                                fontWeight: 600, cursor: 'pointer', outline: 'none', width: '220px'
                            }}
                        >
                            <option value="name_asc">Имя (А-Я)</option>
                            <option value="name_desc">Имя (Я-А)</option>
                            <option value="dept_asc">Отдел (А-Я)</option>
                            <option value="dept_desc">Отдел (Я-А)</option>
                        </select>
                    </div>
                )}

                <button
                    onClick={() => setIsImportMSModalOpen(true)}
                    className="secondary"
                    style={{
                        width: 'auto', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 24px',
                        background: 'rgba(79, 70, 229, 0.1)', color: 'var(--accent)', border: '1px solid var(--accent)'
                    }}
                >
                    <Globe size={18} /> Импорт MS
                </button>

                <button onClick={handleAdd} className="primary" style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 24px' }}>
                    <Plus size={20} /> Добавить
                </button>
            </div>

            {/* Content Table / Grid */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden', border: 'none', background: 'transparent' }}>
                {activeTab === 'users' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {filteredUsers.map((u: any) => (
                            <div key={u.id} className="glass-card animate-scale-in" style={{
                                padding: '24px 32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'transform 0.2s',
                                border: '1px solid var(--border)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 2 }}>
                                    <div style={{
                                        width: '56px', height: '56px', borderRadius: '16px',
                                        background: `linear-gradient(135deg, ${ROLE_COLORS[u.role] || 'var(--accent)'}, #1e40af)`,
                                        color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 800, fontSize: '1.25rem', boxShadow: '0 8px 16px -4px rgba(0,0,0,0.2)'
                                    }}>
                                        {u.full_name?.charAt(0) || u.email.charAt(0)}
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            alignItems: 'center',
                                            gap: '8px 12px',
                                            marginBottom: '4px'
                                        }}>
                                            <h4 style={{
                                                fontWeight: 800,
                                                fontSize: '1.1rem',
                                                lineHeight: 1.2,
                                                wordBreak: 'break-word'
                                            }}>{u.full_name}</h4>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '2px 10px',
                                                borderRadius: '8px',
                                                background: `${ROLE_COLORS[u.role]}15`,
                                                color: ROLE_COLORS[u.role],
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                border: `1px solid ${ROLE_COLORS[u.role]}30`,
                                                whiteSpace: 'nowrap',
                                                flexShrink: 0
                                            }}>
                                                <Shield size={10} />
                                                {ROLE_LABELS[u.role] || u.role}
                                            </span>
                                            {u.is_2fa_enabled && (
                                                <span title="2FA Включена" style={{
                                                    fontSize: '0.65rem',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    background: 'rgba(34, 197, 94, 0.1)',
                                                    color: '#22c55e',
                                                    fontWeight: 800,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    border: '1px solid rgba(34, 197, 94, 0.2)'
                                                }}>
                                                    <ShieldCheck size={10} /> 2FA
                                                </span>
                                            )}
                                        </div>
                                        <p style={{
                                            color: 'var(--text-secondary)',
                                            fontSize: '0.9rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>{u.email}</p>
                                    </div>
                                </div>

                                <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600 }}>
                                        <Building2 size={16} style={{ color: 'var(--text-muted)' }} />
                                        {departments.find(d => d.id === u.department_id)?.name || 'Без отдела'}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                        Регистрация: {new Date(u.created_at).toLocaleDateString()}
                                    </div>
                                </div>

                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
                                    <div
                                        onClick={() => handleToggleStatus(u)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '8px 16px', borderRadius: '12px',
                                            cursor: 'pointer',
                                            background: u.is_active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: u.is_active ? '#22c55e' : '#ef4444',
                                            fontWeight: 700, fontSize: '0.85rem',
                                            transition: 'all 0.2s',
                                            border: `1px solid ${u.is_active ? '#22c55e40' : '#ef444440'}`
                                        }}
                                    >
                                        {u.is_active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                        {u.is_active ? 'Активен' : 'Отключен'}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flex: 1 }}>
                                    <button onClick={() => handleEditUser(u)} className="action-button-modern">
                                        <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => handleResetPasswordAction(u.id)} className="action-button-modern">
                                        <Key size={18} />
                                    </button>
                                    <button onClick={() => handleDeleteAction(u.id, 'user')} className="action-button-modern delete">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'departments' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                        {filteredDepts.map((d: any) => {
                            const head = users.find(u => u.id === d.head_id);
                            return (
                                <div key={d.id} className="glass-card animate-scale-in" style={{ padding: '24px', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ padding: '10px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', borderRadius: '10px' }}>
                                                <Building2 size={20} />
                                            </div>
                                            <h4 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{d.name}</h4>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => handleEditDept(d)} className="action-button-modern"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDeleteAction(d.id, 'dept')} className="action-button-modern delete"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '12px' }}>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Руководитель</p>
                                        {head ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                                                    {head.full_name?.charAt(0)}
                                                </div>
                                                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{head.full_name}</span>
                                            </div>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>Не назначен</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'projects' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                        {filteredProjects.map((p: any) => {
                            const manager = users.find(u => u.id === p.manager_id);
                            return (
                                <div key={p.id} className="glass-card animate-scale-in" style={{ padding: '24px', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ padding: '10px', background: 'rgba(8, 145, 178, 0.1)', color: '#0891b2', borderRadius: '10px' }}>
                                                <FolderKanban size={20} />
                                            </div>
                                            <h4 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{p.name}</h4>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => handleEditProject(p)} className="action-button-modern"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDeleteAction(p.id, 'project')} className="action-button-modern delete"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '12px' }}>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Менеджер проекта</p>
                                        {manager ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                                                    {manager.full_name?.charAt(0)}
                                                </div>
                                                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{manager.full_name}</span>
                                            </div>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>Не назначен</span>
                                        )}
                                    </div>
                                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        <Clock size={14} />
                                        Лимит: <b>{p.weekly_limit}ч / нед</b>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'audit' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filteredAuditLogs.length === 0 ? (
                            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Clock size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
                                <p>История действий пуста</p>
                            </div>
                        ) : (
                            filteredAuditLogs.map((log: any) => {
                                const getTargetName = () => {
                                    if (!log.details) return `ID: ${log.target_id}`;
                                    return log.details.description || log.details.name || log.details.email || log.details.full_name || `ID: ${log.target_id}`;
                                };

                                const handleLink = () => {
                                    if (log.target_type === 'overtime') {
                                        navigate(`/review?search=${log.target_id}`);
                                        return;
                                    }
                                    if (log.target_type === 'user') {
                                        setActiveTab('users');
                                        setSearchQuery(log.details?.email || log.target_id.toString());
                                    } else if (log.target_type === 'department') {
                                        setActiveTab('departments');
                                        setSearchQuery(log.details?.name || log.target_id.toString());
                                    } else if (log.target_type === 'project') {
                                        setActiveTab('projects');
                                        setSearchQuery(log.details?.name || log.target_id.toString());
                                    }
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                };

                                return (
                                    <div key={log.id} className="glass-card animate-scale-in audit-row" style={{
                                        padding: '16px 24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg-secondary)',
                                        transition: 'all 0.2s'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 2 }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '10px',
                                                background: 'rgba(30, 64, 175, 0.1)', color: 'var(--accent)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <Activity size={20} />
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
                                                    {ACTION_LABELS[log.action] || log.action}
                                                </p>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                    Инициатор: <span style={{ color: 'var(--text-secondary)' }}>{log.user_full_name}</span>
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ flex: 1.5, display: 'flex', justifyContent: 'center' }}>
                                            {log.target_type && (
                                                <button
                                                    onClick={handleLink}
                                                    className="audit-link-btn"
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '8px',
                                                        fontSize: '0.85rem', padding: '8px 14px', borderRadius: '10px',
                                                        background: 'var(--bg-tertiary)', color: 'var(--accent)',
                                                        fontWeight: 700, border: '1px solid var(--border)',
                                                        cursor: 'pointer', transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {getTargetName()}
                                                    </span>
                                                    <ExternalLink size={14} />
                                                </button>
                                            )}
                                        </div>

                                        <div style={{ flex: 1, textAlign: 'right' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
                                                <Clock size={14} />
                                                {new Date(log.created_at).toLocaleString('ru', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && editData && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '24px'
                }}>
                    <div className="glass-card animate-scale-in" style={{
                        maxWidth: '500px', width: '100%', padding: '40px', position: 'relative'
                    }}>
                        <button
                            onClick={() => setIsModalOpen(false)}
                            style={{
                                position: 'absolute', right: '24px', top: '24px', padding: '8px',
                                background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer'
                            }}
                        >
                            <X size={24} />
                        </button>

                        <h3 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em' }}>
                            {editData.id ? 'Редактировать' : 'Добавить'}
                            {modalType === 'user' && ' пользователя'}
                            {modalType === 'dept' && ' отдел'}
                            {modalType === 'project' && ' проект'}
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {modalType === 'user' && (
                                <>
                                    {!editData.id && (
                                        <div className="input-group">
                                            <label>Email</label>
                                            <input
                                                type="email"
                                                value={editData.email}
                                                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                                placeholder="example@corp.com"
                                            />
                                        </div>
                                    )}
                                    <div className="input-group">
                                        <label>ФИО Сотрудника</label>
                                        <input
                                            value={editData.full_name}
                                            onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                                            placeholder="Иванов Иван Иванович"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Роль в системе</label>
                                        <select
                                            value={editData.role}
                                            onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                                        >
                                            <option value="employee">Сотрудник</option>
                                            <option value="manager">Менеджер проектов</option>
                                            <option value="head">Начальник отдела</option>
                                            <option value="admin">Администратор</option>
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>Подразделение (Отдел)</label>
                                        <select
                                            value={editData.department_id || ''}
                                            onChange={(e) => setEditData({ ...editData, department_id: e.target.value || null })}
                                        >
                                            <option value="">Не назначен</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                        <input
                                            type="checkbox"
                                            checked={editData.is_active}
                                            onChange={(e) => setEditData({ ...editData, is_active: e.target.checked })}
                                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontWeight: 600 }}>Активный аккаунт</span>
                                    </div>
                                </>
                            )}

                            {modalType === 'dept' && (
                                <>
                                    <div className="input-group">
                                        <label>Название отдела</label>
                                        <input
                                            value={editData.name}
                                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                            placeholder="Напр. Отдел разработки"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Руководитель отдела</label>
                                        <select
                                            value={editData.head_id || ''}
                                            onChange={(e) => setEditData({ ...editData, head_id: e.target.value || null })}
                                        >
                                            <option value="">Не назначен</option>
                                            {users.filter(u => u.role === 'head' || u.role === 'admin').map(u => (
                                                <option key={u.id} value={u.id}>{u.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            {modalType === 'project' && (
                                <>
                                    <div className="input-group">
                                        <label>Название проекта</label>
                                        <input
                                            value={editData.name}
                                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                            placeholder="Напр. Переработка CRM"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Менеджер проекта</label>
                                        <select
                                            value={editData.manager_id || ''}
                                            onChange={(e) => setEditData({ ...editData, manager_id: e.target.value || null })}
                                        >
                                            <option value="">Не назначен</option>
                                            {users.filter(u => u.role === 'manager' || u.role === 'admin' || u.role === 'head').map(u => (
                                                <option key={u.id} value={u.id}>{u.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>Недельный лимит часов</label>
                                        <input
                                            type="number"
                                            value={editData.weekly_limit}
                                            onChange={(e) => setEditData({ ...editData, weekly_limit: e.target.value })}
                                            placeholder="Напр. 50"
                                        />
                                        <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                                            Суммарная переработка по проекту за неделю.
                                        </small>
                                    </div>
                                </>
                            )}

                            <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                                <button className="primary" onClick={handleSave} style={{ width: '100%' }}>
                                    Сохранить изменения
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    style={{
                                        width: '120px',
                                        padding: '12px',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '14px',
                                        fontWeight: 600
                                    }}
                                >
                                    Отмена
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )
            }

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Показано {activeTab === 'users' ? filteredUsers.length : activeTab === 'departments' ? filteredDepts.length : filteredProjects.length} записей.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer' }}>Назад</button>
                    <button style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer' }}>Вперед</button>
                </div>
            </div>
            <ImportMSUsersModal
                isOpen={isImportMSModalOpen}
                onClose={() => setIsImportMSModalOpen(false)}
                onSuccess={(count) => {
                    alert(`Успешно импортировано пользователей: ${count}`);
                    refreshData();
                }}
            />
        </div >
    );
};

export default UsersPage;