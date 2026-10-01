import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import { getOvertimes, reviewOvertime, getDepartments, updateOvertime, getProjects } from '../../services/api';
import type { Overtime, Department, User, Project } from '../../types';
import { TmaReviewFilterBar, type DatePreset } from './TmaReviewFilterBar';
import { TmaReviewCard } from './TmaReviewCard';

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
 * - Возможность быстро скорректировать согласованные часы или указать причину отказа.
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

  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [customHours, setCustomHours] = useState<Record<number, string>>({});

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

  const deptMap = useMemo(() => {
    const map = new Map<number, string>();
    departments.forEach((d) => map.set(d.id, d.name));
    return map;
  }, [departments]);

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

  const handleApprove = async (ot: Overtime, approvedHours?: number) => {
    setProcessingId(ot.id);
    haptic.impact('medium');

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

  const handleAdminUpdate = async (ot: Overtime) => {
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
    // eslint-disable-next-line react-hooks/purity
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
    try {
      const updated = await updateOvertime(ot.id, {
        project_id: Number(adminEditProjectId),
        start_time: startD.toISOString(),
        end_time: endD ? endD.toISOString() : undefined,
        description: adminEditDesc.trim() || undefined,
      });

      haptic.notification('success');
      setItems((prev) => prev.map((item) => (item.id === ot.id ? updated : item)));
      setEditingAdminOtId(null);
    } catch (err: unknown) {
      console.error('[TMA Review] Ошибка обновления администратором:', err);
      haptic.notification('error');
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setAdminUpdateError(axiosErr?.response?.data?.detail || 'Не удалось сохранить изменения');
    } finally {
      setIsAdminUpdating(false);
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

  const formatPeriod = (startStr: string, endStr: string | null = null) => {
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px 14px 80px',
        fontFamily: 'Inter, -apple-system, sans-serif',
        color: 'var(--tg-theme-text-color, var(--text-primary, #f8fafc))',
      }}
    >
      {/* Шапка списка с кнопкой обновления */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 2px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Требует решения</h2>
          <span
            style={{
              background: items.length > 0 ? '#ef4444' : 'rgba(255,255,255,0.1)',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '12px',
            }}
          >
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
      <TmaReviewFilterBar
        departments={departments}
        selectedDeptId={selectedDeptId}
        onSelectDeptId={setSelectedDeptId}
        datePreset={datePreset}
        onSelectDatePreset={setDatePreset}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        customStartDate={customStartDate}
        onCustomStartDateChange={setCustomStartDate}
        customEndDate={customEndDate}
        onCustomEndDateChange={setCustomEndDate}
        todayStr={todayStr}
        haptic={haptic}
      />

      {/* Индикатор начальной загрузки */}
      {loading && !refreshing && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>
          <div style={{ fontSize: '0.95rem' }}>Загрузка заявок...</div>
        </div>
      )}

      {/* Пустой список */}
      {!loading && items.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 16px',
            background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
            borderRadius: '16px',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 12px',
              borderRadius: '50%',
              background: hasActiveFilters ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: hasActiveFilters ? '#3b82f6' : '#10b981',
            }}
          >
            <Check size={28} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 6px' }}>
            {hasActiveFilters ? 'Заявки не найдены' : 'Все заявки согласованы!'}
          </h3>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--tg-theme-hint-color, var(--text-muted, #94a3b8))',
              margin: 0,
            }}
          >
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
        const deptName = ot.user?.department_id ? deptMap.get(ot.user.department_id) : undefined;
        const isEditingAdmin = editingAdminOtId === ot.id;

        return (
          <TmaReviewCard
            key={ot.id}
            ot={ot}
            currentUser={currentUser}
            deptName={deptName}
            isProcessing={isProcessing}
            isExpanded={isExpanded}
            onToggleExpand={() => {
              haptic.selection();
              setExpandedId(isExpanded ? null : ot.id);
            }}
            approvedHoursInput={customHours[ot.id] || ''}
            onApprovedHoursInputChange={(val) => setCustomHours((prev) => ({ ...prev, [ot.id]: val }))}
            isRejecting={isRejecting}
            rejectComment={rejectComment}
            onRejectCommentChange={setRejectComment}
            onStartReject={() => {
              haptic.selection();
              setRejectingId(ot.id);
            }}
            onCancelReject={() => {
              haptic.selection();
              setRejectingId(null);
              setRejectComment('');
            }}
            onSubmitReject={() => handleRejectSubmit(ot)}
            onApprove={(hours) => handleApprove(ot, hours)}
            isEditingAdmin={isEditingAdmin}
            onToggleAdminEdit={() => {
              haptic.selection();
              if (isEditingAdmin) {
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
            allProjects={allProjects}
            adminEditProjectId={adminEditProjectId}
            onAdminEditProjectIdChange={setAdminEditProjectId}
            adminEditStartTime={adminEditStartTime}
            onAdminEditStartTimeChange={setAdminEditStartTime}
            adminEditEndTime={adminEditEndTime}
            onAdminEditEndTimeChange={setAdminEditEndTime}
            adminEditDesc={adminEditDesc}
            onAdminEditDescChange={setAdminEditDesc}
            isAdminUpdating={isAdminUpdating}
            adminUpdateError={adminUpdateError}
            onSubmitAdminUpdate={() => handleAdminUpdate(ot)}
            haptic={haptic}
            formatPeriod={formatPeriod}
          />
        );
      })}
    </div>
  );
};

export default TmaReviewView;
