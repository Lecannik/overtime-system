/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Calendar, Clock, MapPin, Tag, FileText, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import type { Project, Overtime } from '../../types';
import { AxiosError } from 'axios';

interface CreateOvertimeModalProps {
    onClose: () => void;
    onCreated: () => void;
    editData?: Overtime | null;
}

const CreateOvertimeModal: React.FC<CreateOvertimeModalProps> = ({ onClose, onCreated, editData }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectId, setProjectId] = useState('');
    const [projectSearch, setProjectSearch] = useState('');
    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
    
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [description, setDescription] = useState('');
    
    const [startLat, setStartLat] = useState<number | null>(null);
    const [startLng, setStartLng] = useState<number | null>(null);
    const [endLat, setEndLat] = useState<number | null>(null);
    const [endLng, setEndLng] = useState<number | null>(null);
    const [locationName, setLocationName] = useState('');
    const [geoLoading, setGeoLoading] = useState(false);
    const [geoError, setGeoError] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const modalRef = useRef<HTMLDivElement>(null);
    const projectDropdownRef = useRef<HTMLDivElement>(null);

    const initProjects = useCallback(async () => {
        try {
            const res = await api.get('/projects/');
            setProjects(res.data);
        } catch (err) {
            console.error('Failed to load projects', err);
        }
    }, []);

    useEffect(() => {
        initProjects();
    }, [initProjects]);

    useEffect(() => {
        const initForm = () => {
            if (editData) {
                setProjectId(editData.project_id ? editData.project_id.toString() : '');
                const fmt = (d: string) => d ? new Date(d).toISOString().slice(0, 16) : '';
                setStartTime(fmt(editData.start_time));
                setEndTime(editData.end_time ? fmt(editData.end_time) : '');
                setDescription(editData.description || '');
                setStartLat(editData.start_lat || null);
                setStartLng(editData.start_lng || null);
                setEndLat(editData.end_lat || null);
                setEndLng(editData.end_lng || null);
                setLocationName(editData.location_name || '');
                
                const selectedProj = projects.find(p => p.id.toString() === (editData.project_id ? editData.project_id.toString() : ''));
                if (selectedProj) {
                    setProjectSearch(selectedProj.name);
                }
            } else {
                setStartTime(new Date().toISOString().slice(0, 16));
            }
        };

        if (projects.length > 0) {
            initForm();
        }
    }, [editData, projects]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
                setIsProjectDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getLocation = (type: 'start' | 'end') => {
        setGeoLoading(true);
        setGeoError('');
        if (!navigator.geolocation) {
            setGeoError('Геолокация не поддерживается вашим браузером');
            setGeoLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (type === 'start') {
                    setStartLat(position.coords.latitude);
                    setStartLng(position.coords.longitude);
                } else {
                    setEndLat(position.coords.latitude);
                    setEndLng(position.coords.longitude);
                }
                setGeoLoading(false);
            },
            (error) => {
                console.error(error);
                setGeoError('Не удалось получить координаты. Разрешите доступ к геоданным.');
                setGeoLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = {
                project_id: projectId ? parseInt(projectId) : null,
                start_time: new Date(startTime).toISOString(),
                end_time: endTime ? new Date(endTime).toISOString() : undefined,
                description,
                start_lat: startLat,
                start_lng: startLng,
                end_lat: endLat,
                end_lng: endLng,
                location_name: locationName
            };

            if (editData) {
                await api.patch(`/overtime/${editData.id}`, data);
            } else {
                await api.post('/overtime/', data);
            }
            onCreated();
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ detail?: string }>;
            setError(axiosError.response?.data?.detail || 'Ошибка при сохранении заявки');
        } finally {
            setLoading(false);
        }
    };

    const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()));

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
            <div className="modal-content glass-card animate-scale-in" 
                ref={modalRef}
                style={{ maxWidth: '560px', padding: 0, overflow: 'hidden', borderRadius: '24px' }} 
                onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div className="icon-shape" style={{ width: '48px', height: '48px', background: 'var(--primary-gradient)' }}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 800, fontSize: '1.25rem' }}>{editData ? 'Редактировать заявку' : 'Новая заявка'}</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Заполнение отчета о переработке</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="action-button-modern" style={{ width: '40px', height: '40px' }}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {error && (
                        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', borderRadius: '12px', fontSize: '0.875rem', display: 'flex', gap: '8px', fontWeight: 600 }}>
                            <AlertCircle size={20} /> {error}
                        </div>
                    )}

                    {/* Проект */}
                    <div className="form-group" style={{ position: 'relative' }} ref={projectDropdownRef}>
                        <label>Проект</label>
                        <div style={{ position: 'relative' }}>
                            <Tag size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                value={projectSearch}
                                onChange={e => {
                                    setProjectSearch(e.target.value);
                                    setIsProjectDropdownOpen(true);
                                    if (e.target.value === '') setProjectId('');
                                }}
                                onFocus={() => setIsProjectDropdownOpen(true)}
                                placeholder="Выберите проект..."
                                style={{ paddingLeft: '44px', cursor: 'text' }}
                            />
                        </div>
                        
                        {isProjectDropdownOpen && (
                            <div className="glass-card scrollbar-hidden" style={{ 
                                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', 
                                maxHeight: '200px', overflowY: 'auto', zIndex: 10, padding: '8px', gap: '4px', display: 'flex', flexDirection: 'column'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProjectId('');
                                        setProjectSearch('Внутренний (Без проекта)');
                                        setIsProjectDropdownOpen(false);
                                    }}
                                    style={{
                                        padding: '10px 16px', textAlign: 'left', background: projectId === '' ? 'var(--bg-secondary)' : 'transparent',
                                        border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-primary)'
                                    }}
                                >
                                    Внутренний (Без проекта)
                                </button>
                                {filteredProjects.map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                            setProjectId(p.id.toString());
                                            setProjectSearch(p.name);
                                            setIsProjectDropdownOpen(false);
                                        }}
                                        style={{
                                            padding: '10px 16px', textAlign: 'left', background: projectId === p.id.toString() ? 'var(--bg-secondary)' : 'transparent',
                                            border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}
                                    >
                                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.code}</span>
                                    </button>
                                ))}
                                {filteredProjects.length === 0 && (
                                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Проекты не найдены</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="form-group">
                            <label>Время начала</label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} required style={{ paddingLeft: '44px' }} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Время окончания (опц.)</label>
                            <div style={{ position: 'relative' }}>
                                <Clock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ paddingLeft: '44px' }} />
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Описание работ</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Что было сделано?"
                            required
                            rows={3}
                            style={{ resize: 'none' }}
                        />
                    </div>

                    {/* Геолокация */}
                    <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <MapPin size={20} style={{ color: 'var(--accent)' }} />
                            <h4 style={{ fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>Геолокация</h4>
                        </div>
                        
                        {geoError && <div style={{ color: 'var(--error)', fontSize: '0.8rem', marginBottom: '12px' }}>{geoError}</div>}
                        
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                            <button type="button" onClick={() => getLocation('start')} className="secondary" disabled={geoLoading} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                {geoLoading ? 'Определение...' : startLat ? 'Точка старта (Обновить)' : 'Точка старта'}
                            </button>
                            <button type="button" onClick={() => getLocation('end')} className="secondary" disabled={geoLoading} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                {geoLoading ? 'Определение...' : endLat ? 'Точка финиша (Обновить)' : 'Точка финиша'}
                            </button>
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <input
                                type="text"
                                placeholder="Или введите адрес вручную (Монтаж, БЦ Асыл Тау)"
                                value={locationName}
                                onChange={e => setLocationName(e.target.value)}
                                style={{ fontSize: '0.85rem' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                        <button type="button" onClick={onClose} className="secondary" style={{ flex: 1, padding: '14px' }}>Отмена</button>
                        <button type="submit" className="primary" disabled={loading} style={{ flex: 1.5, padding: '14px' }}>
                            {loading ? 'СОХРАНЕНИЕ...' : (editData ? 'СОХРАНИТЬ' : 'ОТПРАВИТЬ')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateOvertimeModal;
