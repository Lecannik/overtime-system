import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Play, AlertCircle, Check } from 'lucide-react';
import {
  getActiveSession,
  startSession,
  stopSession,
  getProjects,
  getMyStats,
  getMyOvertimes,
  getLastProject,
  createOvertime,
  updateOvertime,
} from '../../services/api';
import type { Overtime, Project, UserStats, User } from '../../types';
import { TmaActiveSessionCard } from './TmaActiveSessionCard';
import { TmaProjectSelector } from './TmaProjectSelector';
import { TmaRecentOvertimesList } from './TmaRecentOvertimesList';

interface TmaTrackerViewProps {
  haptic: {
    notification: (type: 'error' | 'success' | 'warning') => void;
    impact: (style?: 'light' | 'medium' | 'heavy') => void;
    selection: () => void;
  };
  currentUser?: User | null;
  backButton?: {
    show: (onClick: () => void) => void;
    hide: () => void;
  };
}

/**
 * Компонент мобильного трекера переработок для Telegram Mini App.
 *
 * Предоставляет сотрудникам:
 * - Живой цифровой секундомер активной сверхурочной смены;
 * - Быстрый запуск и остановку с автоматической фиксацией геопозиции;
 * - Возможность ручной подачи заявки за прошедшее время;
 * - Сводку личной статистики часов и ленту последних заявок.
 */
