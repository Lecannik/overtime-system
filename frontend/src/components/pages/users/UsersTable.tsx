import React from 'react';
import { Edit2, Key, Trash2 } from 'lucide-react';
import type { User, Department } from '../../../types';

interface UsersTableProps {
    users: User[];
    departments: Department[];
    roleLabels: Record<string, string>;
    roleColors: Record<string, string>;
    companyLabels: Record<string, string>;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    onSort: (field: string) => void;
    onEditUser: (user: User) => void;
    onToggleStatus: (user: User) => void;
    onResetPassword: (id: number) => void;
    onDeleteUser: (id: number) => void;
    currentPage: number;
    totalPages: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
}

/**
 * Таблица отображения пользователей с поддержкой сортировки, пагинации и быстрых действий.
 */
export const UsersTable: React.FC<UsersTableProps> = ({
    users,
    departments,
    roleLabels,
    roleColors,
    companyLabels,
    sortBy,
    sortOrder,
    onSort,
    onEditUser,
    onToggleStatus,
    onResetPassword,
    onDeleteUser,
    currentPage,
    totalPages,
    pageSize,
    onPageChange,
    onPageSizeChange,
}) => {
    const renderSortIcon = (field: string) => {
        if (sortBy !== field) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
        return <span style={{ marginLeft: '4px', color: 'var(--accent)' }}>{sortOrder === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <>
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <div className="table-scroll-container">
                    <table className="table-container" style={{ minWidth: '850px' }}>
                        <thead>
                            <tr>
                                <th className="table-header" onClick={() => onSort('full_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    Пользователь {renderSortIcon('full_name')}
                                </th>
                                <th className="table-header" onClick={() => onSort('role')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    Роль / Компания {renderSortIcon('role')}
                                </th>
                                <th className="table-header" onClick={() => onSort('department_id')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    Отдел {renderSortIcon('department_id')}
                                </th>
                                <th className="table-header" onClick={() => onSort('is_active')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    Статус {renderSortIcon('is_active')}
                                </th>
                                <th className="table-header" style={{ textAlign: 'right' }}>
                                    Действия
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td className="table-cell">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div
                                                className="icon-shape"
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    fontSize: '0.9rem',
                                                    color: 'white',
                                                    background: `linear-gradient(310deg, ${roleColors[u.role] || '#2152ff'}, #21d4fd)`,
                                                }}
                                            >
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
                                            <span className="badge badge-info" style={{ width: 'fit-content' }}>
                                                {roleLabels[u.role]}
                                            </span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                {companyLabels[u.company ?? ''] ?? u.company}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        {departments.find((d) => d.id === u.department_id)?.name || '—'}
                                    </td>
                                    <td className="table-cell">
                                        <div
                                            onClick={() => onToggleStatus(u)}
                                            className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {u.is_active ? 'Активен' : 'Отключен'}
                                        </div>
                                    </td>
                                    <td className="table-cell" style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => onEditUser(u)}
                                                className="action-button-modern"
                                                title="Редактировать"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => onResetPassword(u.id)}
                                                className="action-button-modern"
                                                title="Сбросить пароль"
                                            >
                                                <Key size={16} />
                                            </button>
                                            <button
                                                onClick={() => onDeleteUser(u.id)}
                                                className="action-button-modern delete"
                                                title="Удалить"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {totalPages > 1 && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '24px',
                        marginTop: '32px',
                        paddingBottom: '32px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Строк на странице:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                onPageSizeChange(Number(e.target.value));
                                onPageChange(1);
                            }}
                            style={{
                                padding: '4px 12px',
                                width: 'auto',
                                borderRadius: '100px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                            }}
                        >
                            {[10, 20, 50, 100, 1000].map((v) => (
                                <option key={v} value={v}>
                                    {v === 1000 ? 'Все' : v}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            disabled={currentPage === 1}
                            onClick={() => onPageChange(currentPage - 1)}
                            className="secondary"
                            style={{ padding: '6px 16px' }}
                        >
                            Назад
                        </button>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '0 16px',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                            }}
                        >
                            {currentPage} / {totalPages}
                        </div>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => onPageChange(currentPage + 1)}
                            className="secondary"
                            style={{ padding: '6px 16px' }}
                        >
                            Далее
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
