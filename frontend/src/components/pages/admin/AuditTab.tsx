import React, { useState, useEffect, useCallback } from 'react';
import {
    History,
    Search,
    Download,
    Calendar,
    Filter,
    X,
    Eye,
    ChevronLeft,
    ChevronRight,
    RefreshCw
} from 'lucide-react';
import type { AuditLog } from '../../../types';
import { getAuditLogs, exportAuditLogs } from '../../../services/api';
import {
    AUDIT_CATEGORIES,
    getActionMeta,
    formatActionSummary
} from './auditUtils';


interface AuditTabProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
}

/**
 * Вкладка журнала аудита и истории действий в системе.
 * Предоставляет расширенный поиск, фильтрацию по датам и категориям,
 * человекопонятное описание событий, детальный просмотр и выгрузку отчетов в Excel.
 */
export const AuditTab: React.FC<AuditTabProps> = ({ searchQuery, onSearchChange }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [exportLoading, setExportLoading] = useState(false);
    const [totalItems, setTotalItems] = useState(0);

    // Пагинация
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Фильтры
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [startDate, setStartDate] = useState<string>(() => {
        // По умолчанию: 1-е число текущего месяца
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        return firstDay.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => {
        // По умолчанию: текущий день
        return new Date().toISOString().split('T')[0];
    });

    // Локальный поисковый инпут
    const [searchInput, setSearchInput] = useState(searchQuery);

    // Выбранная запись для просмотра в модальном окне
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    // Синхронизация локального инпута с внешним searchQuery
    useEffect(() => {
        setSearchInput(searchQuery);
    }, [searchQuery]);

    // Загрузка логов аудита
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getAuditLogs({
                limit: pageSize,
                offset: (currentPage - 1) * pageSize,
                search: searchQuery.trim() || undefined,
                start_date: startDate ? `${startDate}T00:00:00` : undefined,
                end_date: endDate ? `${endDate}T23:59:59` : undefined,
                category: selectedCategory !== 'all' ? selectedCategory : undefined,
            });

            if (res && res.items) {
                setLogs(res.items);
                setTotalItems(res.total);
            } else {
                setLogs([]);
                setTotalItems(0);
            }
        } catch (err) {
            console.error('Ошибка загрузки журнала аудита:', err);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, searchQuery, startDate, endDate, selectedCategory]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    // Быстрые пресеты периода
    const applyDatePreset = (preset: 'today' | 'week' | 'month' | 'all') => {
        const now = new Date();
        setCurrentPage(1);

        if (preset === 'today') {
            const todayStr = now.toISOString().split('T')[0];
            setStartDate(todayStr);
            setEndDate(todayStr);
        } else if (preset === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(now.getDate() - 7);
            setStartDate(weekAgo.toISOString().split('T')[0]);
            setEndDate(now.toISOString().split('T')[0]);
        } else if (preset === 'month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            setStartDate(firstDay.toISOString().split('T')[0]);
            setEndDate(now.toISOString().split('T')[0]);
        } else if (preset === 'all') {
            setStartDate('');
            setEndDate('');
        }
    };

    // Выгрузка в Excel
    const handleExportExcel = async () => {
        setExportLoading(true);
        try {
            const blob = await exportAuditLogs({
                search: searchQuery.trim() || undefined,
                start_date: startDate ? `${startDate}T00:00:00` : undefined,
                end_date: endDate ? `${endDate}T23:59:59` : undefined,
                category: selectedCategory !== 'all' ? selectedCategory : undefined,
            });

            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            const nowStr = new Date().toISOString().slice(0, 10);
            link.setAttribute('download', `audit_report_${nowStr}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (err) {
            console.error('Ошибка выгрузки отчета:', err);
            alert('Не удалось выгрузить отчет. Проверьте фильтры или попробуйте позже.');
        } finally {
            setExportLoading(false);
        }
    };

    const handleSearchSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        onSearchChange(searchInput);
        setCurrentPage(1);
    };

    const handleSearchClear = () => {
        setSearchInput('');
        onSearchChange('');
        setCurrentPage(1);
    };

    const formatDateTimeLocal = (dateStr?: string) => {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr);
            return d.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Панель фильтров и выгрузки */}
            <div
                className="glass-card"
                style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                }}
            >
                {/* Верхняя строка: Поиск и кнопка Выгрузки в Excel */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <form
                        onSubmit={handleSearchSubmit}
                        style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '280px', position: 'relative' }}
                    >
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search
                                size={18}
                                style={{ position: 'absolute', left: '14px', top: '13px', color: 'var(--text-muted)' }}
                            />
                            <input
                                placeholder="Поиск по истории (ФИО, действие, комментарии, ID заявки)..."
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                style={{ paddingLeft: '42px', paddingRight: searchInput ? '36px' : '14px' }}
                            />
                            {searchInput && (
                                <button
                                    type="button"
                                    onClick={handleSearchClear}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '12px',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        <button
                            type="submit"
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
                            }}
                        >
                            <Search size={15} />
                            Найти
                        </button>
                    </form>

                    <button
                        onClick={handleExportExcel}
                        disabled={exportLoading || totalItems === 0}
                        className="primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 20px',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            whiteSpace: 'nowrap',
                            background: 'var(--accent-gradient)',
                            opacity: exportLoading || totalItems === 0 ? 0.6 : 1,
                        }}
                    >
                        <Download size={16} />
                        {exportLoading ? 'Формирование отчета...' : 'Выгрузить в Excel (.xlsx)'}
                    </button>
                </div>

                {/* Нижняя строка: Фильтр дат, пресеты и категории */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '16px',
                        borderTop: '1px solid var(--border)',
                        paddingTop: '16px',
                    }}
                >
                    {/* Выбор периода */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                            <Calendar size={16} />
                            <span>Период:</span>
                        </div>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => {
                                setStartDate(e.target.value);
                                setCurrentPage(1);
                            }}
                            style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto' }}
                        />
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => {
                                setEndDate(e.target.value);
                                setCurrentPage(1);
                            }}
                            style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto' }}
                        />

                        {/* Пресеты дат */}
                        <div style={{ display: 'flex', gap: '4px', marginLeft: '6px' }}>
                            <button
                                type="button"
                                onClick={() => applyDatePreset('today')}
                                className="secondary"
                                style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                            >
                                Сегодня
                            </button>
                            <button
                                type="button"
                                onClick={() => applyDatePreset('week')}
                                className="secondary"
                                style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                            >
                                7 дней
                            </button>
                            <button
                                type="button"
                                onClick={() => applyDatePreset('month')}
                                className="secondary"
                                style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                            >
                                Месяц
                            </button>
                            <button
                                type="button"
                                onClick={() => applyDatePreset('all')}
                                className="secondary"
                                style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                            >
                                Все
                            </button>
                        </div>
                    </div>

                    {/* Фильтр по категориям */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                            <Filter size={15} />
                            <span>Категория:</span>
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={e => {
                                setSelectedCategory(e.target.value);
                                setCurrentPage(1);
                            }}
                            style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', minWidth: '180px' }}
                        >
                            {AUDIT_CATEGORIES.map(c => (
                                <option key={c.key} value={c.key}>
                                    {c.title}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Таблица истории аудита */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                        <div>Загрузка записей истории...</div>
                    </div>
                ) : logs.length === 0 ? (
                    <div
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
                        <History size={48} style={{ opacity: 0.3 }} />
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Записи истории не найдены
                        </div>
                        <div style={{ fontSize: '0.85rem' }}>
                            Попробуйте изменить параметры поиска или расширить временной диапазон.
                        </div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table-container" style={{ minWidth: '950px', width: '100%' }}>
                            <thead>
                                <tr>
                                    <th className="table-header" style={{ width: '150px' }}>
                                        Дата и время
                                    </th>
                                    <th className="table-header" style={{ width: '220px' }}>
                                        Кто выполнил
                                    </th>
                                    <th className="table-header" style={{ width: '210px' }}>
                                        Событие
                                    </th>
                                    <th className="table-header" style={{ width: '140px' }}>
                                        Объект
                                    </th>
                                    <th className="table-header">Подробности изменений</th>
                                    <th className="table-header" style={{ width: '80px', textAlign: 'right' }}>
                                        Инфо
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => {
                                    const meta = getActionMeta(log.action);
                                    const summary = formatActionSummary(log.action, log.details);
                                    const userName = log.user?.full_name || (log.user_id ? `Пользователь #${log.user_id}` : 'Система');
                                    const userEmail = log.user?.email || '';

                                    return (
                                        <tr
                                            key={log.id}
                                            onClick={() => setSelectedLog(log)}
                                            style={{ cursor: 'pointer', transition: 'background-color 0.15s' }}
                                        >
                                            <td className="table-cell" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {formatDateTimeLocal(log.timestamp)}
                                            </td>
                                            <td className="table-cell">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div
                                                        className="icon-shape"
                                                        style={{
                                                            width: '32px',
                                                            height: '32px',
                                                            borderRadius: '8px',
                                                            background: log.user_id ? 'var(--bg-tertiary)' : 'rgba(168, 85, 247, 0.15)',
                                                            color: log.user_id ? 'var(--text-primary)' : '#a855f7',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 700,
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        {log.user_id ? userName.charAt(0).toUpperCase() : <History size={15} />}
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                                            {userName}
                                                        </div>
                                                        {userEmail && (
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{userEmail}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="table-cell">
                                                <span
                                                    className="badge"
                                                    style={{
                                                        background: meta.badgeBg,
                                                        color: meta.badgeColor,
                                                        fontWeight: 700,
                                                        fontSize: '0.75rem',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        display: 'inline-block',
                                                    }}
                                                >
                                                    {meta.title}
                                                </span>
                                            </td>
                                            <td className="table-cell" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {log.target_type ? (
                                                    <span>
                                                        {log.target_type} {log.target_id ? `(#${log.target_id})` : ''}
                                                    </span>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td className="table-cell" style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                                {summary}
                                            </td>
                                            <td className="table-cell" style={{ textAlign: 'right' }}>
                                                <button
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        setSelectedLog(log);
                                                    }}
                                                    className="action-button-modern"
                                                    title="Посмотреть подробности"
                                                >
                                                    <Eye size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Пагинация */}
            {totalPages > 1 && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '16px',
                        flexWrap: 'wrap',
                        padding: '0 4px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Строк на странице:</span>
                        <select
                            value={pageSize}
                            onChange={e => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            style={{ padding: '4px 10px', width: 'auto', borderRadius: '8px', fontSize: '0.8rem' }}
                        >
                            {[15, 25, 50, 100].map(v => (
                                <option key={v} value={v}>
                                    {v}
                                </option>
                            ))}
                        </select>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Всего записей: {totalItems}
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="secondary"
                            style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                        >
                            <ChevronLeft size={16} /> Назад
                        </button>
                        <div style={{ padding: '0 12px', fontWeight: 700, fontSize: '0.85rem' }}>
                            {currentPage} / {totalPages}
                        </div>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="secondary"
                            style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                        >
                            Далее <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Модальное окно детализированного просмотра события */}
            {selectedLog && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.65)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1100,
                        backdropFilter: 'blur(6px)',
                        padding: '16px',
                    }}
                    onClick={() => setSelectedLog(null)}
                >
                    <div
                        className="glass-card"
                        style={{
                            width: '680px',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            padding: '28px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '20px',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <History size={22} style={{ color: 'var(--primary)' }} />
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Детализация события аудита</h3>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)',
                                    fontSize: '1.5rem',
                                    lineHeight: 1,
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Базовая информация о событии */}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: '14px',
                                background: 'var(--bg-tertiary)',
                                padding: '16px',
                                borderRadius: '12px',
                            }}
                        >
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    Дата и время
                                </div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '2px' }}>
                                    {formatDateTimeLocal(selectedLog.timestamp)}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    Пользователь
                                </div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '2px' }}>
                                    {selectedLog.user?.full_name || (selectedLog.user_id ? `ID: ${selectedLog.user_id}` : 'Система')}
                                </div>
                                {selectedLog.user?.email && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedLog.user.email}</div>
                                )}
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    Действие
                                </div>
                                <div style={{ marginTop: '4px' }}>
                                    <span
                                        className="badge"
                                        style={{
                                            background: getActionMeta(selectedLog.action).badgeBg,
                                            color: getActionMeta(selectedLog.action).badgeColor,
                                            fontWeight: 700,
                                            fontSize: '0.8rem',
                                        }}
                                    >
                                        {getActionMeta(selectedLog.action).title}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    Объект
                                </div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '2px' }}>
                                    {selectedLog.target_type || '—'} {selectedLog.target_id ? `(#${selectedLog.target_id})` : ''}
                                </div>
                            </div>
                        </div>

                        {/* Подробности и изменения */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Структура изменений</h4>

                            {selectedLog.action === 'UPDATE_OVERTIME_TIME' && selectedLog.details ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        Изменение времени переработки пользователем{' '}
                                        <strong>{String(selectedLog.details.updated_by || 'Не указан')}</strong> (
                                        {String(selectedLog.details.role || '—')}).
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-secondary)' }}>
                                                    Параметр
                                                </th>
                                                <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-secondary)' }}>
                                                    Было
                                                </th>
                                                <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-secondary)' }}>
                                                    Стало
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '8px 0', fontWeight: 600 }}>Начало</td>
                                                <td style={{ padding: '8px 0', color: 'var(--danger)' }}>
                                                    {String(selectedLog.details.old_start || '—')}
                                                </td>
                                                <td style={{ padding: '8px 0', color: 'var(--success)', fontWeight: 600 }}>
                                                    {String(selectedLog.details.new_start || '—')}
                                                </td>
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '8px 0', fontWeight: 600 }}>Окончание</td>
                                                <td style={{ padding: '8px 0', color: 'var(--danger)' }}>
                                                    {String(selectedLog.details.old_end || '—')}
                                                </td>
                                                <td style={{ padding: '8px 0', color: 'var(--success)', fontWeight: 600 }}>
                                                    {String(selectedLog.details.new_end || '—')}
                                                </td>
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '8px 0', fontWeight: 600 }}>Часы</td>
                                                <td style={{ padding: '8px 0', color: 'var(--danger)' }}>
                                                    {String(selectedLog.details.old_hours ?? '—')} ч.
                                                </td>
                                                <td style={{ padding: '8px 0', color: 'var(--success)', fontWeight: 600 }}>
                                                    {String(selectedLog.details.new_hours ?? '—')} ч.
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : selectedLog.action.startsWith('REVIEW_') && selectedLog.details ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
                                    <div>
                                        <strong>Решение: </strong>
                                        <span
                                            style={{
                                                fontWeight: 700,
                                                color: selectedLog.details.approved ? 'var(--success)' : 'var(--danger)',
                                            }}
                                        >
                                            {selectedLog.details.approved ? 'Одобрено' : 'Отклонено'}
                                        </span>
                                    </div>
                                    {selectedLog.details.approved_hours !== undefined && (
                                        <div>
                                            <strong>Согласованные часы: </strong>
                                            <span>
                                                {String(selectedLog.details.approved_hours)} ч. (запрошено:{' '}
                                                {String(selectedLog.details.requested_hours)} ч.)
                                            </span>
                                        </div>
                                    )}
                                    {Boolean(selectedLog.details.comment) && (
                                        <div
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                padding: '12px',
                                                borderRadius: '8px',
                                                borderLeft: '3px solid var(--primary)',
                                                marginTop: '6px',
                                            }}
                                        >
                                            <strong>Комментарий согласующего: </strong>
                                            <span style={{ fontStyle: 'italic' }}>{String(selectedLog.details.comment)}</span>
                                        </div>
                                    )}
                                </div>
                            ) : selectedLog.action === 'CANCEL_OVERTIME' && selectedLog.details ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
                                    <div>
                                        <strong>Инициатор отмены: </strong>
                                        <span>{String(selectedLog.details.cancelled_by || '—')}</span>
                                    </div>
                                    <div>
                                        <strong>Предыдущий статус: </strong>
                                        <span>{String(selectedLog.details.previous_status || '—')}</span>
                                    </div>
                                    {Boolean(selectedLog.details.description) && (
                                        <div>
                                            <strong>Описание переработки: </strong>
                                            <span>{String(selectedLog.details.description)}</span>
                                        </div>
                                    )}
                                </div>

                            ) : (
                                <div
                                    style={{
                                        background: 'var(--bg-tertiary)',
                                        padding: '14px',
                                        borderRadius: '8px',
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    {formatActionSummary(selectedLog.action, selectedLog.details)}
                                </div>
                            )}

                            {/* Раскрывающийся JSON для технических деталей */}
                            {selectedLog.details && (
                                <details style={{ marginTop: '8px' }}>
                                    <summary
                                        style={{
                                            cursor: 'pointer',
                                            fontSize: '0.8rem',
                                            color: 'var(--text-muted)',
                                            fontWeight: 600,
                                        }}
                                    >
                                        Сырые данные (JSON)
                                    </summary>
                                    <pre
                                        style={{
                                            background: 'var(--bg-main)',
                                            padding: '14px',
                                            borderRadius: '8px',
                                            overflowX: 'auto',
                                            fontSize: '0.75rem',
                                            fontFamily: 'monospace',
                                            marginTop: '8px',
                                            margin: 0,
                                        }}
                                    >
                                        {JSON.stringify(selectedLog.details, null, 2)}
                                    </pre>
                                </details>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                            <button className="primary" onClick={() => setSelectedLog(null)} style={{ padding: '8px 24px' }}>
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
