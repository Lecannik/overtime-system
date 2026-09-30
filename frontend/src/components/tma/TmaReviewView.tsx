import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  CheckCircle2, XCircle, Clock,
  RefreshCw, Check, ChevronDown, ChevronUp, MapPin,
  Building2, X, Edit2
} from 'lucide-react';
import { getOvertimes, reviewOvertime, getDepartments, updateOvertime, getProjects } from '../../services/api';
import type { Overtime, Department, User, Project } from '../../types';

interface TmaReviewViewProps {
  haptic: {
    notification: (type: 'error' | 'success' | 'warning') => void;
    impact: (style?: 'light' | 'medium' | 'heavy') => void;
    selection: () => void;
  };
  currentUser?: User | null;
  onCountChange?: (count: number) => void;
  backButton?: {
    show: (onClick: () => void) => void;
    hide: () => void;
  };
}

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

interface DatePresetOption {
  id: DatePreset;
  label: string;
}

const DATE_PRESETS: DatePresetOption[] = [
  { id: 'all', label: 'Все даты' },
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: '7 дней' },
  { id: 'month', label: 'Этот месяц' },
  { id: 'custom', label: 'Период...' },
];

/**
 * Форматирует дату в формате YYYY-MM-DD для передачи в API.
 */
const formatDateYMD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Компонент мобильной ленты согласования заявок на переработку (Telegram Mini App).
 *
 * Специально спроектирован для руководителей и менеджеров:
 * - Фильтрация по датам (быстрые чипсы "Все", "Сегодня", "7 дней", "Месяц", "Период");
 * - Фильтрация по отделам (выпадающий селект);
 * - Крупные touch-friendly карточки заявок;
 * - Согласование в один тап с тактильным откликом HapticFeedback;
 * - Возможность быстро скорректировать согласованные часы или указать причину отказа;
 * - Автоматическая адаптация под тему Telegram клиента.
 *
 * @param {TmaReviewViewProps} props - Свойства компонента.
 * @returns {JSX.Element} Лента согласования.
 */
