import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, AlertCircle, Check, Search, Edit2, ChevronDown, Folder, X } from 'lucide-react';
import {
  getActiveSession, startSession, stopSession,
  getProjects, getMyStats, getMyOvertimes, getLastProject, createOvertime, updateOvertime
} from '../../services/api';
import type { Overtime, Project, UserStats, User } from '../../types';
import { STATUS_LABELS } from '../../constants/locale';

interface TmaTrackerViewProps {
  haptic: {
    notification: (type: 'error' | 'success' | 'warning') => void;
    impact: (style?: 'light' | 'medium' | 'heavy') => void;
    selection: () => void;
  };
  currentUser?: User | null;
}

/**
 * Компонент мобильного трекера переработок для Telegram Mini App.
 *
 * Предоставляет сотрудникам:
 * - Живой цифровой секундомер активной сверхурочной смены;
 * - Быстрый запуск и остановку с автоматической фиксацией геопозиции;
 * - Возможность ручной подачи заявки за прошедшее время;
 * - Сводку личной статистики часов и ленту последних заявок.
 *
 * @param {TmaTrackerViewProps} props - Свойства компонента.
 * @returns {JSX.Element} Экран персонального трекера переработок.
 */
export const TmaTrackerView: React.FC<TmaTrackerViewProps> = ({ haptic, currentUser }) => {
  const [activeSession, setActiveSession] = useState<Overtime | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentOvertimes, setRecentOvertimes] = useState<Overtime[]>([]);
  const [loading, setLoading] = useState(true);

  // Предыдущий проект пользователя (стандартный выбор по умолчанию)
  const [previousProject, setPreviousProject] = useState<Project | null>(null);

  // Состояние редактирования заявки
  const [editingOt, setEditingOt] = useState<Overtime | null>(null);
  const [editProjectId, setEditProjectId] = useState<string>('');
  const [editStartTime, setEditStartTime] = useState<string>('');
  const [editEndTime, setEditEndTime] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string>('');

  // Форма запуска новой сессии
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [projectSearch, setProjectSearch] = useState('');
  const [sessionDesc, setSessionDesc] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);

  // Форма остановки сессии
  const [stopComment, setStopComment] = useState('');
  const [stopError, setStopError] = useState('');
  const [isStopping, setIsStopping] = useState(false);

  // Живой секундомер
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Режим ручного ввода (fallback если забыл запустить таймер)
  const [isManualMode, setIsManualMode] = useState(false);
  const [isManualProjectPickerOpen, setIsManualProjectPickerOpen] = useState(false);
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);
  const [manualError, setManualError] = useState('');

  // Форматирование даты в локальный ISO формат для <input type="datetime-local">
  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Безопасное сохранение ID последнего выбранного проекта
  const saveLastProjectId = (id: number | string) => {
    try {
      localStorage.setItem('overtime_last_project_id', String(id));
    } catch {
      // Игнорируем ошибку квоты или приватного режима webview
    }
  };

  // Загрузка начальных данных
  const loadData = useCallback(async () => {
    try {
      const [active, projs, userStats, myOvt, lastProj] = await Promise.all([
        getActiveSession().catch(() => null),
        getProjects().catch(() => []),
        getMyStats().catch(() => null),
        getMyOvertimes({ page_size: 5, view: 'dashboard' }).catch(() => ({ items: [] })),
        getLastProject().catch(() => null),
      ]);

      setActiveSession(active);
      setProjects(projs);
      setStats(userStats);
      setRecentOvertimes(myOvt.items || []);

      // Определение предыдущего проекта пользователя для стандартного выбора по умолчанию
      const savedProjectId = localStorage.getItem('overtime_last_project_id');
      const resolvedPrev = (lastProj && projs.find((p) => p.id === lastProj.id))
        || (savedProjectId && projs.find((p) => String(p.id) === savedProjectId))
        || (myOvt.items?.[0]?.project_id && projs.find((p) => p.id === myOvt.items[0].project_id))
        || (myOvt.items?.[0]?.project?.id && projs.find((p) => p.id === myOvt.items?.[0]?.project?.id))
        || null;

      if (resolvedPrev) {
        setPreviousProject(resolvedPrev);
        setSelectedProjectId((prev) => (prev ? prev : resolvedPrev.id));
        saveLastProjectId(resolvedPrev.id);
      } else if (projs.length > 0) {
        setSelectedProjectId((prev) => (prev ? prev : projs[0].id));
      }
    } catch (err) {
      console.error('[TMA Tracker] Ошибка загрузки данных:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Управление живым секундомером
  useEffect(() => {
    if (activeSession && activeSession.start_time) {
      const updateTimer = () => {
        const startMs = new Date(activeSession.start_time).getTime();
        const diffSecs = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        setElapsedSeconds(diffSecs);
      };

      updateTimer();
      timerRef.current = window.setInterval(updateTimer, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setElapsedSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [activeSession]);

  const formatElapsedTime = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const getGeoLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  };

  const handleStartSession = async () => {
    if (!selectedProjectId) {
      setStartError('Пожалуйста, выберите проект');
      haptic.notification('warning');
      return;
    }

    setIsStarting(true);
    setStartError('');
    haptic.impact('medium');

    const geo = await getGeoLocation();

    try {
      const created = await startSession({
        project_id: Number(selectedProjectId),
        lat: geo?.lat,
        lng: geo?.lng,
        description: sessionDesc.trim() || undefined,
      });
      haptic.notification('success');
      saveLastProjectId(selectedProjectId);
      setActiveSession(created);
      setSessionDesc('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'Ошибка запуска сессии переработки.';
      setStartError(msg);
      haptic.notification('error');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopSession = async () => {
    const cleanComment = stopComment.trim();
    if (!cleanComment) {
      setStopError('Пожалуйста, подробно опишите проделанную работу. Комментарий обязателен для завершения переработки.');
      haptic.notification('warning');
      return;
    }

    setStopError('');
    setIsStopping(true);
    haptic.impact('heavy');

    const geo = await getGeoLocation();

    try {
      await stopSession({
        lat: geo?.lat,
        lng: geo?.lng,
        comment: cleanComment,
      });
      haptic.notification('success');
      setActiveSession(null);
      setStopComment('');
      setStopError('');
      // Перезагружаем статистику и список
      await loadData();
    } catch (err: unknown) {
      console.error('[TMA Tracker] Ошибка остановки сессии:', err);
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'Ошибка завершения переработки.';
      setStopError(msg);
      haptic.notification('error');
    } finally {
      setIsStopping(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');

    if (!selectedProjectId || !manualStartTime || !manualEndTime) {
      setManualError('Пожалуйста, выберите проект и укажите время');
      haptic.notification('warning');
      return;
    }

    if (!manualDesc.trim()) {
      setManualError('Пожалуйста, подробно опишите выполненные работы. Описание обязательно.');
      haptic.notification('warning');
      return;
    }

    const start = new Date(manualStartTime);
    const end = new Date(manualEndTime);
    const now = new Date();

    // Запрет будущего времени для переработки
    if (start > now) {
      setManualError('Время начала не может быть в будущем. Переработка подается за фактически отработанное время.');
      haptic.notification('warning');
      return;
    }

    if (end > now) {
      setManualError('Время окончания не может быть в будущем. Переработка подается за фактически отработанное время.');
      haptic.notification('warning');
      return;
    }

    if (end <= start) {
      setManualError('Время окончания должно быть позже времени начала.');
      haptic.notification('warning');
      return;
    }

    setManualLoading(true);
    haptic.impact('medium');

    try {
      await createOvertime({
        project_id: Number(selectedProjectId),
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        description: manualDesc.trim(),
      });
      haptic.notification('success');
      saveLastProjectId(selectedProjectId);
      setManualSuccess(true);
      setManualDesc('');
      setManualStartTime('');
      setManualEndTime('');
      setManualError('');
      setTimeout(() => {
        setIsManualMode(false);
        setManualSuccess(false);
      }, 1500);
      await loadData();
    } catch (err: unknown) {
      console.error('[TMA Tracker] Ошибка создания ручной заявки:', err);
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'Ошибка создания заявки на переработку.';
      setManualError(msg);
      haptic.notification('error');
    } finally {
      setManualLoading(false);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.code && p.code.toLowerCase().includes(projectSearch.toLowerCase()))
  );

  /**
   * Отрисовывает кастомный селектор проектов для мобильного интерфейса TMA
   * с живым поиском и мгновенной фиксацией выбора.
   *
   * @param {boolean} isManual Флаг ручного режима подачи заявки.
   * @returns {JSX.Element} Интерактивный компонент выбора проекта.
   */
  const renderProjectSelector = (isManual: boolean) => {
    const isOpen = isManual ? isManualProjectPickerOpen : isProjectPickerOpen;
    const setIsOpen = isManual ? setIsManualProjectPickerOpen : setIsProjectPickerOpen;
    const currentProject = projects.find((p) => p.id === Number(selectedProjectId));

    return (
      <div style={{ position: 'relative' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
          Проект <span style={{ color: '#ef4444' }}>*</span>
        </label>

        {/* Кнопка-карточка выбранного проекта */}
        <div
          onClick={() => {
            haptic.selection();
            setIsOpen(!isOpen);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '11px 14px',
            borderRadius: '12px',
            background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
            border: !selectedProjectId && (startError || manualError)
              ? '1px solid #ef4444'
              : '1px solid var(--border, rgba(255, 255, 255, 0.12))',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--primary, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Folder size={17} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  color: currentProject ? 'var(--tg-theme-text-color, #f8fafc)' : 'var(--tg-theme-hint-color, #94a3b8)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {currentProject ? currentProject.name : 'Выберите проект...'}
                </span>
                {currentProject && previousProject && currentProject.id === previousProject.id && (
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: 'rgba(59, 130, 246, 0.22)',
                    color: '#60a5fa',
                    fontWeight: 600,
                    flexShrink: 0
                  }}>
                    ⏮ Предыдущий
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {currentProject?.code && (
              <span style={{
                fontSize: '0.72rem',
                padding: '2px 6px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--tg-theme-hint-color, #94a3b8)',
                fontFamily: 'monospace'
              }}>
                {currentProject.code}
              </span>
            )}
            <ChevronDown size={18} style={{
              color: 'var(--tg-theme-hint-color, #94a3b8)',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease'
            }} />
          </div>
        </div>

        {/* Выпадающий список проектов с поиском */}
        {isOpen && (
          <div style={{
            marginTop: '8px',
            padding: '10px',
            borderRadius: '14px',
            background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '260px',
            zIndex: 10,
          }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--tg-theme-hint-color, #94a3b8)'
              }} />
              <input
                type="text"
                autoFocus
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Поиск по названию или коду..."
                style={{
                  width: '100%',
                  padding: '8px 28px 8px 30px',
                  borderRadius: '8px',
                  background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--tg-theme-text-color, #f8fafc)',
                  fontSize: '0.84rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {projectSearch && (
                <button
                  type="button"
                  onClick={() => setProjectSearch('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--tg-theme-hint-color, #94a3b8)',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Быстрый выбор предыдущего проекта, если сейчас выбран другой */}
            {previousProject && Number(selectedProjectId) !== previousProject.id && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProjectId(previousProject.id);
                  setIsOpen(false);
                  setProjectSearch('');
                  setStartError('');
                  setManualError('');
                  haptic.selection();
                  saveLastProjectId(previousProject.id);
                }}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  background: 'rgba(59, 130, 246, 0.14)',
                  border: '1px dashed rgba(59, 130, 246, 0.4)',
                  color: '#60a5fa',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  textAlign: 'left'
                }}
              >
                <span>⏮ Предыдущий проект:</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {previousProject.name}
                </span>
              </button>
            )}

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              {filteredProjects.map((p) => {
                const isSelected = p.id === Number(selectedProjectId);
                const isPrev = previousProject && p.id === previousProject.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProjectId(p.id);
                      setIsOpen(false);
                      setProjectSearch('');
                      setStartError('');
                      setManualError('');
                      haptic.selection();
                      saveLastProjectId(p.id);
                    }}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                      border: isSelected ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                      color: 'var(--tg-theme-text-color, #f8fafc)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, paddingRight: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </span>
                        {isPrev && (
                          <span style={{
                            fontSize: '0.68rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: 'rgba(59, 130, 246, 0.25)',
                            color: '#60a5fa',
                            fontWeight: 600,
                            flexShrink: 0
                          }}>
                            ⏮ Предыдущий
                          </span>
                        )}
                      </div>
                      {p.code && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--tg-theme-hint-color, #94a3b8)', fontFamily: 'monospace' }}>
                          {p.code}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check size={16} color="var(--primary, #3b82f6)" />}
                  </div>
                );
              })}
              {filteredProjects.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--tg-theme-hint-color, #94a3b8)', fontSize: '0.82rem' }}>
                  Проекты не найдены
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading && !stats && !activeSession) {
    return (
      <div style={{
        padding: '60px 20px',
        textAlign: 'center',
        color: 'var(--tg-theme-hint-color, #94a3b8)',
        fontSize: '0.92rem',
      }}>
        Загрузка трекера...
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '12px 14px 28px',
      fontFamily: 'Inter, -apple-system, sans-serif',
      color: 'var(--tg-theme-text-color, var(--text-primary, #f8fafc))',
    }}>
      {/* ================= БЛОК АКТИВНОЙ СЕССИИ / СТАРТА ================= */}
      {activeSession ? (
        /* КАРТОЧКА АКТИВНОЙ СЕССИИ (ТАЙМЕР) */
        <div style={{
          background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
          borderRadius: '20px',
          padding: '24px 20px',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          boxShadow: '0 8px 30px rgba(16, 185, 129, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '14px',
        }}>
          {/* Пульсирующий бейдж */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '20px',
            padding: '4px 12px',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#10b981',
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 10px #10b981',
              display: 'inline-block',
            }} />
            Сессия активна
          </div>

          {/* Цифровой секундомер */}
          <div style={{
            fontFamily: 'monospace, -apple-system',
            fontVariantNumeric: 'tabular-nums',
            fontSize: '2.8rem',
            fontWeight: 800,
            letterSpacing: '2px',
            color: 'var(--tg-theme-text-color, #f8fafc)',
            margin: '4px 0',
          }}>
            {formatElapsedTime(elapsedSeconds)}
          </div>

          {/* Детали сессии */}
          <div style={{
            width: '100%',
            background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
            borderRadius: '12px',
            padding: '10px 14px',
            fontSize: '0.86rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            textAlign: 'left',
          }}>
            <div style={{ fontWeight: 600 }}>
              📁 {activeSession.project?.name || 'Проект'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>
              Начало: {new Date(activeSession.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Поле комментария к закрытию */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: stopError ? '#ef4444' : 'var(--tg-theme-text-color, #f8fafc)'
            }}>
              Отчет о выполненных работах <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              rows={3}
              value={stopComment}
              onChange={(e) => {
                setStopComment(e.target.value);
                if (stopError) setStopError('');
              }}
              placeholder="Подробно опишите, какие задачи были выполнены за смену (обязательно для завершения)..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '12px',
                background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                border: stopError ? '1px solid #ef4444' : '1px solid var(--border, rgba(255, 255, 255, 0.12))',
                color: 'var(--tg-theme-text-color, #f8fafc)',
                fontSize: '0.88rem',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
            {stopError && (
              <div style={{
                color: '#ef4444',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 500,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{stopError}</span>
              </div>
            )}
          </div>

          {/* Большая кнопка завершения */}
          <button
            type="button"
            onClick={handleStopSession}
            disabled={isStopping}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              color: '#ffffff',
              fontSize: '1.05rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: isStopping ? 'not-allowed' : 'pointer',
              opacity: isStopping ? 0.7 : 1,
              boxShadow: '0 6px 20px rgba(239, 68, 68, 0.35)',
            }}
          >
            <Square size={20} fill="#ffffff" />
            <span>{isStopping ? 'Завершение...' : 'Завершить переработку'}</span>
          </button>
        </div>
      ) : (
        /* КАРТОЧКА ЗАПУСКА СЕССИИ (ТАЙМЕР НЕ АКТИВЕН) */
        <div style={{
          background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
          borderRadius: '20px',
          padding: '20px 18px',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              {isManualMode ? 'Подача за прошедшее время' : 'Таймер переработки'}
            </h3>
            <button
              type="button"
              onClick={() => {
                haptic.selection();
                setManualError('');
                if (!isManualMode) {
                  // Инициализируем актуальным временем: окончание - сейчас, начало - 2 часа назад
                  const now = new Date();
                  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
                  setManualEndTime(formatDateTimeLocal(now));
                  setManualStartTime(formatDateTimeLocal(twoHoursAgo));
                }
                setIsManualMode(!isManualMode);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--tg-theme-button-color, var(--primary, #3b82f6))',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              {isManualMode ? '⏱ К таймеру' : '✍️ Ввести вручную'}
            </button>
          </div>

          {startError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              borderRadius: '10px',
              padding: '10px 12px',
              color: '#ef4444',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <AlertCircle size={16} />
              <span>{startError}</span>
            </div>
          )}

          {isManualMode ? (
            /* ФОРМА РУЧНОЙ ПОДАЧИ */
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {manualError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: '#ef4444',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{manualError}</span>
                </div>
              )}

              {renderProjectSelector(true)}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    Время начала
                  </label>
                  <input
                    type="datetime-local"
                    required
                    max={formatDateTimeLocal(new Date())}
                    value={manualStartTime}
                    onChange={(e) => {
                      setManualStartTime(e.target.value);
                      setManualError('');
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
                      color: 'var(--tg-theme-text-color, #f8fafc)',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    Время окончания
                  </label>
                  <input
                    type="datetime-local"
                    required
                    max={formatDateTimeLocal(new Date())}
                    value={manualEndTime}
                    onChange={(e) => {
                      setManualEndTime(e.target.value);
                      setManualError('');
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
                      color: 'var(--tg-theme-text-color, #f8fafc)',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  Описание выполненных задач
                </label>
                <textarea
                  rows={2}
                  required
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  placeholder="Что было сделано..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
                    color: 'var(--tg-theme-text-color, #f8fafc)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={manualLoading}
                style={{
                  padding: '13px',
                  borderRadius: '12px',
                  border: 'none',
                  background: manualSuccess ? '#10b981' : 'var(--tg-theme-button-color, var(--primary, #3b82f6))',
                  color: 'var(--tg-theme-button-text-color, #ffffff)',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                {manualSuccess ? (
                  <>
                    <Check size={18} />
                    <span>Заявка отправлена!</span>
                  </>
                ) : (
                  <span>{manualLoading ? 'Отправка...' : 'Отправить на согласование'}</span>
                )}
              </button>
            </form>
          ) : (
            /* ФОРМА БЫСТРОГО СТАРТА ТАЙМЕРА */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {renderProjectSelector(false)}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  Предварительная заметка (опционально)
                </label>
                <input
                  type="text"
                  value={sessionDesc}
                  onChange={(e) => setSessionDesc(e.target.value)}
                  placeholder="Например: Срочный выезд, настройка сервера"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
                    color: 'var(--tg-theme-text-color, #f8fafc)',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--tg-theme-hint-color, #94a3b8)', marginTop: '4px', display: 'block' }}>
                  ℹ️ Подробный отчет о выполненной работе заполняется при завершении переработки
                </span>
              </div>

              {/* Большая зеленая кнопка старта */}
              <button
                type="button"
                onClick={handleStartSession}
                disabled={isStarting}
                style={{
                  marginTop: '4px',
                  padding: '16px',
                  borderRadius: '14px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isStarting ? 'not-allowed' : 'pointer',
                  opacity: isStarting ? 0.7 : 1,
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)',
                }}
              >
                <Play size={20} fill="#ffffff" />
                <span>{isStarting ? 'Запуск...' : 'Начать переработку'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= СВОДКА СТАТИСТИКИ ================= */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
        }}>
          <div style={{
            background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
            borderRadius: '16px',
            padding: '14px',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          }}>
            <div style={{ fontSize: '0.76rem', color: 'var(--tg-theme-hint-color, #94a3b8)', marginBottom: '4px' }}>
              В этом месяце
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#60a5fa' }}>
              {stats.current_month_hours || 0} ч
            </div>
          </div>

          <div style={{
            background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
            borderRadius: '16px',
            padding: '14px',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          }}>
            <div style={{ fontSize: '0.76rem', color: 'var(--tg-theme-hint-color, #94a3b8)', marginBottom: '4px' }}>
              Всего одобрено
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
              {stats.total_approved_hours || 0} ч
            </div>
          </div>
        </div>
      )}

      {/* ================= ПОСЛЕДНИЕ ЗАЯВКИ ================= */}
      {recentOvertimes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0 4px', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>
            Недавние переработки
          </div>
          {recentOvertimes.map((ot) => {
            const getStatusBadgeProps = (status: string) => {
              const text = STATUS_LABELS[status] || status;
              switch (status) {
                case 'APPROVED':
                  return { text, bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
                case 'REJECTED':
                case 'CANCELLED':
                  return { text, bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
                case 'IN_PROGRESS':
                  return { text, bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' };
                case 'MANAGER_APPROVED':
                  return { text: 'Одобрено менеджером', bg: 'rgba(8, 145, 178, 0.15)', color: '#0891b2' };
                case 'HEAD_APPROVED':
                  return { text: 'Одобрено нач. отдела', bg: 'rgba(37, 99, 235, 0.15)', color: '#2563eb' };
                case 'PENDING':
                default:
                  return { text, bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
              }
            };

            const { text: badgeText, bg: badgeBg, color: badgeColor } = getStatusBadgeProps(ot.status);

            const canEdit =
              Boolean(currentUser) &&
              (currentUser?.role === 'admin' ||
                (ot.user_id === currentUser?.id && (ot.status === 'PENDING' || ot.status === 'IN_PROGRESS')));

            const isBeingEdited = editingOt?.id === ot.id;

            return (
              <div
                key={ot.id}
                style={{
                  background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  border: isBeingEdited ? '1px solid #3b82f6' : '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* Верхняя строка карточки */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                      {ot.project?.name || 'Проект'}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>
                      {new Date(ot.start_time).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} • {ot.hours || ot.raw_hours || 0} ч
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      background: badgeBg,
                      color: badgeColor,
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: '8px',
                    }}>
                      {badgeText}
                    </span>

                    {canEdit && !isBeingEdited && (
                      <button
                        type="button"
                        onClick={() => {
                          haptic.selection();
                          setEditingOt(ot);
                          setEditProjectId((ot.project_id || '').toString());
                          setEditStartTime(ot.start_time ? formatDateTimeLocal(new Date(ot.start_time)) : '');
                          setEditEndTime(ot.end_time ? formatDateTimeLocal(new Date(ot.end_time)) : '');
                          setEditDesc(ot.description || '');
                          setUpdateError('');
                        }}
                        style={{
                          background: 'rgba(59, 130, 246, 0.12)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          color: '#60a5fa',
                          padding: '5px 8px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Edit2 size={12} />
                        <span>Изменить</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Описание заявки если есть и не редактируется */}
                {!isBeingEdited && ot.description && (
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'var(--tg-theme-text-color, var(--text-secondary, #cbd5e1))',
                    lineHeight: 1.35,
                  }}>
                    💬 {ot.description}
                  </div>
                )}

                {/* Форма редактирования */}
                {isBeingEdited && (
                  <div style={{
                    marginTop: '4px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#60a5fa' }}>
                      Редактирование заявки #{ot.id}
                    </div>

                    {updateError && (
                      <div style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        fontSize: '0.78rem',
                      }}>
                        {updateError}
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--tg-theme-hint-color, #94a3b8)', marginBottom: '4px' }}>
                        Проект
                      </label>
                      <select
                        value={editProjectId}
                        onChange={(e) => setEditProjectId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                          border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                          color: 'var(--tg-theme-text-color, #f8fafc)',
                          fontSize: '0.82rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      >
                        <option value="">Выберите проект...</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id.toString()}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--tg-theme-hint-color, #94a3b8)', marginBottom: '4px' }}>
                          Начало
                        </label>
                        <input
                          type="datetime-local"
                          value={editStartTime}
                          max={formatDateTimeLocal(new Date())}
                          onChange={(e) => setEditStartTime(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                            border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                            color: 'var(--tg-theme-text-color, #f8fafc)',
                            fontSize: '0.78rem',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--tg-theme-hint-color, #94a3b8)', marginBottom: '4px' }}>
                          Окончание
                        </label>
                        <input
                          type="datetime-local"
                          value={editEndTime}
                          min={editStartTime || undefined}
                          max={formatDateTimeLocal(new Date())}
                          onChange={(e) => setEditEndTime(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                            border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                            color: 'var(--tg-theme-text-color, #f8fafc)',
                            fontSize: '0.78rem',
                            outline: 'none',
                            boxSizing: 'border-box',
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
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Что было сделано..."
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                          border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                          color: 'var(--tg-theme-text-color, #f8fafc)',
                          fontSize: '0.82rem',
                          outline: 'none',
                          resize: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!editProjectId) {
                            setUpdateError('Пожалуйста, выберите проект');
                            haptic.notification('warning');
                            return;
                          }
                          if (!editStartTime) {
                            setUpdateError('Пожалуйста, укажите время начала');
                            haptic.notification('warning');
                            return;
                          }
                          if (!editEndTime) {
                            setUpdateError('Пожалуйста, укажите время окончания');
                            haptic.notification('warning');
                            return;
                          }

                          const startD = new Date(editStartTime);
                          const endD = new Date(editEndTime);
                          const now = new Date();

                          if (startD > now) {
                            setUpdateError('Время начала не может быть в будущем');
                            haptic.notification('warning');
                            return;
                          }
                          if (endD > now) {
                            setUpdateError('Время окончания не может быть в будущем');
                            haptic.notification('warning');
                            return;
                          }
                          if (endD <= startD) {
                            setUpdateError('Время окончания должно быть позже времени начала');
                            haptic.notification('warning');
                            return;
                          }

                          setIsUpdating(true);
                          setUpdateError('');
                          haptic.impact('medium');

                          try {
                            await updateOvertime(ot.id, {
                              project_id: Number(editProjectId),
                              start_time: startD.toISOString(),
                              end_time: endD.toISOString(),
                              description: editDesc.trim() || undefined,
                            });
                            haptic.notification('success');
                            setEditingOt(null);
                            await loadData();
                          } catch (err: unknown) {
                            const msg =
                              (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                              'Не удалось обновить заявку';
                            setUpdateError(msg);
                            haptic.notification('error');
                          } finally {
                            setIsUpdating(false);
                          }
                        }}
                        disabled={isUpdating}
                        style={{
                          flex: 1,
                          padding: '9px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: isUpdating ? 'not-allowed' : 'pointer',
                          opacity: isUpdating ? 0.7 : 1,
                        }}
                      >
                        {isUpdating ? 'Сохранение...' : 'Сохранить изменения'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          haptic.selection();
                          setEditingOt(null);
                          setUpdateError('');
                        }}
                        disabled={isUpdating}
                        style={{
                          padding: '9px 12px',
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TmaTrackerView;
