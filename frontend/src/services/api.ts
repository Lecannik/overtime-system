import axios from 'axios';

// Создаем «экземпляр» axios с базовыми настройками
export const api = axios.create({
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
  // FastAPI OAuth2PasswordRequestForm ожидает x-www-form-urlencoded
  const params = new URLSearchParams();
  params.append('username', email);
  params.append('password', password);

  const response = await api.post('/auth/login', params);
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

// Получить список заявок текущего пользователя (с пагинацией)
export const getMyOvertimes = async (params: { page?: number; page_size?: number; status?: string; project_id?: number } = {}) => {
  const response = await api.get('/overtimes/', { params });
  return response.data;
};

// Получить список всех заявок (для менеджера/админа)
export const getOvertimes = async (params: { page?: number; page_size?: number; status?: string; project_id?: number } = {}) => {
  const response = await api.get('/overtimes/', { params });
  return response.data;
};

// Создать новую заявку
export const createOvertime = async (data: {
  project_id: number;
  start_time: string;
  end_time: string;
  description: string;
  location_name?: string;
  timezone_offset?: number;
}) => {
  const token = localStorage.getItem('token');
  const response = await api.post('/overtimes/', data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Обновить существующую заявку
export const updateOvertime = async (overtimeId: number, data: {
  project_id?: number;
  start_time?: string;
  end_time?: string;
  description?: string;
  location_name?: string;
  timezone_offset?: number;
}) => {
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
  const response = await api.get('/overtimes/stats/me');
  return response.data;
};

export const getProjects = async () => {
  const token = localStorage.getItem('token');
  const response = await api.get('/projects/', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Получить детальную информацию о проекте по ID
export const getProject = async (id: number) => {
  const response = await api.get(`/projects/${id}`);
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
export const reviewOvertime = async (id: number, approved: boolean, comment?: string, as_role?: string, approved_hours?: number) => {
  const token = localStorage.getItem('token');
  const response = await api.post(`/overtimes/${id}/review`, {
    approved,
    comment,
    as_role,
    approved_hours
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Получить всех пользователей (только для админа) с поиском, сортировкой и пагинацией
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

// Публичный список пользователей (для всех)
export const getUsersList = async () => {
  const response = await api.get('/users/list');
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
  const response = await api.post(`/admin/users/${userId}/reset-password`);
  return response.data;
};

export const resetUser2FA = async (userId: number) => {
  const response = await api.post(`/admin/users/${userId}/reset-2fa`);
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

// ==================== 2FA ====================
export const setup2FA = async () => {
  const response = await api.post('/auth/2fa/setup');
  return response.data;
};

export const enable2FA = async (code: string) => {
  const response = await api.post('/auth/2fa/enable', null, { params: { code } });
  return response.data;
};

export const disable2FA = async () => {
  const response = await api.post('/auth/2fa/disable');
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
  status?: string;
  stage_id?: number | null;
  gip_id?: number | null;
  lead_engineer_id?: number | null;
  lead_programmer_id?: number | null;
  extra_data?: any;
}) => {
  const token = localStorage.getItem('token');
  const response = await api.patch(`/admin/projects/${projectId}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// ==================== АНАЛИТИКА ====================

export const getAnalyticsSummary = async (params?: any) => {
  const response = await api.get('/analytics/summary', { params });
  return response.data;
};

export const getCompanyComparison = async (params?: any) => {
  const response = await api.get('/analytics/companies', { params });
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

export const exportMyAnalytics = async (params?: any) => {
  const token = localStorage.getItem('token');
  const response = await api.get('/analytics/export/me', {
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

export const getReviewAnalytics = async (params?: any) => {
  const token = localStorage.getItem('token');
  const response = await api.get('/analytics/reviews', {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
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

// ==================== CRM (LEADS & DEALS) ====================

export const getLeads = async () => {
  const response = await api.get('/crm/leads');
  return response.data;
};

// Получить лид по ID
export const getLead = async (id: number) => {
  const response = await api.get(`/crm/leads/${id}`);
  return response.data;
};

export const createLead = async (data: any) => {
  const response = await api.post('/crm/leads', data);
  return response.data;
};

export const updateLead = async (id: number, data: any) => {
  const response = await api.patch(`/crm/leads/${id}`, data);
  return response.data;
};

export const deleteLead = async (id: number) => {
  await api.delete(`/crm/leads/${id}`);
};

export const getDeals = async () => {
  const response = await api.get('/crm/deals');
  return response.data;
};

// Получить сделку по ID
export const getDeal = async (id: number) => {
  const response = await api.get(`/crm/deals/${id}`);
  return response.data;
};

export const createDeal = async (data: any) => {
  const response = await api.post('/crm/deals', data);
  return response.data;
};

export const updateDeal = async (id: number, data: any) => {
  const response = await api.patch(`/crm/deals/${id}`, data);
  return response.data;
};

// ==================== TASK TYPES ====================

export interface TaskType {
  id: number;
  name: string;
  color: string;
  icon?: string;
  is_active: boolean;
}

export const getTaskTypes = async (): Promise<TaskType[]> => {
  const response = await api.get('/tasks/types');
  return response.data;
};

export interface TaskStatus {
  id: number;
  name: string;
  color: string;
  sort_order: number;
}

export const getTaskStatuses = async (): Promise<TaskStatus[]> => {
  const response = await api.get('/tasks/statuses');
  return response.data;
};

export const getAdminTaskTypes = async (): Promise<TaskType[]> => {
  const response = await api.get('/admin/task-types');
  return response.data;
};

export const createTaskType = async (data: Partial<TaskType>) => {
  const response = await api.post('/admin/task-types', data);
  return response.data;
};

export const updateTaskType = async (id: number, data: Partial<TaskType>) => {
  const response = await api.patch(`/admin/task-types/${id}`, data);
  return response.data;
};

export const deleteTaskType = async (id: number) => {
  const response = await api.delete(`/admin/task-types/${id}`);
  return response.data;
};

export const getAdminTaskStatuses = async (): Promise<TaskStatus[]> => {
  const response = await api.get('/admin/task-statuses');
  return response.data;
};

export const createTaskStatus = async (data: any) => {
  const response = await api.post('/admin/task-statuses', data);
  return response.data;
};

export const updateTaskStatus = async (id: number, data: any) => {
  const response = await api.patch(`/admin/task-statuses/${id}`, data);
  return response.data;
};

export const deleteTaskStatus = async (id: number) => {
  const response = await api.delete(`/admin/task-statuses/${id}`);
  return response.data;
};

// ==================== TASKS ====================

export const getTasks = async () => {
  const response = await api.get('/tasks/');
  return response.data;
};

export const deleteTask = async (taskId: number) => {
  const response = await api.delete(`/tasks/${taskId}`);
  return response.data;
};

export const getTasksByProject = async (projectId: number) => {
  const response = await api.get(`/tasks/project/${projectId}`);
  return response.data;
};

export const createTask = async (data: any) => {
  const response = await api.post('/tasks/', data);
  return response.data;
};

export const createTaskComment = async (taskId: number, content: string) => {
  const response = await api.post(`/tasks/${taskId}/comments`, { content });
  return response.data;
};

export const updateTask = async (id: number, data: any) => {
  const response = await api.patch(`/tasks/${id}`, data);
  return response.data;
};

export const getAssignableUsers = async () => {
  const response = await api.get('/tasks/assignable-users');
  return response.data;
};

export const downloadTaskAttachment = async (attachmentId: number) => {
  const response = await api.get(`/tasks/attachments/${attachmentId}`, {
    responseType: 'blob'
  });
  return response.data;
};

export const convertLeadToDeal = async (leadId: number) => {
  const response = await api.post(`/crm/leads/${leadId}/convert`);
  return response.data;
};

export const createProjectFromDeal = async (dealId: number) => {
  const response = await api.post(`/crm/deals/${dealId}/create-project`);
  return response.data;
};

// ==================== ORGANIZATION & DEPARTMENTS ====================

export const getDepartmentTree = async () => {
  const response = await api.get('/admin/departments/tree');
  return response.data;
};

export const updateDepartment = async (id: number, data: any) => {
  const response = await api.patch(`/admin/departments/${id}`, data);
  return response.data;
};

export const createDepartment = async (data: any) => {
  const response = await api.post('/admin/departments/', data);
  return response.data;
};


// ==================== ROLES & PERMISSIONS ====================

export const getRoles = async () => {
  const response = await api.get('/admin/roles');
  return response.data;
};

export const getPermissionList = async () => {
  const response = await api.get('/admin/permissions/list');
  return response.data;
};

export const getAllPermissions = async () => {
  const response = await api.get('/admin/permissions/all');
  return response.data;
};

export const syncRolePermissions = async (roleId: number, permissionIds: number[]) => {
  const response = await api.post(`/admin/roles/${roleId}/permissions`, { permission_ids: permissionIds });
  return response.data;
};

// Финансовая аналитика
export const getCompanyFinances = async () => {
  const response = await api.get('/analytics/finances');
  return response.data;
};

// BPM
export const getWorkflows = async () => {
  const response = await api.get('/bpm/workflows');
  return response.data;
};

export const createWorkflow = async (data: any) => {
  const response = await api.post('/bpm/workflows', data);
  return response.data;
};

export const deleteWorkflow = async (id: number) => {
  const response = await api.delete(`/bpm/workflows/${id}`);
  return response.data;
};

export const getBPMLogs = async (params: { limit?: number; entity_type?: string; entity_id?: number } = {}) => {
  const response = await api.get('/bpm/logs', { params });
  return response.data;
};

// ==================== CRM STAGES ====================

export const getCRMStages = async (module?: string) => {
  const response = await api.get('/admin/crm-stages', { params: { module } });
  return response.data;
};

export const createCRMStage = async (data: any) => {
  const response = await api.post('/admin/crm-stages', data);
  return response.data;
};

export const updateCRMStage = async (id: number, data: any) => {
  const response = await api.patch(`/admin/crm-stages/${id}`, data);
  return response.data;
};

export const deleteCRMStage = async (id: number) => {
  await api.delete(`/admin/crm-stages/${id}`);
};

// ==================== JOB POSITIONS ====================

export const getJobPositions = async () => {
  const response = await api.get('/admin/positions');
  return response.data;
};

export const getJobPositionsHierarchy = async () => {
  const response = await api.get('/admin/positions/hierarchy');
  return response.data;
};

export const createJobPosition = async (data: any) => {
  const response = await api.post('/admin/positions', data);
  return response.data;
};

export const updateJobPosition = async (id: number, data: any) => {
  const response = await api.patch(`/admin/positions/${id}`, data);
  return response.data;
};

export const deleteJobPosition = async (id: number) => {
  await api.delete(`/admin/positions/${id}`);
};

export const syncPositionPermissions = async (positionId: number, permissionIds: number[]) => {
  const response = await api.post(`/admin/positions/${positionId}/permissions`, { permission_ids: permissionIds });
  return response.data;
};

// ==================== SYSTEM SETTINGS ====================

export const getSystemSettings = async () => {
  const response = await api.get('/admin/settings');
  return response.data;
};

export const updateSystemSetting = async (key: string, value: string) => {
  const response = await api.post('/admin/settings', { key, value });
  return response.data;
};

// ==================== NEW CRM ENTITIES ====================

export const getCounterparties = async () => {
  const response = await api.get('/crm/counterparties');
  return response.data;
};

export const createCounterparty = async (data: any) => {
  const response = await api.post('/crm/counterparties', data);
  return response.data;
};

export const getCRMTasks = async (params: { lead_id?: number; deal_id?: number; project_id?: number } = {}) => {
  const response = await api.get('/crm/tasks', { params });
  return response.data;
};

export const createCRMTask = async (data: any) => {
  const response = await api.post('/crm/tasks', data);
  return response.data;
};

// ==================== STAGE PERMISSIONS ====================

export const getPermissionsMatrix = async () => {
  const response = await api.get('/admin/permissions/matrix');
  return response.data;
};

export const syncStagePermissions = async (data: { position_id?: number; user_id?: number; allowed_stage_ids: number[] }) => {
  const response = await api.post('/admin/permissions/sync', data);
  return response.data;
};

// ==================== COUNTERPARTY UPDATE ====================

export const updateCounterparty = async (id: number, data: any) => {
  const response = await api.patch(`/crm/counterparties/${id}`, data);
  return response.data;
};

// ==================== PROJECT DOCUMENTS ====================

export const uploadProjectDoc = async (projectId: number, docType: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/projects/${projectId}/upload-doc?doc_type=${docType}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

// ==================== TASK ATTACHMENTS ====================

export const uploadTaskAttachment = async (taskId: number, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/tasks/${taskId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const getTask = async (id: number) => {
  const response = await api.get(`/tasks/${id}`);
  return response.data;
};

// ==================== TASK TYPES & STATUSES (ADMIN) ====================

export const uploadProjectSpec = async (projectId: number, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/projects/${projectId}/upload-spec`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const uploadGanttExcel = async (projectId: number, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/projects/${projectId}/upload-gantt`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};
