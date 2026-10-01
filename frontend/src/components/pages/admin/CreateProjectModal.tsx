import React, { useState, useEffect } from 'react';
import { createProject } from '../../../services/api';
import { AxiosError } from 'axios';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const PROJECT_CODE_RE = /^\d{4}-\d{5}$/;

/**
 * Модальное окно создания нового проекта с валидацией формата номера проекта (ГГГГ-ННННН).
 */
export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
}) => {
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setCode('');
            setName('');
            setError('');
            setLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        const trimmedName = name.trim();
        const trimmedCode = code.trim();

        if (!trimmedName) {
            setError('Введите название проекта');
            return;
        }
        if (!PROJECT_CODE_RE.test(trimmedCode)) {
            setError('Номер должен быть в формате ГГГГ-ННННН, например: 2026-00001');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await createProject({ name: trimmedName, code: trimmedCode });
            onSuccess();
            onClose();
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ detail?: string }>;
            setError(axiosError.response?.data?.detail || 'Ошибка при создании проекта');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={onClose}>
            <div
                className="modal-content glass-card animate-scale-in"
                style={{ maxWidth: '440px', width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Новый проект</h3>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.5rem', lineHeight: 1 }}
                    >
                        ×
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Номер проекта <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                        type="text"
                        placeholder="2026-00001"
                        maxLength={10}
                        value={code}
                        onChange={(e) => {
                            setError('');
                            setCode(e.target.value);
                        }}
                        style={{ fontFamily: 'monospace', letterSpacing: '0.1em', fontSize: '1rem' }}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                        Формат: ГГГГ-ННННН (например, 2026-00001). <strong>После создания изменить нельзя.</strong>
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Название проекта <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                        type="text"
                        placeholder="Разработка модуля аналитики"
                        value={name}
                        onChange={(e) => {
                            setError('');
                            setName(e.target.value);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmit();
                        }}
                    />
                </div>

                {error && (
                    <div
                        style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid var(--danger)',
                            color: 'var(--danger)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                        }}
                    >
                        {error}
                    </div>
                )}

                <div className="modal-footer-responsive" style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    <button
                        onClick={handleSubmit}
                        className="primary"
                        disabled={loading}
                        style={{ flex: 1 }}
                    >
                        {loading ? 'Создание...' : 'Создать проект'}
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '12px 20px',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    );
};
