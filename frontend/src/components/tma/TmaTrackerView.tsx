import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, AlertCircle, Check, Search } from 'lucide-react';
import {
  getActiveSession, startSession, stopSession,
  getProjects, getMyStats, getMyOvertimes, createOvertime
} from '../../services/api';
import type { Overtime, Project, UserStats } from '../../types';

interface TmaTrackerViewProps {
  haptic: {
    notification: (type: 'error' | 'success' | 'warning') => void;
    impact: (style?: 'light' | 'medium' | 'heavy') => void;
    selection: () => void;
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
 *
 * @param {TmaTrackerViewProps} props - Свойства компонента.
 * @returns {JSX.Element} Экран персонального трекера переработок.
 */
export const TmaTrackerView: React.FC<TmaTrackerViewProps> = ({ haptic }) => {
  const [activeSession, setActiveSession] = useState<Overtime | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentOvertimes, setRecentOvertimes] = useState<Overtime[]>([]);
  const [loading, setLoading] = useState(true);

  // Форма запуска новой сессии
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [projectSearch, setProjectSearch] = useState('');
  const [sessionDesc, setSessionDesc] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState('');


  // Форма остановки сессии
  const [stopComment, setStopComment] = useState('');
  const [isStopping, setIsStopping] = useState(false);

  // Живой секундомер
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Режим ручного ввода (fallback если забыл запустить таймер)
  const [isManualMode, setIsManualMode] = useState(false);
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

  // Загрузка начальных данных
  const loadData = useCallback(async () => {
    try {
      const [active, projs, userStats, myOvt] = await Promise.all([
        getActiveSession().catch(() => null),
        getProjects().catch(() => []),
        getMyStats().catch(() => null),
        getMyOvertimes({ page_size: 5 }).catch(() => ({ items: [] })),
      ]);

      setActiveSession(active);
      setProjects(projs);
      setStats(userStats);
      setRecentOvertimes(myOvt.items || []);

      if (projs.length > 0) {
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
        description: sessionDesc.trim() || '[Telegram Mini App]',
      });
      haptic.notification('success');
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
    setIsStopping(true);
    haptic.impact('heavy');

    const geo = await getGeoLocation();

    try {
      await stopSession({
        lat: geo?.lat,
        lng: geo?.lng,
        comment: stopComment.trim() || undefined,
      });
      haptic.notification('success');
      setActiveSession(null);
      setStopComment('');
      // Перезагружаем статистику и список
      await loadData();
    } catch (err) {
      console.error('[TMA Tracker] Ошибка остановки сессии:', err);
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
        description: manualDesc.trim() || 'Переработка (ручной ввод в TMA)',
      });
      haptic.notification('success');
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
          <textarea
            rows={2}
            value={stopComment}
            onChange={(e) => setStopComment(e.target.value)}
            placeholder="Что было выполнено за эту смену (комментарий)..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '12px',
              background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
              color: 'var(--tg-theme-text-color, #f8fafc)',
              fontSize: '0.88rem',
              outline: 'none',
              resize: 'none',
              boxSizing: 'border-box',
            }}
          />

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

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  Проект
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                  required
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
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

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
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  Проект
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--tg-theme-hint-color, #94a3b8)',
                    }} />
                    <input
                      type="text"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder="Поиск по названию или коду..."
                      style={{
                        width: '100%',
                        padding: '8px 10px 8px 30px',
                        borderRadius: '10px',
                        background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                        color: 'var(--tg-theme-text-color, #f8fafc)',
                        fontSize: '0.82rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '11px',
                      borderRadius: '12px',
                      background: 'var(--tg-theme-bg-color, var(--bg-tertiary, #1e293b))',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
                      color: 'var(--tg-theme-text-color, #f8fafc)',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  >
                    {filteredProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.code ? `(${p.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  Задача / Примечание (опционально)
                </label>
                <input
                  type="text"
                  value={sessionDesc}
                  onChange={(e) => setSessionDesc(e.target.value)}
                  placeholder="Например: Срочный релиз, настройка сервера"
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
            const isApproved = ot.status === 'APPROVED';
            const isPending = ot.status === 'PENDING' || ot.status.includes('APPROVED');
            const isRejected = ot.status === 'REJECTED';
            const badgeBg = isApproved ? 'rgba(16,185,129,0.15)' : isRejected ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
            const badgeColor = isApproved ? '#10b981' : isRejected ? '#ef4444' : '#f59e0b';
            const badgeText = isApproved ? 'Одобрено' : isRejected ? 'Отклонено' : isPending ? 'Ожидает' : String(ot.status);

            return (
              <div
                key={ot.id}
                style={{
                  background: 'var(--tg-theme-secondary-bg-color, var(--bg-secondary, #0f172a))',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                    {ot.project?.name || 'Проект'}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--tg-theme-hint-color, #94a3b8)' }}>
                    {new Date(ot.start_time).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} • {ot.hours || ot.raw_hours || 0} ч
                  </div>
                </div>

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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TmaTrackerView;
