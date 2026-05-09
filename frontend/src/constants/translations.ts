export const ROLE_LABELS: Record<string, string> = {
    'admin': 'Администратор',
    'manager': 'Руководитель',
    'head': 'Начальник отдела',
    'employee': 'Сотрудник',
    'user': 'Пользователь'
};

export const PERMISSION_LABELS: Record<string, string> = {
    'crm:leads:read': 'Просмотр лидов',
    'crm:leads:create': 'Создание лидов',
    'crm:leads:update': 'Редактирование лидов',
    'crm:leads:delete': 'Удаление лидов',
    'crm:deals:read': 'Просмотр сделок',
    'crm:deals:create': 'Создание сделок',
    'crm:deals:update': 'Редактирование сделок',
    'projects:view': 'Просмотр проектов',
    'projects:create': 'Создание проектов',
    'projects:update': 'Редактирование проектов',
    'projects:approve': 'Согласование переработок',
    'analytics:view': 'Доступ к аналитике',
    'admin:users:manage': 'Управление пользователями',
    'admin:org:manage': 'Управление оргструктурой',
    'admin:settings:edit': 'Настройки системы',
    'bpm:manage': 'Управление процессами'
};
