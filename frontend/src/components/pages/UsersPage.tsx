import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users as UsersIcon, Building2, FolderKanban,
    Shield, Search, Filter, Edit2, Key, Trash2, Plus, CheckCircle2, XCircle, User as UserIcon, X
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
    createProject
} from '../../services/api';
import Header from '../layout/Header';

const ROLE_LABELS: Record<string, string> = {
    admin: 'Администратор',
    head: 'Начальник отдела',
    manager: 'Менеджер проектов',
    employee: 'Сотрудник'
};

const UsersPage: React.FC = () => {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'projects'>('users');
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');

    const [users, setUsers] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'user' | 'dept' | 'project' | null>(null);
    const [editData, setEditData] = useState<any>(null);

    const refreshData = async () => {
        try {
            const [usersData, deptsData, projectsData] = await Promise.all([
                getUsers(), getDepartments(), getProjects().catch(() => [])
            ]);
            setUsers(usersData);
            setDepartments(deptsData);
            setProjects(projectsData);
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
            setEditData({ name: '', manager_id: currentUser?.id || null });
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
                        manager_id: editData.manager_id ? parseInt(editData.manager_id) : null
                    });
                } else {
                    await createProject({
                        name: editData.name,
                        manager_id: editData.manager_id ? Number(editData.manager_id) : undefined
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
        if (!confirm('Вы уверены, что хотите сбросить пароль этого пользователя?')) return;
        try {
            const res = await resetUserPassword(userId);
            alert(res.detail || 'Пароль сброшен');
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Ошибка при сбросе пароля');
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
        <div className="page-container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
            <div className="loading-bar" style={{ width: '40%' }}></div>
        </div>
    );

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const filteredDepts = departments.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
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

                <button onClick={handleAdd} className="primary" style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 28px' }}>
                    <Plus size={20} /> Добавить
                </button>
            </div>

            {/* Content Table / Grid */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                {activeTab === 'users' && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: 'var(--bg-tertiary)' }}>
                            <tr>
                                <th style={{ padding: '20px 32px', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Сотрудник</th>
                                <th style={{ padding: '20px 32px', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Роль и Статус</th>
                                <th style={{ padding: '20px 32px', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Подразделение</th>
                                <th style={{ padding: '20px 32px', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((u: any) => (
                                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                                    <td style={{ padding: '20px 32px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{
                                                width: '44px', height: '44px', borderRadius: '12px', background: 'var(--accent)', color: 'white',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem'
                                            }}>
                                                {u.full_name?.charAt(0) || u.email.charAt(0)}
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '2px' }}>{u.full_name}</p>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '20px 32px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.9rem' }}>
                                                <Shield size={14} style={{ color: 'var(--accent)' }} />
                                                {ROLE_LABELS[u.role] || u.role}
                                            </div>
                                            <div style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700,
                                                color: u.is_active ? 'var(--success)' : 'var(--danger)'
                                            }}>
                                                {u.is_active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                {u.is_active ? 'Активен' : 'Отключен'}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '20px 32px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                                            <Building2 size={16} />
                                            {departments.find(d => d.id === u.department_id)?.name || 'Не назначен'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '20px 32px' }}>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button onClick={() => handleEditUser(u)} style={{
                                                padding: '8px', borderRadius: '10px', border: '1px solid var(--border)',
                                                background: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer'
                                            }}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleResetPasswordAction(u.id)} style={{
                                                padding: '8px', borderRadius: '10px', border: '1px solid var(--border)',
                                                background: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer'
                                            }}>
                                                <Key size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteAction(u.id, 'user')} style={{
                                                padding: '8px', borderRadius: '10px', border: '1px solid var(--border)',
                                                background: 'var(--bg-primary)', color: 'var(--danger)', cursor: 'pointer'
                                            }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {activeTab === 'departments' && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: 'var(--bg-tertiary)' }}>
                            <tr>
                                <th style={{ padding: '20px 32px', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Название отдела</th>
                                <th style={{ padding: '20px 32px', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Руководитель</th>
                                <th style={{ padding: '20px 32px', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDepts.map((d: any) => {
                                const head = users.find(u => u.id === d.head_id);
                                return (
                                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '20px 32px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <Building2 size={20} style={{ color: 'var(--accent)' }} />
                                                <span style={{ fontWeight: 700 }}>{d.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px 32px' }}>
                                            {head ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <UserIcon size={16} style={{ color: 'var(--text-muted)' }} />
                                                    <span style={{ fontWeight: 600 }}>{head.full_name}</span>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Не назначен</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '20px 32px' }}>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <button onClick={() => handleEditDept(d)} style={{ padding: '8px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                                                <button onClick={() => handleDeleteAction(d.id, 'dept')} style={{ padding: '8px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                {activeTab === 'projects' && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: 'var(--bg-tertiary)' }}>
                            <tr>
                                <th style={{ padding: '20px 32px', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Название проекта</th>
                                <th style={{ padding: '20px 32px', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Менеджер</th>
                                <th style={{ padding: '20px 32px', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProjects.map((p: any) => {
                                const manager = users.find(u => u.id === p.manager_id);
                                return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '20px 32px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <FolderKanban size={20} style={{ color: 'var(--accent)' }} />
                                                <span style={{ fontWeight: 700 }}>{p.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px 32px' }}>
                                            {manager ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <UserIcon size={16} style={{ color: 'var(--text-muted)' }} />
                                                    <span style={{ fontWeight: 600 }}>{manager.full_name}</span>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Не назначен</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '20px 32px' }}>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <button onClick={() => handleEditProject(p)} style={{ padding: '8px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                                                <button onClick={() => handleDeleteAction(p.id, 'project')} style={{ padding: '8px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
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
            )}

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Показано {activeTab === 'users' ? filteredUsers.length : activeTab === 'departments' ? filteredDepts.length : filteredProjects.length} записей.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer' }}>Назад</button>
                    <button style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer' }}>Вперед</button>
                </div>
            </div>
        </div>
    );
};

export default UsersPage;