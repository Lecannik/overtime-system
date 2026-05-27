/**
 * Централизованные TypeScript-интерфейсы для всего приложения.
 *
 * Правило: любой тип, используемый в двух и более компонентах,
 * должен быть определён здесь (DRY).
 *
 * @module types
 */

// ==================== ПОЛЬЗОВАТЕЛИ ====================

/** Роль пользователя в системе. */
export type UserRole = 'admin' | 'head' | 'manager' | 'employee' | string;

/** Компания пользователя. */
export type UserCompany = 'Polymedia' | 'AJ-techCom' | string;

/** Полная модель пользователя (ответ от API). */
export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  company: UserCompany | null;
  department_id: number | null;
  telegram_chat_id: string | null;
  is_active: boolean;
  is_2fa_enabled: boolean;
  must_change_password: boolean;
  notify_email: boolean;
  notify_telegram: boolean;
  created_at: string;
}

/** Данные для обновления пользователя (PATCH). */
export interface UserUpdate {
  full_name?: string;
  role?: UserRole;
  department_id?: number | null;
  company?: UserCompany | null;
  is_active?: boolean;
  telegram_chat_id?: string | null;
  notify_email?: boolean;
  notify_telegram?: boolean;
}

// ==================== ПЕРЕРАБОТКИ ====================

/** Статус заявки на переработку. */
export type OvertimeStatus =
  | 'IN_PROGRESS'
  | 'PENDING'
  | 'MANAGER_APPROVED'
  | 'HEAD_APPROVED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED' | string;

/** Полная модель заявки на переработку. */
export interface Overtime {
  id: number;
  user_id: number;
  project_id: number | null;
  status: OvertimeStatus;
  description: string;
  start_time: string;
  end_time: string | null;
  total_hours: number | null;
  approved_hours: number | null;
  hours?: number; // legacy property
  location_name: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  manager_comment: string | null;
  head_comment: string | null;
  admin_comment: string | null;
  manager_approved?: boolean | null;
  head_approved?: boolean | null;
  created_at: string;
  updated_at: string | null;
  /** Пользователь (может быть вложен в ответе). */
  user?: Pick<User, 'id' | 'full_name' | 'email' | 'department_id'>;
  /** Проект (может быть вложен в ответе). */
  project?: Pick<Project, 'id' | 'name' | 'code'>;
}

/** Пагинированный ответ со списком заявок. */
export interface PaginatedOvertimes {
  items: Overtime[];
  total: number;
  page: number;
  pages: number;
}

// ==================== ПРОЕКТЫ ====================

/** Модель проекта. */
export interface Project {
  id: number;
  name: string;
  /** Номер в формате YYYY-NNNNN (иммутабелен после создания). */
  code: string | null;
  manager_id: number | null;
  weekly_limit: number;
  is_active?: boolean;
}

/** Данные для создания проекта. */
export interface ProjectCreate {
  name: string;
  /** Обязателен. Формат: YYYY-NNNNN (например, 2026-00001). */
  code: string;
  manager_id?: number | null;
  weekly_limit?: number;
}

/** Данные для обновления проекта (code — нельзя менять). */
export interface ProjectUpdate {
  name?: string;
  manager_id?: number | null;
  weekly_limit?: number;
  is_active?: boolean;
}

// ==================== ОТДЕЛЫ ====================

/** Модель отдела. */
export interface Department {
  id: number;
  name: string;
  head_id: number | null;
}

// ==================== УВЕДОМЛЕНИЯ ====================

/** Модель уведомления. */
export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// ==================== АУДИТ ====================

/** Запись аудит-лога. */
export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  target_type: string | null;
  target_id: number | null;
  details: Record<string, unknown> | null;
  timestamp: string;
  /** Пользователь (вложен в ответе). */
  user?: Pick<User, 'id' | 'full_name' | 'email'>;
}

// ==================== ODOO CRM ====================

/**
 * Превью проекта из Odoo CRM (до импорта).
 * Используется для отображения списка и выбора перед импортом.
 */
export interface OdooProjectPreview {
  odoo_id: number;
  name: string;
  /** Номер проекта из аналитического счёта Odoo. Может отсутствовать. */
  code: string | null;
  manager_name: string | null;
  manager_email: string | null;
}

/**
 * Проект для отправки на эндпоинт импорта.
 * Пользователь выбирает из OdooProjectPreview, а мы формируем OdooProjectImportItem.
 */
export interface OdooProjectImportItem {
  odoo_id: number;
  name: string;
  code: string | null;
  manager_email: string | null;
}

// ==================== АНАЛИТИКА ====================

/** Итоговая статистика за период. */
export interface AnalyticsSummary {
  total_overtimes: number;
  total_hours: number;
  approved_count: number;
  rejected_count: number;
  pending_count: number;
  avg_hours_per_overtime: number;
  approved_requests?: number;
  pending_requests?: number;
  rejected_requests?: number;
  total_requests?: number;
}

// ==================== ОБЩИЕ ====================

/** Ответ пагинации. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

/** Статус операции. */
export interface OperationResult {
  status: 'success' | 'error';
  message?: string;
  detail?: string;
}

export interface UserStats {
    total_approved_hours: number;
    total_requests: number;
    active_requests: number;
    projects_count: number;
    daily_stats: any[];
    by_project: any[];
    current_month_hours: number;
}

export interface ProjectAnalytics {
    project_id: number;
    project_name: string;
    total_hours: number;
    total_requests: number;
    approved_count: number;
    unique_users: number;
}

export interface DepartmentAnalytics {
    department_id: number;
    department_name: string;
    total_hours: number;
    total_requests: number;
    unique_users: number;
}

export interface UserAnalytics {
    user_id: number;
    full_name: string;
    department_name: string | null;
    total_hours: number;
    total_requests: number;
    approved_count: number;
}

export interface ReviewAnalytics {
    total_requested_hours: number;
    total_approved_hours: number;
    exact_match_count: number;
    less_than_requested_count: number;
    more_than_requested_count: number;
    avg_review_time_hours: number;
}

export interface AnalyticsParams {
    start_date?: string;
    end_date?: string;
    department_id?: number;
    project_id?: number;
    company?: string;
}

export interface LoginResponse {
    access_token: string;
    token_type: string;
    user: User;
    status?: string;
    email?: string;
}

export interface UserUpdatePreferences {
    is_2fa_enabled?: boolean;
    tg_notifications?: boolean;
    email_notifications?: boolean;
}
