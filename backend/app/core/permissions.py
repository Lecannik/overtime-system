from enum import Enum

class ModulePermission(str, Enum):
    # CRM: Leads
    CRM_LEADS_READ = "crm:leads:read"
    CRM_LEADS_CREATE = "crm:leads:create"
    CRM_LEADS_UPDATE = "crm:leads:update"
    CRM_LEADS_DELETE = "crm:leads:delete"
    
    # CRM: Deals
    CRM_DEALS_READ = "crm:deals:read"
    CRM_DEALS_CREATE = "crm:deals:create"
    CRM_DEALS_UPDATE = "crm:deals:update"
    CRM_DEALS_DELETE = "crm:deals:delete"

    # CRM: Counterparties
    CRM_COUNTERPARTIES_READ = "crm:counterparties:read"
    CRM_COUNTERPARTIES_CREATE = "crm:counterparties:create"
    CRM_COUNTERPARTIES_UPDATE = "crm:counterparties:update"
    CRM_COUNTERPARTIES_DELETE = "crm:counterparties:delete"
    
    # Projects
    PROJECTS_READ = "projects:read"
    PROJECTS_CREATE = "projects:create"
    PROJECTS_UPDATE = "projects:update"
    PROJECTS_DELETE = "projects:delete"
    
    # Analytics
    ANALYTICS_VIEW = "analytics:view"
    
    # Admin / Settings
    ADMIN_USERS_MANAGE = "admin:users:manage"
    ADMIN_ORG_MANAGE = "admin:org:manage"
    ADMIN_SETTINGS_EDIT = "admin:settings:edit"
    ADMIN_BPM_MANAGE = "admin:bpm:manage"

# Группировка для фронтенда
PERMISSION_GROUPS = {
    "CRM: Лиды": [
        "crm:leads:read",
        "crm:leads:create",
        "crm:leads:update",
        "crm:leads:delete"
    ],
    "CRM: Сделки": [
        "crm:deals:read",
        "crm:deals:create",
        "crm:deals:update",
        "crm:deals:delete"
    ],
    "CRM: Контрагенты": [
        "crm:counterparties:read",
        "crm:counterparties:create",
        "crm:counterparties:update",
        "crm:counterparties:delete"
    ],
    "Проекты": [
        "projects:read",
        "projects:create",
        "projects:update",
        "projects:delete"
    ],
    "Аналитика": [
        "analytics:view"
    ],
    "Администрирование": [
        "admin:users:manage",
        "admin:org:manage",
        "admin:settings:edit",
        "admin:bpm:manage"
    ]
}
