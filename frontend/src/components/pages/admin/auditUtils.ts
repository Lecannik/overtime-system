/**
 * Утилиты для форматирования и локализации событий журнала аудита.
 * Обеспечивают перевод технических ключей действий в понятный русский язык
 * и формирование структурированных описаний изменений.
 */

export interface ActionMeta {
    title: string;
    category: string;
    categoryTitle: string;
    badgeColor: string;
    badgeBg: string;
}

/** Категории событий аудита для фильтрации */
export const AUDIT_CATEGORIES = [
    { key: 'all', title: 'Все категории' },
    { key: 'auth', title: 'Авторизация' },
    { key: 'overtimes', title: 'Заявки и переработки' },
    { key: 'reviews', title: 'Согласование' },
    { key: 'users', title: 'Пользователи' },
    { key: 'departments', title: 'Отделы' },
    { key: 'projects', title: 'Проекты' },
    { key: 'system', title: 'Системные' },
] as const;

/** Словарь метаинформации о действиях */
export const ACTION_CONFIG: Record<string, ActionMeta> = {
    LOGIN: {
        title: 'Вход в систему',
        category: 'auth',
        categoryTitle: 'Авторизация',
        badgeColor: '#38bdf8',
        badgeBg: 'rgba(56, 189, 248, 0.15)',
    },
    LOGOUT: {
        title: 'Выход из системы',
        category: 'auth',
        categoryTitle: 'Авторизация',
        badgeColor: '#94a3b8',
        badgeBg: 'rgba(148, 163, 184, 0.15)',
    },
    PASSWORD_RESET_REQUEST: {
        title: 'Запрос сброса пароля',
        category: 'auth',
        categoryTitle: 'Безопасность',
        badgeColor: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
    },
    PASSWORD_RESET_CONFIRM: {
        title: 'Сброс пароля подтвержден',
        category: 'auth',
        categoryTitle: 'Безопасность',
        badgeColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
    },
    CHANGE_PASSWORD: {
        title: 'Смена пароля',
        category: 'auth',
        categoryTitle: 'Безопасность',
        badgeColor: '#3b82f6',
        badgeBg: 'rgba(59, 130, 246, 0.15)',
    },
    RESET_PASSWORD: {
        title: 'Сброс пароля админом',
        category: 'users',
        categoryTitle: 'Пользователи',
        badgeColor: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
    },
    CREATE_USER: {
        title: 'Создание пользователя',
        category: 'users',
        categoryTitle: 'Пользователи',
        badgeColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
    },
    UPDATE_USER: {
        title: 'Обновление пользователя',
        category: 'users',
        categoryTitle: 'Пользователи',
        badgeColor: '#38bdf8',
        badgeBg: 'rgba(56, 189, 248, 0.15)',
    },
    DELETE_USER: {
        title: 'Удаление пользователя',
        category: 'users',
        categoryTitle: 'Пользователи',
        badgeColor: '#ef4444',
        badgeBg: 'rgba(239, 68, 68, 0.15)',
    },
    CREATE_DEPT: {
        title: 'Создание отдела',
        category: 'departments',
        categoryTitle: 'Отделы',
        badgeColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
    },
    UPDATE_DEPT: {
        title: 'Изменение отдела',
        category: 'departments',
        categoryTitle: 'Отделы',
        badgeColor: '#38bdf8',
        badgeBg: 'rgba(56, 189, 248, 0.15)',
    },
    DELETE_DEPT: {
        title: 'Удаление отдела',
        category: 'departments',
        categoryTitle: 'Отделы',
        badgeColor: '#ef4444',
        badgeBg: 'rgba(239, 68, 68, 0.15)',
    },
    CREATE_PROJECT: {
        title: 'Создание проекта',
        category: 'projects',
        categoryTitle: 'Проекты',
        badgeColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
    },
    UPDATE_PROJECT: {
        title: 'Изменение проекта',
        category: 'projects',
        categoryTitle: 'Проекты',
        badgeColor: '#38bdf8',
        badgeBg: 'rgba(56, 189, 248, 0.15)',
    },
    DELETE_PROJECT: {
        title: 'Удаление проекта',
        category: 'projects',
        categoryTitle: 'Проекты',
        badgeColor: '#ef4444',
        badgeBg: 'rgba(239, 68, 68, 0.15)',
    },
    IMPORT_ODOO_PROJECTS: {
        title: 'Импорт из Odoo (XML-RPC)',
        category: 'projects',
        categoryTitle: 'Проекты',
        badgeColor: '#8b5cf6',
        badgeBg: 'rgba(139, 92, 246, 0.15)',
    },
    IMPORT_ODOO_INTEGRATION_PROJECTS: {
        title: 'Импорт из Odoo (API)',
        category: 'projects',
        categoryTitle: 'Проекты',
        badgeColor: '#8b5cf6',
        badgeBg: 'rgba(139, 92, 246, 0.15)',
    },
    CREATE_OVERTIME: {
        title: 'Создание заявки',
        category: 'overtimes',
        categoryTitle: 'Заявки',
        badgeColor: '#38bdf8',
        badgeBg: 'rgba(56, 189, 248, 0.15)',
    },
    UPDATE_OVERTIME_TIME: {
        title: 'Изменение времени заявки',
        category: 'overtimes',
        categoryTitle: 'Заявки',
        badgeColor: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
    },
    REVIEW_HEAD_APPROVED: {
        title: 'Одобрено руководителем',
        category: 'reviews',
        categoryTitle: 'Согласование',
        badgeColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
    },
    REVIEW_HEAD_REJECTED: {
        title: 'Отклонено руководителем',
        category: 'reviews',
        categoryTitle: 'Согласование',
        badgeColor: '#ef4444',
        badgeBg: 'rgba(239, 68, 68, 0.15)',
    },
    REVIEW_MANAGER_APPROVED: {
        title: 'Одобрено менеджером',
        category: 'reviews',
        categoryTitle: 'Согласование',
        badgeColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
    },
    REVIEW_MANAGER_REJECTED: {
        title: 'Отклонено менеджером',
        category: 'reviews',
        categoryTitle: 'Согласование',
        badgeColor: '#ef4444',
        badgeBg: 'rgba(239, 68, 68, 0.15)',
    },
    CANCEL_OVERTIME: {
        title: 'Отмена заявки',
        category: 'overtimes',
        categoryTitle: 'Заявки',
        badgeColor: '#ef4444',
        badgeBg: 'rgba(239, 68, 68, 0.15)',
    },
    RESTORE_OVERTIME: {
        title: 'Восстановление заявки',
        category: 'overtimes',
        categoryTitle: 'Заявки',
        badgeColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
    },
    AUTO_CLOSE_STALE: {
        title: 'Автозакрытие заявки',
        category: 'system',
        categoryTitle: 'Система',
        badgeColor: '#a855f7',
        badgeBg: 'rgba(168, 85, 247, 0.15)',
    },
};

