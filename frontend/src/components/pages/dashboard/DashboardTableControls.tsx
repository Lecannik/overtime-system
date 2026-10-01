import React from 'react';
import { Search, List, LayoutGrid, Settings, RotateCcw } from 'lucide-react';
import type { User, Department } from '../../../types';

export interface ColumnConfig {
    id: string;
    label: string;
    visible: boolean;
    width?: number;
}

interface DashboardTableControlsProps {
    activeTab: 'my' | 'all';
    user: User | null;
    departments: Department[];
    selectedDeptId: string;
    onSelectDeptId: (deptId: string) => void;
    filterStatus: string;
    onFilterStatusChange: (status: string) => void;
    startDate: string;
    endDate: string;
    onDateRangeReset: () => void;
    startInputCallbackRef: (el: HTMLInputElement | null) => void;
    endInputCallbackRef: (el: HTMLInputElement | null) => void;
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    mobileView: 'cards' | 'table';
    onToggleMobileView: () => void;
    isColConfigOpen: boolean;
    onToggleColConfig: () => void;
    columns: ColumnConfig[];
    onToggleColumnVisibility: (id: string) => void;
    onMoveColumn: (from: number, to: number) => void;
    onResetColumnWidths: () => void;
}

/**
 * Панель фильтров, поиска, настройки видимости колонок и переключения видов для дашборда переработок.
 */
