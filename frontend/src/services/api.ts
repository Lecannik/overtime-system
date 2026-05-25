import axios from 'axios';
import type { OdooProjectPreview, OdooProjectImportItem } from '../types';



/**
 * Экземпляр axios с базовыми настройками для работы с бэкендом.
 * Все запросы проходят через interceptors ниже.
 */
export const api = axios.create({
  baseURL: '/api/v1',
});

// ==================== INTERCEPTORS ====================

/**
 * Request interceptor: автоматически добавляет JWT-токен в заголовок Authorization.
 * Благодаря этому НИ ОДНА функция ниже не должна читать токен вручную.
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Response interceptor: фоновое обновление токена при 401 Unauthorized.
 * Если обновить не удается, перенаправляет на страницу логина.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Если ошибка 401 Unauthorized и запрос еще не повторялся
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Исключаем бесконечный цикл на путях авторизации
      if (
        originalRequest.url === '/auth/refresh' ||
        originalRequest.url === '/auth/login' ||
        originalRequest.url === '/auth/verify-2fa'
      ) {
        localStorage.removeItem('token');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post('/api/v1/auth/refresh');
        const { access_token } = response.data;
        localStorage.setItem('token', access_token);
        
        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        
        processQueue(null, access_token);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('token');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ==================== АУТЕНТИФИКАЦИЯ ====================

/** Вход в систему. FastAPI OAuth2 ожидает x-www-form-urlencoded. */
export const login = async (email: string, password: string) => {
  const params = new URLSearchParams();
  params.append('username', email);
  params.append('password', password);
  const response = await api.post('/auth/login', params);
  return response.data;
};

/** Верификация 2FA кода при входе. */
export const verify2FA = async (email: string, code: string) => {
  const response = await api.post('/auth/verify-2fa', { email, code });
  return response.data;
};

/** Запрос сброса пароля по email. */
export const requestPasswordReset = async (email: string) => {
  const response = await api.post('/auth/password-reset/request', { email });
  return response.data;
};

/** Подтверждение сброса пароля с OTP-кодом. */
export const confirmPasswordReset = async (data: any) => {
  const response = await api.post('/auth/password-reset/confirm', data);
  return response.data;
};

/** Обновить настройки текущего пользователя (имя, Telegram, уведомления). */
export const updateMyProfile = async (data: any) => {
  const response = await api.patch('/auth/me', data);
  return response.data;
};