/** Получить метаданные действия по коду */
export const getActionMeta = (action: string): ActionMeta => {
    return ACTION_CONFIG[action] || {
        title: action,
        category: 'other',
        categoryTitle: 'Другое',
        badgeColor: '#94a3b8',
        badgeBg: 'rgba(148, 163, 184, 0.15)',
    };
};

/** Формирование краткого понятного описания изменений в одну строку */
export const formatActionSummary = (action: string, details?: Record<string, unknown> | null): string => {
    if (!details || typeof details !== 'object') {
        return '—';
    }

    if (action === 'UPDATE_OVERTIME_TIME') {
        const oldH = details.old_hours;
        const newH = details.new_hours;
        if (oldH !== undefined && newH !== undefined) {
            return `Часы: ${String(oldH)} ч. → ${String(newH)} ч. (${String(details.updated_by || 'автор')})`;
        }
        return 'Изменение временных параметров заявки';
    }

    if (action.startsWith('REVIEW_')) {
        const approved = details.approved;
        const appH = details.approved_hours;
        const comment = details.comment;
        let res = approved ? `Одобрено` : `Отклонено`;
        if (appH !== undefined) {
            res += ` (${String(appH)} ч.)`;
        }
        if (comment) {
            res += ` • «${String(comment)}»`;
        }
        return res;
    }

    if (action === 'CANCEL_OVERTIME') {
        return `Отменено (${String(details.cancelled_by || 'пользователем')})${details.description ? `: «${String(details.description)}»` : ''}`;
    }

    if (action === 'AUTO_CLOSE_STALE') {
        return `Причина: ${String(details.reason || 'Истек лимит времени')}`;
    }

    if (action === 'CREATE_USER' || action === 'UPDATE_USER') {
        const parts = [];
        if (details.full_name) parts.push(`ФИО: ${String(details.full_name)}`);
        if (details.role) parts.push(`Роль: ${String(details.role)}`);
        if (details.is_active !== undefined) parts.push(`Активен: ${details.is_active ? 'Да' : 'Нет'}`);
        return parts.join(', ') || 'Обновление данных пользователя';
    }

    if (action === 'CREATE_DEPT' || action === 'UPDATE_DEPT') {
        if (details.name) return `Отдел: ${String(details.name)}`;
        if (details.head_id !== undefined) return `Руководитель ID: ${String(details.head_id || 'Снят')}`;
        return 'Изменение параметров отдела';
    }

    if (action === 'CREATE_PROJECT' || action === 'UPDATE_PROJECT') {
        const parts = [];
        if (details.name) parts.push(`Проект: ${String(details.name)}`);
        if (details.code) parts.push(`Код: ${String(details.code)}`);
        if (details.weekly_limit) parts.push(`Лимит: ${String(details.weekly_limit)} ч/нед`);
        return parts.join(', ') || 'Изменение проекта';
    }

    if (action.includes('IMPORT_ODOO')) {
        return `Импортировано: ${String(details.imported ?? 0)}, Пропущено: ${String(details.skipped ?? 0)}`;
    }

    // Если обычный json
    const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (entries.length > 0) {
        return entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).slice(0, 2).join(', ');
    }

    return '—';
};

