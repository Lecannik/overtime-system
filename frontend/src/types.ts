export interface User {
    id: number;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
    department_id?: number | null;
    position_id?: number | null;
    department_name?: string;
    position_name?: string;
    company?: string;
    telegram_chat_id?: string | null;
    notification_level?: number;
    must_change_password?: boolean;
    is_2fa_enabled?: boolean;
    two_fa_method?: 'email' | 'totp';
    permissions?: string[];
}

export interface TaskStatus {
    id: number;
    name: string;
    color: string;
    sort_order: number;
    is_active: boolean;
}

export interface TaskType {
    id: number;
    name: string;
    color: string;
    icon?: string;
    is_active: boolean;
}

export interface Department {
    id: number;
    name: string;
    parent_id?: number | null;
    manager_id?: number | null;
}

export interface Permission {
    id: number;
    name: string;
    description?: string;
}

export interface JobPosition {
    id: number;
    name: string;
    department_id?: number | null;
    department?: Department;
    permissions?: Permission[];
}

export interface Counterparty {
    id: number;
    name: string;
    inn?: string;
    address?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
}

export interface Task {
    id: number;
    title: string;
    description?: string;
    deadline?: string;
    status_id?: number;
    status?: string; // Legacy/Fallback
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    type_id?: number;
    type?: string;
    assigned_id?: number;
    department_id?: number;
    creator_id: number;
    lead_id?: number;
    deal_id?: number;
    project_id?: number;
    
    // Relations
    task_status?: TaskStatus;
    task_type?: TaskType;
    department?: Department;
    creator?: User;
    assigned?: User;
    attachments?: any[];
    comments?: any[];
    created_at: string;
    updated_at: string;
}

export interface Project {
    id: number;
    name: string;
    manager_id?: number | null;
    weekly_limit?: number;
    status?: string;
    stage_id?: number | null;
    gip_id?: number | null;

    // Финансы
    budget?: number;
    gross_profit?: number;
    net_profit?: number;
    turnover?: number;
    labor_cost?: number;
    ntk?: number;
    aup?: number;

    // Документы
    doc_spec_url?: string;
    doc_tech_spec_url?: string;
    doc_schemes_url?: string;
    doc_client_export_url?: string;

    manager?: User;
    gip?: User;
    stage?: any;
    tasks?: Task[];
}

export interface Lead {
    id: number;
    title: string;
    description?: string;
    counterparty_id?: number;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
    source?: string;
    stage_id?: number;
    counterparty?: Counterparty;
    stage?: any;
    tasks?: Task[];
}

export interface Deal {
    id: number;
    title: string;
    description?: string;
    budget?: number;
    currency?: string;
    counterparty_id?: number;
    contract_url?: string;
    client_export_url?: string;
    project_id?: number;
    stage_id?: number;
    assigned_id?: number;
    counterparty?: Counterparty;
    stage?: any;
    tasks?: Task[];
}