/** Смена пароля текущего пользователя. */
export const changePassword = async (oldPassword: string, newPassword: string) => {
  const response = await api.post('/auth/change-password', {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return response.data;
};

/** Выход из системы с отзывом Refresh Token на бэкенде. */
export const logout = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};

// ==================== ЗАЯВКИ НА ПЕРЕРАБОТКУ ====================

/** Получить список заявок текущего пользователя с пагинацией и фильтрами. */
export const getMyOvertimes = async (
  params: { page?: number; page_size?: number; status?: string; project_id?: number; start_date?: string; end_date?: string } = {}
) => {
  const response = await api.get('/overtimes/', { params });
  return response.data;
};

/** Получить список всех заявок (для менеджера/админа) с пагинацией и фильтрами. */
export const getOvertimes = async (
  params: { page?: number; page_size?: number; status?: string; project_id?: number; start_date?: string; end_date?: string } = {}
) => {
  const response = await api.get('/overtimes/', { params });
  return response.data;
};

/** Создать новую заявку на переработку. */
export const createOvertime = async (data: {
  project_id: number;
  start_time: string;
  end_time: string | null;
  description: string;
  location_name?: string | null;
  start_lat?: number | null;
  start_lng?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
}) => {
  const response = await api.post('/overtimes/', data);
  return response.data;
};

/** Обновить существующую заявку. */
export const updateOvertime = async (overtimeId: number, data: any) => {
  const response = await api.patch(`/overtimes/${overtimeId}`, data);
  return response.data;
};

/** Отменить заявку на переработку. */
export const cancelOvertime = async (overtimeId: number) => {
  const response = await api.post(`/overtimes/${overtimeId}/cancel`, null);
  return response.data;
};

/** Удалить заявку на переработку (только администратор). */
export const deleteOvertime = async (overtimeId: number): Promise<void> => {
  await api.delete(`/overtimes/${overtimeId}`);
};


/** Согласовать или отклонить заявку. */
export const reviewOvertime = async (
  id: number,
  approved: boolean,
  comment?: string,
  as_role?: string,
  approved_hours?: number
) => {
  const response = await api.post(`/overtimes/${id}/review`, {
    approved,
    comment,
    as_role,
    approved_hours,
  });
  return response.data;
};

/** Получить личную статистику переработок. */
export const getMyStats = async () => {
  const response = await api.get('/overtimes/stats/me');
  return response.data;
};

// ==================== ПРОЕКТЫ ====================

/** Получить список проектов (публичный эндпоинт). */
export const getProjects = async () => {
  const response = await api.get('/projects/');
  return response.data;
};

// ==================== УВЕДОМЛЕНИЯ ====================

/** Получить список уведомлений текущего пользователя. */
export const getNotifications = async () => {
  const response = await api.get('/notifications/');
  return response.data;
};

/** Пометить одно уведомление как прочитанное. */
export const markNotificationRead = async (id: number) => {
  await api.post(`/notifications/${id}/read`, null);
};

/** Пометить все уведомления как прочитанные. */
export const markAllNotificationsRead = async () => {
  await api.post('/notifications/read-all', null);
};

// ==================== ПОЛЬЗОВАТЕЛИ (ADMIN) ====================

/**
 * Получить список пользователей с поиском, сортировкой и пагинацией.
 * Только для администраторов.
 */
export const getUsers = async (params?: {
  search?: string;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  page_size?: number;
  role?: string;
  department_id?: number;
  company?: string;
}) => {
  const response = await api.get('/admin/users', { params });
  return response.data;
};

/** Обновить данные пользователя (роль, отдел, активность). Только для админа. */
export const updateUser = async (userId: number, data: any) => {
  const response = await api.patch(`/admin/users/${userId}`, data);
  return response.data;
};

/** Сбросить пароль пользователя. Только для админа. */
export const resetUserPassword = async (userId: number) => {
  const response = await api.post(`/admin/users/${userId}/reset-password`);
  return response.data;
};

/** Удалить пользователя. Только для админа. */
export const deleteUser = async (userId: number) => {
  await api.delete(`/admin/users/${userId}`);
};

/** Создать нового пользователя. Только для админа. */
export const createUser = async (userData: any) => {
  const response = await api.post('/admin/users', userData);
  return response.data;
};

// ==================== ОТДЕЛЫ (ADMIN) ====================

/** Получить список всех отделов. */
export const getDepartments = async () => {
  const response = await api.get('/admin/departments');
  return response.data;
};

/** Создать новый отдел. */
export const createDepartment = async (data: { name: string; head_id?: number | null }) => {
  const response = await api.post('/admin/departments', data);
  return response.data;
};

/** Обновить отдел. */
export const updateDepartment = async (deptId: number, data: any) => {
  const response = await api.patch(`/admin/departments/${deptId}`, data);
  return response.data;
};

/** Удалить отдел. */
export const deleteDepartment = async (deptId: number) => {
  await api.delete(`/admin/departments/${deptId}`);
};

// ==================== ПРОЕКТЫ (ADMIN) ====================

/** Получить список всех проектов (для администрирования). */
export const getAdminProjects = async () => {
  const response = await api.get('/admin/projects');
  return response.data;
};

/**
 * Создать новый проект.
 * Поле code должно быть в формате YYYY-NNNNN (например, 2026-00001).
 * После создания номер проекта (code) нельзя изменить.
 */
export const createProject = async (data: {
  name: string;
  code: string;
  manager_id?: number | null;
  weekly_limit?: number;
}) => {
  const response = await api.post('/admin/projects', data);
  return response.data;
};

/**
 * Обновить проект.
 * Поле code намеренно исключено — номер проекта иммутабелен.
 */
export const updateProject = async (projectId: number, data: {
  name?: string;
  manager_id?: number | null;
  weekly_limit?: number;
  is_active?: boolean;
}) => {
  const response = await api.patch(`/admin/projects/${projectId}`, data);
  return response.data;
};

/** Удалить проект. */
export const deleteProject = async (projectId: number) => {
  await api.delete(`/admin/projects/${projectId}`);
};

// ==================== ODOO CRM ====================

/** Проверить статус конфигурации Odoo интеграции. */
export const getOdooStatus = async (): Promise<{
  configured: boolean;
  url: string | null;
  db: string | null;
}> => {
  const response = await api.get('/admin/odoo/status');
  return response.data;
};

/**
 * Получить список активных проектов из Odoo CRM.
 * Возвращает odoo_id, name, code (YYYY-NNNNN), manager_name, manager_email.
 */
export const getOdooProjects = async (): Promise<{
  projects: OdooProjectPreview[];
  total: number;
}> => {
  const response = await api.get('/admin/odoo/projects');
  return response.data;
};

/** Импортировать выбранные проекты из Odoo в локальную БД. */
export const importOdooProjects = async (projects: OdooProjectImportItem[]): Promise<{
  status: string;
  imported: number;
  skipped: number;
  errors: string[];
}> => {
  const response = await api.post('/admin/odoo/import', projects);
  return response.data;
};



/** Получить общую статистику. */
export const getAnalyticsSummary = async (params?: any) => {
  const response = await api.get('/analytics/summary', { params });
  return response.data;
};

/** Получить сравнение по компаниям. */
export const getCompanyComparison = async (params?: any) => {
  const response = await api.get('/analytics/companies', { params });
  return response.data;
};

/** Получить аналитику по проектам. */
export const getProjectAnalytics = async (params?: any) => {
  const response = await api.get('/analytics/projects', { params });
  return response.data;
};

/** Получить аналитику по отделам. */
export const getDepartmentAnalytics = async (params?: any) => {
  const response = await api.get('/analytics/departments', { params });
  return response.data;
};

/** Получить аналитику по пользователям. */
export const getUserAnalytics = async (params?: any) => {
  const response = await api.get('/analytics/users', { params });
  return response.data;
};

/** Получить недельную статистику. */
export const getWeeklyStats = async () => {
  const response = await api.get('/analytics/weekly');
  return response.data;
};

/** Экспортировать аналитику в Excel (для админа). */
export const exportAnalytics = async (params?: any) => {
  const response = await api.get('/analytics/export', { params, responseType: 'blob' });
  return response.data;
};

/** Экспортировать личную аналитику текущего пользователя. */
export const exportMyAnalytics = async (params?: any) => {
  const response = await api.get('/analytics/export/me', { params, responseType: 'blob' });
  return response.data;
};

/** Получить аналитику по согласованиям. */
export const getReviewAnalytics = async (params?: any) => {
  const response = await api.get('/analytics/reviews', { params });
  return response.data;
};

// ==================== АУДИТ ====================

/** Получить журнал аудита с пагинацией и поиском. */
export const getAuditLogs = async (limit = 100, offset = 0, search?: string) => {
  const response = await api.get('/audit/', { params: { limit, offset, search: search || undefined } });
  return response.data;
};

export default api;
