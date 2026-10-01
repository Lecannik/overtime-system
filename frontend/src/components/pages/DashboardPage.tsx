/* eslint-disable */
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Eye, RotateCcw, Edit2, Trash2, MapPin, FileDown
} from 'lucide-react';
import {
  getMyOvertimes,
  getOvertimes,
  getMyStats,
  cancelOvertime,
  restoreOvertime,
  exportMyAnalytics,
  exportAnalytics,
  getAnalyticsSummary,
  getDepartments
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Header from '../layout/Header';
import CreateOvertimeModal from './CreateOvertimeModal';
import OvertimeDetailModal from './OvertimeDetailModal';
import LoadingOverlay from '../atoms/LoadingOverlay';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import { Russian } from 'flatpickr/dist/l10n/ru.js';
import type { User, Overtime, UserStats, Department, AnalyticsSummary } from '../../types';
import { AxiosError } from 'axios';
import { DashboardStatsCards } from './dashboard/DashboardStatsCards';
import { DashboardCharts } from './dashboard/DashboardCharts';
import { DashboardTableControls, type ColumnConfig } from './dashboard/DashboardTableControls';
import { DashboardOvertimesTable } from './dashboard/DashboardOvertimesTable';

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

type SortKey = 'date' | 'user' | 'project' | 'hours' | 'status' | '';

/**
 * Главный экран дашборда системы:
 * - Отображает личные переработки пользователя либо сводные данные компании (для администраторов).
 * - Поддерживает фильтрацию по статусу, отделу, диапазону дат flatpickr, текстовый поиск.
 * - Включает KPI-карточки, аналитические графики и настраиваемую таблицу.
 */
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser, token, refreshUser } = useAuth();
  const [overtimes, setOvertimes] = useState<Overtime[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(authUser);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editOvertime, setEditOvertime] = useState<Overtime | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOvertimeDetail, setSelectedOvertimeDetail] = useState<Overtime | null>(null);

  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [companyStats, setCompanyStats] = useState<AnalyticsSummary | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');

  const [mobileView, setMobileView] = useState<'cards' | 'table'>(() => {
    return (localStorage.getItem('dashboard_mobile_view') as 'cards' | 'table') || 'cards';
  });

  useEffect(() => {
    localStorage.setItem('dashboard_mobile_view', mobileView);
  }, [mobileView]);

  const [sortKey, setSortKey] = useState<SortKey>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [isColConfigOpen, setIsColConfigOpen] = useState(false);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  const DEFAULT_COLUMN_WIDTHS: Record<string, number> = useMemo(() => ({
    date: 110,
    user: 200,
    project: 180,
    hours: 80,
    approved_hours: 100,
    status: 140,
    description: 240,
    start_time: 90,
    end_time: 90,
    actions: 130,
  }), []);

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('dashboard_columns_config_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse columns config', e);
      }
    }
    return [
      { id: 'date', label: 'Дата', visible: true, width: 110 },
      { id: 'user', label: 'Сотрудник', visible: false, width: 200 },
      { id: 'project', label: 'Проект', visible: true, width: 180 },
      { id: 'hours', label: 'Часы', visible: true, width: 80 },
      { id: 'approved_hours', label: 'Одобрено', visible: true, width: 100 },
      { id: 'status', label: 'Статус', visible: true, width: 140 },
      { id: 'description', label: 'Описание', visible: true, width: 240 },
      { id: 'start_time', label: 'Начало', visible: false, width: 90 },
      { id: 'end_time', label: 'Конец', visible: false, width: 90 },
      { id: 'actions', label: 'Действия', visible: true, width: 130 },
    ];
  });

  useEffect(() => {
    localStorage.setItem('dashboard_columns_config_v2', JSON.stringify(columns));
  }, [columns]);

  const [resizingColId, setResizingColId] = useState<string | null>(null);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);

  const handleResizeStart = (e: React.MouseEvent, colId: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColId(colId);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = currentWidth;
  };

  useEffect(() => {
    if (!resizingColId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartXRef.current;
      const newWidth = Math.max(60, resizeStartWidthRef.current + delta);
      setColumns(prev => prev.map(c => (c.id === resizingColId ? { ...c, width: newWidth } : c)));
    };

    const handleMouseUp = () => {
      setResizingColId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColId]);

  const resetSingleColumnWidth = (colId: string) => {
    const defaultW = DEFAULT_COLUMN_WIDTHS[colId] || 150;
    setColumns(prev => prev.map(c => (c.id === colId ? { ...c, width: defaultW } : c)));
  };

  const resetColumnWidths = () => {
    setColumns(prev =>
      prev.map(c => ({
        ...c,
        width: DEFAULT_COLUMN_WIDTHS[c.id] || 150,
      }))
    );
  };

  const toggleColumnVisibility = (id: string) => {
    setColumns(prev => prev.map(col => (col.id === id ? { ...col, visible: !col.visible } : col)));
  };

  const moveColumn = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= columns.length) return;
    setColumns(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedColId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, _id: string) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetId) return;

    setColumns(prev => {
      const fromIdx = prev.findIndex(c => c.id === draggedColId);
      const toIdx = prev.findIndex(c => c.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
    setDraggedColId(null);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortKey('');
        setSortDir('asc');
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const startPickerRef = useRef<flatpickr.Instance | null>(null);
  const endPickerRef = useRef<flatpickr.Instance | null>(null);
  const startElRef = useRef<HTMLInputElement | null>(null);
  const endElRef = useRef<HTMLInputElement | null>(null);

  const initPickers = useCallback(() => {
    if (startPickerRef.current) startPickerRef.current.destroy();
    if (endPickerRef.current) endPickerRef.current.destroy();

    const commonConfig: flatpickr.Options.Options = {
      locale: Russian,
      dateFormat: 'd.m.Y',
      allowInput: true,
      parseDate: safeParseDate,
      disableMobile: true,
    };

    if (startElRef.current) {
      startPickerRef.current = flatpickr(startElRef.current, {
        ...commonConfig,
        defaultDate: parseToDate(startDate) || undefined,
        onChange: (selectedDates) => {
          if (selectedDates.length > 0) {
            const ymd = formatToYmd(selectedDates[0]);
            setStartDate(ymd);
            if (endPickerRef.current) endPickerRef.current.set('minDate', selectedDates[0]);
          } else {
            setStartDate('');
            if (endPickerRef.current) endPickerRef.current.set('minDate', undefined as any);
          }
          setCurrentPage(1);
        },
      });
    }

    if (endElRef.current) {
      endPickerRef.current = flatpickr(endElRef.current, {
        ...commonConfig,
        defaultDate: parseToDate(endDate) || undefined,
        minDate: parseToDate(startDate) || undefined,
        onChange: (selectedDates) => {
          if (selectedDates.length > 0) {
            const ymd = formatToYmd(selectedDates[0]);
            setEndDate(ymd);
          } else {
            setEndDate('');
          }
          setCurrentPage(1);
        },
      });
    }
  }, [startDate, endDate]);

  const startInputCallbackRef = useCallback((el: HTMLInputElement | null) => {
    startElRef.current = el;
    if (el) initPickers();
  }, [initPickers]);

  const endInputCallbackRef = useCallback((el: HTMLInputElement | null) => {
    endElRef.current = el;
    if (el) initPickers();
  }, [initPickers]);

  useEffect(() => {
    return () => {
      if (startPickerRef.current) startPickerRef.current.destroy();
      if (endPickerRef.current) endPickerRef.current.destroy();
    };
  }, []);

  const handleDateRangeReset = () => {
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchTableData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      if (activeTab === 'my') {
        const data = await getMyOvertimes({
          start_date: startDate ? `${startDate}T00:00:00` : undefined,
          end_date: endDate ? `${endDate}T23:59:59` : undefined,
          status: filterStatus || undefined,
          page: currentPage,
          page_size: 10,
          search: debouncedSearch || undefined,
          view: 'dashboard',
        });
        setOvertimes(data.items || []);
        setTotalPages(data.pages || 1);
      } else {
        const params: any = {
          page: currentPage,
          page_size: 10,
          view: 'all',
        };
        if (startDate) params.start_date = `${startDate}T00:00:00`;
        if (endDate) params.end_date = `${endDate}T23:59:59`;
        if (filterStatus) params.status = filterStatus;
        if (debouncedSearch) params.search = debouncedSearch;
        if (selectedDeptId) params.department_id = selectedDeptId;

        const data = await getOvertimes(params);
        setOvertimes(data.items || []);
        setTotalPages(data.pages || 1);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [activeTab, startDate, endDate, filterStatus, currentPage, debouncedSearch, selectedDeptId]);

  const fetchUserAndStats = useCallback(async () => {
    try {
      const curUser = authUser || (await refreshUser());
      if (curUser) {
        setUser(curUser);
        const statsData = await getMyStats();
        setStats(statsData);

        if (curUser.role === 'admin') {
          const compData = await getAnalyticsSummary();
          setCompanyStats(compData);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [authUser, refreshUser]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchUserAndStats();
  }, [token, navigate, fetchUserAndStats]);

  useEffect(() => {
    if (user?.role === 'admin') {
      getDepartments()
        .then(data => setDepartments(data || []))
        .catch(err => console.error('Failed to load departments', err));
    }
  }, [user]);

  useEffect(() => {
    fetchTableData();
  }, [fetchTableData]);

  const handleCancel = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите отменить эту заявку?')) return;
    setLoading(true);
    try {
      await cancelOvertime(id);
      await fetchTableData(false);
      await fetchUserAndStats();
    } catch (err) {
      console.error(err);
      alert('Ошибка при отмене заявки');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: number) => {
    if (!window.confirm('Восстановить эту заявку? Она вернется в статус проверки.')) return;
    setLoading(true);
    try {
      await restoreOvertime(id);
      await fetchTableData(false);
      await fetchUserAndStats();
    } catch (err) {
      console.error(err);
      alert('Ошибка при восстановлении заявки');
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (data: Blob, defaultName: string) => {
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', defaultName);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const data = await exportMyAnalytics({
        start_date: startDate ? `${startDate}T00:00:00` : undefined,
        end_date: endDate ? `${endDate}T23:59:59` : undefined,
      });
      downloadFile(data, `my_overtimes_${startDate || 'all'}_${endDate || 'all'}.xlsx`);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert(axiosError.response?.data?.detail || 'Ошибка при экспорте');
    } finally {
      setLoading(false);
    }
  };

  const handleExportMonth = async (monthType: 'current' | 'previous') => {
    try {
      setLoading(true);
      const now = new Date();
      let start: Date;
      let end: Date;

      if (monthType === 'current') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      }

      const sStr = formatToYmd(start) + 'T00:00:00';
      const eStr = formatToYmd(end) + 'T23:59:59';

      const data = await exportMyAnalytics({ start_date: sStr, end_date: eStr });
      downloadFile(data, `my_overtimes_${monthType}_month.xlsx`);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert(axiosError.response?.data?.detail || 'Ошибка при экспорте за месяц');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCompanyAll = async () => {
    try {
      setLoading(true);
      const data = await exportAnalytics({
        start_date: startDate ? `${startDate}T00:00:00` : undefined,
        end_date: endDate ? `${endDate}T23:59:59` : undefined,
      });
      downloadFile(data, `company_overtimes_${startDate || 'all'}_${endDate || 'all'}.xlsx`);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert(axiosError.response?.data?.detail || 'Ошибка при экспорте компании');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCompanyMonth = async (monthType: 'current' | 'previous') => {
    try {
      setLoading(true);
      const now = new Date();
      let start: Date;
      let end: Date;

      if (monthType === 'current') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      }

      const sStr = formatToYmd(start) + 'T00:00:00';
      const eStr = formatToYmd(end) + 'T23:59:59';

      const data = await exportAnalytics({ start_date: sStr, end_date: eStr });
      downloadFile(data, `company_overtimes_${monthType}_month.xlsx`);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert(axiosError.response?.data?.detail || 'Ошибка при экспорте компании за месяц');
    } finally {
      setLoading(false);
    }
  };

  const filteredOvertimes = Array.isArray(overtimes) ? overtimes : [];

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

  const visibleColumns = useMemo(() => columns.filter(c => c.visible), [columns]);
  const totalTableWidth = useMemo(
    () => visibleColumns.reduce((sum, c) => sum + (c.width || DEFAULT_COLUMN_WIDTHS[c.id] || 150), 0),
    [visibleColumns, DEFAULT_COLUMN_WIDTHS]
  );

  const renderActionButtons = (ot: Overtime) => (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
      <button
        onClick={() => setSelectedOvertimeDetail(ot)}
        className="action-button-modern"
        title="Просмотреть детали"
        style={{ color: 'var(--primary)' }}
      >
        <Eye size={16} />
      </button>
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
      {(user?.role === 'admin' ||
        (ot.status !== 'APPROVED' && ot.status !== 'REJECTED' && ot.status !== 'CANCELLED')) && (
        <button
          onClick={() => {
            setEditOvertime(ot);
            setIsCreateModalOpen(true);
          }}
          className="action-button-modern"
          title="Редактировать"
        >
          <Edit2 size={16} />
        </button>
      )}
      {ot.status !== 'CANCELLED' &&
        (user?.role === 'admin' ||
          (ot.status !== 'APPROVED' && ot.status !== 'REJECTED')) && (
          <button
            onClick={() => handleCancel(ot.id)}
            className="action-button-modern delete"
            title="Удалить/Отменить"
            style={{ color: 'var(--error)' }}
          >
            <Trash2 size={16} />
          </button>
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

      <div
        className="dashboard-page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
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
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="primary"
              style={{ padding: '10px 20px', minHeight: '42px', fontWeight: 700 }}
            >
              <Plus size={20} /> НОВАЯ ЗАЯВКА
            </button>
          )}
          <button
            onClick={() => (activeTab === 'my' ? handleExportMonth('previous') : handleExportCompanyMonth('previous'))}
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              fontSize: '0.8rem',
            }}
            className="btn-secondary"
          >
            <FileDown size={16} /> Прошлый месяц
          </button>
          <button
            onClick={() => (activeTab === 'my' ? handleExportMonth('current') : handleExportCompanyMonth('current'))}
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              fontSize: '0.8rem',
            }}
            className="btn-secondary"
          >
            <FileDown size={16} /> Текущий месяц
          </button>
          <button
            onClick={() => (activeTab === 'my' ? handleExport() : handleExportCompanyAll())}
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              fontSize: '0.8rem',
            }}
            className="btn-secondary"
          >
            <FileDown size={16} /> Общий отчет
          </button>
        </div>
      </div>

      {/* Переключатель вкладок (только для админа) */}
      {user?.role === 'admin' && (
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-secondary)',
            padding: '4px',
            borderRadius: '12px',
            width: 'fit-content',
            border: '1px solid var(--border)',
            marginBottom: '32px',
          }}
        >
          <button
            onClick={() => {
              setActiveTab('my');
              setCurrentPage(1);
            }}
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
            onClick={() => {
              setActiveTab('all');
              setCurrentPage(1);
            }}
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

      {/* Stats KPI Overview */}
      <DashboardStatsCards
        activeTab={activeTab}
        stats={stats}
        companyStats={companyStats}
      />

      {/* Charts Section */}
      <DashboardCharts stats={stats} />

      {/* Table Card (Full Width) */}
      <div
        className="glass-card"
        style={{ padding: '0', display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}
      >
        <DashboardTableControls
          activeTab={activeTab}
          user={user}
          departments={departments}
          selectedDeptId={selectedDeptId}
          onSelectDeptId={(id) => {
            setSelectedDeptId(id);
            setCurrentPage(1);
          }}
          filterStatus={filterStatus}
          onFilterStatusChange={(status) => {
            setFilterStatus(status);
            setCurrentPage(1);
          }}
          startDate={startDate}
          endDate={endDate}
          onDateRangeReset={handleDateRangeReset}
          startInputCallbackRef={startInputCallbackRef}
          endInputCallbackRef={endInputCallbackRef}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          mobileView={mobileView}
          onToggleMobileView={() => setMobileView((v) => (v === 'cards' ? 'table' : 'cards'))}
          isColConfigOpen={isColConfigOpen}
          onToggleColConfig={() => setIsColConfigOpen(!isColConfigOpen)}
          columns={columns}
          onToggleColumnVisibility={toggleColumnVisibility}
          onMoveColumn={moveColumn}
          onResetColumnWidths={resetColumnWidths}
        />

        <DashboardOvertimesTable
          mobileView={mobileView}
          activeTab={activeTab}
          overtimes={sortedOvertimes}
          columns={columns}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(k) => handleSort(k as SortKey)}
          draggedColId={draggedColId}
          resizingColId={resizingColId}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onResizeStart={handleResizeStart}
          onResetSingleColumnWidth={resetSingleColumnWidth}
          defaultColumnWidths={DEFAULT_COLUMN_WIDTHS}
          totalTableWidth={totalTableWidth}
          renderActionButtons={renderActionButtons}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      {isCreateModalOpen && (
        <CreateOvertimeModal
          editData={editOvertime}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditOvertime(null);
          }}
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
