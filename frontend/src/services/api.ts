import axios from 'axios';

// Создаем «экземпляр» axios с базовыми настройками
const api = axios.create({
  baseURL: '/api/v1',  // Vite-прокси перенаправит это на localhost:8000
});

// Автоматически добавляем токен в заголовок Authorization для всех запросов
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Функция входа — отправляет email и пароль на бэкенд
export const login = async (email: string, password: string) => {
  // FastAPI ожидает данные формы (не JSON!), поэтому используем FormData
  const formData = new FormData();
  formData.append('username', email);  // В OAuth2 поле называется 'username'
  formData.append('password', password);

  const response = await api.post('/auth/login', formData);
  return response.data;
};

// Верификация 2FA кода
export const verify2FA = async (email: string, code: string) => {
  const response = await api.post('/auth/verify-2fa', { email, code });
  return response.data;
};

// Запрос сброса пароля
export const requestPasswordReset = async (email: string) => {
  const response = await api.post('/auth/password-reset/request', { email });
  return response.data;
};

// Подтверждение сброса пароля
export const confirmPasswordReset = async (data: any) => {
  const response = await api.post('/auth/password-reset/confirm', data);
  return response.data;
};

// Получить список заявок текущего пользователя
export const getOvertimes = async () => {
  const token = localStorage.getItem('token');
  const response = await api.get('/overtimes/', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Создать новую заявку
export const createOvertime = async (data: {
  project_id: number;
  start_time: string;
  end_time: string;
  description: string;
}) => {
  const token = localStorage.getItem('token');
  const response = await api.post('/overtimes/', data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Обновить существующую заявку
export const updateOvertime = async (overtimeId: number, data: any) => {
  const token = localStorage.getItem('token');
  const response = await api.patch(`/overtimes/${overtimeId}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Отменить заявку
export const cancelOvertime = async (overtimeId: number) => {
  const token = localStorage.getItem('token');
  const response = await api.post(`/overtimes/${overtimeId}/cancel`, null, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Получить личную статистику
export const getMyStats = async () => {
  const token = localStorage.getItem('token');
  const response = await api.get('/overtimes/stats/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Получить список проектов
export const getProjects = async () => {
  const token = localStorage.getItem('token');
  const response = await api.get('/projects/', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// ==================== УВЕДОМЛЕНИЯ ====================

export const getNotifications = async () => {
  const token = localStorage.getItem('token');
  const response = await api.get('/notifications/', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const markNotificationRead = async (id: number) => {
  const token = localStorage.getItem('token');
  await api.post(`/notifications/${id}/read`, null, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

export const markAllNotificationsRead = async () => {
  const token = localStorage.getItem('token');
  await api.post('/notifications/read-all', null, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

// Согласовать или отклонить заявку
export const reviewOvertime = async (
  overtimeId: number,
  approved: boolean,
  comment?: string,
  asRole?: string
) => {
  const token = localStorage.getItem('token');
  const response = await api.post(`/overtimes/${overtimeId}/review`, {
    approved,
    comment: comment || null,
    as_role: asRole || null
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Получить всех пользователей (только для админа)
export const getUsers = async () => {
  const token = localStorage.getItem('token');
  const response = await api.get('/admin/users', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
// Обновить пользователя (роль, отдел, активность)
export const updateUser = async (userId: number, data: any) => {
  const token = localStorage.getItem('token');
  const response = await api.patch(`/admin/users/${userId}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Сбросить пароль пользователя (только для админа)
export const resetUserPassword = async (userId: number) => {
  const token = localStorage.getItem('token');
  const response = await api.post(`/admin/users/${userId}/reset-password`, null, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const deleteUser = async (userId: number) => {
  const token = localStorage.getItem('token');
  await api.delete(`/admin/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

// Обновить свой профиль
export const updateMyProfile = async (data: any) => {
  const token = localStorage.getItem('token');
  const response = await api.patch('/auth/me', data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const createUser = async (userData: any) => {
  const token = localStorage.getItem('token');
  const response = await api.post('/admin/users', userData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Сменить пароль
export const changePassword = async (oldPassword: string, newPassword: string) => {
  const token = localStorage.getItem('token');
  const response = await api.post('/auth/change-password', {
    old_password: oldPassword,
    new_password: newPassword
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// ==================== ОТДЕЛЫ ====================

export const getDepartments = async () => {
  const token = localStorage.getItem('token');
  const response = await api.get('/admin/departments', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const createDepartment = async (data: { name: string; head_id?: number | null }) => {
  const token = localStorage.getItem('token');
  const response = await api.post('/admin/departments', data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const updateDepartment = async (deptId: number, data: any) => {
  const token = localStorage.getItem('token');
  const response = await api.patch(`/admin/departments/${deptId}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const deleteDepartment = async (deptId: number) => {
  const token = localStorage.getItem('token');
  await api.delete(`/admin/departments/${deptId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

// ==================== ПРОЕКТЫ ====================

export const createProject = async (data: {
  name: string;
  manager_id?: number | null;
  weekly_limit?: number;
}) => {
  const token = localStorage.getItem('token');
  const response = await api.post('/admin/projects', data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const updateProject = async (projectId: number, data: {
  name?: string;
  manager_id?: number | null;
  weekly_limit?: number;
}) => {
  const token = localStorage.getItem('token');
  const response = await api.patch(`/admin/projects/${projectId}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// ==================== АНАЛИТИКА ====================

export const getAnalyticsSummary = async (params?: any) => {
  const token = localStorage.getItem('token');
  const response = await api.get('/analytics/summary', {
    headers: { Authorization: `Bearer ${token}` },
    params
  });
  return response.data;
};

export const getProjectAnalytics = async (params?: any) => {
  const token = localStorage.getItem('token');
  const response = await api.get('/analytics/projects', {
    headers: { Authorization: `Bearer ${token}` },
    params
  });
  return response.data;
};

export const getDepartmentAnalytics = async (params?: any) => {
  const token = localStorage.getItem('token');
  const response = await api.get('/analytics/departments', {
    headers: { Authorization: `Bearer ${token}` },
    params
  });
  return response.data;
};

export const getUserAnalytics = async (params?: any) => {
  const token = localStorage.getItem('token');
  const response = await api.get('/analytics/users', {
    headers: { Authorization: `Bearer ${token}` },
    params
  });
  return response.data;
};

export const getWeeklyStats = async () => {
  const token = localStorage.getItem('token');
  const response = await api.get('/analytics/weekly', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const exportAnalytics = async (params?: any) => {
  const token = localStorage.getItem('token');
  const response = await api.get('/analytics/export', {
    headers: { Authorization: `Bearer ${token}` },
    params,
    responseType: 'blob'
  });
  return response.data;
};

export const deleteProject = async (projectId: number) => {
  const token = localStorage.getItem('token');
  await api.delete(`/admin/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

// ==================== АУДИТ ====================
export const getAuditLogs = async (limit = 100, offset = 0) => {
  const token = localStorage.getItem('token');
  const response = await api.get('/audit/', {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit, offset }
  });
  return response.data;
};

export default api;
// Автоматический редирект на логин при 401 (Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