export const TmaTrackerView: React.FC<TmaTrackerViewProps> = ({ haptic, currentUser, backButton }) => {
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

  // Обработка нативной кнопки «Назад» Telegram
  useEffect(() => {
    if (editingOt !== null || isManualMode || isProjectPickerOpen || isManualProjectPickerOpen) {
      backButton?.show(() => {
        if (isProjectPickerOpen) setIsProjectPickerOpen(false);
        else if (isManualProjectPickerOpen) setIsManualProjectPickerOpen(false);
        else if (editingOt !== null) setEditingOt(null);
        else if (isManualMode) setIsManualMode(false);
      });
      return () => {
        backButton?.hide();
      };
    } else {
      backButton?.hide();
    }
  }, [editingOt, isManualMode, isProjectPickerOpen, isManualProjectPickerOpen, backButton]);

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const maxAllowedDateTime = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return formatDateTimeLocal(d);
  }, []);

  const saveLastProjectId = (id: number | '') => {
    if (id) {
      localStorage.setItem('tma_last_project_id', id.toString());
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [session, projectList, myStats, overtimesRes, lastProjRes] = await Promise.allSettled([
        getActiveSession(),
        getProjects(),
        getMyStats(),
        getMyOvertimes({ page_size: 5 }),
        getLastProject().catch(() => null),
      ]);

      if (session.status === 'fulfilled') {
        setActiveSession(session.value);
      }

      let loadedProjects: Project[] = [];
      if (projectList.status === 'fulfilled') {
        loadedProjects = projectList.value;
        setProjects(loadedProjects);
      }

      if (myStats.status === 'fulfilled') {
        setStats(myStats.value);
      }

      if (overtimesRes.status === 'fulfilled') {
        setRecentOvertimes(overtimesRes.value.items || []);
      }

      let detectedPreviousProject: Project | null = null;
      if (lastProjRes.status === 'fulfilled' && lastProjRes.value) {
        detectedPreviousProject = lastProjRes.value;
      } else {
        const savedId = localStorage.getItem('tma_last_project_id');
        if (savedId) {
          detectedPreviousProject = loadedProjects.find((p) => p.id === Number(savedId)) || null;
        }
      }

      if (detectedPreviousProject) {
        setPreviousProject(detectedPreviousProject);
        setSelectedProjectId(detectedPreviousProject.id);
      } else if (loadedProjects.length > 0) {
        setSelectedProjectId(loadedProjects[0].id);
      }
    } catch (err) {
      console.error('[TMA Tracker] Ошибка при первичной загрузке данных:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Секундомер активной сессии
  useEffect(() => {
    if (activeSession) {
      const startMs = new Date(activeSession.start_time).getTime();
      const updateTimer = () => {
        const nowMs = Date.now();
        const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
        setElapsedSeconds(diffSec);
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

  const formatElapsedTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const getGeoLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    if (!navigator.geolocation) return null;
    return new Promise((resolve) => {
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
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Ошибка запуска сессии переработки.';
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
      await loadData();
    } catch (err: unknown) {
      console.error('[TMA Tracker] Ошибка остановки сессии:', err);
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Ошибка завершения переработки.';
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
    const nowWithGrace = new Date(Date.now() + 5 * 60 * 1000);

    if (start > nowWithGrace) {
      setManualError('Время начала не может быть в будущем. Переработка подается за фактически отработанное время.');
      haptic.notification('warning');
      return;
    }

    if (end > nowWithGrace) {
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
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Ошибка создания заявки на переработку.';
      setManualError(msg);
      haptic.notification('error');
    } finally {
      setManualLoading(false);
    }
  };

  const handleUpdateSubmit = async () => {
    if (!editingOt) return;
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

    const startD = new Date(editStartTime);
    const endD = editEndTime ? new Date(editEndTime) : null;
    const nowWithGrace = new Date(Date.now() + 5 * 60 * 1000);

    if (startD > nowWithGrace) {
      setUpdateError('Время начала не может быть в будущем');
      haptic.notification('warning');
      return;
    }
    if (endD && endD > nowWithGrace) {
      setUpdateError('Время окончания не может быть в будущем');
      haptic.notification('warning');
      return;
    }
    if (endD && endD <= startD) {
      setUpdateError('Время окончания должно быть позже времени начала');
      haptic.notification('warning');
      return;
    }

    setIsUpdating(true);
    setUpdateError('');
    try {
      await updateOvertime(editingOt.id, {
        project_id: Number(editProjectId),
        start_time: startD.toISOString(),
        end_time: endD ? endD.toISOString() : undefined,
        description: editDesc.trim() || undefined,
      });

      haptic.notification('success');
      setEditingOt(null);
      await loadData();
    } catch (err: unknown) {
      console.error('[TMA Tracker] Ошибка обновления переработки:', err);
      haptic.notification('error');
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Не удалось сохранить изменения.';
      setUpdateError(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>
        Загрузка трекера...
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px 14px 80px',
        fontFamily: 'Inter, -apple-system, sans-serif',
        color: 'var(--tg-theme-text-color, var(--text-primary, #f8fafc))',
      }}
    >
      {/* Приветствие */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
            Привет, {currentUser?.full_name?.split(' ')[0] || 'Коллега'} 👋
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>
            Учет времени сверхурочной работы
          </p>
        </div>
      </div>

      {/* Основная карточка трекера */}
      {activeSession ? (
        <TmaActiveSessionCard
          activeSession={activeSession}
          elapsedSeconds={elapsedSeconds}
          stopComment={stopComment}
          onStopCommentChange={setStopComment}
          stopError={stopError}
          isStopping={isStopping}
          onStopSession={handleStopSession}
          formatElapsedTime={formatElapsedTime}
        />
      ) : (
        <div
          style={{
            background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
            borderRadius: '20px',
            padding: '20px 18px',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
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
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                borderRadius: '10px',
                padding: '10px 12px',
                color: '#ef4444',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <AlertCircle size={16} />
              <span>{startError}</span>
            </div>
          )}

          {isManualMode ? (
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {manualError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    color: '#ef4444',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{manualError}</span>
                </div>
              )}

              <TmaProjectSelector
                isOpen={isManualProjectPickerOpen}
                onToggleOpen={() => {
                  haptic.selection();
                  setIsManualProjectPickerOpen(!isManualProjectPickerOpen);
                }}
                onClose={() => setIsManualProjectPickerOpen(false)}
                selectedProjectId={selectedProjectId}
                onSelectProject={(id) => {
                  setSelectedProjectId(id);
                  setIsManualProjectPickerOpen(false);
                  setProjectSearch('');
                  setManualError('');
                  saveLastProjectId(id);
                }}
                projects={projects}
                previousProject={previousProject}
                projectSearch={projectSearch}
                onProjectSearchChange={setProjectSearch}
                haptic={haptic}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    Время начала
                  </label>
                  <input
                    type="datetime-local"
                    required
                    max={maxAllowedDateTime}
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
                    max={maxAllowedDateTime}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <TmaProjectSelector
                isOpen={isProjectPickerOpen}
                onToggleOpen={() => {
                  haptic.selection();
                  setIsProjectPickerOpen(!isProjectPickerOpen);
                }}
                onClose={() => setIsProjectPickerOpen(false)}
                selectedProjectId={selectedProjectId}
                onSelectProject={(id) => {
                  setSelectedProjectId(id);
                  setIsProjectPickerOpen(false);
                  setProjectSearch('');
                  setStartError('');
                  saveLastProjectId(id);
                }}
                projects={projects}
                previousProject={previousProject}
                projectSearch={projectSearch}
                onProjectSearchChange={setProjectSearch}
                haptic={haptic}
              />

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
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--tg-theme-hint-color, #94a3b8)',
                    marginTop: '4px',
                    display: 'block',
                  }}
                >
                  ℹ️ Подробный отчет о выполненной работе заполняется при завершении переработки
                </span>
              </div>

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

      {/* Сводка статистики */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div
            style={{
              background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
              borderRadius: '16px',
              padding: '14px',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            }}
          >
            <div style={{ fontSize: '0.76rem', color: 'var(--tg-theme-hint-color, #94a3b8)', marginBottom: '4px' }}>
              В этом месяце
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#60a5fa' }}>
              {stats.current_month_hours || 0} ч
            </div>
          </div>

          <div
            style={{
              background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
              borderRadius: '16px',
              padding: '14px',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            }}
          >
            <div style={{ fontSize: '0.76rem', color: 'var(--tg-theme-hint-color, #94a3b8)', marginBottom: '4px' }}>
              Всего одобрено
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
              {stats.total_approved_hours || 0} ч
            </div>
          </div>
        </div>
      )}

      {/* Последние заявки с возможностью редактирования */}
      <TmaRecentOvertimesList
        recentOvertimes={recentOvertimes}
        editingOt={editingOt}
        onStartEdit={(ot) => {
          setEditingOt(ot);
          setEditProjectId((ot.project_id || '').toString());
          setEditStartTime(ot.start_time ? formatDateTimeLocal(new Date(ot.start_time)) : '');
          setEditEndTime(ot.end_time ? formatDateTimeLocal(new Date(ot.end_time)) : '');
          setEditDesc(ot.description || '');
          setUpdateError('');
        }}
        onCancelEdit={() => setEditingOt(null)}
        editProjectId={editProjectId}
        onEditProjectIdChange={setEditProjectId}
        editStartTime={editStartTime}
        onEditStartTimeChange={setEditStartTime}
        editEndTime={editEndTime}
        onEditEndTimeChange={setEditEndTime}
        editDesc={editDesc}
        onEditDescChange={setEditDesc}
        isUpdating={isUpdating}
        updateError={updateError}
        onSubmitUpdate={handleUpdateSubmit}
        projects={projects}
        maxAllowedDateTime={maxAllowedDateTime}
        haptic={haptic}
      />
    </div>
  );
};

export default TmaTrackerView;
