/* eslint-disable */
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Clock, CheckCircle, AlertCircle, TrendingUp,
  MapPin, Trash2, Edit2, Search, ChevronLeft, ChevronRight, FileDown,
  Settings, ChevronUp, ChevronDown
} from 'lucide-react';
import { api, getMyOvertimes, getMyStats, cancelOvertime, exportMyAnalytics, getAccessToken } from '../../services/api';
import Header from '../layout/Header';
import CreateOvertimeModal from './CreateOvertimeModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { STATUS_LABELS, formatDate, formatTime } from '../../constants/locale';
import LoadingOverlay from '../atoms/LoadingOverlay';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import { Russian } from 'flatpickr/dist/l10n/ru.js';
import type { User, Overtime, UserStats } from '../../types';
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
  const [isColConfigOpen, setIsColConfigOpen] = useState(false);

  // Сортировка: ключ поля и направление
  type SortKey = 'date' | 'project' | 'hours' | 'status' | null;
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
    const saved = localStorage.getItem('dashboard_columns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { id: 'date', label: 'Дата', visible: true },
      { id: 'project', label: 'Проект', visible: true },
      { id: 'hours', label: 'Часы', visible: true },
      { id: 'status', label: 'Статус', visible: true },
      { id: 'description', label: 'Описание', visible: false },
      { id: 'start_time', label: 'Начало', visible: false },
      { id: 'end_time', label: 'Окончание', visible: false },
      { id: 'actions', label: 'Действия', visible: true }
    ];
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
      setUser(userRes.data);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to fetch user and stats:', err);
    }
  }, [navigate]);

  const fetchTableData = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const token = getAccessToken();
      if (!token) { navigate('/login'); return; }

      const ovRes = await getMyOvertimes({ 
        page: currentPage, 
        page_size: pageSize,
        status: filterStatus || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        view: 'dashboard'
      });
      setOvertimes(ovRes.items || []);
      setTotalPages(ovRes.pages || 1);
    } catch (err) {
      console.error('Failed to fetch table data:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [currentPage, pageSize, filterStatus, startDate, endDate, navigate]);

  // 1. Загружаем общие данные при монтировании
  useEffect(() => {
    const init = async () => {
        await fetchUserAndStats();
    };
    init();
  }, [fetchUserAndStats]);

  // 2. Загрузка таблицы при смене страницы или статуса (с лоадером)
  useEffect(() => {
    const init = async () => {
        await fetchTableData(true);
    };
    init();
  }, [currentPage, filterStatus, fetchTableData]);

  // 3. Загрузка таблицы при смене дат (без лоадера)
  useEffect(() => {
    const update = async () => {
        await fetchTableData(false);
    };
    update();
  }, [startDate, endDate, fetchTableData]);



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

  const filteredOvertimes = (Array.isArray(overtimes) ? overtimes : []).filter(ot =>
    (ot.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ot.project?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  if (loading && !overtimes.length) return <LoadingOverlay />;

  return (
    <div className="page-container animate-fade-in">
      {loading && <LoadingOverlay />}
      {user && <Header user={user} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Дашборд сотрудника</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ваша активность и статус переработок за последнее время.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleExport} style={{
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px'
          }} className="btn-secondary">
            <FileDown size={18} /> ЭКСПОРТ (EXCEL)
          </button>
          <button onClick={() => setIsCreateModalOpen(true)} className="primary">
            <Plus size={20} /> НОВАЯ ЗАЯВКА
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '40px' }}>
        {[
          { label: 'Часов одобрено', value: `${stats?.total_approved_hours || 0}ч`, icon: Clock, color: 'var(--primary)', sub: 'Всего подтверждено' },
          { label: 'Всего заявок', value: stats?.total_requests || 0, icon: TrendingUp, color: 'var(--success)', sub: 'За всё время' },
          { label: 'Активных заявок', value: stats?.active_requests || 0, icon: AlertCircle, color: 'var(--warning)', sub: 'В процессе проверки' },
          { label: 'Проектов', value: stats?.projects_count || '0', icon: CheckCircle, color: 'var(--info)', sub: 'Участие в проектах' },
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
        ))}
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
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>Распределение по проектам</h4>
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <div style={{ flex: 1, height: '100%', position: 'relative', width: '100%', minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={stats?.by_project || []}
                    dataKey="hours"
                    nameKey="project_name"
                    innerRadius={60}
                    outerRadius={80}
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
            <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '20px' }}>
              {(stats?.by_project || []).slice(0, 4).map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '2px', background: [
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

      {/* Widgets Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="glass-card" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', color: 'white', border: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px' }}>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.8, marginBottom: '16px' }}>Текущий месяц</h4>
          <div style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px' }}>{stats?.current_month_hours || 0}ч</div>
          <p style={{ fontSize: '0.85rem', opacity: 0.9 }}>Всего одобренных часов за текущий месяц.</p>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} />
            </div>
            <h4 style={{ fontWeight: 700, margin: 0 }}>Информация</h4>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Не забывайте прикреплять геолокацию к заявкам для более быстрого согласования менеджером.
          </p>
        </div>
      </div>

      {/* Table Card (Full Width) */}
      <div className="glass-card" style={{ padding: '0', display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontWeight: 700 }}>Мои переработки</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flexGrow: 1, justifyContent: 'flex-end' }}>
              {/* Фильтр по статусу */}
              <select
                value={filterStatus}
                onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                style={{ height: '36px', padding: '0 12px', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
              >
                <option value="">Все статусы</option>
                <option value="pending">На согласовании</option>
                <option value="head_approved">Утверждено рук.</option>
                <option value="manager_approved">Утверждено мен.</option>
                <option value="approved">Одобрено</option>
                <option value="rejected">Отклонено</option>
                <option value="cancelled">Отменено</option>
                <option value="in_progress">В процессе</option>
              </select>

              {/* Диапазон дат */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  ref={startInputCallbackRef}
                  type="text"
                  placeholder="дд/мм/гггг"
                  style={{ height: '36px', width: '100px', padding: '0 8px', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', textAlign: 'center' }}
                  title="Начало периода"
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                <input
                  ref={endInputCallbackRef}
                  type="text"
                  placeholder="дд/мм/гггг"
                  style={{ height: '36px', width: '100px', padding: '0 8px', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', textAlign: 'center' }}
                  title="Конец периода"
                />
                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); setCurrentPage(1); }}
                    className="action-button-modern"
                    title="Сбросить даты"
                    style={{ height: '36px', width: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ×
                  </button>
                )}
              </div>

              <div style={{ position: 'relative', width: '220px', maxWidth: '100%', flexGrow: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  placeholder="Найти по описанию..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '36px', height: '36px', fontSize: '0.8rem', background: 'var(--bg-tertiary)', width: '100%' }}
                />
              </div>
              <div style={{ position: 'relative' }}>
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
          <div style={{ overflowX: 'auto', flex: 1, borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
            <table className="table-container" style={{ minWidth: '950px' }}>
              <thead>
                <tr>
                  {columns.filter(c => c.visible).map(col => {
                    const isSortable = ['date', 'project', 'hours', 'status'].includes(col.id);
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
                        width: col.id === 'actions' ? '180px' : undefined,
                        minWidth: col.id === 'actions' ? '180px' : undefined,
                        userSelect: 'none',
                        color: isActive ? 'var(--primary)' : undefined,
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
                          return <td key={col.id} className="table-cell">{formatDate(ot.start_time)}</td>;
                        case 'project':
                          return (
                            <td key={col.id} className="table-cell" style={{ maxWidth: '240px', wordBreak: 'break-word' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ot.project?.name || 'Внутренний'}</div>
                            </td>
                          );
                        case 'hours':
                          return <td key={col.id} className="table-cell">{ot.hours}ч</td>;
                        case 'status':
                          return (
                            <td key={col.id} className="table-cell" style={{ whiteSpace: 'nowrap' }}>
                              <span className={`badge badge-${ot.status === 'APPROVED' ? 'success' : ot.status === 'REJECTED' || ot.status === 'CANCELLED' ? 'danger' : 'warning'}`}>
                                {STATUS_LABELS[ot.status] || ot.status}
                              </span>
                            </td>
                          );
                        case 'description':
                          return <td key={col.id} className="table-cell" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ot.description}>{ot.description || '-'}</td>;
                        case 'start_time':
                          return <td key={col.id} className="table-cell">{formatTime(ot.start_time)}</td>;
                        case 'end_time': {
                          const isEndEpoch = ot.end_time && new Date(ot.end_time).getFullYear() <= 1970;
                          return (
                            <td key={col.id} className="table-cell">
                              {ot.status === 'IN_PROGRESS' || !ot.end_time || isEndEpoch 
                                ? '-' 
                                : formatTime(ot.end_time)}
                            </td>
                          );
                        }
                        case 'actions':
                          return (
                            <td key={col.id} className="table-cell" style={{ textAlign: 'right', whiteSpace: 'nowrap', width: '180px', minWidth: '180px' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
                                    style={{ color: 'var(--accent)' }}
                                  >
                                    <MapPin size={16} />
                                  </a>
                                )}
                              </div>
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
    </div>
  );
};

export default DashboardPage;
