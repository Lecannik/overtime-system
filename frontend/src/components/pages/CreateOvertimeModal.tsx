import React, { useState, useEffect } from 'react';
import { X, Calendar, Briefcase, FileText, AlertCircle, MapPin } from 'lucide-react';
import { createOvertime, updateOvertime, getProjects } from '../../services/api';

interface Props {
    onClose: () => void;
    onCreated: () => void;
    editData?: any;
}

const CreateOvertimeModal: React.FC<Props> = ({ onClose, onCreated, editData }) => {
    const [projects, setProjects] = useState<any[]>([]);
    const [projectId, setProjectId] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [description, setDescription] = useState('');
    const [locationName, setLocationName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getProjects().then(setProjects).catch(() => { });

        if (editData) {
            setProjectId(editData.project_id.toString());
            // Форматируем дату для datetime-local (YYYY-MM-DDTHH:mm)
            const fmt = (d: string) => new Date(d).toISOString().slice(0, 16);
            setStartTime(fmt(editData.start_time));
            setEndTime(fmt(editData.end_time));
            setDescription(editData.description);
            setLocationName(editData.location_name || '');
        }
    }, [editData]);

    const hasChanges = () => {
        if (editData) {
            const fmt = (d: string) => new Date(d).toISOString().slice(0, 16);
            return (
                projectId !== editData.project_id.toString() ||
                startTime !== fmt(editData.start_time) ||
                endTime !== fmt(editData.end_time) ||
                description !== editData.description ||
                locationName !== (editData.location_name || '')
            );
        }
        return projectId !== '' || startTime !== '' || endTime !== '' || description !== '' || locationName !== '';
    };

    const handleCloseWithConfirm = () => {
        if (hasChanges()) {
            if (window.confirm('Вы уверены что хотите отменить изменения?')) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = {
                project_id: Number(projectId),
                start_time: startTime,
                end_time: endTime,
                description,
                location_name: locationName
            };

            if (editData) {
                await updateOvertime(editData.id, data);
            } else {
                await createOvertime(data);
            }

            onCreated();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Ошибка при сохранении заявки');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(2, 6, 23, 0.7)', backdropFilter: 'blur(8px)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px'
        }} onClick={handleCloseWithConfirm}>
            <style>{`
                [data-theme='dark'] input::-webkit-calendar-picker-indicator {
                    filter: invert(1) brightness(2) !important;
                    -webkit-filter: invert(1) brightness(2) !important;
                    opacity: 1 !important;
                    cursor: pointer;
                }
                input[type="datetime-local"] {
                    color-scheme: dark !important;
                }
            `}</style>
            <div className="glass-card animate-fade-in" style={{
                maxWidth: '600px', width: '100%', padding: '0', overflow: 'hidden', border: 'none', background: 'var(--bg-primary)'
            }}
                onClick={e => e.stopPropagation()}>

                {/* Modal Header */}
                <div style={{
                    padding: '24px 32px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{editData ? 'Редактировать заявку' : 'Создать новую заявку'}</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>{editData ? 'Внесите изменения в вашу сверхурочную работу' : 'Заполните данные о вашей сверхурочной работе'}</p>
                    </div>
                    <button
                        onClick={handleCloseWithConfirm}
                        style={{
                            background: 'var(--bg-tertiary)', border: 'none', borderRadius: '50%',
                            width: '32px', height: '32px', padding: '0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'var(--text-primary)', outline: 'none'
                        }}
                    >
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>

                <div style={{ padding: '32px' }}>
                    {error && (
                        <div style={{
                            padding: '16px', borderRadius: '12px', background: 'rgba(185, 28, 28, 0.1)',
                            color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px'
                        }}>
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Briefcase size={16} style={{ color: 'var(--accent)' }} /> Проект специализации
                            </label>
                            <select value={projectId} onChange={e => setProjectId(e.target.value)} required>
                                <option value="">Выберите проект из списка</option>
                                {projects.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Calendar size={16} style={{ color: 'var(--accent)' }} /> Дата и время начала
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="datetime-local"
                                        value={startTime}
                                        onChange={e => setStartTime(e.target.value)}
                                        required
                                        style={{ paddingRight: '44px' }}
                                        className="datetime-input-custom"
                                    />
                                    <Calendar
                                        size={18}
                                        style={{
                                            position: 'absolute',
                                            right: '14px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: 'var(--text-muted)',
                                            pointerEvents: 'none',
                                            opacity: 0.8
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Calendar size={16} style={{ color: 'var(--accent)' }} /> Дата и время окончания
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="datetime-local"
                                        value={endTime}
                                        onChange={e => setEndTime(e.target.value)}
                                        required
                                        style={{ paddingRight: '44px' }}
                                        className="datetime-input-custom"
                                    />
                                    <Calendar
                                        size={18}
                                        style={{
                                            position: 'absolute',
                                            right: '14px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: 'var(--text-muted)',
                                            pointerEvents: 'none',
                                            opacity: 0.8
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <MapPin size={16} style={{ color: 'var(--accent)' }} /> Местоположение (объект)
                            </label>
                            <input
                                value={locationName}
                                onChange={e => setLocationName(e.target.value)}
                                placeholder="Укажите адрес или название объекта..."
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={16} style={{ color: 'var(--accent)' }} /> Обоснование переработки
                            </label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                required
                                rows={4}
                                placeholder="Напишите, какие задачи были выполнены или почему возникла необходимость задержаться..."
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button onClick={handleCloseWithConfirm} type="button" style={{
                                flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--border)',
                                background: 'transparent', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)'
                            }}>
                                Отмена
                            </button>
                            <button type="submit" className="primary" disabled={loading} style={{ flex: 1.5, padding: '14px' }}>
                                {loading ? 'Подождите...' : (editData ? 'Сохранить изменения' : 'Отправить на согласование')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateOvertimeModal;