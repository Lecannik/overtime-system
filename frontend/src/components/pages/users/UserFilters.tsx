import React from 'react';
import { Search } from 'lucide-react';
import type { Department } from '../../../types';

interface UserFiltersProps {
    searchInput: string;
    onSearchInputChange: (val: string) => void;
    onSearchSubmit: () => void;
    roleFilter: string;
    onRoleFilterChange: (val: string) => void;
    deptFilter: string | number;
    onDeptFilterChange: (val: string) => void;
    departments: Department[];
    roleLabels: Record<string, string>;
}

/**
 * Панель фильтрации пользователей: строка поиска по ФИО/email, селектор роли и отдела.
 */
export const UserFilters: React.FC<UserFiltersProps> = ({
    searchInput,
    onSearchInputChange,
    onSearchSubmit,
    roleFilter,
    onRoleFilterChange,
    deptFilter,
    onDeptFilterChange,
    departments,
    roleLabels,
}) => {
    return (
        <div
            className="glass-card"
            style={{
                padding: '16px 24px',
                marginBottom: '24px',
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
                alignItems: 'center',
            }}
        >
            <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: 'min(100%, 280px)', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search
                        size={18}
                        style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }}
                    />
                    <input
                        placeholder="Поиск пользователей (ФИО, Email)..."
                        value={searchInput}
                        onChange={(e) => onSearchInputChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onSearchSubmit();
                        }}
                        style={{ paddingLeft: '40px' }}
                    />
                </div>
                <button
                    onClick={onSearchSubmit}
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
                        height: '42px',
                    }}
                >
                    <Search size={15} />
                    Найти
                </button>
            </div>
            <select
                value={roleFilter}
                onChange={(e) => onRoleFilterChange(e.target.value)}
                style={{ width: 'auto', flex: '1 1 150px' }}
            >
                <option value="ALL">Все роли</option>
                {Object.entries(roleLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                        {v}
                    </option>
                ))}
            </select>
            <select
                value={String(deptFilter)}
                onChange={(e) => onDeptFilterChange(e.target.value)}
                style={{ width: 'auto', flex: '1 1 150px' }}
            >
                <option value="ALL">Все отделы</option>
                {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                        {d.name}
                    </option>
                ))}
            </select>
        </div>
    );
};
