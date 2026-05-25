/**
 * Единый файл локализации для всего фронтенда.
 * Все текстовые метки и переводы должны находиться здесь.
 * Это позволяет избежать разрозненных строк в компонентах (DRY).
 */

export const STATUS_LABELS: Record<string, string> = {
    IN_PROGRESS: 'В процессе',
    PENDING: 'Ожидает',
    MANAGER_APPROVED: 'Менеджер ОК',
    HEAD_APPROVED: 'Начальник ОК',
    APPROVED: 'Одобрено',
    REJECTED: 'Отклонено',
    CANCELLED: 'Отменено',
};

export const STATUS_COLORS: Record<string, string> = {
    IN_PROGRESS: '#6366f1',
    PENDING: '#b45309',
    MANAGER_APPROVED: '#0891b2',
    HEAD_APPROVED: '#2563eb',
    APPROVED: '#15803d',
    REJECTED: '#b91c1c',
    CANCELLED: '#64748b',
};

export const ROLE_LABELS: Record<string, string> = {
    admin: 'Администратор',
    head: 'Начальник отдела',
    manager: 'Менеджер проектов',
    employee: 'Сотрудник',
};

export const ROLE_COLORS: Record<string, string> = {
    admin: '#7c3aed',
    head: '#2563eb',
    manager: '#0891b2',
    employee: '#64748b',
};

export const COMPANY_LABELS: Record<string, string> = {
    Polymedia: 'Polymedia',
    'AJ-techCom': 'AJ-techCom',
};

export const ACTION_LABELS: Record<string, string> = {
    LOGIN: 'Вход в систему',
    REVIEW_ADMIN: 'Решение администратора',
    REVIEW_MANAGER: 'Решение менеджера',
    REVIEW_HEAD: 'Решение начальника',
    CANCEL_OVERTIME: 'Отмена заявки',
    CREATE_USER: 'Создание пользователя',
    UPDATE_USER: 'Изменение профиля',
    RESET_PASSWORD: 'Сброс пароля',
    CHANGE_PASSWORD: 'Смена пароля',
    CREATE_DEPT: 'Создание отдела',
    UPDATE_DEPT: 'Изменение отдела',
    CREATE_PROJECT: 'Создание проекта',
    UPDATE_PROJECT: 'Изменение проекта',
    IMPORT_USER_MS: 'Импорт из Office 365',
};

/**
 * Получить русскую метку для статуса (с fallback).
 */
export const getStatusLabel = (status: string): string =>
    STATUS_LABELS[status] || status;

/**
 * Получить цвет для статуса (с fallback).
 */
export const getStatusColor = (status: string): string =>
    STATUS_COLORS[status] || '#64748b';

/** Локаль для форматирования дат по умолчанию */
const DATE_LOCALE = 'ru-RU';

/**
 * Форматировать дату в формате дд.мм.гггг
 * @example formatDate('2026-05-23T15:00:00') → '23.05.2026'
 */
export const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(DATE_LOCALE, {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
};

/**
 * Форматировать дату и время: дд.мм.гггг, ЧЧ:ММ
 * @example formatDateTime('2026-05-23T15:00:00') → '23.05.2026, 15:00'
 */
export const formatDateTime = (date: string | Date | null | undefined): string => {
    if (!date) return '—';
    return new Date(date).toLocaleString(DATE_LOCALE, {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

/**
 * Форматировать только время: ЧЧ:ММ
 * @example formatTime('2026-05-23T15:30:00') → '15:30'
 */
export const formatTime = (date: string | Date | null | undefined): string => {
    if (!date) return '—';
    return new Date(date).toLocaleTimeString(DATE_LOCALE, {
        hour: '2-digit', minute: '2-digit'
    });
};
