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
 * Парсит дату от бэкенда. Если переданная строка является наивной датой (без указания таймзоны Z/+/-),
 * принудительно трактует её как UTC, добавляя суффикс 'Z'.
 */
export const parseBackendDate = (date: string | Date | null | undefined): Date | null => {
    if (!date) return null;
    if (date instanceof Date) return isNaN(date.getTime()) ? null : date;
    
    if (typeof date === 'string') {
        let clean = date.trim();
        // Если это дата без Z и без смещения, добавляем 'Z'
        if (clean.length >= 10 && !clean.endsWith('Z') && !/[-+]\d{2}:?\d{2}$/.test(clean)) {
            // Поддержка для строк вида "YYYY-MM-DD" или "YYYY-MM-DDTHH:mm:ss"
            if (!clean.includes('T') && clean.includes(' ')) {
                clean = clean.replace(' ', 'T');
            }
            clean = clean + 'Z';
        }
        const parsed = new Date(clean);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

/**
 * Форматировать дату в формате дд.мм.гггг
 * @example formatDate('2026-05-23T15:00:00') → '23.05.2026'
 */
export const formatDate = (date: string | Date | null | undefined): string => {
    const parsed = parseBackendDate(date);
    if (!parsed) return '—';
    return parsed.toLocaleDateString(DATE_LOCALE, {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
};

/**
 * Форматировать дату и время: дд.мм.гггг, ЧЧ:ММ
 * @example formatDateTime('2026-05-23T15:00:00') → '23.05.2026, 15:00'
 */
export const formatDateTime = (date: string | Date | null | undefined): string => {
    const parsed = parseBackendDate(date);
    if (!parsed) return '—';
    return parsed.toLocaleString(DATE_LOCALE, {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

/**
 * Форматировать только время: ЧЧ:ММ
 * @example formatTime('2026-05-23T15:30:00') → '15:30'
 */
export const formatTime = (date: string | Date | null | undefined): string => {
    const parsed = parseBackendDate(date);
    if (!parsed) return '—';
    return parsed.toLocaleTimeString(DATE_LOCALE, {
        hour: '2-digit', minute: '2-digit'
    });
};
