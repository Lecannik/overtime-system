import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Briefcase, FileText, AlertCircle } from 'lucide-react';
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
        }
    }, [editData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = {
                project_id: Number(projectId),
                start_time: startTime, // Передаем строку прямо из инпута
                end_time: endTime,     // Передаем строку прямо из инпута
                description
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
        }} onClick={onClose}>
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
                    <button onClick={onClose} style={{
                        background: 'var(--bg-tertiary)', border: 'none', borderRadius: '50%', width: '36px', height: '36px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)'
                    }}>
                        <X size={20} />
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
                                <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} required />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={16} style={{ color: 'var(--accent)' }} /> Дата и время окончания
                                </label>
                                <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} required />
                            </div>
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
                            <button onClick={onClose} type="button" style={{
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