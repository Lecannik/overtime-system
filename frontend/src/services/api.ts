import axios from 'axios';
import type { 
    LoginResponse, User, Project, Department, Overtime, 
    PaginatedResponse, UserStats, AuditLog, Notification,
    AnalyticsSummary, ProjectAnalytics, DepartmentAnalytics, UserAnalytics, ReviewAnalytics,
    AnalyticsParams, OdooProjectPreview, OdooIntegrationProject
} from '../types';

let inMemoryToken: string | null = null;

export const setAccessToken = (token: string | null) => {
    inMemoryToken = token;
};

export const getAccessToken = () => {
    return inMemoryToken;
};

let refreshPromise: Promise<string | null> | null = null;

/**
 * Обновляет локальный Access Token, выполняя запрос к эндпоинту /auth/refresh.
 * Использует паттерн Singleton для Promise, предотвращая одновременную отправку
 * нескольких параллельных запросов на обновление токена (например, в React Strict Mode).
 * 
 * @returns {Promise<string | null>} Промис, возвращающий Access Token или null.
 */
export const refreshAccessToken = (): Promise<string | null> => {
    if (refreshPromise) {
        return refreshPromise;
    }

    refreshPromise = api.post<LoginResponse>('/auth/refresh')
        .then((res) => {
            const token = res.data.access_token;
            setAccessToken(token || null);
            return token || null;
        })
        .catch((err) => {
            setAccessToken(null);
            return Promise.reject(err);
        })
        .finally(() => {
            refreshPromise = null;
        });

    return refreshPromise;
};

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

export const api = axios.create({
    baseURL: `${API_URL}/api/v1`,
    withCredentials: true,
});

// Добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let isRefreshing = false;

interface FailedRequest {
    resolve: (token: string | null) => void;
    reject: (error: unknown) => void;
}

let failedQueue: FailedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            // Исключаем бесконечный цикл на логине/рефреше
            if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
                setAccessToken(null);
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers.Authorization = 'Bearer ' + token;
                        return api(originalRequest);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const token = await refreshAccessToken();
                
                processQueue(null, token);
                
                originalRequest.headers.Authorization = 'Bearer ' + token;
                return api(originalRequest);
            } catch (err) {
                processQueue(err, null);
                setAccessToken(null);
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login';
                }
                return Promise.reject(err);
            } finally {
                isRefreshing = false;
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
// Odoo Projects
export const getOdooStatus = () => api.get<{ configured: boolean }>('/admin/odoo/status').then(r => r.data);
export const getOdooProjects = () => api.get<{ projects: OdooProjectPreview[] }>('/admin/odoo/projects').then(r => r.data);
export const importOdooProjects = (projects: Partial<OdooProjectPreview>[]) => api.post('/admin/odoo/import', projects).then(r => r.data);

// Odoo Projects Integration Microservice
export const getOdooIntegrationStatus = () => api.get<{ configured: boolean; url: string | null }>('/admin/odoo-integration/status').then(r => r.data);
export const getOdooIntegrationProjects = (fields?: string[], name?: string, code?: string) => {
    const params = new URLSearchParams();
    if (fields) {
        fields.forEach(f => params.append('fields', f));
    }
    if (name) {
        params.append('name', name);
    }
    if (code) {
        params.append('code', code);
    }
    return api.get<OdooIntegrationProject[]>('/admin/odoo-integration/projects', { params }).then(r => r.data);
};
export const importOdooIntegrationProjects = (projects: { id: number; name?: string; code?: string | null; status?: string | null }[]) => 
    api.post('/admin/odoo-integration/import', projects).then(r => r.data);

// --- OVERTIMES ---
export const getMyOvertimes = (params?: Record<string, unknown>) => 
    api.get<PaginatedResponse<Overtime>>('/overtimes/', { params }).then(r => r.data);
export const getMyStats = () => api.get<UserStats>('/overtimes/stats/me').then(r => r.data);
export const createOvertime = (data: Partial<Overtime>) => api.post<Overtime>('/overtimes/', data).then(r => r.data);
export const updateOvertime = (id: number, data: Partial<Overtime>) => api.patch<Overtime>(`/overtimes/${id}`, data).then(r => r.data);
export const cancelOvertime = (id: number) => api.post(`/overtimes/${id}/cancel`).then(r => r.data);
export const restoreOvertime = (id: number) => api.post(`/overtimes/${id}/restore`).then(r => r.data);
export const getOvertimes = (params?: Record<string, unknown>) => 
    api.get<PaginatedResponse<Overtime>>('/overtimes/', { params }).then(r => r.data);
export const reviewOvertime = (id: number, approved: boolean, comment?: string, as_role?: string, approved_hours?: number) => 
    api.post(`/overtimes/${id}/review`, { approved, comment, as_role, approved_hours }).then(r => r.data);

/** Модель записи-дня для календарной сводки. */
export interface CalendarDayEntry {
    id: number;
    initials: string;
    name: string;
    hours: number;
    status: string;
}

/** Сводная информация по одному дню для heatmap-календаря. */
export interface CalendarDayData {
    total: number;
    pending: number;
    approved: number;
    hours: number;
    entries: CalendarDayEntry[];
}

/** Словарь 'YYYY-MM-DD' → CalendarDayData */
export type CalendarSummary = Record<string, CalendarDayData>;

/**
 * Загружает сводку заявок по дням выбранного месяца для отображения в heatmap-календаре.
 * @param month - строка формата 'YYYY-MM' (например '2026-07')
 */
export const getCalendarSummary = (month?: string, year?: number): Promise<CalendarSummary> =>
    api.get<CalendarSummary>('/overtimes/calendar-summary', { params: { month, year } }).then(r => r.data);

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
export const exportMyAnalytics = (params?: { start_date?: string; end_date?: string }) => 
    api.get('/analytics/export-my', { params, responseType: 'blob' }).then(r => r.data);

// --- AUDIT ---
export const getAuditLogs = (limit = 100, offset = 0, search?: string) => 
    api.get<PaginatedResponse<AuditLog>>('/audit/', { params: { limit, offset, search } }).then(r => r.data);

// --- NOTIFICATIONS ---
export const getNotifications = () => api.get<Notification[]>('/notifications/').then(r => r.data);
export const markNotificationRead = (id: number) => api.post(`/notifications/${id}/read`).then(r => r.data);
export const markAllNotificationsRead = () => api.post('/notifications/read-all').then(r => r.data);

export default api;
