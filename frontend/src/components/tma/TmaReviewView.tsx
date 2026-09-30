import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2, XCircle, Clock,
  RefreshCw, Check, ChevronDown, ChevronUp, MapPin
} from 'lucide-react';
import { getOvertimes, reviewOvertime } from '../../services/api';
import type { Overtime } from '../../types';

interface TmaReviewViewProps {
  haptic: {
    notification: (type: 'error' | 'success' | 'warning') => void;
    impact: (style?: 'light' | 'medium' | 'heavy') => void;
    selection: () => void;
  };
  onCountChange?: (count: number) => void;
}

/**
 * Компонент мобильной ленты согласования заявок на переработку (Telegram Mini App).
 *
 * Специально спроектирован для руководителей и менеджеров:
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
  onCountChange,
}) => {
  const [items, setItems] = useState<Overtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

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

  const loadOvertimes = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await getOvertimes({
        preset: 'action_required',
        view: 'review',
        page_size: 50,
      });
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
  }, []);

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

  const formatPeriod = (startStr: string, endStr: string | null) => {
    const s = new Date(startStr);
    const datePart = s.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const startTime = s.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (!endStr) return `${datePart}, ${startTime} — ...`;
    const e = new Date(endStr);
    const endTime = e.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${datePart}, ${startTime} — ${endTime}`;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '12px 14px 24px',
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
            background: 'rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981',
          }}>
            <Check size={28} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 6px' }}>
            Все заявки согласованы!
          </h3>
          <p style={{
            fontSize: '0.85rem',
            color: 'var(--tg-theme-hint-color, var(--text-muted, #94a3b8))',
            margin: 0,
          }}>
            Новые заявки от ваших сотрудников появятся здесь автоматически.
          </p>
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
                    Заявка #{ot.id}
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

            {/* Корректировка часов (аккордеон) */}
            <div style={{ borderTop: '1px solid var(--border, rgba(255,255,255,0.06))', paddingTop: '8px' }}>
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
