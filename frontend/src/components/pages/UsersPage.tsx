import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Globe, RefreshCcw } from 'lucide-react';
import {
    getUsers,
    getDepartments,
    getAdminProjects,
    updateUser,
    resetUserPassword,
    deleteUser,
    deleteDepartment,
    deleteProject,
    createDepartment,
    updateDepartment,
    updateProject,
    getOdooStatus,
    getOdooIntegrationStatus,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { User, Department, Project } from '../../types';
import Header from '../layout/Header';
import Skeleton from '../common/Skeleton';
import ImportMSUsersModal from '../modals/ImportMSUsersModal';
import UserModal from '../modals/UserModal';
import ConfirmModal from '../modals/ConfirmModal';
import { DepartmentsTab } from './admin/DepartmentsTab';
import { ProjectsTab } from './admin/ProjectsTab';
import { AuditTab } from './admin/AuditTab';
import { OdooImportModal } from './admin/OdooImportModal';
import { OdooIntegrationModal } from './admin/OdooIntegrationModal';
import { CreateProjectModal } from './admin/CreateProjectModal';
import { UserFilters } from './users/UserFilters';
import { UsersTable } from './users/UsersTable';
import { ROLE_LABELS, COMPANY_LABELS, ROLE_COLORS } from '../../constants/locale';
import { AxiosError } from 'axios';

/**
 * Главная страница администрирования системы.
 *
 * Управляет пользователями, отделами, проектами и журналом аудита.
 * Поддерживает интеграцию с Microsoft Graph и Odoo CRM.
 */
const UsersPage: React.FC = () => {
    const navigate = useNavigate();
    const { user: authUser, token, refreshUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'projects' | 'audit'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [authChecked, setAuthChecked] = useState(false);
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [deptFilter, setDeptFilter] = useState<string | number>('ALL');
    const [companyFilter] = useState('ALL');

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [sortBy, setSortBy] = useState<string>('id');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    // Модальные окна
    const [isImportMSModalOpen, setIsImportMSModalOpen] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isOdooModalOpen, setIsOdooModalOpen] = useState(false);
    const [isOdooIntModalOpen, setIsOdooIntModalOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
    const [confirmInfo, setConfirmInfo] = useState<{
        title: string;
        message: string;
        type: 'warning' | 'danger' | 'info';
    }>({ title: '', message: '', type: 'warning' });

    const [editUserData, setEditUserData] = useState<User | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Инлайн редактирование отдела
    const [editDeptId, setEditDeptId] = useState<number | null>(null);
    const [editDeptName, setEditDeptName] = useState('');

    // Инлайн редактирование проекта
    const [editProjectId, setEditProjectId] = useState<number | null>(null);
    const [editProjectName, setEditProjectName] = useState('');
    const [editProjectActive, setEditProjectActive] = useState(true);

    // Статусы доступности интеграций Odoo
    const [isOdooConfigured, setIsOdooConfigured] = useState(false);
    const [isOdooIntConfigured, setIsOdooIntConfigured] = useState(false);

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
        setCurrentPage(1);
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
                    department_id: deptFilter !== 'ALL' ? parseInt(String(deptFilter)) : undefined,
                    company: companyFilter !== 'ALL' ? companyFilter : undefined,
                    sort_by: sortBy,
                    sort_order: sortOrder,
                });
                setUsers(res.items);
                setTotalPages(res.pages);
            } else if (activeTab === 'departments') {
                const [deptRes, userRes] = await Promise.all([
                    getDepartments(),
                    getUsers({ page_size: 1000 }),
                ]);
                setDepartments(deptRes);
                setUsers(userRes.items || []);
                setTotalPages(1);
            } else if (activeTab === 'projects') {
                const [projRes, userRes] = await Promise.all([
                    getAdminProjects(),
                    getUsers({ page_size: 1000 }),
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

    useEffect(() => {
        getOdooStatus()
            .then((res) => setIsOdooConfigured(res.configured))
            .catch((err) => console.error('Error checking legacy Odoo status:', err));

        getOdooIntegrationStatus()
            .then((res) => setIsOdooIntConfigured(res.configured))
            .catch((err) => console.error('Error checking Odoo microservice status:', err));
    }, []);

    useEffect(() => {
        getDepartments().then(setDepartments).catch((err) => console.error(err));
    }, []);

    useEffect(() => {
        const checkAuth = async () => {
            if (!token) {
                navigate('/login');
                return;
            }
            try {
                const curUser = authUser || (await refreshUser());
                if (!curUser) {
                    navigate('/login');
                    return;
                }
                setCurrentUser(curUser);
                if (curUser.role !== 'admin') {
                    navigate('/dashboard');
                    return;
                }
                setAuthChecked(true);
            } catch {
                navigate('/login');
            }
        };
        checkAuth();
    }, [navigate, token, authUser, refreshUser]);

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
            setIsProjectModalOpen(true);
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
            type: 'warning',
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
            type: 'info',
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
            type: 'danger',
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

    if (loading && currentPage === 1) {
        return (
            <div className="page-container">
                <Skeleton height={800} />
            </div>
        );
    }

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
                <ImportMSUsersModal
                    isOpen={isImportMSModalOpen}
                    onClose={() => setIsImportMSModalOpen(false)}
                    onSuccess={refreshData}
                />
                <CreateProjectModal
                    isOpen={isProjectModalOpen}
                    onClose={() => setIsProjectModalOpen(false)}
                    onSuccess={refreshData}
                />
                <OdooImportModal
                    isOpen={isOdooModalOpen}
                    onClose={() => setIsOdooModalOpen(false)}
                    onSuccess={refreshData}
                />
                <OdooIntegrationModal
                    isOpen={isOdooIntModalOpen}
                    onClose={() => setIsOdooIntModalOpen(false)}
                    onSuccess={refreshData}
                />

                {currentUser && <Header user={currentUser} />}

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '16px',
                        marginBottom: '32px',
                    }}
                >
                    <div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Система управления</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Администрирование пользователей, отделов и проектов организации.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button onClick={refreshData} className="secondary" style={{ padding: '0 11px', borderRadius: '12px' }}>
                            <RefreshCcw size={18} />
                        </button>
                        <button
                            onClick={() => setIsImportMSModalOpen(true)}
                            className="secondary"
                            style={{ color: 'var(--primary)', borderRadius: '12px' }}
                        >
                            <Globe size={18} /> <span style={{ marginLeft: '8px' }}>Импорт MS</span>
                        </button>
                        <button onClick={handleAdd} className="primary">
                            <Plus size={18} /> <span style={{ marginLeft: '8px' }}>Добавить</span>
                        </button>
                    </div>
                </div>

                <div
                    className="glass-card scrollbar-hidden"
                    style={{
                        padding: '8px',
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '32px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '12px',
                        width: '100%',
                        overflowX: 'auto',
                    }}
                >
                    {(['users', 'departments', 'projects', 'audit'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => {
                                setActiveTab(tab);
                                setCurrentPage(1);
                                setSearchQuery('');
                                setSearchInput('');
                            }}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '10px',
                                background: activeTab === tab ? 'var(--bg-secondary)' : 'transparent',
                                color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                                fontWeight: 600,
                                boxShadow: activeTab === tab ? 'var(--card-shadow)' : 'none',
                                fontSize: '0.85rem',
                                flexShrink: 0,
                            }}
                        >
                            {tab === 'users' ? 'Пользователи' : tab === 'departments' ? 'Отделы' : tab === 'projects' ? 'Проекты' : 'История'}
                        </button>
                    ))}
                </div>

                {activeTab === 'users' && (
                    <>
                        <UserFilters
                            searchInput={searchInput}
                            onSearchInputChange={setSearchInput}
                            onSearchSubmit={() => {
                                setSearchQuery(searchInput);
                                setCurrentPage(1);
                            }}
                            roleFilter={roleFilter}
                            onRoleFilterChange={(role) => {
                                setRoleFilter(role);
                                setCurrentPage(1);
                            }}
                            deptFilter={deptFilter}
                            onDeptFilterChange={(dept) => {
                                setDeptFilter(dept);
                                setCurrentPage(1);
                            }}
                            departments={departments}
                            roleLabels={ROLE_LABELS}
                        />

                        <UsersTable
                            users={users}
                            departments={departments}
                            roleLabels={ROLE_LABELS}
                            roleColors={ROLE_COLORS}
                            companyLabels={COMPANY_LABELS}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onSort={handleSort}
                            onEditUser={handleEditUser}
                            onToggleStatus={handleToggleStatus}
                            onResetPassword={handleResetPasswordAction}
                            onDeleteUser={(id) => handleDeleteAction(id, 'user')}
                            currentPage={currentPage}
                            totalPages={totalPages}
                            pageSize={pageSize}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={setPageSize}
                        />
                    </>
                )}

                {activeTab === 'departments' && (
                    <DepartmentsTab
                        departments={departments}
                        users={users}
                        searchQuery={searchQuery}
                        onRefresh={refreshData}
                        onEdit={(d) => {
                            setEditDeptId(d.id);
                            setEditDeptName(d.name);
                        }}
                        onDelete={(id) => handleDeleteAction(id, 'dept')}
                        onAdd={handleAdd}
                    />
                )}

                {activeTab === 'projects' && (
                    <ProjectsTab
                        projects={projects}
                        users={users}
                        searchQuery={searchQuery}
                        isOdooConfigured={isOdooConfigured}
                        isOdooIntConfigured={isOdooIntConfigured}
                        onOpenOdooModal={() => setIsOdooModalOpen(true)}
                        onOpenOdooIntModal={() => setIsOdooIntModalOpen(true)}
                        onOpenAddProjectModal={handleAdd}
                        onEdit={(p) => {
                            setEditProjectId(p.id);
                            setEditProjectName(p.name);
                            setEditProjectActive(p.is_active ?? true);
                        }}
                        onDelete={(id) => handleDeleteAction(id, 'project')}
                        onRefresh={refreshData}
                    />
                )}

                {activeTab === 'audit' && (
                    <AuditTab
                        searchQuery={searchQuery}
                        onSearchChange={(q) => {
                            setSearchQuery(q);
                            setSearchInput(q);
                        }}
                    />
                )}
            </div>

            {/* Модал редактирования отдела */}
            {editDeptId !== null && (
                <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setEditDeptId(null)}>
                    <div
                        className="modal-content glass-card animate-scale-in"
                        style={{ maxWidth: '440px', width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Редактировать отдел</h3>
                            <button
                                onClick={() => setEditDeptId(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.5rem', lineHeight: 1 }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                Название отдела <span style={{ color: 'var(--danger)' }}>*</span>
                            </label>
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

                        <div className="modal-footer-responsive" style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
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
                <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setEditProjectId(null)}>
                    <div
                        className="modal-content glass-card animate-scale-in"
                        style={{ maxWidth: '440px', width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Редактировать проект</h3>
                            <button
                                onClick={() => setEditProjectId(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.5rem', lineHeight: 1 }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                Название проекта <span style={{ color: 'var(--danger)' }}>*</span>
                            </label>
                            <input
                                type="text"
                                value={editProjectName}
                                onChange={(e) => setEditProjectName(e.target.value)}
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                        if (editProjectName.trim()) {
                                            await updateProject(editProjectId, {
                                                name: editProjectName.trim(),
                                                is_active: editProjectActive,
                                            });
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
                            <label
                                htmlFor="edit-project-active"
                                style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                                Проект активен
                            </label>
                        </div>

                        <div className="modal-footer-responsive" style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                            <button
                                onClick={async () => {
                                    if (editProjectName.trim()) {
                                        await updateProject(editProjectId, {
                                            name: editProjectName.trim(),
                                            is_active: editProjectActive,
                                        });
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
