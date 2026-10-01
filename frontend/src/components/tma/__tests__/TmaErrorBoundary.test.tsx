import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TmaErrorBoundary } from '../TmaErrorBoundary';

/**
 * Тестовый компонент, генерирующий исключение при рендеринге.
 */
const ProblemChild: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Тестовая ошибка рендеринга');
  }
  return <div>Нормальный контент TMA</div>;
};

describe('TmaErrorBoundary', () => {
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    // Подавляем вывод console.error в процессе тестирования намеренного выброса ошибки
    originalConsoleError = console.error;
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('рендерит дочерние элементы без ошибок', () => {
    render(
      <TmaErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </TmaErrorBoundary>
    );

    expect(screen.getByText('Нормальный контент TMA')).toBeInTheDocument();
    expect(screen.queryByText('Произошла ошибка')).not.toBeInTheDocument();
  });

  it('перехватывает ошибку рендеринга и отображает интерфейс восстановления', () => {
    render(
      <TmaErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </TmaErrorBoundary>
    );

    expect(screen.getByText('Произошла ошибка')).toBeInTheDocument();
    expect(
      screen.getByText(/В работе мини-приложения произошел сбой/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Перезагрузить/i })).toBeInTheDocument();
  });

  it('вызывает перезагрузку страницы при клике на кнопку «Перезагрузить»', () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadMock },
    });

    render(
      <TmaErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </TmaErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: /Перезагрузить/i });
    fireEvent.click(reloadButton);

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
