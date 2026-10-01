import React, { useMemo } from 'react';
import { Folder, ChevronDown, Search, X } from 'lucide-react';
import type { Project } from '../../types';

interface TmaProjectSelectorProps {
    isOpen: boolean;
    onToggleOpen: () => void;
    onClose: () => void;
    selectedProjectId: number | '';
    onSelectProject: (id: number) => void;
    projects: Project[];
    previousProject: Project | null;
    projectSearch: string;
    onProjectSearchChange: (val: string) => void;
    haptic: {
        selection: () => void;
    };
}

/**
 * Селектор проектов для мобильного интерфейса Telegram Mini App:
 * - Крупная плашка выбора с отображением названия и кода проекта;
 * - Быстрый выбор предыдущего проекта в один клик;
 * - Выпадающий поиск по коду и названию проекта.
 */
export const TmaProjectSelector: React.FC<TmaProjectSelectorProps> = ({
    isOpen,
    onToggleOpen,
    selectedProjectId,
    onSelectProject,
    projects,
    previousProject,
    projectSearch,
    onProjectSearchChange,
    haptic,
}) => {
    const currentProject = useMemo(
        () => projects.find((p) => p.id === Number(selectedProjectId)),
        [projects, selectedProjectId]
    );

    const filteredProjects = useMemo(() => {
        if (!projectSearch.trim()) return projects;
        const q = projectSearch.toLowerCase();
        return projects.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                (p.code && p.code.toLowerCase().includes(q))
        );
    }, [projects, projectSearch]);

    return (
        <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                Проект <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
            </label>

            {/* Триггер выбора проекта */}
            <div
                onClick={onToggleOpen}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                    border: isOpen
                        ? '1px solid var(--primary, #3b82f6)'
                        : '1px solid var(--border, rgba(255, 255, 255, 0.12))',
                    cursor: 'pointer',
                    userSelect: 'none',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: 'var(--primary, #3b82f6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <Folder size={17} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                                style={{
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    color: currentProject
                                        ? 'var(--tg-theme-text-color, #f8fafc)'
                                        : 'var(--tg-theme-hint-color, #94a3b8)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {currentProject ? currentProject.name : 'Выберите проект...'}
                            </span>
                            {currentProject && previousProject && currentProject.id === previousProject.id && (
                                <span
                                    style={{
                                        fontSize: '0.68rem',
                                        padding: '1px 5px',
                                        borderRadius: '4px',
                                        background: 'rgba(59, 130, 246, 0.22)',
                                        color: '#60a5fa',
                                        fontWeight: 600,
                                        flexShrink: 0,
                                    }}
                                >
                                    ⏮ Предыдущий
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {currentProject?.code && (
                        <span
                            style={{
                                fontSize: '0.72rem',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                color: 'var(--tg-theme-hint-color, #94a3b8)',
                                fontFamily: 'monospace',
                            }}
                        >
                            {currentProject.code}
                        </span>
                    )}
                    <ChevronDown
                        size={18}
                        style={{
                            color: 'var(--tg-theme-hint-color, #94a3b8)',
                            transform: isOpen ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s ease',
                        }}
                    />
                </div>
            </div>

            {/* Выпадающий список проектов с поиском */}
            {isOpen && (
                <div
                    style={{
                        marginTop: '8px',
                        padding: '10px',
                        borderRadius: '14px',
                        background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.35)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        maxHeight: '260px',
                        zIndex: 10,
                    }}
                >
                    <div style={{ position: 'relative' }}>
                        <Search
                            size={14}
                            style={{
                                position: 'absolute',
                                left: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--tg-theme-hint-color, #94a3b8)',
                            }}
                        />
                        <input
                            type="text"
                            autoFocus
                            value={projectSearch}
                            onChange={(e) => onProjectSearchChange(e.target.value)}
                            placeholder="Поиск по названию или коду..."
                            style={{
                                width: '100%',
                                padding: '8px 28px 8px 30px',
                                borderRadius: '8px',
                                background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: 'var(--tg-theme-text-color, #f8fafc)',
                                fontSize: '0.84rem',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                        {projectSearch && (
                            <button
                                type="button"
                                onClick={() => onProjectSearchChange('')}
                                style={{
                                    position: 'absolute',
                                    right: '8px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--tg-theme-hint-color, #94a3b8)',
                                    cursor: 'pointer',
                                    padding: 0,
                                }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Быстрый выбор предыдущего проекта */}
                    {previousProject && Number(selectedProjectId) !== previousProject.id && (
                        <button
                            type="button"
                            onClick={() => {
                                onSelectProject(previousProject.id);
                                haptic.selection();
                            }}
                            style={{
                                padding: '7px 10px',
                                borderRadius: '8px',
                                background: 'rgba(59, 130, 246, 0.14)',
                                border: '1px dashed rgba(59, 130, 246, 0.4)',
                                color: '#60a5fa',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                textAlign: 'left',
                            }}
                        >
                            <span>⏮ Предыдущий проект:</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {previousProject.name}
                            </span>
                        </button>
                    )}

                    <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        {filteredProjects.map((p) => {
                            const isSelected = p.id === Number(selectedProjectId);
                            const isPrev = previousProject && p.id === previousProject.id;
                            return (
                                <div
                                    key={p.id}
                                    onClick={() => {
                                        onSelectProject(p.id);
                                        haptic.selection();
                                    }}
                                    style={{
                                        padding: '9px 12px',
                                        borderRadius: '8px',
                                        background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                        border: isSelected ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                                        color: 'var(--tg-theme-text-color, #f8fafc)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, paddingRight: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span
                                                style={{
                                                    fontWeight: isSelected ? 700 : 500,
                                                    fontSize: '0.86rem',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                            >
                                                {p.name}
                                            </span>
                                            {isPrev && (
                                                <span
                                                    style={{
                                                        fontSize: '0.68rem',
                                                        padding: '1px 5px',
                                                        borderRadius: '4px',
                                                        background: 'rgba(59, 130, 246, 0.25)',
                                                        color: '#60a5fa',
                                                        fontWeight: 600,
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    ⏮ Предыдущий
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {p.code && (
                                        <span
                                            style={{
                                                fontSize: '0.72rem',
                                                color: 'var(--tg-theme-hint-color, #94a3b8)',
                                                fontFamily: 'monospace',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {p.code}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                        {filteredProjects.length === 0 && (
                            <div
                                style={{
                                    padding: '14px',
                                    textAlign: 'center',
                                    fontSize: '0.82rem',
                                    color: 'var(--tg-theme-hint-color, #94a3b8)',
                                }}
                            >
                                Проекты не найдены
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
