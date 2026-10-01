import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateProjectModal } from '../CreateProjectModal';
import * as api from '../../../../services/api';

vi.mock('../../../../services/api', () => ({
  createProject: vi.fn(),
}));

describe('CreateProjectModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('не рендерится, когда isOpen=false', () => {
    render(<CreateProjectModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Новый проект')).not.toBeInTheDocument();
  });

  it('отображает форму создания проекта при isOpen=true', () => {
    render(<CreateProjectModal {...defaultProps} />);
    expect(screen.getByText('Новый проект')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('2026-00001')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Разработка модуля аналитики')).toBeInTheDocument();
  });

  it('валидирует обязательность названия проекта', async () => {
    render(<CreateProjectModal {...defaultProps} />);

    const submitBtn = screen.getByRole('button', { name: 'Создать проект' });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Введите название проекта')).toBeInTheDocument();
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it('валидирует формат номера проекта (ГГГГ-ННННН)', async () => {
    render(<CreateProjectModal {...defaultProps} />);

    const codeInput = screen.getByPlaceholderText('2026-00001');
    const nameInput = screen.getByPlaceholderText('Разработка модуля аналитики');
    const submitBtn = screen.getByRole('button', { name: 'Создать проект' });

    fireEvent.change(nameInput, { target: { value: 'Тестовый проект' } });
    fireEvent.change(codeInput, { target: { value: '2026-1' } });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText('Номер должен быть в формате ГГГГ-ННННН, например: 2026-00001')
    ).toBeInTheDocument();
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it('успешно отправляет корректные данные проекта и закрывает модальное окно', async () => {
    vi.mocked(api.createProject).mockResolvedValueOnce({
      id: 1,
      code: '2026-00001',
      name: 'Тестовый проект',
      manager_id: null,
      weekly_limit: 40,
      is_active: true,
    });

    render(<CreateProjectModal {...defaultProps} />);

    const codeInput = screen.getByPlaceholderText('2026-00001');
    const nameInput = screen.getByPlaceholderText('Разработка модуля аналитики');
    const submitBtn = screen.getByRole('button', { name: 'Создать проект' });

    fireEvent.change(codeInput, { target: { value: '2026-00001' } });
    fireEvent.change(nameInput, { target: { value: 'Тестовый проект' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createProject).toHaveBeenCalledWith({
        code: '2026-00001',
        name: 'Тестовый проект',
      });
      expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('отображает ошибку сервера при неудачном создании проекта', async () => {
    vi.mocked(api.createProject).mockRejectedValueOnce({
      response: { data: { detail: 'Проект с таким кодом уже существует' } },
    });

    render(<CreateProjectModal {...defaultProps} />);

    const codeInput = screen.getByPlaceholderText('2026-00001');
    const nameInput = screen.getByPlaceholderText('Разработка модуля аналитики');
    const submitBtn = screen.getByRole('button', { name: 'Создать проект' });

    fireEvent.change(codeInput, { target: { value: '2026-00001' } });
    fireEvent.change(nameInput, { target: { value: 'Существующий проект' } });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText('Проект с таким кодом уже существует')
    ).toBeInTheDocument();
  });
});