export const TmaReviewView: React.FC<TmaReviewViewProps> = ({
  haptic,
  currentUser,
  onCountChange,
  backButton,
}) => {
  const [items, setItems] = useState<Overtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Редактирование заявки администратором
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [editingAdminOtId, setEditingAdminOtId] = useState<number | null>(null);
  const [adminEditProjectId, setAdminEditProjectId] = useState<string>('');
  const [adminEditStartTime, setAdminEditStartTime] = useState<string>('');
  const [adminEditEndTime, setAdminEditEndTime] = useState<string>('');
  const [adminEditDesc, setAdminEditDesc] = useState<string>('');
  const [isAdminUpdating, setIsAdminUpdating] = useState<boolean>(false);
  const [adminUpdateError, setAdminUpdateError] = useState<string>('');

  // Обработка нативной кнопки «Назад» Telegram
  useEffect(() => {
    if (editingAdminOtId !== null) {
      backButton?.show(() => {
        setEditingAdminOtId(null);
      });
      return () => {
        backButton?.hide();
      };
    } else {
      backButton?.hide();
    }
  }, [editingAdminOtId, backButton]);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      getProjects().then(setAllProjects).catch(() => {});
    }
  }, [currentUser]);

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Фильтры
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Сохраняем актуальный коллбэк в ref, чтобы не пересоздавать loadOvertimes
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  // Состояние развернутых деталей для карточки
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // Состояние для отклонения с комментарием
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  // Кастомные часы для одобрения (по id)
  const [customHours, setCustomHours] = useState<Record<number, string>>({});

  // Загружаем список отделов при монтировании
  useEffect(() => {
    let isMounted = true;
    getDepartments()
      .then((depts) => {
        if (isMounted && Array.isArray(depts)) {
          setDepartments(depts);
        }
      })
      .catch((err) => {
        console.warn('[TMA Review] Список отделов не загружен или ограничен правами:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Карта отделов id -> name для быстрого поиска имени отдела в карточке
  const deptMap = useMemo(() => {
    const map = new Map<number, string>();
    departments.forEach((d) => map.set(d.id, d.name));
    return map;
  }, [departments]);

  // Вычисляем диапазон дат по пресету
  const dateRange = useMemo(() => {
    const today = new Date();
    const todayStr = formatDateYMD(today);

    if (datePreset === 'today') {
      return { start_date: todayStr, end_date: todayStr };
    }
    if (datePreset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { start_date: formatDateYMD(d), end_date: todayStr };
    }
    if (datePreset === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start_date: formatDateYMD(d), end_date: todayStr };
    }
    if (datePreset === 'custom') {
      return {
        start_date: customStartDate || undefined,
        end_date: customEndDate || undefined,
      };
    }
    return {};
  }, [datePreset, customStartDate, customEndDate]);

  const maxAllowedDateTime = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return formatDateTimeLocal(d);
  }, []);

  const loadOvertimes = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params: Record<string, unknown> = {
        preset: 'action_required',
        view: 'review',
        page_size: 50,
      };

      if (selectedDeptId) {
        params.department_id = Number(selectedDeptId);
      }
      if (dateRange.start_date) {
        params.start_date = dateRange.start_date;
      }
      if (dateRange.end_date) {
        params.end_date = dateRange.end_date;
      }

      const res = await getOvertimes(params);
      const list = res.items || [];
      setItems(list);
      if (onCountChangeRef.current) {
        onCountChangeRef.current(list.length);
      }
    } catch (err) {
      console.error('[TMA Review] Ошибка при загрузке заявок:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDeptId, dateRange]);

  useEffect(() => {
    loadOvertimes();
  }, [loadOvertimes]);

  const handleApprove = async (ot: Overtime) => {
    setProcessingId(ot.id);
    haptic.impact('medium');

    const editedHoursStr = customHours[ot.id];
    const approvedHours = editedHoursStr ? parseFloat(editedHoursStr) : undefined;

    try {
      await reviewOvertime(ot.id, true, undefined, undefined, approvedHours);
      haptic.notification('success');
      setItems((prev) => {
        const updated = prev.filter((item) => item.id !== ot.id);
        if (onCountChangeRef.current) onCountChangeRef.current(updated.length);
        return updated;
      });
    } catch (err) {
      console.error('[TMA Review] Ошибка при одобрении:', err);
      haptic.notification('error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (ot: Overtime) => {
    if (!rejectComment.trim()) {
      haptic.notification('warning');
      return;
    }

    setProcessingId(ot.id);
    haptic.impact('heavy');

    try {
      await reviewOvertime(ot.id, false, rejectComment.trim());
      haptic.notification('success');
      setRejectingId(null);
      setRejectComment('');
      setItems((prev) => {
        const updated = prev.filter((item) => item.id !== ot.id);
        if (onCountChangeRef.current) onCountChangeRef.current(updated.length);
        return updated;
      });
    } catch (err) {
      console.error('[TMA Review] Ошибка при отклонении:', err);
      haptic.notification('error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleResetFilters = () => {
    haptic.selection();
    setSelectedDeptId('');
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  const hasActiveFilters = Boolean(selectedDeptId || datePreset !== 'all' || customStartDate || customEndDate);

  const formatPeriod = (startStr: string, endStr: string | null) => {
    const s = new Date(startStr);
    const datePart = s.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const startTime = s.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (!endStr) return `${datePart}, ${startTime} — ...`;
    const e = new Date(endStr);
    const endTime = e.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${datePart}, ${startTime} — ${endTime}`;
  };

  const todayStr = formatDateYMD(new Date());

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '12px 14px 80px',
      fontFamily: 'Inter, -apple-system, sans-serif',
      color: 'var(--tg-theme-text-color, var(--text-primary, #f8fafc))',
    }}>
      {/* Шапка списка с кнопкой обновления */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 2px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
            Требует решения
          </h2>
          <span style={{
            background: items.length > 0 ? '#ef4444' : 'rgba(255,255,255,0.1)',
            color: '#ffffff',
            fontSize: '0.78rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '12px',
          }}>
            {items.length}
          </span>
        </div>

        <button
          onClick={() => {
            haptic.selection();
            loadOvertimes(true);
          }}
          disabled={loading || refreshing}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--tg-theme-button-color, var(--primary, #3b82f6))',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            padding: '6px 10px',
            borderRadius: '8px',
          }}
        >
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
          <span>Обновить</span>
        </button>
      </div>

      {/* Панель фильтров: Отдел и Период дат */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
        borderRadius: '14px',
        padding: '10px 12px',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
      }}>
        {/* Строка с выбором отдела и кнопкой сброса */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flex: 1,
            background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
            borderRadius: '10px',
            padding: '6px 10px',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
            minWidth: 0,
          }}>
            <Building2 size={15} style={{ color: 'var(--tg-theme-hint-color, #94a3b8)', flexShrink: 0 }} />
            <select
              value={selectedDeptId}
              onChange={(e) => {
                haptic.selection();
                setSelectedDeptId(e.target.value);
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--tg-theme-text-color, #f8fafc)',
                fontSize: '0.82rem',
                outline: 'none',
                cursor: 'pointer',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <option value="" style={{ background: '#1e293b', color: '#f8fafc' }}>
                Все отделы {departments.length > 0 ? `(${departments.length})` : ''}
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id} style={{ background: '#1e293b', color: '#f8fafc' }}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '6px 10px',
                borderRadius: '10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <X size={13} />
              <span>Сбросить</span>
            </button>
          )}
        </div>

        {/* Горизонтальный скролл чипсов дат */}
        <div style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '2px',
        }}>
          {DATE_PRESETS.map((preset) => {
            const isActive = datePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  haptic.selection();
                  setDatePreset(preset.id);
                }}
                style={{
                  background: isActive
                    ? 'var(--tg-theme-button-color, var(--primary, #3b82f6))'
                    : 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                  color: isActive
                    ? 'var(--tg-theme-button-text-color, #ffffff)'
                    : 'var(--tg-theme-hint-color, #94a3b8)',
                  border: isActive
                    ? 'none'
                    : '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                  padding: '5px 11px',
                  borderRadius: '16px',
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Пользовательский диапазон дат (если выбран "Период...") */}
        {datePreset === 'custom' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            paddingTop: '6px',
            borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.72rem',
                color: 'var(--tg-theme-hint-color, #94a3b8)',
                marginBottom: '3px',
              }}>
                С даты
              </label>
              <input
                type="date"
                value={customStartDate}
                max={todayStr}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                  color: 'var(--tg-theme-text-color, #f8fafc)',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.72rem',
                color: 'var(--tg-theme-hint-color, #94a3b8)',
                marginBottom: '3px',
              }}>
                По дату
              </label>
              <input
                type="date"
                value={customEndDate}
                min={customStartDate || undefined}
                max={todayStr}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                  color: 'var(--tg-theme-text-color, #f8fafc)',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Индикатор начальной загрузки */}
      {loading && !refreshing && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>
          <div style={{ fontSize: '0.95rem' }}>Загрузка заявок...</div>
        </div>
      )}

      {/* Пустой список */}
      {!loading && items.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '48px 16px',
          background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
          borderRadius: '16px',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 12px',
            borderRadius: '50%',
            background: hasActiveFilters ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: hasActiveFilters ? '#3b82f6' : '#10b981',
          }}>
            <Check size={28} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 6px' }}>
            {hasActiveFilters ? 'Заявки не найдены' : 'Все заявки согласованы!'}
          </h3>
          <p style={{
            fontSize: '0.85rem',
            color: 'var(--tg-theme-hint-color, var(--text-muted, #94a3b8))',
            margin: 0,
          }}>
            {hasActiveFilters
              ? 'По выбранным фильтрам (отдел / дата) нет заявок, требующих решения.'
              : 'Новые заявки от ваших сотрудников появятся здесь автоматически.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                marginTop: '16px',
                background: 'var(--tg-theme-button-color, #3b82f6)',
                color: 'var(--tg-theme-button-text-color, #ffffff)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      )}

      {/* Список карточек */}
      {items.map((ot) => {
        const isProcessing = processingId === ot.id;
        const isExpanded = expandedId === ot.id;
        const isRejecting = rejectingId === ot.id;
        const empName = ot.user?.full_name || ot.user?.email || 'Сотрудник';
        const projName = ot.project?.name || 'Внутренний проект';
        const hoursDisplay = ot.hours || ot.raw_hours || 0;
        const deptName = ot.user?.department_id ? deptMap.get(ot.user.department_id) : undefined;

        return (
          <div
            key={ot.id}
            style={{
              background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
              borderRadius: '16px',
              padding: '16px',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              opacity: isProcessing ? 0.5 : 1,
              pointerEvents: isProcessing ? 'none' : 'auto',
              transition: 'all 0.2s',
            }}
          >
            {/* Верхняя строка карточки: Сотрудник и Часы */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  flexShrink: 0,
                }}>
                  {empName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>
                    {empName}
                  </div>
                  <div style={{
                    fontSize: '0.78rem',
                    color: 'var(--tg-theme-hint-color, var(--text-muted, #94a3b8))',
                  }}>
                    Заявка #{ot.id} {deptName ? `• ${deptName}` : ''}
                  </div>
                </div>
              </div>

              {/* Бейдж часов */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                padding: '4px 10px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.92rem',
                whiteSpace: 'nowrap',
              }}>
                {hoursDisplay} ч
              </div>
            </div>

            {/* Проект и период */}
            <div style={{
              background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--tg-theme-text-color, #f8fafc)' }}>
                📁 {projName}
              </div>
              <div style={{
                fontSize: '0.8rem',
                color: 'var(--tg-theme-hint-color, var(--text-muted, #94a3b8))',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}>
                <Clock size={13} />
                <span>{formatPeriod(ot.start_time, ot.end_time)}</span>
              </div>
            </div>

            {/* Комментарий сотрудника */}
            {ot.description && (
              <div style={{
                fontSize: '0.86rem',
                lineHeight: 1.4,
                color: 'var(--tg-theme-text-color, var(--text-secondary, #cbd5e1))',
              }}>
                💬 {ot.description}
              </div>
            )}

            {/* Местоположение (если есть) */}
            {ot.location_name && (
              <div style={{
                fontSize: '0.78rem',
                color: 'var(--tg-theme-hint-color, #94a3b8)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <MapPin size={13} />
                <span>{ot.location_name}</span>
              </div>
            )}

            {/* Корректировка часов (аккордеон) и Редактирование (для админа) */}
            <div style={{ borderTop: '1px solid var(--border, rgba(255,255,255,0.06))', paddingTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setExpandedId(isExpanded ? null : ot.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--tg-theme-hint-color, var(--text-muted, #94a3b8))',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{isExpanded ? 'Скрыть параметры согласования' : 'Скорректировать часы...'}</span>
                </button>

                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      haptic.selection();
                      if (editingAdminOtId === ot.id) {
                        setEditingAdminOtId(null);
                      } else {
                        setEditingAdminOtId(ot.id);
                        setAdminEditProjectId((ot.project_id || '').toString());
                        setAdminEditStartTime(ot.start_time ? formatDateTimeLocal(new Date(ot.start_time)) : '');
                        setAdminEditEndTime(ot.end_time ? formatDateTimeLocal(new Date(ot.end_time)) : '');
                        setAdminEditDesc(ot.description || '');
                        setAdminUpdateError('');
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#60a5fa',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: 600,
                    }}
                  >
                    <Edit2 size={13} />
                    <span>{editingAdminOtId === ot.id ? 'Скрыть правку' : 'Править заявку'}</span>
                  </button>
                )}
              </div>

              {/* Форма полного редактирования заявки админом */}
              {editingAdminOtId === ot.id && (
                <div style={{
                  marginTop: '10px',
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa' }}>
                    Редактирование заявки администратором (ID #{ot.id})
                  </div>

                  {adminUpdateError && (
                    <div style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      fontSize: '0.76rem',
                    }}>
                      {adminUpdateError}
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--tg-theme-hint-color, #94a3b8)', marginBottom: '4px' }}>
                      Проект
                    </label>
                    <select
                      value={adminEditProjectId}
                      onChange={(e) => setAdminEditProjectId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                        color: 'var(--tg-theme-text-color, #f8fafc)',
                        fontSize: '0.82rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="" style={{ background: '#1e293b', color: '#f8fafc' }}>Выберите проект...</option>
                      {allProjects.map((p) => (
                        <option key={p.id} value={p.id.toString()} style={{ background: '#1e293b', color: '#f8fafc' }}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--tg-theme-hint-color, #94a3b8)', marginBottom: '4px' }}>
                        Начало
                      </label>
                      <input
                        type="datetime-local"
                        value={adminEditStartTime}
                        max={maxAllowedDateTime}
                        onChange={(e) => setAdminEditStartTime(e.target.value)}
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          boxSizing: 'border-box',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
                          border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                          color: 'var(--tg-theme-text-color, #f8fafc)',
                          fontSize: '0.82rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--tg-theme-hint-color, #94a3b8)', marginBottom: '4px' }}>
                        Окончание
                      </label>
                      <input
                        type="datetime-local"
                        value={adminEditEndTime}
                        min={adminEditStartTime || undefined}
                        max={maxAllowedDateTime}
                        onChange={(e) => setAdminEditEndTime(e.target.value)}
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          boxSizing: 'border-box',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
                          border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                          color: 'var(--tg-theme-text-color, #f8fafc)',
                          fontSize: '0.82rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--tg-theme-hint-color, #94a3b8)', marginBottom: '4px' }}>
                      Описание работ
                    </label>
                    <textarea
                      rows={2}
                      value={adminEditDesc}
                      onChange={(e) => setAdminEditDesc(e.target.value)}
                      placeholder="Описание проделанных работ..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                        color: 'var(--tg-theme-text-color, #f8fafc)',
                        fontSize: '0.82rem',
                        outline: 'none',
                        resize: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      disabled={isAdminUpdating}
                      onClick={async () => {
                        if (!adminEditProjectId) {
                          setAdminUpdateError('Пожалуйста, выберите проект');
                          haptic.notification('warning');
                          return;
                        }
                        if (!adminEditStartTime) {
                          setAdminUpdateError('Пожалуйста, укажите время начала');
                          haptic.notification('warning');
                          return;
                        }

                        const startD = new Date(adminEditStartTime);
                        const endD = adminEditEndTime ? new Date(adminEditEndTime) : null;
                        const nowWithGrace = new Date(Date.now() + 5 * 60 * 1000);

                        if (startD > nowWithGrace) {
                          setAdminUpdateError('Время начала не может быть в будущем');
                          haptic.notification('warning');
                          return;
                        }
                        if (endD && endD > nowWithGrace) {
                          setAdminUpdateError('Время окончания не может быть в будущем');
                          haptic.notification('warning');
                          return;
                        }
                        if (endD && endD <= startD) {
                          setAdminUpdateError('Время окончания должно быть позже времени начала');
                          haptic.notification('warning');
                          return;
                        }

                        setIsAdminUpdating(true);
                        setAdminUpdateError('');
                        haptic.impact('medium');

                        try {
                          const updated = await updateOvertime(ot.id, {
                            project_id: Number(adminEditProjectId),
                            start_time: startD.toISOString(),
                            end_time: endD ? endD.toISOString() : undefined,
                            description: adminEditDesc.trim() || undefined,
                          });
                          haptic.notification('success');
                          setEditingAdminOtId(null);
                          const chosenProj = allProjects.find((p) => p.id === Number(adminEditProjectId));
                          setItems((prev) => prev.map((item) => (item.id === ot.id ? {
                            ...item,
                            ...updated,
                            project: updated.project || (chosenProj ? { id: chosenProj.id, name: chosenProj.name, code: chosenProj.code } : item.project),
                          } : item)));
                        } catch (err: unknown) {
                          const msg =
                            (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                            'Не удалось обновить заявку';
                          setAdminUpdateError(msg);
                          haptic.notification('error');
                        } finally {
                          setIsAdminUpdating(false);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: isAdminUpdating ? 'not-allowed' : 'pointer',
                        opacity: isAdminUpdating ? 0.7 : 1,
                      }}
                    >
                      {isAdminUpdating ? 'Сохранение...' : 'Сохранить правки'}
                    </button>
                    <button
                      type="button"
                      disabled={isAdminUpdating}
                      onClick={() => {
                        haptic.selection();
                        setEditingAdminOtId(null);
                        setAdminUpdateError('');
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'var(--tg-theme-text-color, #f8fafc)',
                        border: 'none',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}

              {isExpanded && (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>
                    Согласовать:
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={customHours[ot.id] || ''}
                    placeholder={`${hoursDisplay} (по умолч.)`}
                    onChange={(e) => setCustomHours({ ...customHours, [ot.id]: e.target.value })}
                    style={{
                      width: '130px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                      color: 'var(--tg-theme-text-color, #f8fafc)',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>ч</span>
                </div>
              )}
            </div>

            {/* Блок отказа (ввод причины) */}
            {isRejecting ? (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                borderRadius: '10px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <textarea
                  rows={2}
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Укажите причину отклонения (обязательно)..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--tg-theme-text-color, #f8fafc)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleRejectSubmit(ot)}
                    disabled={isProcessing}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      background: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    Подтвердить отказ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptic.selection();
                      setRejectingId(null);
                      setRejectComment('');
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'var(--tg-theme-text-color, #f8fafc)',
                      border: 'none',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              /* Кнопки действий Одобрить / Отклонить */
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => handleApprove(ot)}
                  disabled={isProcessing}
                  style={{
                    flex: 1,
                    padding: '11px 14px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <CheckCircle2 size={18} />
                  <span>Одобрить</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setRejectingId(ot.id);
                  }}
                  disabled={isProcessing}
                  style={{
                    padding: '11px 16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <XCircle size={18} />
                  <span>Отклонить</span>
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TmaReviewView;
