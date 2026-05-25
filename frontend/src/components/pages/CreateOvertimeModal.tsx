import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Briefcase, FileText, AlertCircle, MapPin } from 'lucide-react';
import { createOvertime, updateOvertime, getProjects } from '../../services/api';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import { Russian } from 'flatpickr/dist/l10n/ru.js';

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

    const startInputRef = useRef<HTMLInputElement>(null);
    const endInputRef = useRef<HTMLInputElement>(null);
    const startFpRef = useRef<any>(null);
    const endFpRef = useRef<any>(null);

    const [projectSearch, setProjectSearch] = useState('');
    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        getProjects().then(data => {
            const list = [...data];
            if (editData && editData.project) {
                const found = list.find(p => p.id === editData.project_id);
                if (!found) {
                    list.push({
                        id: editData.project_id,
                        name: editData.project.name,
                        code: editData.project.code || '',
                        is_active: false
                    });
                }
            }
            setProjects(list);
        }).catch(() => { });

        if (editData) {
            setProjectId(editData.project_id.toString());
            // Форматируем дату для datetime-local (YYYY-MM-DDTHH:mm)
            const fmt = (d: string) => d ? new Date(d).toISOString().slice(0, 16) : '';
            setStartTime(fmt(editData.start_time));
            setEndTime(fmt(editData.end_time));
            setDescription(editData.description);
            setLocationName(editData.location_name || '');
        }
    }, [editData]);

    useEffect(() => {
        if (projectId && projects.length > 0) {
            const selectedProj = projects.find(p => p.id.toString() === projectId);
            if (selectedProj) {
                setProjectSearch(selectedProj.name);
            }
        }
    }, [projectId, projects]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsProjectDropdownOpen(false);
                if (projectId) {
                    const selectedProj = projects.find(p => p.id.toString() === projectId);
                    if (selectedProj) {
                        setProjectSearch(selectedProj.name);
                    }
                } else {
                    setProjectSearch('');
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [projectId, projects]);

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(projectSearch.toLowerCase()))
    ).slice(0, 10);

    const formatToIsoLocal = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const parseToDate = (str: string) => {
        if (!str) return null;
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    };

    useEffect(() => {
        if (startInputRef.current && !startFpRef.current) {
            startFpRef.current = flatpickr(startInputRef.current, {
                enableTime: true,
                time_24hr: true,
                dateFormat: "d/m/Y H:i",
                locale: Russian,
                allowInput: true,
                onChange: (selectedDates) => {
                    if (selectedDates[0]) {
                        setStartTime(formatToIsoLocal(selectedDates[0]));
                    } else {
                        setStartTime('');
                    }
                },
                onClose: (selectedDates) => {
                    if (selectedDates[0]) {
                        setStartTime(formatToIsoLocal(selectedDates[0]));
                    } else {
                        setStartTime('');
                    }
                }
            });
        }
        if (endInputRef.current && !endFpRef.current) {
            endFpRef.current = flatpickr(endInputRef.current, {
                enableTime: true,
                time_24hr: true,
                dateFormat: "d/m/Y H:i",
                locale: Russian,
                allowInput: true,
                onChange: (selectedDates) => {
                    if (selectedDates[0]) {
                        setEndTime(formatToIsoLocal(selectedDates[0]));
                    } else {
                        setEndTime('');
                    }
                },
                onClose: (selectedDates) => {
                    if (selectedDates[0]) {
                        setEndTime(formatToIsoLocal(selectedDates[0]));
                    } else {
                        setEndTime('');
                    }
                }
            });
        }

        return () => {
            if (startFpRef.current) {
                startFpRef.current.destroy();
                startFpRef.current = null;
            }
            if (endFpRef.current) {
                endFpRef.current.destroy();
                endFpRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (startFpRef.current) {
            const currentFpDate = startFpRef.current.selectedDates[0];
            const formattedCurrent = currentFpDate ? formatToIsoLocal(currentFpDate) : '';
            if (formattedCurrent !== startTime) {
                const parsed = parseToDate(startTime);
                if (parsed) {
                    startFpRef.current.setDate(parsed, false);
                } else {
                    startFpRef.current.clear();
                }
            }
        }
    }, [startTime]);

    useEffect(() => {
        if (endFpRef.current) {
            const currentFpDate = endFpRef.current.selectedDates[0];
            const formattedCurrent = currentFpDate ? formatToIsoLocal(currentFpDate) : '';
            if (formattedCurrent !== endTime) {
                const parsed = parseToDate(endTime);
                if (parsed) {
                    endFpRef.current.setDate(parsed, false);
                } else {
                    endFpRef.current.clear();
                }
            }
        }
    }, [endTime]);

    const hasChanges = () => {
        if (editData) {
            const fmt = (d: string) => d ? new Date(d).toISOString().slice(0, 16) : '';
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
                end_time: endTime || null,
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
                .project-dropdown-item:hover {
                    background: var(--bg-tertiary) !important;
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

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }} ref={dropdownRef}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Briefcase size={16} style={{ color: 'var(--accent)' }} /> Проект специализации
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    placeholder="Введите номер или название проекта..."
                                    value={projectSearch}
                                    onChange={e => {
                                        setProjectSearch(e.target.value);
                                        setProjectId('');
                                        setIsProjectDropdownOpen(true);
                                    }}
                                    onFocus={() => setIsProjectDropdownOpen(true)}
                                    required
                                    style={{ paddingRight: '40px' }}
                                />
                                {projectSearch && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProjectSearch('');
                                            setProjectId('');
                                            setIsProjectDropdownOpen(true);
                                        }}
                                        style={{
                                            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', color: 'var(--text-muted)', padding: '4px', cursor: 'pointer',
                                            width: 'auto', height: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {isProjectDropdownOpen && filteredProjects.length > 0 && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0,
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                    borderRadius: '12px', marginTop: '8px', zIndex: 10,
                                    boxShadow: 'var(--card-shadow)', maxHeight: '250px', overflowY: 'auto'
                                }}>
                                    {filteredProjects.map((p: any) => (
                                        <div
                                            key={p.id}
                                            onClick={() => {
                                                setProjectId(p.id.toString());
                                                setProjectSearch(p.name);
                                                setIsProjectDropdownOpen(false);
                                            }}
                                            style={{
                                                padding: '12px 16px', cursor: 'pointer',
                                                background: projectId === p.id.toString() ? 'rgba(59,130,246,0.1)' : 'transparent',
                                                borderBottom: '1px solid var(--border)',
                                                display: 'flex', flexDirection: 'column', gap: '2px'
                                            }}
                                            className="project-dropdown-item"
                                        >
                                            <div style={{
                                                fontWeight: 600,
                                                fontSize: '0.9rem',
                                                color: p.is_active === false ? 'var(--text-muted)' : 'var(--text-primary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}>
                                                {p.name}
                                                {p.is_active === false && (
                                                    <span className="badge badge-secondary" style={{
                                                        fontSize: '0.7rem',
                                                        padding: '2px 6px',
                                                        background: 'var(--bg-tertiary)',
                                                        color: 'var(--text-secondary)',
                                                        borderRadius: '6px',
                                                        border: '1px solid var(--border)'
                                                    }}>
                                                        Архив
                                                    </span>
                                                )}
                                            </div>
                                            {p.code && <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontFamily: 'monospace' }}>{p.code}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Calendar size={16} style={{ color: 'var(--accent)' }} /> Дата и время начала
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        ref={startInputRef}
                                        type="text"
                                        placeholder="Выберите дату и время начала"
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
                                        ref={endInputRef}
                                        type="text"
                                        placeholder="Выберите дату и время окончания"
                                        required={!editData || editData.status !== 'IN_PROGRESS'}
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