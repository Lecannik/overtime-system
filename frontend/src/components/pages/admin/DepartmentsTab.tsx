import React, { useState, useMemo } from 'react';
import { Building2, Edit2, Trash2, LayoutGrid, Table, Users as UsersIcon, Plus } from 'lucide-react';
import type { Department, User } from '../../../types';
import { updateDepartment } from '../../../services/api';


interface DepartmentsTabProps {
    departments: Department[];
    users: User[];
    searchQuery: string;
    onRefresh: () => void;
    onEdit: (dept: Department) => void;
    onDelete: (id: number) => void;
    onAdd: () => void;
}

/**
 * Вкладка управления отделами организации.
 * Поддерживает переключение между табличным и карточным видами,
 * клиентскую фильтрацию по поиску, фильтр по наличию руководителя и сортировку.
 */
export const DepartmentsTab: React.FC<DepartmentsTabProps> = ({
    departments,
    users,
    searchQuery,
    onRefresh,
    onEdit,
    onDelete,
    onAdd,
}) => {
    // Режим отображения (Таблица / Карточки) с сохранением в localStorage
    const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
        return (localStorage.getItem('admin_dept_view_mode') as 'table' | 'cards') || 'table';
    });

    const [headFilter, setHeadFilter] = useState<'ALL' | 'WITH_HEAD' | 'WITHOUT_HEAD'>('ALL');
    const [sortBy, setSortBy] = useState<'id' | 'name' | 'head' | 'users_count'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [updatingHeadId, setUpdatingHeadId] = useState<number | null>(null);

    const handleViewModeChange = (mode: 'table' | 'cards') => {
        setViewMode(mode);
        localStorage.setItem('admin_dept_view_mode', mode);
    };

    const handleSort = (field: 'id' | 'name' | 'head' | 'users_count') => {
        if (sortBy === field) {
            setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

    const renderSortIcon = (field: 'id' | 'name' | 'head' | 'users_count') => {
        if (sortBy !== field) return <span style={{ opacity: 0.3, marginLeft: '6px' }}>↕</span>;
        return sortOrder === 'asc' ? (
            <span style={{ color: 'var(--accent)', marginLeft: '6px' }}>↑</span>
        ) : (
            <span style={{ color: 'var(--accent)', marginLeft: '6px' }}>↓</span>
        );
    };

    // Подсчет количества сотрудников по отделам
    const usersCountByDept = useMemo(() => {
        const counts: Record<number, number> = {};
        if (Array.isArray(users)) {
            users.forEach(u => {
                if (u.department_id) {
                    counts[u.department_id] = (counts[u.department_id] || 0) + 1;
                }
            });
        }
        return counts;
    }, [users]);

    // Карта пользователей по ID
    const usersMap = useMemo(() => {
        const map = new Map<number, User>();
        if (Array.isArray(users)) {
            users.forEach(u => map.set(u.id, u));
        }
        return map;
    }, [users]);

    // Список кандидатов в руководители (head / admin)
    const headCandidates = useMemo(() => {
        return (Array.isArray(users) ? users : []).filter(u => u.role === 'head' || u.role === 'admin');
    }, [users]);

    // Фильтрация и сортировка
    const processedDepartments = useMemo(() => {
        let list = [...departments];

        // 1. Поиск по строке (название отдела, ID, ФИО руководителя)
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            list = list.filter(d => {
                const nameMatch = d.name.toLowerCase().includes(q);
                const idMatch = d.id.toString().includes(q);
                const headUser = d.head_id ? usersMap.get(d.head_id) : null;
                const headMatch = headUser ? headUser.full_name.toLowerCase().includes(q) : false;
                return nameMatch || idMatch || headMatch;
            });
        }

        // 2. Фильтр по наличию руководителя
        if (headFilter === 'WITH_HEAD') {
            list = list.filter(d => d.head_id !== null && d.head_id !== undefined);
        } else if (headFilter === 'WITHOUT_HEAD') {
            list = list.filter(d => !d.head_id);
        }

        // 3. Сортировка
        list.sort((a, b) => {
            let res = 0;
            if (sortBy === 'id') {
                res = a.id - b.id;
            } else if (sortBy === 'name') {
                res = a.name.localeCompare(b.name, 'ru');
            } else if (sortBy === 'head') {
                const headA = a.head_id ? usersMap.get(a.head_id)?.full_name || '' : '';
                const headB = b.head_id ? usersMap.get(b.head_id)?.full_name || '' : '';
                res = headA.localeCompare(headB, 'ru');
            } else if (sortBy === 'users_count') {
                const countA = usersCountByDept[a.id] || 0;
                const countB = usersCountByDept[b.id] || 0;
                res = countA - countB;
            }
            return sortOrder === 'asc' ? res : -res;
        });

        return list;
    }, [departments, searchQuery, headFilter, sortBy, sortOrder, usersMap, usersCountByDept]);

    const handleHeadChange = async (deptId: number, newHeadId: number | null) => {
        try {
            setUpdatingHeadId(deptId);
            await updateDepartment(deptId, { head_id: newHeadId });
            onRefresh();
        } catch (err) {
            console.error('Ошибка назначения руководителя:', err);
        } finally {
            setUpdatingHeadId(null);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Панель инструментов: переключатель видов, фильтры и кнопка добавления */}
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

                {/* Дополнительные фильтры и счетчик */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <select
                        value={headFilter}
                        onChange={e => setHeadFilter(e.target.value as any)}
                        style={{
                            padding: '8px 16px',
                            fontSize: '0.85rem',
                            borderRadius: '10px',
                            width: 'auto',
                            minWidth: '180px',
                        }}
                    >
                        <option value="ALL">Все отделы</option>
                        <option value="WITH_HEAD">С руководителем</option>
                        <option value="WITHOUT_HEAD">Без руководителя</option>
                    </select>

                    <button
                        onClick={onAdd}
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
                        Новый отдел
                    </button>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, padding: '0 4px' }}>
                        Найдено: <strong style={{ color: 'var(--text-primary)' }}>{processedDepartments.length}</strong>
                    </div>
                </div>
            </div>

            {/* Контент: Таблица или Карточки */}
            {processedDepartments.length === 0 ? (
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
                    <Building2 size={48} style={{ opacity: 0.3 }} />
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Отделы не найдены</div>
                    <div style={{ fontSize: '0.85rem' }}>
                        {searchQuery ? `По запросу «${searchQuery}» ничего не найдено` : 'Список отделов пуст'}
                    </div>
                </div>
            ) : viewMode === 'table' ? (
                /* ТАБЛИЧНЫЙ ВИД */
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table-container" style={{ minWidth: '750px', width: '100%' }}>
                            <thead>
                                <tr>
                                    <th
                                        className="table-header"
                                        onClick={() => handleSort('id')}
                                        style={{ cursor: 'pointer', userSelect: 'none', width: '90px' }}
                                    >
                                        ID {renderSortIcon('id')}
                                    </th>
                                    <th
                                        className="table-header"
                                        onClick={() => handleSort('name')}
                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        Название отдела {renderSortIcon('name')}
                                    </th>
                                    <th
                                        className="table-header"
                                        onClick={() => handleSort('head')}
                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        Руководитель отдела {renderSortIcon('head')}
                                    </th>
                                    <th
                                        className="table-header"
                                        onClick={() => handleSort('users_count')}
                                        style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'center', width: '140px' }}
                                    >
                                        Сотрудников {renderSortIcon('users_count')}
                                    </th>
                                    <th className="table-header" style={{ textAlign: 'right', width: '120px' }}>
                                        Действия
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedDepartments.map(d => {
                                    const count = usersCountByDept[d.id] || 0;

                                    return (

                                        <tr key={d.id}>
                                            <td className="table-cell" style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                                                #{d.id}
                                            </td>
                                            <td className="table-cell">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div
                                                        className="icon-shape"
                                                        style={{
                                                            width: '36px',
                                                            height: '36px',
                                                            background: 'var(--bg-tertiary)',
                                                            color: 'var(--primary)',
                                                            borderRadius: '8px',
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        <Building2 size={18} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                                            {d.name}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="table-cell">
                                                <select
                                                    value={d.head_id || ''}
                                                    disabled={updatingHeadId === d.id}
                                                    onChange={e => handleHeadChange(d.id, e.target.value ? Number(e.target.value) : null)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        fontSize: '0.85rem',
                                                        borderRadius: '8px',
                                                        maxWidth: '260px',
                                                        opacity: updatingHeadId === d.id ? 0.6 : 1,
                                                    }}
                                                >
                                                    <option value="">Не назначен</option>
                                                    {headCandidates.map(u => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.full_name} ({u.role === 'admin' ? 'Админ' : 'Руководитель'})
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="table-cell" style={{ textAlign: 'center' }}>
                                                <span
                                                    className="badge"
                                                    style={{
                                                        background: count > 0 ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-tertiary)',
                                                        color: count > 0 ? '#38bdf8' : 'var(--text-muted)',
                                                        fontWeight: 700,
                                                        fontSize: '0.8rem',
                                                        padding: '4px 10px',
                                                    }}
                                                >
                                                    <UsersIcon size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                    {count} чел.
                                                </span>
                                            </td>
                                            <td className="table-cell" style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                    <button
                                                        onClick={() => onEdit(d)}
                                                        className="action-button-modern"
                                                        title="Редактировать название"
                                                    >
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => onDelete(d.id)}
                                                        className="action-button-modern delete"
                                                        title="Удалить отдел"
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
                    {processedDepartments.map(d => {
                        const count = usersCountByDept[d.id] || 0;

                        return (
                            <div
                                key={d.id}
                                className="glass-card"
                                style={{
                                    padding: '20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '16px',
                                    marginBottom: 0,
                                    position: 'relative',
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
                                                color: 'var(--primary)',
                                                borderRadius: '12px',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Building2 size={22} />
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontWeight: 800,
                                                    fontSize: '1.05rem',
                                                    wordBreak: 'break-word',
                                                    lineHeight: 1.2,
                                                }}
                                            >
                                                {d.name}
                                            </div>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginTop: '4px',
                                                    fontSize: '0.75rem',
                                                    color: 'var(--text-muted)',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                <span>ID: {d.id}</span>
                                                <span>•</span>
                                                <span>{count} сотр.</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                        <button onClick={() => onEdit(d)} className="action-button-modern" title="Редактировать">
                                            <Edit2 size={15} />
                                        </button>
                                        <button onClick={() => onDelete(d.id)} className="action-button-modern delete" title="Удалить">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Руководитель отдела
                                    </label>
                                    <select
                                        value={d.head_id || ''}
                                        disabled={updatingHeadId === d.id}
                                        onChange={e => handleHeadChange(d.id, e.target.value ? Number(e.target.value) : null)}
                                        style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                                    >
                                        <option value="">Не назначен</option>
                                        {headCandidates.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.full_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
