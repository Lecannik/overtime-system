import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Search, Edit2, Key, Trash2, Plus, Globe, RefreshCcw, Briefcase
} from 'lucide-react';
import api, {
    getUsers, getDepartments, getProjects, getAuditLogs, updateUser, resetUserPassword,
    deleteUser, deleteDepartment, deleteProject, createDepartment, createProject,
    updateDepartment, updateProject
} from '../../services/api';
import Header from '../layout/Header';
import Skeleton from '../common/Skeleton';
import ImportMSUsersModal from '../modals/ImportMSUsersModal';
import UserModal from '../modals/UserModal';
import ConfirmModal from '../modals/ConfirmModal';
import { ROLE_LABELS, COMPANY_LABELS, ROLE_COLORS } from '../../constants/locale';

const UsersPage: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'projects' | 'audit'>('users');
    const [users, setUsers] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [companyFilter] = useState('ALL');

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    const [isImportMSModalOpen, setIsImportMSModalOpen] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<() => void>(() => { });
    const [confirmInfo, setConfirmInfo] = useState({ title: '', message: '', type: 'warning' as any });

    const [editUserData, setEditUserData] = useState<any>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const refreshData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'users') {
                const res = await getUsers({
                    page: currentPage,
                    page_size: pageSize,
                    search: searchQuery,
                    role: roleFilter !== 'ALL' ? roleFilter : undefined,
                    department_id: deptFilter !== 'ALL' ? parseInt(deptFilter) : undefined,
                    company: companyFilter !== 'ALL' ? companyFilter : undefined
                });
                setUsers(res.items);
                setTotalPages(res.pages);
            } else if (activeTab === 'audit') {
                const res = await getAuditLogs(pageSize, (currentPage - 1) * pageSize);
                // Если бэкенд возвращает {items, total}, используем это
                if (res.items) {
                    setAuditLogs(res.items);
                    setTotalPages(Math.ceil(res.total / pageSize));
                } else {
                    setAuditLogs(res);
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
                    getProjects(),
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
    };

    // Загрузка отделов для фильтра один раз
    useEffect(() => {
        getDepartments().then(setDepartments);
    }, []);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (!token) { navigate('/login'); return; }
            try {
                const res = await api.get('/auth/me');
                setCurrentUser(res.data);
                if (res.data.role !== 'admin') { navigate('/dashboard'); return; }
                refreshData();
            } catch { navigate('/login'); }
        };
        checkAuth();
    }, [currentPage, pageSize, searchQuery, roleFilter, deptFilter, companyFilter, activeTab, navigate]);

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
            const name = window.prompt('Название проекта:');
            if (name) {
                await createProject({ name });
                refreshData();
            }
        }
    };

    const handleEditUser = (user: any) => {
        setEditUserData(user);
        setIsUserModalOpen(true);
    };

    const handleToggleStatus = (user: any) => {
        setConfirmInfo({
            title: 'Изменить статус?',
            message: `Вы действительно хотите ${user.is_active ? 'отключить' : 'активировать'} пользователя ${user.full_name}?`,
            type: 'warning'
        });
        setConfirmAction(() => async () => {
            setActionLoading(true);
            await updateUser(user.id, { is_active: !user.is_active });
            setActionLoading(false);
            setIsConfirmOpen(false);
            refreshData();
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
            } catch (err: any) {
                alert('Ошибка: ' + (err.response?.data?.detail || err.message));
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
            if (type === 'user') await deleteUser(id);
            if (type === 'dept') await deleteDepartment(id);
            if (type === 'project') await deleteProject(id);
            setActionLoading(false);
            setIsConfirmOpen(false);
            refreshData();
        });
        setIsConfirmOpen(true);
    };

    if (loading && currentPage === 1) return <div className="page-container"><Skeleton height={800} /></div>;

    return (
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

            <Header user={currentUser} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Система управления</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Администрирование пользователей, отделов и проектов организации.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={refreshData} className="secondary" style={{ padding: '0 11px', borderRadius: '12px' }}><RefreshCcw size={18} /></button>
                    <button onClick={() => setIsImportMSModalOpen(true)} className="secondary" style={{ color: 'var(--primary)', borderRadius: '12px' }}>
                        <Globe size={18} /> <span style={{ marginLeft: '8px' }}>Импорт MS</span>
                    </button>
                    <button onClick={handleAdd} className="primary">
                        <Plus size={18} /> <span style={{ marginLeft: '8px' }}>Добавить</span>
                    </button>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '8px', display: 'flex', gap: '8px', marginBottom: '32px', background: 'var(--bg-tertiary)', borderRadius: '12px', width: 'fit-content' }}>
                {(['users', 'departments', 'projects', 'audit'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '10px',
                            background: activeTab === tab ? 'var(--bg-secondary)' : 'transparent',
                            color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            boxShadow: activeTab === tab ? 'var(--card-shadow)' : 'none',
                            fontSize: '0.85rem'
                        }}
                    >
                        {tab === 'users' ? 'Пользователи' : tab === 'departments' ? 'Отделы' : tab === 'projects' ? 'Проекты' : 'История'}
                    </button>
                ))}
            </div>

            <div className="glass-card" style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                    <input
                        placeholder="Поиск..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        style={{ paddingLeft: '40px' }}
                    />
                </div>
                {activeTab === 'users' && (
                    <>
                        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }} style={{ width: 'auto' }}>
                            <option value="ALL">Все роли</option>
                            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }} style={{ width: 'auto' }}>
                            <option value="ALL">Все отделы</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </>
                )}
            </div>

            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                {activeTab === 'users' && (
                    <table className="table-container">
                        <thead>
                            <tr>
                                <th className="table-header">Пользователь</th>
                                <th className="table-header">Роль / Компания</th>
                                <th className="table-header">Отдел</th>
                                <th className="table-header">Статус</th>
                                <th className="table-header" style={{ textAlign: 'right' }}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u: any) => (
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
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{COMPANY_LABELS[u.company]}</span>
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
                )}

                {activeTab === 'departments' && (
                    <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                        {departments.map(d => (
                            <div key={d.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div className="icon-shape" style={{ width: '48px', height: '48px', background: 'var(--bg-tertiary)', color: 'var(--primary)', borderRadius: '12px' }}><Building2 size={24} /></div>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{d.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ID: {d.id}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => {
                                            const n = window.prompt('Имя отдела:', d.name);
                                            if (n && n !== d.name) updateDepartment(d.id, { name: n }).then(refreshData);
                                        }} className="action-button-modern"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDeleteAction(d.id, 'dept')} className="action-button-modern delete"><Trash2 size={16} /></button>
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
                    <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
                        {projects.map(p => (
                            <div key={p.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div className="icon-shape" style={{ width: '48px', height: '48px', background: 'var(--bg-tertiary)', color: 'var(--info)', borderRadius: '12px' }}><Briefcase size={24} /></div>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{p.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Проект организации</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => {
                                            const n = window.prompt('Имя проекта:', p.name);
                                            if (n && n !== p.name) updateProject(p.id, { name: n }).then(refreshData);
                                        }} className="action-button-modern"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDeleteAction(p.id, 'project')} className="action-button-modern delete"><Trash2 size={16} /></button>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
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
                                            value={p.weekly_limit}
                                            onChange={(e) => updateProject(p.id, { weekly_limit: Number(e.target.value) }).then(refreshData)}
                                            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'audit' && (
                    <table className="table-container">
                        <thead>
                            <tr>
                                <th className="table-header">Дата</th>
                                <th className="table-header">Кто</th>
                                <th className="table-header">Действие</th>
                                <th className="table-header">Объект</th>
                            </tr>
                        </thead>
                        <tbody>
                            {auditLogs.map((log: any) => (
                                <tr key={log.id}>
                                    <td className="table-cell" style={{ fontSize: '0.8rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                    <td className="table-cell" style={{ fontWeight: 600 }}>{log.user?.full_name || 'System'}</td>
                                    <td className="table-cell"><span className="badge badge-info">{log.action}</span></td>
                                    <td className="table-cell" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.target_type} ({log.target_id})</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
    );
};

export default UsersPage;