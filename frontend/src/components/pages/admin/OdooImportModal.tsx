import React, { useState, useMemo, useEffect } from 'react';
import { Search, Download, X as XIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { getOdooProjects, importOdooProjects } from '../../../services/api';
import type { OdooProjectPreview } from '../../../types';
import { AxiosError } from 'axios';

interface OdooImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

/**
 * Модальное окно импорта проектов из Odoo CRM через XML-RPC.
 *
 * Предоставляет интерфейс поиска, фильтрации, пагинации, пакетного выбора проектов
 * и отображения результатов импорта.
 */
export const OdooImportModal: React.FC<OdooImportModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
}) => {
    const [odooProjects, setOdooProjects] = useState<OdooProjectPreview[]>([]);
    const [odooLoading, setOdooLoading] = useState(false);
    const [odooError, setOdooError] = useState('');
    const [selectedOdooIds, setSelectedOdooIds] = useState<Set<number>>(new Set());
    const [importLoading, setImportLoading] = useState(false);
    const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
    const [odooSearch, setOdooSearch] = useState('');
    const [odooPage, setOdooPage] = useState(1);
    const [odooPageSize, setOdooPageSize] = useState(10);

    // Загрузка проектов при открытии
    useEffect(() => {
        if (!isOpen) return;
        setOdooLoading(true);
        setOdooError('');
        setSelectedOdooIds(new Set());
        setImportResult(null);
        setOdooSearch('');
        setOdooPage(1);

        getOdooProjects()
            .then(data => {
                setOdooProjects(data.projects || []);
            })
            .catch((err: unknown) => {
                const axiosError = err as AxiosError<{ detail?: string }>;
                setOdooError(axiosError.response?.data?.detail || 'Не удалось загрузить проекты из Odoo');
            })
            .finally(() => setOdooLoading(false));
    }, [isOpen]);

    // Фильтрация
    const filteredOdooProjects = useMemo(() => {
        const q = odooSearch.toLowerCase().trim();
        if (!q) return odooProjects;
        return odooProjects.filter(p => {
            const nameMatch = p.name ? p.name.toLowerCase().includes(q) : false;
            const codeMatch = p.code ? p.code.toLowerCase().includes(q) : false;
            const idMatch = p.odoo_id ? p.odoo_id.toString().includes(q) : false;
            const managerMatch = p.manager_name ? p.manager_name.toLowerCase().includes(q) : false;
            return nameMatch || codeMatch || idMatch || managerMatch;
        });
    }, [odooProjects, odooSearch]);

    const totalOdooPages = Math.max(1, Math.ceil(filteredOdooProjects.length / (odooPageSize >= 1000 ? (filteredOdooProjects.length || 1) : odooPageSize)));

    const paginatedOdooProjects = useMemo(() => {
        if (odooPageSize >= 1000) return filteredOdooProjects;
        const start = (odooPage - 1) * odooPageSize;
        return filteredOdooProjects.slice(start, start + odooPageSize);
    }, [filteredOdooProjects, odooPage, odooPageSize]);

    const isCurrentPageAllSelected = paginatedOdooProjects.length > 0 && paginatedOdooProjects.every(p => selectedOdooIds.has(p.odoo_id));
    const isAllFilteredSelected = filteredOdooProjects.length > 0 && filteredOdooProjects.every(p => selectedOdooIds.has(p.odoo_id));

    const toggleSelectCurrentPage = () => {
        setSelectedOdooIds(prev => {
            const next = new Set(prev);
            if (isCurrentPageAllSelected) {
                paginatedOdooProjects.forEach(p => next.delete(p.odoo_id));
            } else {
                paginatedOdooProjects.forEach(p => next.add(p.odoo_id));
            }
            return next;
        });
    };

    const toggleSelectAllFiltered = () => {
        setSelectedOdooIds(prev => {
            const next = new Set(prev);
            if (isAllFilteredSelected) {
                filteredOdooProjects.forEach(p => next.delete(p.odoo_id));
            } else {
                filteredOdooProjects.forEach(p => next.add(p.odoo_id));
            }
            return next;
        });
    };

    const toggleOdooProject = (odooId: number) => {
        setSelectedOdooIds(prev => {
            const next = new Set(prev);
            if (next.has(odooId)) next.delete(odooId);
            else next.add(odooId);
            return next;
        });
    };

    const handleImportSelected = async () => {
        if (selectedOdooIds.size === 0) return;
        const toImport = odooProjects.filter(p => selectedOdooIds.has(p.odoo_id));
        setImportLoading(true);
        setOdooError('');
        try {
            const result = await importOdooProjects(toImport);
            setImportResult(result);
            onSuccess();
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ detail?: string }>;
            setOdooError(axiosError.response?.data?.detail || 'Ошибка при импорте проектов');
        } finally {
            setImportLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={onClose}>
            <div
                className="modal-content glass-card animate-scale-in"
                style={{
                    maxWidth: '720px', width: '95%',
                    maxHeight: '88vh', height: '88vh',
                    display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Заголовок */}
                <div style={{
                    padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg-secondary)', flexShrink: 0
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                            Импорт проектов из Odoo CRM
                        </h3>
                        {!odooLoading && !odooError && odooProjects.length > 0 && (
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Всего: <strong>{odooProjects.length}</strong>
                                {odooSearch && <> · Найдено: <strong>{filteredOdooProjects.length}</strong></>}
                                {' '}· Выбрано: <strong style={{ color: selectedOdooIds.size > 0 ? 'var(--accent)' : 'inherit' }}>{selectedOdooIds.size}</strong>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px', borderRadius: '8px' }}
                    >
                        <XIcon size={20} />
                    </button>
                </div>

                {/* Панель поиска и выбора */}
                {!odooLoading && !odooError && odooProjects.length > 0 && (
                    <div style={{
                        padding: '12px 24px', borderBottom: '1px solid var(--border)',
                        background: 'var(--bg-tertiary)', display: 'flex', flexDirection: 'column', gap: '10px',
                        flexShrink: 0
                    }}>
                        <div style={{ position: 'relative', width: '100%' }}>
                            <input
                                type="text"
                                value={odooSearch}
                                onChange={e => { setOdooSearch(e.target.value); setOdooPage(1); }}
                                placeholder="Поиск по названию, коду или Odoo ID..."
                                style={{
                                    width: '100%', padding: '9px 36px 9px 38px',
                                    borderRadius: '10px', border: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)', color: 'var(--text-main)',
                                    fontSize: '0.85rem', boxSizing: 'border-box'
                                }}
                            />
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            {odooSearch && (
                                <button
                                    type="button"
                                    onClick={() => { setOdooSearch(''); setOdooPage(1); }}
                                    style={{
                                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                                        padding: '2px', display: 'flex', alignItems: 'center'
                                    }}
                                >
                                    <XIcon size={14} />
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    id="select-page-odoo"
                                    checked={isCurrentPageAllSelected}
                                    onChange={toggleSelectCurrentPage}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                                />
                                <label htmlFor="select-page-odoo" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    {isCurrentPageAllSelected ? 'Снять выбор на странице' : `Выбрать все на странице (${paginatedOdooProjects.length})`}
                                </label>
                            </div>

                            {filteredOdooProjects.length > paginatedOdooProjects.length && (
                                <button
                                    type="button"
                                    onClick={toggleSelectAllFiltered}
                                    className="secondary"
                                    style={{
                                        padding: '4px 10px', fontSize: '0.78rem', borderRadius: '8px',
                                        color: isAllFilteredSelected ? 'var(--warning)' : 'var(--accent)',
                                        borderColor: isAllFilteredSelected ? 'var(--warning)' : 'var(--border)'
                                    }}
                                >
                                    {isAllFilteredSelected ? 'Снять со всех найденных' : `Выбрать все найденные (${filteredOdooProjects.length})`}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Тело со скроллингом */}
                <div className="custom-scrollbar" style={{
                    flex: 1, minHeight: 0, overflowY: 'auto',
                    padding: '16px 24px', display: 'flex', flexDirection: 'column'
                }}>
                    {odooLoading && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px', margin: 'auto' }}>
                            <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Подключение к Odoo CRM...</p>
                        </div>
                    )}

                    {odooError && !odooLoading && (
                        <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '16px' }}>
                            ⚠️ {odooError}
                        </div>
                    )}

                    {importResult && (
                        <div style={{ marginBottom: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(34,197,94,0.08)', border: '1px solid var(--success)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: '8px' }}>
                                ✅ Импорт завершён
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Импортировано: <strong>{importResult.imported}</strong> · Пропущено (дубликаты): <strong>{importResult.skipped}</strong>
                            </div>
                            {importResult.errors.length > 0 && (
                                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--warning)' }}>
                                    {importResult.errors.map((e, i) => <div key={i}>⚠️ {e}</div>)}
                                </div>
                            )}
                        </div>
                    )}

                    {!odooLoading && !odooError && paginatedOdooProjects.map(p => {
                        const isSelected = selectedOdooIds.has(p.odoo_id);
                        return (
                            <div
                                key={p.odoo_id}
                                onClick={() => toggleOdooProject(p.odoo_id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                                    background: isSelected ? 'rgba(59,130,246,0.08)' : 'var(--bg-secondary)',
                                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                                    marginBottom: '8px', transition: 'all 0.15s ease',
                                    boxShadow: isSelected ? '0 0 0 1px var(--accent)' : 'none'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleOdooProject(p.odoo_id)}
                                    onClick={e => e.stopPropagation()}
                                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', flexShrink: 0, cursor: 'pointer' }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                                        {p.name}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        {p.code ? (
                                            <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, background: 'rgba(56,189,248,0.12)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.25)' }}>
                                                {p.code}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.72rem', color: 'var(--warning)', fontStyle: 'italic' }}>
                                                Без кода
                                            </span>
                                        )}
                                        {p.manager_name && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                👤 {p.manager_name}
                                                {p.manager_email && <span style={{ opacity: 0.7 }}> ({p.manager_email})</span>}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600, flexShrink: 0, padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                                    #{p.odoo_id}
                                </span>
                            </div>
                        );
                    })}

                    {!odooLoading && !odooError && odooProjects.length > 0 && filteredOdooProjects.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', margin: 'auto' }}>
                            <Search size={36} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <p>Ничего не найдено по запросу «{odooSearch}»</p>
                        </div>
                    )}

                    {!odooLoading && !odooError && odooProjects.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', margin: 'auto' }}>
                            <Download size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                            <p>Проекты в Odoo не найдены или Odoo не настроен</p>
                        </div>
                    )}
                </div>

                {/* Панель пагинации */}
                {!odooLoading && !odooError && filteredOdooProjects.length > 0 && (
                    <div style={{
                        padding: '10px 24px', borderTop: '1px solid var(--border)',
                        background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', flexWrap: 'wrap', gap: '10px', flexShrink: 0
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Строк на стр:</span>
                            <select
                                value={odooPageSize}
                                onChange={e => { setOdooPageSize(Number(e.target.value)); setOdooPage(1); }}
                                style={{ padding: '3px 8px', width: 'auto', borderRadius: '8px', fontSize: '0.78rem', background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                            >
                                {[10, 20, 50, 100, 1000].map(v => (
                                    <option key={v} value={v}>{v === 1000 ? 'Все' : v}</option>
                                ))}
                            </select>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {(odooPage - 1) * odooPageSize + 1}–{Math.min(odooPage * odooPageSize, filteredOdooProjects.length)} из {filteredOdooProjects.length}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                type="button"
                                disabled={odooPage <= 1}
                                onClick={() => setOdooPage(p => Math.max(1, p - 1))}
                                className="secondary"
                                style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <ChevronLeft size={14} /> Назад
                            </button>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', padding: '0 4px' }}>
                                {odooPage} / {totalOdooPages}
                            </span>
                            <button
                                type="button"
                                disabled={odooPage >= totalOdooPages}
                                onClick={() => setOdooPage(p => Math.min(totalOdooPages, p + 1))}
                                className="secondary"
                                style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                Далее <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Футер */}
                <div style={{
                    padding: '16px 24px', borderTop: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg-secondary)', gap: '12px', flexShrink: 0
                }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {selectedOdooIds.size > 0
                            ? `Выбрано ${selectedOdooIds.size} из ${odooProjects.length} проектов`
                            : 'Выберите проекты для импорта'}
                    </span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem' }}
                        >
                            Закрыть
                        </button>
                        <button
                            type="button"
                            onClick={handleImportSelected}
                            disabled={selectedOdooIds.size === 0 || importLoading}
                            className="primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '10px', fontSize: '0.85rem' }}
                        >
                            {importLoading ? (
                                <>Импорт...</>
                            ) : (
                                <><Download size={16} /> Импортировать ({selectedOdooIds.size})</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OdooImportModal;
