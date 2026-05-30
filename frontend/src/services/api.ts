import axios from 'axios';
import type { 
    LoginResponse, User, Project, Department, Overtime, 
    PaginatedResponse, UserStats, AuditLog, Notification,
    AnalyticsSummary, ProjectAnalytics, DepartmentAnalytics, UserAnalytics, ReviewAnalytics,
    AnalyticsParams, OdooProjectPreview
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
    baseURL: `${API_URL}/api/v1`,
});

// Добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }

        // Предотвращаем React Error #31 при выводе ошибок Pydantic (преобразуем массив/объект detail в строку)
        if (error.response?.data?.detail) {
            const detail = error.response.data.detail;
            if (Array.isArray(detail)) {
                interface PydanticErrorItem {
                    loc?: (string | number)[];
                    msg?: string;
                }
                error.response.data.detail = (detail as PydanticErrorItem[]).map((err) => {
                    const field = err.loc ? err.loc.filter((l) => l !== 'body').join('.') : '';
                    const prefix = field ? `Поле "${field}": ` : '';
                    let msg = err.msg || '';
                    if (msg === 'Field required') msg = 'обязательно для заполнения';
                    else if (msg.includes('value is not a valid integer')) msg = 'должно быть целым числом';
                    else if (msg.includes('Input should be a valid datetime')) msg = 'должно быть корректной датой и временем';
                    return `${prefix}${msg}`;
                }).join('; ');
            } else if (typeof detail === 'object') {
                error.response.data.detail = JSON.stringify(detail);
            }
        }

        return Promise.reject(error);
    }
);

// --- AUTH ---
export const login = (data: FormData) => api.post<LoginResponse>('/auth/login', data);
export const logout = () => api.post('/auth/logout');
export const verify2FA = (email: string, code: string) => 
    api.post<LoginResponse>('/auth/verify-2fa', { email, code }).then(r => r.data);
export const requestPasswordReset = (email: string) => 
    api.post<{ detail: string }>('/auth/password-reset/request', { email }).then(r => r.data);
export const confirmPasswordReset = (data: Record<string, unknown>) => 
    api.post<{ detail: string }>('/auth/password-reset/confirm', data).then(r => r.data);
export const changePassword = (data: Record<string, unknown>) => 
    api.post<{ detail: string }>('/auth/change-password', data).then(r => r.data);

// --- USERS ---
export const getUsers = (params?: Record<string, unknown>) => 
    api.get<PaginatedResponse<User>>('/admin/users', { params }).then(r => r.data);
export const createUser = (data: Partial<User> & { password?: string }) => api.post<User>('/admin/users', data).then(r => r.data);
export const updateUser = (id: number, data: Partial<User>) => api.patch<User>(`/admin/users/${id}`, data).then(r => r.data);
export const deleteUser = (id: number) => api.delete(`/admin/users/${id}`).then(r => r.data);
export const resetUserPassword = (id: number) => api.post<{ detail: string }>(`/admin/users/${id}/reset-password`).then(r => r.data);
export const updateMyPreferences = (data: Partial<User>) => api.patch<User>('/auth/me', data).then(r => r.data);

// --- DEPARTMENTS ---
export const getDepartments = () => api.get<Department[]>('/admin/departments').then(r => r.data);
export const createDepartment = (data: { name: string }) => api.post<Department>('/admin/departments', data).then(r => r.data);
export const updateDepartment = (id: number, data: Partial<Department>) => api.patch<Department>(`/admin/departments/${id}`, data).then(r => r.data);
export const deleteDepartment = (id: number) => api.delete(`/admin/departments/${id}`).then(r => r.data);

// --- PROJECTS ---
export const getAdminProjects = () => api.get<Project[]>('/admin/projects').then(r => r.data);
export const createProject = (data: { name: string; code: string }) => api.post<Project>('/admin/projects', data).then(r => r.data);
export const updateProject = (id: number, data: Partial<Project>) => api.patch<Project>(`/admin/projects/${id}`, data).then(r => r.data);
export const deleteProject = (id: number) => api.delete(`/admin/projects/${id}`).then(r => r.data);

// Odoo Projects
export const getOdooProjects = () => api.get<{ projects: OdooProjectPreview[] }>('/admin/odoo/projects').then(r => r.data);
export const importOdooProjects = (projects: Partial<OdooProjectPreview>[]) => api.post('/admin/odoo/import', projects).then(r => r.data);

// --- OVERTIMES ---
export const getMyOvertimes = (params?: Record<string, unknown>) => 
    api.get<PaginatedResponse<Overtime>>('/overtimes/', { params }).then(r => r.data);
export const getMyStats = () => api.get<UserStats>('/overtimes/stats/me').then(r => r.data);
export const createOvertime = (data: Partial<Overtime>) => api.post<Overtime>('/overtimes/', data).then(r => r.data);
export const updateOvertime = (id: number, data: Partial<Overtime>) => api.patch<Overtime>(`/overtimes/${id}`, data).then(r => r.data);
export const cancelOvertime = (id: number) => api.post(`/overtimes/${id}/cancel`).then(r => r.data);
export const getOvertimes = (params?: Record<string, unknown>) => 
    api.get<PaginatedResponse<Overtime>>('/overtimes/', { params }).then(r => r.data);
export const reviewOvertime = (id: number, approved: boolean, comment?: string, as_role?: string, approved_hours?: number) => 
    api.post(`/overtimes/${id}/review`, { approved, comment, as_role, approved_hours }).then(r => r.data);

// --- ANALYTICS ---
export const getAnalyticsSummary = (params?: AnalyticsParams) => 
    api.get<AnalyticsSummary>('/analytics/summary', { params }).then(r => r.data);
export const getProjectAnalytics = (params?: AnalyticsParams) => 
    api.get<ProjectAnalytics[]>('/analytics/projects', { params }).then(r => r.data);
export const getDepartmentAnalytics = (params?: AnalyticsParams) => 
    api.get<DepartmentAnalytics[]>('/analytics/departments', { params }).then(r => r.data);
export const getUserAnalytics = (params?: AnalyticsParams) => 
    api.get<UserAnalytics[]>('/analytics/users', { params }).then(r => r.data);
export const getReviewAnalytics = (params?: AnalyticsParams) => 
    api.get<ReviewAnalytics>('/analytics/reviews', { params }).then(r => r.data);
export const exportAnalytics = (params?: AnalyticsParams) => 
    api.get('/analytics/export', { params, responseType: 'blob' }).then(r => r.data);
export const exportMyAnalytics = () => 
    api.get('/analytics/export-my', { responseType: 'blob' }).then(r => r.data);

// --- AUDIT ---
export const getAuditLogs = (limit = 100, offset = 0, search?: string) => 
    api.get<PaginatedResponse<AuditLog>>('/audit/', { params: { limit, offset, search } }).then(r => r.data);

// --- NOTIFICATIONS ---
export const getNotifications = () => api.get<Notification[]>('/notifications/').then(r => r.data);
export const markNotificationRead = (id: number) => api.post(`/notifications/${id}/read`).then(r => r.data);
export const markAllNotificationsRead = () => api.post('/notifications/read-all').then(r => r.data);

export default api;
