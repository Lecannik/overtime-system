import React, { useState, useMemo, useEffect } from 'react';
import { Search, Globe, Plus, X as XIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { getOdooIntegrationProjects, importOdooIntegrationProjects } from '../../../services/api';
import type { OdooIntegrationProject } from '../../../types';
import { AxiosError } from 'axios';

interface OdooIntegrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

/**
 * Модальное окно выгрузки и импорта проектов из Odoo CRM через микросервис интеграции (API).
 *
 * Позволяет динамически выбирать поля для выгрузки (партнер, статус, сумма),
 * осуществлять серверный/клиентский поиск и пакетно создавать проекты в системе.
 */
export const OdooIntegrationModal: React.FC<OdooIntegrationModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
}) => {
    const [odooIntProjects, setOdooIntProjects] = useState<OdooIntegrationProject[]>([]);
    const [odooIntLoading, setOdooIntLoading] = useState(false);
    const [odooIntError, setOdooIntError] = useState('');
    const [selectedOdooIntIds, setSelectedOdooIntIds] = useState<Set<number>>(new Set());
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(['name', 'code']));
    const [odooIntSearch, setOdooIntSearch] = useState('');
    const [odooIntImportLoading, setOdooIntImportLoading] = useState(false);
    const [odooIntImportResult, setOdooIntImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
    const [odooIntPage, setOdooIntPage] = useState(1);
    const [odooIntPageSize, setOdooIntPageSize] = useState(10);

    const loadProjects = async (fieldsToFetch: string[], queryText: string) => {
        setOdooIntLoading(true);
        setOdooIntError('');
        try {
            const trimmedQuery = queryText.trim() || undefined;
            const data = await getOdooIntegrationProjects(
                fieldsToFetch.length > 0 ? fieldsToFetch : undefined,
                trimmedQuery,
                trimmedQuery
            );
            setOdooIntProjects(data);
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ detail?: string }>;
            setOdooIntError(axiosError.response?.data?.detail || 'Не удалось получить проекты из сервиса интеграции Odoo');
        } finally {
            setOdooIntLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        setSelectedOdooIntIds(new Set());
        setOdooIntImportResult(null);
        setOdooIntSearch('');
        setOdooIntPage(1);
        loadProjects(Array.from(selectedFields), '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const toggleFieldSelection = (field: string) => {
        const next = new Set(selectedFields);
        if (next.has(field)) {
            next.delete(field);
        } else {
            next.add(field);
        }
        setSelectedFields(next);
        loadProjects(Array.from(next), odooIntSearch);
    };

    const handleOdooIntSearch = () => {
        loadProjects(Array.from(selectedFields), odooIntSearch);
    };

    // Фильтрация
    const filteredOdooIntProjects = useMemo(() => {
        const search = odooIntSearch.toLowerCase().trim();
        if (!search) return odooIntProjects;
        return odooIntProjects.filter(p => {
            const nameMatch = p.name ? p.name.toLowerCase().includes(search) : false;
            const codeMatch = p.code ? p.code.toLowerCase().includes(search) : false;
            const idMatch = p.id ? p.id.toString().includes(search) : false;
            return nameMatch || codeMatch || idMatch;
        });
    }, [odooIntProjects, odooIntSearch]);

    const totalOdooIntPages = Math.max(1, Math.ceil(filteredOdooIntProjects.length / (odooIntPageSize >= 1000 ? (filteredOdooIntProjects.length || 1) : odooIntPageSize)));

    const paginatedOdooIntProjects = useMemo(() => {
        if (odooIntPageSize >= 1000) return filteredOdooIntProjects;
        const start = (odooIntPage - 1) * odooIntPageSize;
        return filteredOdooIntProjects.slice(start, start + odooIntPageSize);
    }, [filteredOdooIntProjects, odooIntPage, odooIntPageSize]);

    const isCurrentPageAllSelectedInt = paginatedOdooIntProjects.length > 0 && paginatedOdooIntProjects.every(p => selectedOdooIntIds.has(p.id));
    const isAllFilteredSelectedInt = filteredOdooIntProjects.length > 0 && filteredOdooIntProjects.every(p => selectedOdooIntIds.has(p.id));

    const toggleSelectCurrentPageInt = () => {
        setSelectedOdooIntIds(prev => {
            const next = new Set(prev);
            if (isCurrentPageAllSelectedInt) {
                paginatedOdooIntProjects.forEach(p => next.delete(p.id));
            } else {
                paginatedOdooIntProjects.forEach(p => next.add(p.id));
            }
            return next;
        });
    };

    const toggleSelectAllFilteredInt = () => {
        setSelectedOdooIntIds(prev => {
            const next = new Set(prev);
            if (isAllFilteredSelectedInt) {
                filteredOdooIntProjects.forEach(p => next.delete(p.id));
            } else {
                filteredOdooIntProjects.forEach(p => next.add(p.id));
            }
            return next;
        });
    };

    const toggleOdooIntProject = (id: number) => {
        setSelectedOdooIntIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleImportOdooIntSelected = async () => {
        if (selectedOdooIntIds.size === 0) return;
        const toImport = odooIntProjects
            .filter(p => selectedOdooIntIds.has(p.id))
            .map(p => ({
                id: p.id,
                name: p.name,
                code: p.code || '',
            }));

        setOdooIntImportLoading(true);
        setOdooIntError('');
        try {
            const result = await importOdooIntegrationProjects(toImport);
            setOdooIntImportResult(result);
            onSuccess();
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ detail?: string }>;
            setOdooIntError(axiosError.response?.data?.detail || 'Ошибка при импорте проектов');
        } finally {
            setOdooIntImportLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={onClose}>
            <div
                className="modal-content glass-card animate-scale-in"
                style={{
                    maxWidth: '820px', width: '95%',
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
                            Импорт проектов из Odoo CRM (API)
                        </h3>
                        {!odooIntLoading && !odooIntError && odooIntProjects.length > 0 && (
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Всего: <strong>{odooIntProjects.length}</strong>
                                {odooIntSearch && <> · Найдено: <strong>{filteredOdooIntProjects.length}</strong></>}
                                {' '}· Выбрано: <strong style={{ color: selectedOdooIntIds.size > 0 ? 'var(--accent)' : 'inherit' }}>{selectedOdooIntIds.size}</strong>
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

                {/* Панель фильтров и полей */}
                {!odooIntLoading && !odooIntError && (
                    <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)', display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
                        {/* Выбор полей */}
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                Выбор полей для выгрузки из Odoo:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {[
                                    { id: 'name', label: 'Имя проекта', required: true },
                                    { id: 'code', label: 'Код проекта', required: true },
                                    { id: 'status', label: 'Статус', required: false },
                                    { id: 'project_amount', label: 'Сумма', required: false },
                                    { id: 'partner', label: 'Клиент', required: false },
                                    { id: 'partner_company', label: 'Компания клиента', required: false },
                                    { id: 'project_manager_ids', label: 'Менеджеры', required: false },
                                ].map(f => {
                                    const isSelected = f.required || selectedFields.has(f.id);
                                    return (
                                        <label
                                            key={f.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                fontSize: '0.78rem', fontWeight: 600, padding: '3px 8px',
                                                borderRadius: '8px', background: isSelected ? 'rgba(59,130,246,0.1)' : 'var(--bg-secondary)',
                                                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                                                cursor: f.required ? 'not-allowed' : 'pointer',
                                                opacity: f.required ? 0.7 : 1,
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                disabled={f.required}
                                                onChange={() => toggleFieldSelection(f.id)}
                                                style={{ accentColor: 'var(--accent)' }}
                                            />
                                            {f.label}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Текстовый поиск с кнопкой */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <input
                                    type="text"
                                    value={odooIntSearch}
                                    onChange={e => { setOdooIntSearch(e.target.value); setOdooIntPage(1); }}
                                    onKeyDown={e => e.key === 'Enter' && handleOdooIntSearch()}
                                    placeholder="Поиск по названию или номеру проекта..."
                                    style={{
                                        width: '100%', padding: '9px 36px 9px 38px',
                                        borderRadius: '10px', border: '1px solid var(--border)',
                                        background: 'var(--bg-secondary)', color: 'var(--text-main)',
                                        fontSize: '0.85rem', boxSizing: 'border-box'
                                    }}
                                />
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                {odooIntSearch && (
                                    <button
                                        type="button"
                                        onClick={() => { setOdooIntSearch(''); setOdooIntPage(1); }}
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
                            <button
                                type="button"
                                onClick={handleOdooIntSearch}
                                disabled={odooIntLoading}
                                className="primary"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '9px 16px', borderRadius: '10px',
                                    fontWeight: 700, fontSize: '0.82rem',
                                    whiteSpace: 'nowrap', flexShrink: 0
                                }}
                            >
                                <Search size={14} />
                                Найти
                            </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    id="select-page-odoo-int"
                                    checked={isCurrentPageAllSelectedInt}
                                    onChange={toggleSelectCurrentPageInt}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                                />
                                <label htmlFor="select-page-odoo-int" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    {isCurrentPageAllSelectedInt ? 'Снять выбор на странице' : `Выбрать все на странице (${paginatedOdooIntProjects.length})`}
                                </label>
                            </div>

                            {filteredOdooIntProjects.length > paginatedOdooIntProjects.length && (
                                <button
                                    type="button"
                                    onClick={toggleSelectAllFilteredInt}
                                    className="secondary"
                                    style={{
                                        padding: '4px 10px', fontSize: '0.78rem', borderRadius: '8px',
                                        color: isAllFilteredSelectedInt ? 'var(--warning)' : 'var(--accent)',
                                        borderColor: isAllFilteredSelectedInt ? 'var(--warning)' : 'var(--border)'
                                    }}
                                >
                                    {isAllFilteredSelectedInt ? 'Снять со всех найденных' : `Выбрать все найденные (${filteredOdooIntProjects.length})`}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Тело со списком проектов */}
                <div className="custom-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column' }}>
                    {odooIntLoading && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px', margin: 'auto' }}>
                            <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Загрузка проектов из Odoo CRM API...</p>
                        </div>
                    )}

                    {odooIntError && !odooIntLoading && (
                        <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '16px' }}>
                            ⚠️ {odooIntError}
                        </div>
                    )}

                    {/* Результат импорта */}
                    {odooIntImportResult && (
                        <div style={{ marginBottom: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(34,197,94,0.08)', border: '1px solid var(--success)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: '8px' }}>
                                ✅ Импорт успешно завершён
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Создано проектов: <strong>{odooIntImportResult.imported}</strong> · Пропущено (уже существуют): <strong>{odooIntImportResult.skipped}</strong>
                            </div>
                            {odooIntImportResult.errors.length > 0 && (
                                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--warning)' }}>
                                    {odooIntImportResult.errors.map((e, i) => <div key={i}>⚠️ {e}</div>)}
                                </div>
                            )}
                        </div>
                    )}

                    {!odooIntLoading && !odooIntError && paginatedOdooIntProjects.map(p => {
                        const isSelected = selectedOdooIntIds.has(p.id);
                        return (
                            <div
                                key={p.id}
                                onClick={() => toggleOdooIntProject(p.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '14px',
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
                                    onChange={() => toggleOdooIntProject(p.id)}
                                    onClick={e => e.stopPropagation()}
                                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', flexShrink: 0, cursor: 'pointer' }}
                                />
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ minWidth: 0 }}>
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
                                            {selectedFields.has('partner') && p.partner && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    🤝 Клиент: <strong>{Array.isArray(p.partner) ? p.partner[1] : (typeof p.partner === 'object' ? (p.partner as { name?: string }).name : p.partner)}</strong>
                                                </span>
                                            )}
                                            {selectedFields.has('partner_company') && p.partner_company && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    🏢 Компания: <strong>{Array.isArray(p.partner_company) ? p.partner_company[1] : (typeof p.partner_company === 'object' ? (p.partner_company as { name?: string }).name : p.partner_company)}</strong>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                                        {selectedFields.has('status') && p.status && (
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase',
                                                padding: '2px 6px', borderRadius: '6px',
                                                background: p.status === 'worked' || p.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)',
                                                color: p.status === 'worked' || p.status === 'active' ? 'var(--success)' : 'var(--text-muted)'
                                            }}>
                                                {p.status}
                                            </span>
                                        )}
                                        {selectedFields.has('project_amount') && p.project_amount !== undefined && (
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                {new Intl.NumberFormat('ru-RU').format(p.project_amount ?? 0)} ₸
                                            </span>
                                        )}
                                        {selectedFields.has('project_manager_ids') && Array.isArray(p.project_manager_ids) && p.project_manager_ids.length > 0 && (
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                PM: {p.project_manager_ids.join(', ')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600, flexShrink: 0, padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                                    #{p.id}
                                </span>
                            </div>
                        );
                    })}

                    {!odooIntLoading && !odooIntError && filteredOdooIntProjects.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', margin: 'auto' }}>
                            <Globe size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                            <p>Проекты с такими параметрами не найдены в Odoo CRM API</p>
                        </div>
                    )}
                </div>

                {/* Панель пагинации API модала */}
                {!odooIntLoading && !odooIntError && filteredOdooIntProjects.length > 0 && (
                    <div style={{
                        padding: '10px 24px', borderTop: '1px solid var(--border)',
                        background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', flexWrap: 'wrap', gap: '10px', flexShrink: 0
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Строк на стр:</span>
                            <select
                                value={odooIntPageSize}
                                onChange={e => { setOdooIntPageSize(Number(e.target.value)); setOdooIntPage(1); }}
                                style={{ padding: '3px 8px', width: 'auto', borderRadius: '8px', fontSize: '0.78rem', background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                            >
                                {[10, 20, 50, 100, 1000].map(v => (
                                    <option key={v} value={v}>{v === 1000 ? 'Все' : v}</option>
                                ))}
                            </select>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {(odooIntPage - 1) * odooIntPageSize + 1}–{Math.min(odooIntPage * odooIntPageSize, filteredOdooIntProjects.length)} из {filteredOdooIntProjects.length}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                type="button"
                                disabled={odooIntPage <= 1}
                                onClick={() => setOdooIntPage(p => Math.max(1, p - 1))}
                                className="secondary"
                                style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <ChevronLeft size={14} /> Назад
                            </button>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', padding: '0 4px' }}>
                                {odooIntPage} / {totalOdooIntPages}
                            </span>
                            <button
                                type="button"
                                disabled={odooIntPage >= totalOdooIntPages}
                                onClick={() => setOdooIntPage(p => Math.min(totalOdooIntPages, p + 1))}
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
                        {selectedOdooIntIds.size > 0
                            ? `Выбрано ${selectedOdooIntIds.size} из ${filteredOdooIntProjects.length} проектов`
                            : 'Выберите проекты для добавления'}
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
                            onClick={handleImportOdooIntSelected}
                            disabled={selectedOdooIntIds.size === 0 || odooIntImportLoading}
                            className="primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '10px', fontSize: '0.85rem' }}
                        >
                            {odooIntImportLoading ? (
                                <>Импорт...</>
                            ) : (
                                <><Plus size={16} /> Добавить выбранные ({selectedOdooIntIds.size})</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OdooIntegrationModal;
