import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Overtime } from '../../../types';
import type { ColumnConfig } from './DashboardTableControls';
import { STATUS_LABELS, formatDate, formatTime } from '../../../constants/locale';

interface DashboardOvertimesTableProps {
    mobileView: 'cards' | 'table';
    activeTab: 'my' | 'all';
    overtimes: Overtime[];
    columns: ColumnConfig[];
    sortKey: string;
    sortDir: 'asc' | 'desc';
    onSort: (key: string) => void;
    draggedColId: string | null;
    resizingColId: string | null;
    onDragStart: (e: React.DragEvent, colId: string) => void;
    onDragOver: (e: React.DragEvent, colId: string) => void;
    onDrop: (e: React.DragEvent, colId: string) => void;
    onResizeStart: (e: React.MouseEvent, colId: string, currentWidth: number) => void;
    onResetSingleColumnWidth: (colId: string) => void;
    defaultColumnWidths: Record<string, number>;
    totalTableWidth: number;
    renderActionButtons: (ot: Overtime) => React.ReactNode;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

/**
 * Таблица и мобильный карточный список заявок на переработку:
 * - Поддерживает динамическое изменение ширины колонок (resize)
 * - Поддерживает перетаскивание колонок (drag-and-drop)
 * - Сортировку по ключевым полям
 * - Пагинацию
 */
export const DashboardOvertimesTable: React.FC<DashboardOvertimesTableProps> = ({
    mobileView,
    activeTab,
    overtimes,
    columns,
    sortKey,
    sortDir,
    onSort,
    draggedColId,
    resizingColId,
    onDragStart,
    onDragOver,
    onDrop,
    onResizeStart,
    onResetSingleColumnWidth,
    defaultColumnWidths,
    totalTableWidth,
    renderActionButtons,
    currentPage,
    totalPages,
    onPageChange,
}) => {
    const visibleColumns = columns.filter((c) => c.visible);

    return (
        <>
            {/* Мобильный карточный режим */}
            {mobileView === 'cards' && (
                <div className="show-on-mobile" style={{ flexDirection: 'column', gap: '10px', padding: '12px' }}>
                    {overtimes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Ничего не найдено
                        </div>
                    ) : (
                        overtimes.map((ot: Overtime) => {
                            const isApproved =
                                ot.status === 'APPROVED' ||
                                ot.status === 'MANAGER_APPROVED' ||
                                ot.status === 'HEAD_APPROVED';
                            return (
                                <div key={ot.id} className="mobile-overtime-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                                            {formatDate(ot.start_time)}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span
                                                className={`badge badge-${
                                                    ot.status === 'APPROVED'
                                                        ? 'success'
                                                        : ot.status === 'REJECTED' || ot.status === 'CANCELLED'
                                                        ? 'danger'
                                                        : ot.status === 'IN_PROGRESS'
                                                        ? 'info'
                                                        : 'warning'
                                                }`}
                                            >
                                                {STATUS_LABELS[ot.status] || ot.status}
                                            </span>
                                            <span
                                                style={{
                                                    fontWeight: 800,
                                                    fontSize: '0.9rem',
                                                    color: isApproved ? 'var(--success)' : 'var(--primary)',
                                                }}
                                            >
                                                {isApproved && ot.approved_hours != null ? `${ot.approved_hours}ч` : `${ot.hours}ч`}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {ot.project?.name || 'Внутренний'}
                                        </div>
                                        {activeTab === 'all' && ot.user && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {ot.user.full_name} ({ot.user.email})
                                            </div>
                                        )}
                                    </div>

                                    {ot.description && (
                                        <div
                                            className="line-clamp-2"
                                            style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}
                                        >
                                            {ot.description}
                                        </div>
                                    )}

                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            borderTop: '1px solid var(--border)',
                                            paddingTop: '10px',
                                            marginTop: '2px',
                                            flexWrap: 'wrap',
                                            gap: '8px',
                                        }}
                                    >
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {formatTime(ot.start_time)}
                                            {ot.end_time && ` - ${formatTime(ot.end_time)}`}
                                        </div>
                                        {renderActionButtons(ot)}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Табличный режим */}
            <div
                className={`table-scroll-container ${mobileView === 'cards' ? 'hide-on-mobile' : ''}`}
                style={{ flex: 1, borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}
            >
                <table
                    className="table-container"
                    style={{ minWidth: `${Math.max(850, totalTableWidth)}px`, width: '100%', tableLayout: 'fixed' }}
                >
                    <thead>
                        <tr>
                            {visibleColumns.map((col) => {
                                const isSortable = ['date', 'user', 'project', 'hours', 'status'].includes(col.id);
                                const isActive = sortKey === col.id;
                                const colWidth = col.width || defaultColumnWidths[col.id] || 150;
                                return (
                                    <th
                                        key={col.id}
                                        className="table-header"
                                        draggable={col.id !== 'actions' && !resizingColId}
                                        onDragStart={(e) => onDragStart(e, col.id)}
                                        onDragOver={(e) => onDragOver(e, col.id)}
                                        onDrop={(e) => onDrop(e, col.id)}
                                        onClick={() => (isSortable ? onSort(col.id) : undefined)}
                                        style={{
                                            cursor: col.id === 'actions' ? 'default' : isSortable ? 'pointer' : 'grab',
                                            textAlign: col.id === 'actions' ? 'right' : 'left',
                                            opacity: draggedColId === col.id ? 0.5 : 1,
                                            borderLeft: draggedColId && draggedColId !== col.id ? '2px dashed var(--primary)' : undefined,
                                            transition: resizingColId ? 'none' : 'background-color 0.2s ease, opacity 0.2s ease',
                                            width: `${colWidth}px`,
                                            minWidth: `${colWidth}px`,
                                            maxWidth: `${colWidth}px`,
                                            userSelect: 'none',
                                            color: isActive ? 'var(--primary)' : undefined,
                                            whiteSpace: 'nowrap',
                                            position: 'relative',
                                            boxSizing: 'border-box',
                                        }}
                                    >
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                maxWidth: 'calc(100% - 12px)',
                                            }}
                                        >
                                            {col.label}
                                            {isSortable &&
                                                (isActive ? (
                                                    sortDir === 'asc' ? (
                                                        <ChevronUp size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                                    ) : (
                                                        <ChevronDown size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                                    )
                                                ) : (
                                                    <ChevronUp size={13} style={{ opacity: 0.25, flexShrink: 0 }} />
                                                ))}
                                        </span>
                                        {col.id !== 'actions' && (
                                            <div
                                                className={`column-resizer ${resizingColId === col.id ? 'resizing' : ''}`}
                                                onMouseDown={(e) => onResizeStart(e, col.id, colWidth)}
                                                onClick={(e) => e.stopPropagation()}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    onResetSingleColumnWidth(col.id);
                                                }}
                                                title="Потяните для изменения ширины (двойной клик для сброса)"
                                            />
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {overtimes.map((ot: Overtime) => (
                            <tr key={ot.id}>
                                {visibleColumns.map((col) => {
                                    const colWidth = col.width || defaultColumnWidths[col.id] || 150;
                                    const cellStyle: React.CSSProperties = {
                                        width: `${colWidth}px`,
                                        minWidth: `${colWidth}px`,
                                        maxWidth: `${colWidth}px`,
                                        boxSizing: 'border-box',
                                    };
                                    switch (col.id) {
                                        case 'date':
                                            return (
                                                <td key={col.id} className="table-cell" style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                                                    {formatDate(ot.start_time)}
                                                </td>
                                            );
                                        case 'user':
                                            return (
                                                <td key={col.id} className="table-cell" style={{ ...cellStyle, overflow: 'hidden' }}>
                                                    <div
                                                        style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}
                                                        title={ot.user?.full_name || '-'}
                                                    >
                                                        {ot.user?.full_name || '-'}
                                                    </div>
                                                    <div
                                                        style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}
                                                        title={ot.user?.email || ''}
                                                    >
                                                        {ot.user?.email}
                                                    </div>
                                                </td>
                                            );
                                        case 'project':
                                            return (
                                                <td key={col.id} className="table-cell" style={{ ...cellStyle, overflow: 'hidden' }}>
                                                    <div
                                                        style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}
                                                        title={ot.project?.name || 'Внутренний'}
                                                    >
                                                        {ot.project?.name || 'Внутренний'}
                                                    </div>
                                                </td>
                                            );
                                        case 'hours':
                                            return (
                                                <td key={col.id} className="table-cell" style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                                                    {ot.hours}ч
                                                </td>
                                            );
                                        case 'approved_hours': {
                                            const isApproved =
                                                ot.status === 'APPROVED' ||
                                                ot.status === 'MANAGER_APPROVED' ||
                                                ot.status === 'HEAD_APPROVED';
                                            return (
                                                <td key={col.id} className="table-cell" style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                                                    {isApproved && ot.approved_hours != null ? (
                                                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{ot.approved_hours}ч</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                    )}
                                                </td>
                                            );
                                        }
                                        case 'status':
                                            return (
                                                <td key={col.id} className="table-cell" style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                                                    <span
                                                        className={`badge badge-${
                                                            ot.status === 'APPROVED'
                                                                ? 'success'
                                                                : ot.status === 'REJECTED' || ot.status === 'CANCELLED'
                                                                ? 'danger'
                                                                : ot.status === 'IN_PROGRESS'
                                                                ? 'info'
                                                                : 'warning'
                                                        }`}
                                                    >
                                                        {STATUS_LABELS[ot.status] || ot.status}
                                                    </span>
                                                </td>
                                            );
                                        case 'description':
                                            return (
                                                <td
                                                    key={col.id}
                                                    className="table-cell"
                                                    style={{ ...cellStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                    title={ot.description}
                                                >
                                                    {ot.description || '-'}
                                                </td>
                                            );
                                        case 'start_time':
                                            return (
                                                <td key={col.id} className="table-cell" style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                                                    {formatTime(ot.start_time)}
                                                </td>
                                            );
                                        case 'end_time': {
                                            const isEndEpoch = ot.end_time && new Date(ot.end_time).getFullYear() <= 1970;
                                            return (
                                                <td key={col.id} className="table-cell" style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                                                    {ot.status === 'IN_PROGRESS' || !ot.end_time || isEndEpoch ? '-' : formatTime(ot.end_time)}
                                                </td>
                                            );
                                        }
                                        case 'actions':
                                            return (
                                                <td key={col.id} className="table-cell" style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    {renderActionButtons(ot)}
                                                </td>
                                            );
                                        default:
                                            return null;
                                    }
                                })}
                            </tr>
                        ))}
                        {overtimes.length === 0 && (
                            <tr>
                                <td
                                    colSpan={visibleColumns.length}
                                    style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}
                                >
                                    Ничего не найдено
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div
                style={{
                    padding: '16px 24px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-secondary)',
                }}
            >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Страница <b>{currentPage}</b> из <b>{totalPages}</b>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="action-button-modern"
                        style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="action-button-modern"
                        style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </>
    );
};
