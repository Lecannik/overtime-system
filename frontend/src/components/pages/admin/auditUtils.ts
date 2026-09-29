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

/** Категории событий аудита для фильтрации с пояснениями */
export const AUDIT_CATEGORIES = [
    { key: 'all', title: 'Все категории', description: 'Полный журнал всех событий системы без фильтрации по типу' },
    { key: 'auth', title: 'Авторизация', description: 'Входы пользователей (пароль, 2FA, SSO), завершение сессий, сброс и смена паролей' },
    { key: 'overtimes', title: 'Заявки и переработки', description: 'Создание, редактирование администратором, отмена и удаление заявок на переработку' },
    { key: 'reviews', title: 'Согласование', description: 'Решения менеджеров проектов, начальников отделов и администратора (одобрение/отклонение)' },
    { key: 'users', title: 'Пользователи', description: 'Создание новых учетных записей, редактирование профилей, смена ролей и импорт из Office 365' },
    { key: 'departments', title: 'Отделы', description: 'Создание подразделений, изменение названий отделов и назначение руководителей' },
    { key: 'projects', title: 'Проекты', description: 'Создание и правка проектов, настройка недельных лимитов и синхронизация с Odoo' },
    { key: 'system', title: 'Системные', description: 'Автоматические операции планировщика: автозакрытие зависших сессий и периодические проверки' },
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
    LOGIN_2FA: {
        title: 'Вход с 2FA',
        category: 'auth',
        categoryTitle: 'Авторизация',
        badgeColor: '#38bdf8',
        badgeBg: 'rgba(56, 189, 248, 0.15)',
    },
    LOGIN_SSO: {
        title: 'Вход через SSO',
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
    PASSWORD_RESET: {
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
    IMPORT_USER_MS: {
        title: 'Импорт из Office 365',
        category: 'users',
        categoryTitle: 'Пользователи',
        badgeColor: '#8b5cf6',
        badgeBg: 'rgba(139, 92, 246, 0.15)',
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
    IMPORT_PROJECT_ODOO: {
        title: 'Импорт из Odoo',
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
    CREATE_OVERTIME_MANUAL: {
        title: 'Ручное создание заявки',
        category: 'overtimes',
        categoryTitle: 'Заявки',
        badgeColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
    },
    ADMIN_UPDATE_OVERTIME: {
        title: 'Правка заявки админом',
        category: 'overtimes',
        categoryTitle: 'Заявки',
        badgeColor: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
    },
    UPDATE_OVERTIME_TIME: {
        title: 'Изменение времени заявки',
        category: 'overtimes',
        categoryTitle: 'Заявки',
        badgeColor: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
    },
    DELETE_OVERTIME: {
        title: 'Удаление заявки',
        category: 'overtimes',
        categoryTitle: 'Заявки',
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
    REVIEW_ADMIN: {
        title: 'Решение администратора',
        category: 'reviews',
        categoryTitle: 'Согласование',
        badgeColor: '#7c3aed',
        badgeBg: 'rgba(124, 58, 237, 0.15)',
    },
    REVIEW_HEAD: {
        title: 'Решение нач. отдела',
        category: 'reviews',
        categoryTitle: 'Согласование',
        badgeColor: '#2563eb',
        badgeBg: 'rgba(37, 99, 235, 0.15)',
    },
    REVIEW_MANAGER: {
        title: 'Решение менеджера',
        category: 'reviews',
        categoryTitle: 'Согласование',
        badgeColor: '#0891b2',
        badgeBg: 'rgba(8, 145, 178, 0.15)',
    },
    SELF_REVIEW_ADMIN: {
        title: 'Самосогласование админом',
        category: 'reviews',
        categoryTitle: 'Согласование',
        badgeColor: '#8b5cf6',
        badgeBg: 'rgba(139, 92, 246, 0.15)',
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

    const employeeInfo = details.employee_name
        ? `${String(details.employee_name)}${details.employee_email ? ` (${String(details.employee_email)})` : ''}`
        : (details.employee_email ? String(details.employee_email) : '');

    if (action === 'ADMIN_UPDATE_OVERTIME') {
        const changes = [];
        if (details.status) changes.push(`Статус: ${String(details.status)}`);
        if (details.hours !== undefined) changes.push(`Часы: ${String(details.hours)} ч.`);
        if (details.approved_hours !== undefined) changes.push(`Согл. часы: ${String(details.approved_hours)} ч.`);
        if (details.admin_comment) changes.push(`Комментарий: «${String(details.admin_comment)}»`);
        const changesStr = changes.length > 0 ? changes.join(', ') : 'Изменение параметров заявки';
        return employeeInfo ? `Сотрудник: ${employeeInfo} • ${changesStr}` : changesStr;
    }

    if (action === 'DELETE_OVERTIME') {
        const reason = details.reason ? `: «${String(details.reason)}»` : '';
        return employeeInfo ? `Удалена заявка сотрудника ${employeeInfo}${reason}` : `Заявка удалена${reason}`;
    }

    if (action === 'UPDATE_OVERTIME_TIME') {
        const oldH = details.old_hours;
        const newH = details.new_hours;
        const emp = employeeInfo ? ` [${employeeInfo}]` : '';
        if (oldH !== undefined && newH !== undefined) {
            return `Часы: ${String(oldH)} ч. → ${String(newH)} ч.${emp}`;
        }
        return `Изменение времени заявки${emp}`;
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
        if (employeeInfo) {
            res += ` [Сотрудник: ${employeeInfo}]`;
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

    if (action.includes('IMPORT_ODOO') || action === 'IMPORT_PROJECT_ODOO') {
        return `Импортировано: ${String(details.imported ?? 0)}, Пропущено: ${String(details.skipped ?? 0)}`;
    }

    if (action === 'IMPORT_USER_MS') {
        return `Импортировано: ${String(details.created ?? details.imported ?? 0)}, Обновлено: ${String(details.updated ?? 0)}`;
    }

    // Если обычный json
    const entries = Object.entries(details).filter(([k, v]) => k !== 'employee_name' && k !== 'employee_email' && v !== null && v !== undefined && v !== '');
    if (entries.length > 0) {
        const formatted = entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).slice(0, 2).join(', ');
        return employeeInfo ? `Сотрудник: ${employeeInfo} • ${formatted}` : formatted;
    }

    return employeeInfo ? `Сотрудник: ${employeeInfo}` : '—';
};
