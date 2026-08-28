import React, { useState, useMemo } from 'react';
import {
    Briefcase,
    Edit2,
    Trash2,
    LayoutGrid,
    Table,
    Download,
    Globe,
    Plus,
    CheckCircle2,
    Archive
} from 'lucide-react';
import type { Project, User } from '../../../types';
import { updateProject } from '../../../services/api';


interface ProjectsTabProps {
    projects: Project[];
    users: User[];
    searchQuery: string;
    isOdooConfigured: boolean;
    isOdooIntConfigured: boolean;
    onOpenOdooModal: () => void;
    onOpenOdooIntModal: () => void;
    onOpenAddProjectModal: () => void;
    onEdit: (project: Project) => void;
    onDelete: (id: number) => void;
    onRefresh: () => void;
}

/**
 * Вкладка администрирования проектов системы.
 * Поддерживает переключение между табличным и карточным видами,
 * расширенный поиск (по коду, названию, менеджеру), фильтры по статусу и менеджеру,
 * сортировку и быстрое редактирование лимитов и статусов.
 */
export const ProjectsTab: React.FC<ProjectsTabProps> = ({
    projects,
    users,
    searchQuery,
    isOdooConfigured,
    isOdooIntConfigured,
    onOpenOdooModal,
    onOpenOdooIntModal,
    onOpenAddProjectModal,
    onEdit,
    onDelete,
    onRefresh,
}) => {
    // Режим отображения (Таблица / Карточки) с сохранением в localStorage
    const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
        return (localStorage.getItem('admin_project_view_mode') as 'table' | 'cards') || 'table';
    });

    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');
    const [managerFilter, setManagerFilter] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<'code' | 'name' | 'manager' | 'weekly_limit' | 'is_active'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    // Локальный буфер введенных лимитов часов
    const [localLimits, setLocalLimits] = useState<Record<number, number>>({});
    const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

    const handleViewModeChange = (mode: 'table' | 'cards') => {
        setViewMode(mode);
        localStorage.setItem('admin_project_view_mode', mode);
    };

    const handleSort = (field: 'code' | 'name' | 'manager' | 'weekly_limit' | 'is_active') => {
        if (sortBy === field) {
            setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

    const renderSortIcon = (field: 'code' | 'name' | 'manager' | 'weekly_limit' | 'is_active') => {
        if (sortBy !== field) return <span style={{ opacity: 0.3, marginLeft: '6px' }}>↕</span>;
        return sortOrder === 'asc' ? (
            <span style={{ color: 'var(--accent)', marginLeft: '6px' }}>↑</span>
        ) : (
            <span style={{ color: 'var(--accent)', marginLeft: '6px' }}>↓</span>
        );
    };

    // Карта пользователей
    const usersMap = useMemo(() => {
        const map = new Map<number, User>();
        if (Array.isArray(users)) {
            users.forEach(u => map.set(u.id, u));
        }
        return map;
    }, [users]);

    // Кандидаты в менеджеры проектов (manager / admin)
    const managerCandidates = useMemo(() => {
        return (Array.isArray(users) ? users : []).filter(u => u.role === 'manager' || u.role === 'admin');
    }, [users]);

    // Фильтрация и сортировка проектов
    const processedProjects = useMemo(() => {
        let list = [...projects];

        // 1. Поиск по строке (код, название, ФИО менеджера)
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            list = list.filter(p => {
                const nameMatch = p.name.toLowerCase().includes(q);
                const codeMatch = (p.code || '').toLowerCase().includes(q);
                const managerUser = p.manager_id ? usersMap.get(p.manager_id) : null;
                const managerMatch = managerUser ? managerUser.full_name.toLowerCase().includes(q) : false;
                return nameMatch || codeMatch || managerMatch;
            });
        }

        // 2. Фильтр по статусу
        if (statusFilter === 'ACTIVE') {
            list = list.filter(p => p.is_active);
        } else if (statusFilter === 'ARCHIVED') {
            list = list.filter(p => !p.is_active);
        }

        // 3. Фильтр по менеджеру
        if (managerFilter === 'NO_MANAGER') {
            list = list.filter(p => !p.manager_id);
        } else if (managerFilter !== 'ALL') {
            const mgrId = Number(managerFilter);
            list = list.filter(p => p.manager_id === mgrId);
        }

        // 4. Сортировка
        list.sort((a, b) => {
            let res = 0;
            if (sortBy === 'code') {
                res = (a.code || '').localeCompare(b.code || '', 'ru');
            } else if (sortBy === 'name') {
                res = a.name.localeCompare(b.name, 'ru');
            } else if (sortBy === 'manager') {
                const mgrA = a.manager_id ? usersMap.get(a.manager_id)?.full_name || '' : '';
                const mgrB = b.manager_id ? usersMap.get(b.manager_id)?.full_name || '' : '';
                res = mgrA.localeCompare(mgrB, 'ru');
            } else if (sortBy === 'weekly_limit') {
                res = (a.weekly_limit || 0) - (b.weekly_limit || 0);
            } else if (sortBy === 'is_active') {
                res = (a.is_active ? 1 : 0) - (b.is_active ? 1 : 0);
            }
            return sortOrder === 'asc' ? res : -res;
        });

        return list;
    }, [projects, searchQuery, statusFilter, managerFilter, sortBy, sortOrder, usersMap]);

    const handleToggleStatus = async (p: Project) => {
        try {
            setUpdatingStatusId(p.id);
            await updateProject(p.id, { is_active: !p.is_active });
            onRefresh();
        } catch (err) {
            console.error('Ошибка изменения статуса проекта:', err);
        } finally {
            setUpdatingStatusId(null);
        }
    };

    const handleManagerChange = async (projectId: number, managerId: number | null) => {
        try {
            await updateProject(projectId, { manager_id: managerId });
            onRefresh();
        } catch (err) {
            console.error('Ошибка назначения менеджера:', err);
        }
    };

    const handleLimitBlur = async (projectId: number, originalLimit: number) => {
        const val = localLimits[projectId];
        if (val !== undefined && val !== originalLimit && val >= 0) {
            try {
                await updateProject(projectId, { weekly_limit: val });
                onRefresh();
            } catch (err) {
                console.error('Ошибка сохранения лимита:', err);
            }
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Панель интеграций Odoo и действий */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px',
                    padding: '0 4px',
                }}
            >
                {/* Переключатель вида: Таблица / Карточки */}
                <div
                    style={{
                        display: 'flex',
                        background: 'var(--bg-tertiary)',
                        padding: '4px',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                    }}
                >
                    <button
                        onClick={() => handleViewModeChange('table')}
                        style={{
                            border: 'none',
                            background: viewMode === 'table' ? 'var(--primary-gradient)' : 'transparent',
                            color: viewMode === 'table' ? 'white' : 'var(--text-secondary)',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            transition: 'all 0.2s',
                        }}
                    >
                        <Table size={16} />
                        Табличный вид
                    </button>
                    <button
                        onClick={() => handleViewModeChange('cards')}
                        style={{
                            border: 'none',
                            background: viewMode === 'cards' ? 'var(--primary-gradient)' : 'transparent',
                            color: viewMode === 'cards' ? 'white' : 'var(--text-secondary)',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            transition: 'all 0.2s',
                        }}
                    >
                        <LayoutGrid size={16} />
                        Карточный вид
                    </button>
                </div>

                {/* Кнопки импорта и добавления */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {isOdooConfigured && (
                        <button
                            onClick={onOpenOdooModal}
                            className="secondary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                borderRadius: '10px',
                                color: 'var(--accent)',
                                border: '1px solid var(--accent)',
                                padding: '8px 16px',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                            }}
                        >
                            <Download size={15} />
                            Odoo CRM (XML-RPC)
                        </button>
                    )}
                    {isOdooIntConfigured && (
                        <button
                            onClick={onOpenOdooIntModal}
                            className="primary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                borderRadius: '10px',
                                padding: '8px 16px',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                            }}
                        >
                            <Globe size={15} />
                            Импорт из Odoo (API)
                        </button>
                    )}
                    <button
                        onClick={onOpenAddProjectModal}
                        className="primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                        }}
                    >
                        <Plus size={16} />
                        Новый проект
                    </button>
                </div>
            </div>

            {/* Панель фильтров: статус, менеджер и счетчик */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                    padding: '0 4px',
                }}
            >
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    style={{
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        borderRadius: '10px',
                        width: 'auto',
                        minWidth: '170px',
                    }}
                >
                    <option value="ALL">Все статусы</option>
                    <option value="ACTIVE">Только активные</option>
                    <option value="ARCHIVED">В архиве</option>
                </select>

                <select
                    value={managerFilter}
                    onChange={e => setManagerFilter(e.target.value)}
                    style={{
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        borderRadius: '10px',
                        width: 'auto',
                        minWidth: '200px',
                    }}
                >
                    <option value="ALL">Все менеджеры</option>
                    <option value="NO_MANAGER">Без менеджера</option>
                    {managerCandidates.map(u => (
                        <option key={u.id} value={u.id.toString()}>
                            {u.full_name}
                        </option>
                    ))}
                </select>

                <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Найдено: <strong style={{ color: 'var(--text-primary)' }}>{processedProjects.length}</strong>
                </div>
            </div>

            {/* Контент: Таблица или Карточки */}
            {processedProjects.length === 0 ? (
                <div
                    className="glass-card"
                    style={{
                        padding: '48px 24px',
                        textAlign: 'center',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                    }}
                >
                    <Briefcase size={48} style={{ opacity: 0.3 }} />
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Проекты не найдены</div>
                    <div style={{ fontSize: '0.85rem' }}>
                        {searchQuery ? `По запросу «${searchQuery}» ничего не найдено` : 'Список проектов пуст'}
                    </div>
                </div>
            ) : viewMode === 'table' ? (
                /* ТАБЛИЧНЫЙ ВИД */
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table-container" style={{ minWidth: '900px', width: '100%' }}>
                            <thead>
                                <tr>
                                    <th
                                        className="table-header"
                                        onClick={() => handleSort('code')}
                                        style={{ cursor: 'pointer', userSelect: 'none', width: '150px' }}
                                    >
                                        Номер проекта {renderSortIcon('code')}
                                    </th>
                                    <th
                                        className="table-header"
                                        onClick={() => handleSort('name')}
                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        Название проекта {renderSortIcon('name')}
                                    </th>
                                    <th
                                        className="table-header"
                                        onClick={() => handleSort('manager')}
                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        Менеджер проекта {renderSortIcon('manager')}
                                    </th>
                                    <th
                                        className="table-header"
                                        onClick={() => handleSort('weekly_limit')}
                                        style={{ cursor: 'pointer', userSelect: 'none', width: '160px', textAlign: 'center' }}
                                    >
                                        Лимит (ч/нед) {renderSortIcon('weekly_limit')}
                                    </th>
                                    <th
                                        className="table-header"
                                        onClick={() => handleSort('is_active')}
                                        style={{ cursor: 'pointer', userSelect: 'none', width: '120px', textAlign: 'center' }}
                                    >
                                        Статус {renderSortIcon('is_active')}
                                    </th>
                                    <th className="table-header" style={{ textAlign: 'right', width: '120px' }}>
                                        Действия
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedProjects.map(p => {
                                    return (
                                        <tr key={p.id}>
                                            <td className="table-cell">
                                                <span
                                                    style={{
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 700,
                                                        color: p.is_active ? 'var(--accent)' : 'var(--text-muted)',
                                                        background: 'var(--bg-tertiary)',
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        display: 'inline-block',
                                                    }}
                                                >
                                                    {p.code || '—'}
                                                </span>
                                            </td>
                                            <td className="table-cell">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div
                                                        className="icon-shape"
                                                        style={{
                                                            width: '36px',
                                                            height: '36px',
                                                            background: 'var(--bg-tertiary)',
                                                            color: p.is_active ? 'var(--info)' : 'var(--text-muted)',
                                                            borderRadius: '8px',
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        <Briefcase size={18} />
                                                    </div>
                                                    <div>
                                                        <div
                                                            style={{
                                                                fontWeight: 700,
                                                                color: p.is_active ? 'var(--text-primary)' : 'var(--text-muted)',
                                                                fontSize: '0.95rem',
                                                            }}
                                                        >
                                                            {p.name}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="table-cell">
                                                <select
                                                    value={p.manager_id || ''}
                                                    onChange={e => handleManagerChange(p.id, e.target.value ? Number(e.target.value) : null)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        fontSize: '0.85rem',
                                                        borderRadius: '8px',
                                                        maxWidth: '240px',
                                                    }}
                                                >
                                                    <option value="">Не назначен</option>
                                                    {managerCandidates.map(u => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.full_name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="table-cell" style={{ textAlign: 'center' }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={localLimits[p.id] ?? p.weekly_limit}
                                                    onChange={e =>
                                                        setLocalLimits(prev => ({ ...prev, [p.id]: Number(e.target.value) }))
                                                    }
                                                    onBlur={() => handleLimitBlur(p.id, p.weekly_limit)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '0.85rem',
                                                        width: '75px',
                                                        textAlign: 'center',
                                                        borderRadius: '6px',
                                                    }}
                                                />
                                            </td>
                                            <td className="table-cell" style={{ textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleToggleStatus(p)}
                                                    disabled={updatingStatusId === p.id}
                                                    className={`badge ${p.is_active ? 'badge-success' : 'badge-danger'}`}
                                                    style={{
                                                        cursor: 'pointer',
                                                        border: 'none',
                                                        fontSize: '0.75rem',
                                                        padding: '4px 10px',
                                                        transition: 'transform 0.1s',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                    }}
                                                    title="Нажмите для переключения статуса"
                                                >
                                                    {p.is_active ? <CheckCircle2 size={12} /> : <Archive size={12} />}
                                                    {p.is_active ? 'Активен' : 'Архив'}
                                                </button>
                                            </td>
                                            <td className="table-cell" style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                    <button
                                                        onClick={() => onEdit(p)}
                                                        className="action-button-modern"
                                                        title="Редактировать название и статус"
                                                    >
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => onDelete(p.id)}
                                                        className="action-button-modern delete"
                                                        title="Удалить проект"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* КАРТОЧНЫЙ ВИД */
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                        gap: '16px',
                    }}
                >
                    {processedProjects.map(p => {
                        return (
                            <div
                                key={p.id}
                                className="glass-card"
                                style={{
                                    padding: '20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '16px',
                                    marginBottom: 0,
                                    opacity: p.is_active ? 1 : 0.75,
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                        <div
                                            className="icon-shape"
                                            style={{
                                                width: '46px',
                                                height: '46px',
                                                background: 'var(--bg-tertiary)',
                                                color: p.is_active ? 'var(--info)' : 'var(--text-muted)',
                                                borderRadius: '12px',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Briefcase size={22} />
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontWeight: 800,
                                                    fontSize: '1.05rem',
                                                    wordBreak: 'break-word',
                                                    lineHeight: 1.2,
                                                    color: p.is_active ? 'var(--text-primary)' : 'var(--text-muted)',
                                                }}
                                            >
                                                {p.name}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                <span
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-muted)',
                                                        fontWeight: 600,
                                                        fontFamily: 'monospace',
                                                    }}
                                                >
                                                    {p.code || '—'}
                                                </span>
                                                <button
                                                    onClick={() => handleToggleStatus(p)}
                                                    className={`badge ${p.is_active ? 'badge-success' : 'badge-danger'}`}
                                                    style={{
                                                        cursor: 'pointer',
                                                        border: 'none',
                                                        fontSize: '0.65rem',
                                                        padding: '2px 8px',
                                                    }}
                                                    title="Нажмите для переключения статуса"
                                                >
                                                    {p.is_active ? 'Активен' : 'Архив'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                        <button onClick={() => onEdit(p)} className="action-button-modern" title="Редактировать">
                                            <Edit2 size={15} />
                                        </button>
                                        <button onClick={() => onDelete(p.id)} className="action-button-modern delete" title="Удалить">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Менеджер</label>
                                        <select
                                            value={p.manager_id || ''}
                                            onChange={e => handleManagerChange(p.id, e.target.value ? Number(e.target.value) : null)}
                                            style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                                        >
                                            <option value="">Не назначен</option>
                                            {managerCandidates.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Лимит (ч/нед)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={localLimits[p.id] ?? p.weekly_limit}
                                            onChange={e => setLocalLimits(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                                            onBlur={() => handleLimitBlur(p.id, p.weekly_limit)}
                                            style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