export const DashboardTableControls: React.FC<DashboardTableControlsProps> = ({
    activeTab,
    user,
    departments,
    selectedDeptId,
    onSelectDeptId,
    filterStatus,
    onFilterStatusChange,
    startDate,
    endDate,
    onDateRangeReset,
    startInputCallbackRef,
    endInputCallbackRef,
    searchQuery,
    onSearchQueryChange,
    mobileView,
    onToggleMobileView,
    isColConfigOpen,
    onToggleColConfig,
    columns,
    onToggleColumnVisibility,
    onMoveColumn,
    onResetColumnWidths,
}) => {
    return (
        <div
            className="dashboard-card-header"
            style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
            }}
        >
            <h3 style={{ fontWeight: 700, fontSize: '1.15rem', margin: 0 }}>
                {activeTab === 'my' ? 'Мои переработки' : 'Все переработки'}
            </h3>
            <div
                className="dashboard-filters-wrap"
                style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    flexGrow: 1,
                    justifyContent: 'flex-end',
                }}
            >
                {/* Фильтр по отделам (только для админа в режиме "Все") */}
                {user?.role === 'admin' && activeTab === 'all' && (
                    <select
                        value={selectedDeptId}
                        onChange={(e) => onSelectDeptId(e.target.value)}
                        style={{
                            height: '36px',
                            padding: '0 10px',
                            fontSize: '0.8rem',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            flex: '1 1 130px',
                            minWidth: '120px',
                        }}
                    >
                        <option value="">Все отделы</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id.toString()}>
                                {d.name}
                            </option>
                        ))}
                    </select>
                )}

                {/* Фильтр по статусу */}
                <select
                    value={filterStatus}
                    onChange={(e) => onFilterStatusChange(e.target.value)}
                    style={{
                        height: '36px',
                        padding: '0 10px',
                        fontSize: '0.8rem',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        flex: '1 1 130px',
                        minWidth: '120px',
                    }}
                >
                    <option value="">Все статусы</option>
                    <option value="PENDING">На согласовании</option>
                    <option value="HEAD_APPROVED">Утверждено рук.</option>
                    <option value="MANAGER_APPROVED">Утверждено мен.</option>
                    <option value="APPROVED">Одобрено</option>
                    <option value="REJECTED">Отклонено</option>
                    <option value="CANCELLED">Отменено</option>
                    <option value="IN_PROGRESS">В процессе</option>
                </select>

                {/* Диапазон дат */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 210px', minWidth: '190px' }}>
                    <input
                        ref={startInputCallbackRef}
                        type="text"
                        placeholder="дд/мм/гггг"
                        style={{
                            height: '36px',
                            flex: 1,
                            minWidth: 0,
                            width: '100%',
                            padding: '0 6px',
                            fontSize: '0.8rem',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            textAlign: 'center',
                        }}
                        title="Начало периода"
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', flexShrink: 0 }}>—</span>
                    <input
                        ref={endInputCallbackRef}
                        type="text"
                        placeholder="дд/мм/гггг"
                        style={{
                            height: '36px',
                            flex: 1,
                            minWidth: 0,
                            width: '100%',
                            padding: '0 6px',
                            fontSize: '0.8rem',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            textAlign: 'center',
                        }}
                        title="Конец периода"
                    />
                    {(startDate || endDate) && (
                        <button
                            onClick={onDateRangeReset}
                            className="action-button-modern"
                            title="Сбросить даты"
                            style={{
                                height: '36px',
                                width: '36px',
                                minWidth: '36px',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            ×
                        </button>
                    )}
                </div>

                {/* Поиск */}
                <div style={{ position: 'relative', flex: '1 1 180px', minWidth: '150px' }}>
                    <Search
                        size={16}
                        style={{
                            position: 'absolute',
                            left: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)',
                            pointerEvents: 'none',
                        }}
                    />
                    <input
                        placeholder="Найти по описанию..."
                        value={searchQuery}
                        onChange={(e) => onSearchQueryChange(e.target.value)}
                        style={{
                            paddingLeft: '36px',
                            height: '36px',
                            fontSize: '0.8rem',
                            background: 'var(--bg-tertiary)',
                            width: '100%',
                        }}
                    />
                </div>

                {/* Переключатель вида: Карточки / Таблица */}
                <div className="show-on-mobile" style={{ gap: '6px' }}>
                    <button
                        onClick={onToggleMobileView}
                        className="action-button-modern"
                        title={mobileView === 'cards' ? 'Показать таблицу' : 'Показать карточки'}
                        style={{
                            height: '36px',
                            width: '36px',
                            minWidth: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary)',
                        }}
                    >
                        {mobileView === 'cards' ? <List size={18} /> : <LayoutGrid size={18} />}
                    </button>
                </div>

                {/* Настройка колонок */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                        onClick={onToggleColConfig}
                        className="action-button-modern"
                        title="Настройка колонок"
                        style={{
                            height: '36px',
                            width: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Settings size={18} />
                    </button>
                    {isColConfigOpen && (
                        <div
                            style={{
                                position: 'absolute',
                                right: 0,
                                top: '42px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                boxShadow: 'var(--card-shadow)',
                                zIndex: 100,
                                width: '240px',
                                padding: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                            }}
                        >
                            <div
                                style={{
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    borderBottom: '1px solid var(--border)',
                                    paddingBottom: '6px',
                                    marginBottom: '4px',
                                }}
                            >
                                Настройка колонок
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                                {columns.map((col, idx) => (
                                    <div
                                        key={col.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            fontSize: '0.75rem',
                                        }}
                                    >
                                        <label
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                color: 'var(--text-primary)',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={col.visible}
                                                disabled={col.id === 'date' || col.id === 'actions'}
                                                onChange={() => onToggleColumnVisibility(col.id)}
                                            />
                                            <span>{col.label}</span>
                                        </label>
                                        <div style={{ display: 'flex', gap: '2px' }}>
                                            <button
                                                disabled={idx === 0}
                                                onClick={() => onMoveColumn(idx, idx - 1)}
                                                style={{
                                                    border: 'none',
                                                    background: 'transparent',
                                                    cursor: 'pointer',
                                                    padding: '2px',
                                                    opacity: idx === 0 ? 0.3 : 1,
                                                    color: 'var(--text-primary)',
                                                }}
                                            >
                                                ↑
                                            </button>
                                            <button
                                                disabled={idx === columns.length - 1}
                                                onClick={() => onMoveColumn(idx, idx + 1)}
                                                style={{
                                                    border: 'none',
                                                    background: 'transparent',
                                                    cursor: 'pointer',
                                                    padding: '2px',
                                                    opacity: idx === columns.length - 1 ? 0.3 : 1,
                                                    color: 'var(--text-primary)',
                                                }}
                                            >
                                                ↓
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={onResetColumnWidths}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    background: 'transparent',
                                    border: '1px dashed var(--border)',
                                    borderRadius: '6px',
                                    padding: '6px 8px',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    marginTop: '4px',
                                    width: '100%',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <RotateCcw size={13} />
                                <span>Сбросить ширину колонок</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
