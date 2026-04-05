/**
 * Единый файл локализации для всего фронтенда.
 * Все текстовые метки и переводы должны находиться здесь.
 * Это позволяет избежать разрозненных строк в компонентах (DRY).
 */

export const STATUS_LABELS: Record<string, string> = {
    PENDING: 'Ожидает',
    MANAGER_APPROVED: 'Менеджер ОК',
    HEAD_APPROVED: 'Начальник ОК',
    APPROVED: 'Одобрено',
    REJECTED: 'Отклонено',
    CANCELLED: 'Отменено',
};

export const STATUS_COLORS: Record<string, string> = {
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
