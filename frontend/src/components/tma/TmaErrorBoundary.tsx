import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Свойства компонента TmaErrorBoundary.
 */
interface Props {
  /** Дочерние элементы, защищаемые предохранителем ошибок */
  children: ReactNode;
}

/**
 * Состояние компонента TmaErrorBoundary.
 */
interface State {
  /** Флаг наличия перехваченной ошибки */
  hasError: boolean;
  /** Объект ошибки */
  error: Error | null;
}

/**
 * Предохранитель ошибок (Error Boundary) для Telegram Mini App (TMA).
 *
 * Перехватывает ошибки рендеринга и жизненного цикла дочерних компонентов TMA,
 * предотвращая «белый экран смерти» внутри WebApp-контейнера Telegram.
 * Предоставляет пользователю понятный интерфейс с возможностью перезагрузить приложение.
 */
export class TmaErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  /**
   * Обновляет состояние при возникновении ошибки для отображения запасного UI.
   *
   * @param {Error} error - Выброшенная ошибка
   * @returns {State} Новое состояние с флагом ошибки
   */
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Логирует информацию об ошибке в консоль (или внешнюю систему мониторинга).
   *
   * @param {Error} error - Объект ошибки
   * @param {ErrorInfo} errorInfo - Дополнительная информация о стеке компонентов
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[TMA Error Boundary caught an error]:', error, errorInfo);
  }

  /**
   * Выполняет перезагрузку страницы мини-приложения.
   */
  private handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '24px',
            backgroundColor: 'var(--bg-primary, #0f172a)',
            color: 'var(--text-primary, #f8fafc)',
            textAlign: 'center',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              color: 'var(--danger, #ef4444)',
            }}
          >
            <AlertTriangle size={32} />
          </div>

          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              margin: '0 0 8px 0',
              color: 'var(--text-primary, #f8fafc)',
            }}
          >
            Произошла ошибка
          </h2>

          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary, #94a3b8)',
              margin: '0 0 24px 0',
              maxWidth: '320px',
              lineHeight: 1.5,
            }}
          >
            В работе мини-приложения произошел сбой. Попробуйте перезагрузить страницу.
          </p>

          <button
            onClick={this.handleReload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: '#ffffff',
              backgroundColor: 'var(--primary, #3b82f6)',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}
          >
            <RefreshCw size={18} />
            <span>Перезагрузить</span>
          </button>

          {import.meta.env.DEV && this.state.error && (
            <pre
              style={{
                marginTop: '24px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                color: '#f87171',
                fontSize: '0.75rem',
                maxWidth: '100%',
                overflowX: 'auto',
                textAlign: 'left',
              }}
            >
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default TmaErrorBoundary;
