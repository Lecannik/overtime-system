/* eslint-disable */
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Clock, AlertCircle, TrendingUp,
  MapPin, Trash2, Edit2, Search, ChevronLeft, ChevronRight, FileDown,
  Settings, ChevronUp, ChevronDown, RotateCcw, Eye, LayoutGrid, List
} from 'lucide-react';
import { api, getMyOvertimes, getMyStats, cancelOvertime, restoreOvertime, exportMyAnalytics, exportAnalytics, getAnalyticsSummary, getAccessToken } from '../../services/api';
import Header from '../layout/Header';
import CreateOvertimeModal from './CreateOvertimeModal';
import OvertimeDetailModal from './OvertimeDetailModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { STATUS_LABELS, formatDate, formatTime } from '../../constants/locale';
import LoadingOverlay from '../atoms/LoadingOverlay';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import { Russian } from 'flatpickr/dist/l10n/ru.js';
import type { User, Overtime, UserStats, Department, AnalyticsSummary } from '../../types';
import { AxiosError } from 'axios';

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

const formatToYmd = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseToDate = (str: string) => {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Безопасно парсит строку даты, предотвращая исключения во flatpickr при некорректном ручном вводе.
 *
 * @param {string} datestr - Входная строка даты.
 * @param {string} format - Формат даты.
 * @returns {Date} Объект даты. При ошибке возвращает невалидную дату new Date(NaN).
 */
const safeParseDate = (datestr: string, _format: string): Date => {
  if (!datestr) return new Date(NaN);
  try {
    const trimmed = datestr.trim();
    const parts = trimmed.split(/[\/\s:\.-]+/).filter(Boolean);
    if (parts.length >= 3) {
      let day = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        day = parseInt(parts[2], 10);
      }
      if (year < 100) {
        year += 2000;
      }
      const hour = parts[3] ? parseInt(parts[3], 10) : 0;
      const minute = parts[4] ? parseInt(parts[4], 10) : 0;
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && !isNaN(hour) && !isNaN(minute)) {
        const date = new Date(year, month, day, hour, minute);
        if (!isNaN(date.getTime())) return date;
      }
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? new Date(NaN) : d;
  } catch (e) {
    return new Date(NaN);
  }
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [overtimes, setOvertimes] = useState<Overtime[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editOvertime, setEditOvertime] = useState<Overtime | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isColConfigOpen, setIsColConfigOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [companyStats, setCompanyStats] = useState<AnalyticsSummary | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedOvertimeDetail, setSelectedOvertimeDetail] = useState<Overtime | null>(null);
  const [mobileView, setMobileView] = useState<'cards' | 'table'>('cards');

  // Debounce поиска — 350мс
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Сортировка: ключ поля и направление
  type SortKey = 'date' | 'user' | 'project' | 'hours' | 'status' | null;
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  /** Переключить сортировку по полю — повторный клик меняет направление */
  const handleSort = (key: SortKey) => {
    if (key === null) return;
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  };

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const defaultCols = [
      { id: 'date', label: 'Дата', visible: true },
      { id: 'user', label: 'Автор', visible: true },
      { id: 'project', label: 'Проект', visible: true },
      { id: 'hours', label: 'Часов запрошено', visible: true },
      { id: 'approved_hours', label: 'Одобрено часов', visible: true },
      { id: 'status', label: 'Статус', visible: true },
      { id: 'description', label: 'Описание', visible: false },
      { id: 'start_time', label: 'Начало', visible: false },
      { id: 'end_time', label: 'Окончание', visible: false },
      { id: 'actions', label: 'Действия', visible: true }
    ];
    const saved = localStorage.getItem('dashboard_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ColumnConfig[];
        const merged = [...parsed];
        defaultCols.forEach(dCol => {
          const existingIdx = merged.findIndex(c => c.id === dCol.id);
          if (existingIdx === -1) {
            // Новая колонка — добавить перед «Действиями»
            const actionsIdx = merged.findIndex(c => c.id === 'actions');
            if (actionsIdx !== -1) {
              merged.splice(actionsIdx, 0, dCol);
            } else {
              merged.push(dCol);
            }
          } else {
            // Колонка уже есть — синхронизировать label (на случай переименования)
            merged[existingIdx] = { ...merged[existingIdx], label: dCol.label };
          }
        });
        return merged;
      } catch (e) {
        console.error(e);
      }
    }
    return defaultCols;
  });

  useEffect(() => {
    localStorage.setItem('dashboard_columns', JSON.stringify(columns));
  }, [columns]);

  const toggleColumnVisibility = (id: string) => {
    setColumns(prev => prev.map(col => col.id === id ? { ...col, visible: !col.visible } : col));
  };

  const moveColumn = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= columns.length) return;
    const newCols = [...columns];
    const [removed] = newCols.splice(fromIndex, 1);
    newCols.splice(toIndex, 0, removed);
    setColumns(newCols);
  };

  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
    setDraggedColId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    if (id) {
      e.preventDefault();
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetId) return;

    const draggedIdx = columns.findIndex(c => c.id === draggedColId);
    const targetIdx = columns.findIndex(c => c.id === targetId);

    const newCols = [...columns];
    const [removed] = newCols.splice(draggedIdx, 1);
    newCols.splice(targetIdx, 0, removed);

    setColumns(newCols);
    setDraggedColId(null);
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(12);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const startFpRef = useRef<any>(null);
  const endFpRef = useRef<any>(null);

  const startInputCallbackRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      if (!startFpRef.current) {
        startFpRef.current = flatpickr(node, {
          dateFormat: "d/m/Y",
          locale: Russian,
          allowInput: true,
          disableMobile: true,
          parseDate: safeParseDate,
          onClose: (selectedDates) => {
            if (selectedDates[0]) {
              setStartDate(formatToYmd(selectedDates[0]));
            } else {
              setStartDate('');
            }
            setCurrentPage(1);
          }
        });
      }
    } else {
      if (startFpRef.current) {
        startFpRef.current.destroy();
        startFpRef.current = null;
      }
    }
  }, []);

  const endInputCallbackRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      if (!endFpRef.current) {
        endFpRef.current = flatpickr(node, {
          dateFormat: "d/m/Y",
          locale: Russian,
          allowInput: true,
          disableMobile: true,
          parseDate: safeParseDate,
          onClose: (selectedDates) => {
            if (selectedDates[0]) {
              setEndDate(formatToYmd(selectedDates[0]));
            } else {
              setEndDate('');
            }
            setCurrentPage(1);
          }
        });
      }
    } else {
      if (endFpRef.current) {
        endFpRef.current.destroy();
        endFpRef.current = null;
      }
    }
  }, []);

  const fetchUserAndStats = useCallback(async () => {
    try {
      const token = getAccessToken();
      if (!token) { navigate('/login'); return; }

      const [userRes, statsRes] = await Promise.all([
        api.get('/auth/me'),
        getMyStats()
      ]);
      const curUser = userRes.data;
      setUser(curUser);
      setStats(statsRes);

      if (curUser?.role === 'admin') {
        const [deptsRes, compStatsRes] = await Promise.all([
          api.get('/admin/departments').then(r => r.data),
          getAnalyticsSummary()
        ]);
        setDepartments(deptsRes || []);
        setCompanyStats(compStatsRes);
      }
    } catch (err) {
      console.error('Failed to fetch user and stats:', err);
    }
  }, [navigate]);

  const fetchTableData = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const token = getAccessToken();
      if (!token) { navigate('/login'); return; }

      const params: any = {
        page: currentPage,
        page_size: pageSize,
        status: filterStatus || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        search: debouncedSearch || undefined,
      };

      if (user?.role === 'admin' && activeTab === 'all') {
        params.view = 'admin_dashboard';
        if (selectedDeptId) {
          params.department_id = parseInt(selectedDeptId);
        }
      } else {
        params.view = 'dashboard';
      }

      const ovRes = await getMyOvertimes(params);
      setOvertimes(ovRes.items || []);
      setTotalPages(ovRes.pages || 1);
    } catch (err) {
      console.error('Failed to fetch table data:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [currentPage, pageSize, filterStatus, startDate, endDate, debouncedSearch, navigate, user, activeTab, selectedDeptId]);

  // 1. Загружаем общие данные при монтировании
  useEffect(() => {
    const init = async () => {
      await fetchUserAndStats();
    };
    init();
  }, [fetchUserAndStats]);

  // 2. Загрузка таблицы при смене страницы, статуса, поиска, вкладки или отдела (с лоадером)
  useEffect(() => {
    const init = async () => {
      await fetchTableData(true);
    };
    init();
  }, [currentPage, filterStatus, debouncedSearch, activeTab, selectedDeptId, fetchTableData]);

  // 3. Загрузка таблицы при смене дат (без лоадера)
  useEffect(() => {
    const update = async () => {
      await fetchTableData(false);
    };
    update();
  }, [startDate, endDate, activeTab, selectedDeptId, fetchTableData]);



  // 5. Подписка на внешние обновления (overtime_update)
  useEffect(() => {
    const handleUpdate = () => {
      fetchTableData(false);
      fetchUserAndStats();
    };
    window.addEventListener('overtime_update', handleUpdate);
    return () => {
      window.removeEventListener('overtime_update', handleUpdate);
    };
  }, [fetchTableData, fetchUserAndStats]);

  // 6. Синхронизация стейта во flatpickr
  useEffect(() => {
    if (startFpRef.current) {
      const currentFpDate = startFpRef.current.selectedDates[0];
      const formattedCurrent = currentFpDate ? formatToYmd(currentFpDate) : '';
      if (formattedCurrent !== startDate) {
        const parsed = parseToDate(startDate);
        if (parsed) {
          startFpRef.current.setDate(parsed, false);
        } else {
          startFpRef.current.clear();
        }
      }
    }
  }, [startDate]);

  useEffect(() => {
    if (endFpRef.current) {
      const currentFpDate = endFpRef.current.selectedDates[0];
      const formattedCurrent = currentFpDate ? formatToYmd(currentFpDate) : '';
      if (formattedCurrent !== endDate) {
        const parsed = parseToDate(endDate);
        if (parsed) {
          endFpRef.current.setDate(parsed, false);
        } else {
          endFpRef.current.clear();
        }
      }
    }
  }, [endDate]);

  const handleCancel = async (id: number) => {
    if (window.confirm('Отменить заявку?')) {
      try {
        await cancelOvertime(id);
        fetchTableData(false);
        fetchUserAndStats();
      } catch (err: unknown) {
        const axiosError = err as AxiosError<{ detail?: string }>;
        console.error(axiosError);
        alert(axiosError.response?.data?.detail || 'Ошибка при отмене заявки');
      }
    }
  };

  const handleRestore = async (id: number) => {
    if (window.confirm('Восстановить заявку? Она вернётся в статус «Ожидает согласования».')) {
      try {
        await restoreOvertime(id);
        fetchTableData(false);
        fetchUserAndStats();
      } catch (err: unknown) {
        const axiosError = err as AxiosError<{ detail?: string }>;
        console.error(axiosError);
        alert(axiosError.response?.data?.detail || 'Ошибка при восстановлении заявки');
      }
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const blob = await exportMyAnalytics();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      link.setAttribute('download', `personal_report_${dateStr}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      console.error('Export error:', axiosError);
      alert(axiosError.response?.data?.detail || 'Ошибка при экспорте отчета');
    } finally {
      setLoading(false);
    }
  };

  const handleExportMonth = async (month: 'current' | 'previous') => {
    try {
      setLoading(true);
      const now = new Date();
      let startStr = '';
      let endStr = '';

      if (month === 'current') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        startStr = formatToYmd(start);
        endStr = formatToYmd(end);
      } else {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        startStr = formatToYmd(start);
        endStr = formatToYmd(end);
      }

      const blob = await exportMyAnalytics({ start_date: startStr, end_date: endStr });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const fileSuffix = month === 'current' ? 'current_month' : 'previous_month';
      link.setAttribute('download', `personal_report_${fileSuffix}_${now.getFullYear()}_${now.getMonth() + 1}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error('Export month error:', err);
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert(axiosError.response?.data?.detail || 'Не удалось экспортировать отчет за выбранный месяц');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCompanyMonth = async (month: 'current' | 'previous') => {
    try {
      setLoading(true);
      const now = new Date();
      let startStr = '';
      let endStr = '';

      if (month === 'current') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        startStr = formatToYmd(start);
        endStr = formatToYmd(end);
      } else {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        startStr = formatToYmd(start);
        endStr = formatToYmd(end);
      }

      const blob = await exportAnalytics({ start_date: startStr, end_date: endStr });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const fileSuffix = month === 'current' ? 'current_month' : 'previous_month';
      link.setAttribute('download', `company_report_${fileSuffix}_${now.getFullYear()}_${now.getMonth() + 1}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error('Export company month error:', err);
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert(axiosError.response?.data?.detail || 'Не удалось экспортировать отчет компании за выбранный месяц');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCompanyAll = async () => {
    try {
      setLoading(true);
      const blob = await exportAnalytics();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      link.setAttribute('download', `company_report_${dateStr}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error('Export company error:', err);
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert(axiosError.response?.data?.detail || 'Ошибка при экспорте отчета компании');
    } finally {
      setLoading(false);
    }
  };

  const filteredOvertimes = Array.isArray(overtimes) ? overtimes : [];

  /** Отсортированный массив, применяется поверх фильтра */
  const sortedOvertimes = useMemo(() => {
    if (!sortKey) return filteredOvertimes;
    return [...filteredOvertimes].sort((a, b) => {
      let valA: string | number;
      let valB: string | number;
      switch (sortKey) {
        case 'date':
          valA = new Date(a.start_time).getTime();
          valB = new Date(b.start_time).getTime();
          break;
        case 'user':
          valA = (a.user?.full_name || '').toLowerCase();
          valB = (b.user?.full_name || '').toLowerCase();
          break;
        case 'project':
          valA = (a.project?.name || '').toLowerCase();
          valB = (b.project?.name || '').toLowerCase();
          break;
        case 'hours':
          valA = Number(a.hours) || 0;
          valB = Number(b.hours) || 0;
          break;
        case 'status':
          valA = (a.status || '').toLowerCase();
          valB = (b.status || '').toLowerCase();
          break;
        default:
          return 0;
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredOvertimes, sortKey, sortDir]);

  const renderActionButtons = (ot: Overtime) => (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
      {/* Просмотр деталей */}
      <button
        onClick={() => setSelectedOvertimeDetail(ot)}
        className="action-button-modern"
        title="Просмотреть детали"
        style={{ color: 'var(--primary)' }}
      >
        <Eye size={16} />
      </button>
      {/* Кнопка восстановления для отменённых заявок */}
      {ot.status === 'CANCELLED' && (
        <button
          onClick={() => handleRestore(ot.id)}
          className="action-button-modern"
          title="Восстановить заявку"
          style={{ color: 'var(--primary)' }}
        >
          <RotateCcw size={16} />
        </button>
      )}
      {/* Редактирование и отмена для активных заявок */}
      {(ot.status === 'PENDING' || ot.status === 'IN_PROGRESS' || ot.status === 'MANAGER_APPROVED' || ot.status === 'HEAD_APPROVED' || user?.role === 'admin') &&
        ot.status !== 'APPROVED' && ot.status !== 'REJECTED' && ot.status !== 'CANCELLED' && (
          <>
            <button
              onClick={() => { setEditOvertime(ot); setIsCreateModalOpen(true); }}
              className="action-button-modern"
              title="Редактировать"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => handleCancel(ot.id)}
              className="action-button-modern delete"
              title="Удалить/Отменить"
              style={{ color: 'var(--error)' }}
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      {ot.start_lat && ot.start_lng && (
        <a
          href={`https://www.google.com/maps?q=${ot.start_lat},${ot.start_lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="action-button-modern"
          title="Точка начала (карта)"
          style={{ color: 'var(--success)' }}
        >
          <MapPin size={16} />
        </a>
      )}
      {ot.end_lat && ot.end_lng && (
        <a
          href={`https://www.google.com/maps?q=${ot.end_lat},${ot.end_lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="action-button-modern"
          title="Точка финиша (карта)"
          style={{ color: 'var(--error)' }}
        >
          <MapPin size={16} />
        </a>
      )}
      {!ot.start_lat && ot.location_name && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ot.location_name)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="action-button-modern"
          title={ot.location_name}
          style={{ color: 'var(--text-secondary)' }}
        >
          <MapPin size={16} />
        </a>
      )}
    </div>
  );

  if (loading && !overtimes.length) return <LoadingOverlay />;

  return (
    <div className="page-container animate-fade-in">
      {loading && <LoadingOverlay />}
      {user && <Header user={user} />}

      <div className="dashboard-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {activeTab === 'my' ? 'Дашборд сотрудника' : 'Сводный дашборд компании'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            {activeTab === 'my'
              ? 'Ваша активность и статус переработок за последнее время.'
              : 'Статистика и заявки всех сотрудников компании.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {activeTab === 'my' && (
            <button onClick={() => setIsCreateModalOpen(true)} className="primary" style={{ padding: '10px 20px', minHeight: '42px', fontWeight: 700 }}>
              <Plus size={20} /> НОВАЯ ЗАЯВКА
            </button>
          )}
          <button onClick={() => activeTab === 'my' ? handleExportMonth('previous') : handleExportCompanyMonth('previous')} style={{
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', fontSize: '0.8rem'
          }} className="btn-secondary">
            <FileDown size={16} /> Прошлый месяц
          </button>
          <button onClick={() => activeTab === 'my' ? handleExportMonth('current') : handleExportCompanyMonth('current')} style={{
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', fontSize: '0.8rem'
          }} className="btn-secondary">
            <FileDown size={16} /> Текущий месяц
          </button>
          <button onClick={() => activeTab === 'my' ? handleExport() : handleExportCompanyAll()} style={{
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', fontSize: '0.8rem'
          }} className="btn-secondary">
            <FileDown size={16} /> Общий отчет
          </button>
        </div>
      </div>

      {/* Переключатель вкладок (только для админа) */}
      {user?.role === 'admin' && (
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '12px', width: 'fit-content', border: '1px solid var(--border)', marginBottom: '32px' }}>
          <button
            onClick={() => { setActiveTab('my'); setCurrentPage(1); }}
            style={{
              padding: '8px 24px',
              borderRadius: '8px',
              border: 0,
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'my' ? 'var(--primary-gradient)' : 'transparent',
              color: activeTab === 'my' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s ease',
            }}
          >
            Мои переработки
          </button>
          <button
            onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
            style={{
              padding: '8px 24px',
              borderRadius: '8px',
              border: 0,
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'all' ? 'var(--primary-gradient)' : 'transparent',
              color: activeTab === 'all' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s ease',
            }}
          >
            Все сотрудники
          </button>
        </div>
      )}

      {/* Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '40px' }}>
        {activeTab === 'my' ? (
          [
            { label: 'Часов одобрено в этом месяце', value: `${stats?.current_month_hours || 0}ч`, icon: Clock, color: 'var(--primary)', sub: 'В текущем месяце' },
            { label: 'Часов одобрено в прошлом месяце', value: `${stats?.last_month_hours || 0}ч`, icon: Clock, color: 'var(--info)', sub: 'В прошлом месяце' },
            { label: 'Всего заявок', value: stats?.total_requests || 0, icon: TrendingUp, color: 'var(--success)', sub: 'За всё время' },
            { label: 'Активных заявок', value: stats?.active_requests || 0, icon: AlertCircle, color: 'var(--warning)', sub: 'В процессе проверки' },
          ].map((stat, i) => (
            <div key={i} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{stat.label}</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stat.value}</h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{stat.sub}</p>
              </div>
              <div className="icon-shape" style={{ background: 'var(--bg-tertiary)', color: stat.color, width: '48px', height: '48px', borderRadius: '16px' }}>
                <stat.icon size={24} />
              </div>
            </div>
          ))
        ) : (
          [
            { label: 'Часов согласовано в компании', value: `${companyStats?.total_hours || 0}ч`, icon: Clock, color: 'var(--primary)', sub: 'По всем проектам' },
            { label: 'Всего заявок в компании', value: companyStats?.total_requests || 0, icon: TrendingUp, color: 'var(--info)', sub: 'Зарегистрировано' },
            { label: 'Согласовано заявок', value: companyStats?.approved_requests || 0, icon: TrendingUp, color: 'var(--success)', sub: 'Одобрено руководителями' },
            { label: 'Ожидают согласования', value: companyStats?.pending_requests || 0, icon: AlertCircle, color: 'var(--warning)', sub: 'В процессе проверки' },
          ].map((stat, i) => (
            <div key={i} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{stat.label}</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stat.value}</h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{stat.sub}</p>
              </div>
              <div className="icon-shape" style={{ background: 'var(--bg-tertiary)', color: stat.color, width: '48px', height: '48px', borderRadius: '16px' }}>
                <stat.icon size={24} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="glass-card" style={{ padding: '24px', minWidth: 0 }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>Активность за 30 дней (часы)</h4>
          <div style={{ height: '200px', position: 'relative', width: '100%', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={stats?.daily_stats || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis
                  dataKey="date"
                  hide
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickFormatter={(value) => `${value}ч`} />
                <RechartsTooltip
                  contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px', boxShadow: 'var(--card-shadow)' }}
                  itemStyle={{ color: 'var(--primary)' }}
                  labelFormatter={(label) => {
                    if (!label) return '';
                    const parts = label.split('-');
                    if (parts.length === 3) {
                      return `Дата: ${parts[2]}.${parts[1]}.${parts[0]}`;
                    }
                    return `Дата: ${label}`;
                  }}
                  formatter={(value: any, name: any) => {
                    if (name === 'hours') return [`${value} ч.`, 'Время переработки'];
                    return [value, name];
                  }}
                />
                <Bar dataKey="hours" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px', minWidth: 0 }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Распределение по проектам</h4>
          <div className="dashboard-pie-wrap" style={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: '16px' }}>
            <div style={{ flex: '1 1 200px', height: '180px', position: 'relative', width: '100%', minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={stats?.by_project || []}
                    dataKey="hours"
                    nameKey="project_name"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                  >
                    {(stats?.by_project || []).map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={[
                        'var(--primary)', 'var(--success)', 'var(--warning)', 'var(--info)', '#8b5cf6', '#ec4899'
                      ][index % 6]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px', boxShadow: 'var(--card-shadow)' }}
                    formatter={(value: any, name: any) => {
                      return [`${value} ч.`, name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="dashboard-pie-legend" style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(stats?.by_project || []).slice(0, 4).map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '2px', flexShrink: 0, background: [
                      'var(--primary)', 'var(--success)', 'var(--warning)', 'var(--info)', '#8b5cf6', '#ec4899'
                    ][i % 6]
                  }} />
                  <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.project_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table Card (Full Width) */}
      <div className="glass-card" style={{ padding: '0', display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
        <div className="dashboard-card-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1.15rem' }}>{activeTab === 'my' ? 'Мои переработки' : 'Все переработки'}</h3>
          <div className="dashboard-filters-wrap" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flexGrow: 1, justifyContent: 'flex-end' }}>
            {/* Фильтр по отделам */}
            {user?.role === 'admin' && activeTab === 'all' && (
              <select
                value={selectedDeptId}
                onChange={e => { setSelectedDeptId(e.target.value); setCurrentPage(1); }}
                style={{ height: '36px', padding: '0 10px', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', flex: '1 1 130px', minWidth: '120px' }}
              >
                <option value="">Все отделы</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id.toString()}>{d.name}</option>
                ))}
              </select>
            )}

            {/* Фильтр по статусу */}
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              style={{ height: '36px', padding: '0 10px', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', flex: '1 1 130px', minWidth: '120px' }}
            >
              <option value="">Все статусы</option>
              <option value="PENDING">На согласовании</option>
              <option value="HEAD_APPROVED">Утверждено рук.</option>
              <option value="MANAGER_APPROVED">Утверждено мен.</option>
              <option value="APPROVED">Одобрено</option>
              <option value="REJECTED">Отклонено</option>
              <option value="CANCELLED">Отменено</option>
              <option value="IN_PROGRESS">В процессе</option>
            </select>

            {/* Диапазон дат — адаптивный блок, не вылезает за экран */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 210px', minWidth: '190px' }}>
              <input
                ref={startInputCallbackRef}
                type="text"
                placeholder="дд/мм/гггг"
                style={{ height: '36px', flex: 1, minWidth: 0, width: '100%', padding: '0 6px', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', textAlign: 'center' }}
                title="Начало периода"
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', flexShrink: 0 }}>—</span>
              <input
                ref={endInputCallbackRef}
                type="text"
                placeholder="дд/мм/гггг"
                style={{ height: '36px', flex: 1, minWidth: 0, width: '100%', padding: '0 6px', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', textAlign: 'center' }}
                title="Конец периода"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); setCurrentPage(1); }}
                  className="action-button-modern"
                  title="Сбросить даты"
                  style={{ height: '36px', width: '36px', minWidth: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Поиск */}
            <div style={{ position: 'relative', flex: '1 1 180px', minWidth: '150px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                placeholder="Найти по описанию..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px', height: '36px', fontSize: '0.8rem', background: 'var(--bg-tertiary)', width: '100%' }}
              />
            </div>

            {/* Переключатель вида на мобильных: Карточки / Таблица */}
            <div className="show-on-mobile" style={{ gap: '6px' }}>
              <button
                onClick={() => setMobileView(v => v === 'cards' ? 'table' : 'cards')}
                className="action-button-modern"
                title={mobileView === 'cards' ? 'Показать таблицу' : 'Показать карточки'}
                style={{ height: '36px', width: '36px', minWidth: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}
              >
                {mobileView === 'cards' ? <List size={18} /> : <LayoutGrid size={18} />}
              </button>
            </div>

            {/* Настройка колонок */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setIsColConfigOpen(!isColConfigOpen)}
                className="action-button-modern"
                title="Настройка колонок"
                style={{ height: '36px', width: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Settings size={18} />
              </button>
              {isColConfigOpen && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '42px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxShadow: 'var(--card-shadow)',
                  zIndex: 100,
                  width: '240px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '4px' }}>
                    Настройка колонок
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {columns.map((col, idx) => (
                      <div
                        key={col.id}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}
                      >
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none', color: 'var(--text-primary)' }}>
                          <input
                            type="checkbox"
                            checked={col.visible}
                            disabled={col.id === 'date' || col.id === 'actions'}
                            onChange={() => toggleColumnVisibility(col.id)}
                          />
                          <span>{col.label}</span>
                        </label>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button
                            disabled={idx === 0}
                            onClick={() => moveColumn(idx, idx - 1)}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', opacity: idx === 0 ? 0.3 : 1, color: 'var(--text-primary)' }}
                          >
                            ↑
                          </button>
                          <button
                            disabled={idx === columns.length - 1}
                            onClick={() => moveColumn(idx, idx + 1)}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', opacity: idx === columns.length - 1 ? 0.3 : 1, color: 'var(--text-primary)' }}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Мобильный карточный режим (для экранов смартфонов) */}
        {mobileView === 'cards' && (
          <div className="show-on-mobile" style={{ flexDirection: 'column', gap: '10px', padding: '12px' }}>
            {sortedOvertimes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Ничего не найдено
              </div>
            ) : (
              sortedOvertimes.map((ot: Overtime) => {
                const isApproved = ot.status === 'APPROVED' || ot.status === 'MANAGER_APPROVED' || ot.status === 'HEAD_APPROVED';
                return (
                  <div key={ot.id} className="mobile-overtime-card">
                    {/* Верхняя строка: Дата, Статус, Часы */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {formatDate(ot.start_time)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge badge-${ot.status === 'APPROVED' ? 'success' : ot.status === 'REJECTED' || ot.status === 'CANCELLED' ? 'danger' : 'warning'}`}>
                          {STATUS_LABELS[ot.status] || ot.status}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: isApproved ? 'var(--success)' : 'var(--primary)' }}>
                          {isApproved && ot.approved_hours != null ? `${ot.approved_hours}ч` : `${ot.hours}ч`}
                        </span>
                      </div>
                    </div>

                    {/* Проект и Автор */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {ot.project?.name || 'Внутренний'}
                      </div>
                      {activeTab === 'all' && ot.user && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {ot.user.full_name} ({ot.user.email})
                        </div>
                      )}
                    </div>

                    {/* Описание */}
                    {ot.description && (
                      <div className="line-clamp-2" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {ot.description}
                      </div>
                    )}

                    {/* Время и кнопки действий */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '2px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {formatTime(ot.start_time)}{ot.end_time && ` - ${formatTime(ot.end_time)}`}
                      </div>
                      {renderActionButtons(ot)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Табличный режим (для десктопа и при переключении на мобилках) */}
        <div className={`table-scroll-container ${mobileView === 'cards' ? 'hide-on-mobile' : ''}`} style={{ flex: 1, borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
          <table className="table-container" style={{ minWidth: '850px' }}>
            <thead>
              <tr>
                {columns.filter(c => c.visible).map(col => {
                  const isSortable = ['date', 'user', 'project', 'hours', 'status'].includes(col.id);
                  const isActive = sortKey === col.id;
                  return (
                    <th
                      key={col.id}
                      className="table-header"
                      draggable={col.id !== 'actions'}
                      onDragStart={e => handleDragStart(e, col.id)}
                      onDragOver={e => handleDragOver(e, col.id)}
                      onDrop={e => handleDrop(e, col.id)}
                      onClick={() => isSortable ? handleSort(col.id as SortKey) : undefined}
                      style={{
                        cursor: col.id === 'actions' ? 'default' : isSortable ? 'pointer' : 'grab',
                        textAlign: col.id === 'actions' ? 'right' : 'left',
                        opacity: draggedColId === col.id ? 0.5 : 1,
                        borderLeft: draggedColId && draggedColId !== col.id ? '2px dashed var(--primary)' : undefined,
                        transition: 'all 0.2s ease',
                        width: col.id === 'actions' ? '160px' : undefined,
                        minWidth: col.id === 'actions' ? '160px' : undefined,
                        userSelect: 'none',
                        color: isActive ? 'var(--primary)' : undefined,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {col.label}
                        {isSortable && (
                          isActive
                            ? (sortDir === 'asc'
                              ? <ChevronUp size={13} style={{ color: 'var(--primary)' }} />
                              : <ChevronDown size={13} style={{ color: 'var(--primary)' }} />)
                            : <ChevronUp size={13} style={{ opacity: 0.25 }} />
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedOvertimes.map((ot: Overtime) => (
                <tr key={ot.id}>
                  {columns.filter(c => c.visible).map(col => {
                    switch (col.id) {
                      case 'date':
                        return <td key={col.id} className="table-cell" style={{ whiteSpace: 'nowrap', minWidth: '100px' }}>{formatDate(ot.start_time)}</td>;
                      case 'user':
                        return (
                          <td key={col.id} className="table-cell" style={{ minWidth: '170px', maxWidth: '240px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflowWrap: 'break-word' }}>{ot.user?.full_name || '-'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflowWrap: 'break-word' }}>{ot.user?.email}</div>
                          </td>
                        );
                      case 'project':
                        return (
                          <td key={col.id} className="table-cell" style={{ minWidth: '160px', maxWidth: '240px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflowWrap: 'break-word' }}>{ot.project?.name || 'Внутренний'}</div>
                          </td>
                        );
                      case 'hours':
                        return <td key={col.id} className="table-cell" style={{ whiteSpace: 'nowrap', minWidth: '80px' }}>{ot.hours}ч</td>;
                      case 'approved_hours': {
                        const isApproved = ot.status === 'APPROVED' || ot.status === 'MANAGER_APPROVED' || ot.status === 'HEAD_APPROVED';
                        return (
                          <td key={col.id} className="table-cell" style={{ whiteSpace: 'nowrap', minWidth: '90px' }}>
                            {isApproved && ot.approved_hours != null
                              ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>{ot.approved_hours}ч</span>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                        );
                      }
                      case 'status':
                        return (
                          <td key={col.id} className="table-cell" style={{ whiteSpace: 'nowrap', minWidth: '120px' }}>
                            <span className={`badge badge-${ot.status === 'APPROVED' ? 'success' : ot.status === 'REJECTED' || ot.status === 'CANCELLED' ? 'danger' : 'warning'}`}>
                              {STATUS_LABELS[ot.status] || ot.status}
                            </span>
                          </td>
                        );
                      case 'description':
                        return <td key={col.id} className="table-cell" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ot.description}>{ot.description || '-'}</td>;
                      case 'start_time':
                        return <td key={col.id} className="table-cell" style={{ whiteSpace: 'nowrap' }}>{formatTime(ot.start_time)}</td>;
                      case 'end_time': {
                        const isEndEpoch = ot.end_time && new Date(ot.end_time).getFullYear() <= 1970;
                        return (
                          <td key={col.id} className="table-cell" style={{ whiteSpace: 'nowrap' }}>
                            {ot.status === 'IN_PROGRESS' || !ot.end_time || isEndEpoch
                              ? '-'
                              : formatTime(ot.end_time)}
                          </td>
                        );
                      }
                      case 'actions':
                        return (
                          <td key={col.id} className="table-cell" style={{ textAlign: 'right', whiteSpace: 'nowrap', width: '160px', minWidth: '160px' }}>
                            {renderActionButtons(ot)}
                          </td>
                        );
                      default:
                        return null;
                    }
                  })}
                </tr>
              ))}
              {sortedOvertimes.length === 0 && (
                <tr><td colSpan={columns.filter(c => c.visible).length} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Ничего не найдено</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination UI */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Страница <b>{currentPage}</b> из <b>{totalPages}</b>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="action-button-modern"
              style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="action-button-modern"
              style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateOvertimeModal
          editData={editOvertime}
          onClose={() => { setIsCreateModalOpen(false); setEditOvertime(null); }}
          onCreated={() => {
            setIsCreateModalOpen(false);
            setEditOvertime(null);
            const update = async () => {
              await fetchTableData(false);
              await fetchUserAndStats();
            };
            update();
          }}
        />
      )}

      {selectedOvertimeDetail && (
        <OvertimeDetailModal
          overtime={selectedOvertimeDetail}
          currentUser={user}
          onClose={() => setSelectedOvertimeDetail(null)}
          onStatusUpdate={() => {
            const update = async () => {
              await fetchTableData(false);
              await fetchUserAndStats();
            };
            update();
          }}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .dashboard-page-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .dashboard-page-header > div:last-child {
            width: 100% !important;
            justify-content: space-between;
          }
          .dashboard-page-header button.primary {
            width: 100% !important;
            justify-content: center !important;
          }
          .dashboard-card-header {
            padding: 16px 14px !important;
          }
          .dashboard-filters-wrap {
            width: 100% !important;
            justify-content: flex-start !important;
          }
          .dashboard-pie-wrap {
            flex-direction: column !important;
          }
          .dashboard-pie-legend {
            width: 100% !important;
            padding-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default DashboardPage;
