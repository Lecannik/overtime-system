import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ChevronLeft, Save, Briefcase, TrendingUp, FileText,
    Upload, Download, CheckCircle, AlertCircle, Activity, DollarSign,
    BarChart3
} from 'lucide-react';
import { getProject, updateProject, getCRMStages, getUsers, uploadProjectDoc, uploadProjectSpec, uploadGanttExcel } from '../../services/api';
import Skeleton from '../common/Skeleton';

interface GanttTask {
    title: string;
    start_date: string;
    end_date: string;
    assignee: string;
}

const ProjectEditPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [project, setProject] = useState<any>(null);
    const [stages, setStages] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'general' | 'finance' | 'docs' | 'gantt'>('general');
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
    const [specParsing, setSpecParsing] = useState(false);
    const [specResult, setSpecResult] = useState<any>(null);
    const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
    const [ganttLoading, setGanttLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        manager_id: '',
        gip_id: '',
        stage_id: '',
        status: 'ACTIVE',
        weekly_limit: 50,
        budget: 0,
        gross_profit: 0,
        net_profit: 0,
        turnover: 0,
        labor_cost: 0,
        ntk: 0,
        aup: 0,
    });

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [projData, stagesData, usersData] = await Promise.all([
                getProject(Number(id)),
                getCRMStages('PROJECT'),
                getUsers({ page_size: 1000 })
            ]);
            setProject(projData);
            setStages(stagesData);
            setUsers(usersData.items || usersData || []);

            // Округляем финансовые поля перед установкой в форму
            const round2 = (val: any) => typeof val === 'number' ? Math.round(val * 100) / 100 : val;

            setFormData({
                name: projData.name || '',
                manager_id: projData.manager_id?.toString() || '',
                gip_id: projData.gip_id?.toString() || '',
                stage_id: projData.stage_id?.toString() || '',
                status: projData.status || 'ACTIVE',
                weekly_limit: projData.weekly_limit || 50,
                budget: round2(projData.budget || 0),
                gross_profit: round2(projData.gross_profit || 0),
                net_profit: round2(projData.net_profit || 0),
                turnover: round2(projData.turnover || 0),
                labor_cost: round2(projData.labor_cost || 0),
                ntk: round2(projData.ntk || 0),
                aup: round2(projData.aup || 0),
            });
        } catch (err) {
            console.error('Ошибка загрузки проекта:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateProject(Number(id), {
                ...formData,
                manager_id: formData.manager_id ? Number(formData.manager_id) : null,
                gip_id: formData.gip_id ? Number(formData.gip_id) : null,
                stage_id: formData.stage_id ? Number(formData.stage_id) : null,
                status: formData.status
            });
            await fetchData();
        } catch (err) {
            alert('Ошибка при сохранении проекта');
        } finally {
            setSaving(false);
        }
    };

    const handleDocUpload = async (docType: string, file: File) => {
        setUploadingDoc(docType);
        try {
            await uploadProjectDoc(Number(id), docType, file);
            await fetchData();
        } catch (err) {
            alert('Ошибка при загрузке файла');
        } finally {
            setUploadingDoc(null);
        }
    };

    // Загрузка спецификации с парсингом финансов
    const handleSpecUpload = async (file: File) => {
        setSpecParsing(true);
        setSpecResult(null);
        try {
            const result = await uploadProjectSpec(Number(id), file);
            setSpecResult(result);
            // Обновляем данные проекта — финансы заполнены парсером
            await fetchData();
        } catch (err: any) {
            const msg = err.response?.data?.detail || 'Ошибка при загрузке спецификации';
            alert(msg);
        } finally {
            setSpecParsing(false);
        }
    };

    // Загрузка Ганта из Excel
    const handleGanttUpload = async (file: File) => {
        setGanttLoading(true);
        try {
            const result = await uploadGanttExcel(Number(id), file);
            setGanttTasks(result.tasks || []);
        } catch (err: any) {
            const detail = err.response?.data?.detail || 'Ошибка при загрузке файла Ганта';
            alert(detail);
        } finally {
            setGanttLoading(false);
        }
    };

    if (loading) return <div style={{ padding: '40px' }}><Skeleton height={600} /></div>;
    if (!project) return <div className="text-center py-20">Проект не найден</div>;

    const docTypes = [
        { key: 'spec', label: 'Спецификация (Excel)', field: 'doc_spec_url', icon: '📊', isSpec: true },
        { key: 'tech_spec', label: 'Техническое задание (ТЗ)', field: 'doc_tech_spec_url', icon: '📋', isSpec: false },
        { key: 'schemes', label: 'Схемы подключения', field: 'doc_schemes_url', icon: '🔌', isSpec: false },
        { key: 'client_export', label: 'Выгрузка для клиента', field: 'doc_client_export_url', icon: '📤', isSpec: false },
    ];

    const financeFields = [
        { label: 'Бюджет', key: 'budget', icon: DollarSign, color: '#3b82f6' },
        { label: 'Оборот', key: 'turnover', icon: Activity, color: '#8b5cf6' },
        { label: 'Сумма работ', key: 'labor_cost', icon: Briefcase, color: '#ec4899' },
        { label: 'Валовая прибыль', key: 'gross_profit', icon: TrendingUp, color: '#10b981' },
        { label: 'Чистая прибыль', key: 'net_profit', icon: TrendingUp, color: '#059669' },
        { label: 'НТК', key: 'ntk', icon: Activity, color: '#f59e0b' },
        { label: 'АУП', key: 'aup', icon: Activity, color: '#f43f5e' },
    ];

    const tabs = [
        { id: 'general', label: 'Общее', icon: Briefcase },
        { id: 'finance', label: 'Экономика', icon: TrendingUp },
        { id: 'docs', label: 'Документы', icon: FileText },
        { id: 'gantt', label: 'Диаграмма Ганта', icon: BarChart3 },
    ];

    // ---- Gantt helpers ----
    const ganttMinDate = ganttTasks.length > 0
        ? new Date(Math.min(...ganttTasks.map(t => new Date(t.start_date).getTime())))
        : new Date();
    const ganttMaxDate = ganttTasks.length > 0
        ? new Date(Math.max(...ganttTasks.map(t => new Date(t.end_date).getTime())))
        : new Date();
    const totalDays = Math.max(1, Math.ceil((ganttMaxDate.getTime() - ganttMinDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e', '#84cc16'];

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Link to={`/projects/${id}`} className="icon-button" style={{ background: 'var(--bg-secondary)' }}>
                        <ChevronLeft size={20} />
                    </Link>
                    <div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Редактирование: {project.name}</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
                            ID: #{project.id} • Статус: {project.status}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        style={{
                            padding: '12px 24px', border: 'none',
                            background: activeTab === tab.id ? 'rgba(59,130,246,0.15)' : 'var(--bg-secondary)',
                            color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
                            borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            gap: '8px', fontWeight: activeTab === tab.id ? 700 : 500, fontSize: '0.9rem', transition: 'all 0.2s'
                        }}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSave}>
                {/* General Tab */}
                {activeTab === 'general' && (
                    <div className="glass-card" style={{ padding: '32px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                    Название проекта
                                </label>
                                <input className="modern-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Введите название проекта..." />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Статус</label>
                                <select className="modern-input" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                    <option value="PLANNED">Запланирован</option>
                                    <option value="ACTIVE">Активен</option>
                                    <option value="ON_HOLD">На паузе</option>
                                    <option value="COMPLETED">Завершен</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Стадия</label>
                                <select className="modern-input" value={formData.stage_id} onChange={e => setFormData({ ...formData, stage_id: e.target.value })}>
                                    <option value="">Не выбрана</option>
                                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Менеджер проекта</label>
                                <select className="modern-input" value={formData.manager_id} onChange={e => setFormData({ ...formData, manager_id: e.target.value })}>
                                    <option value="">Не назначен</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>ГИП (Главный инженер)</label>
                                <select className="modern-input" value={formData.gip_id} onChange={e => setFormData({ ...formData, gip_id: e.target.value })}>
                                    <option value="">Не назначен</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Недельный лимит OT (часов)</label>
                                <input type="number" className="modern-input" value={formData.weekly_limit} onChange={e => setFormData({ ...formData, weekly_limit: Number(e.target.value) })} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Finance Tab */}
                {activeTab === 'finance' && (
                    <div className="glass-card" style={{ padding: '32px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                            {financeFields.map(field => (
                                <div key={field.key} style={{
                                    padding: '20px', borderRadius: '16px',
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border)', transition: 'all 0.2s'
                                }}>
                                    <label style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px'
                                    }}>
                                        <field.icon size={14} style={{ color: field.color }} />
                                        {field.label}
                                    </label>
                                    <input
                                        type="number" className="modern-input"
                                        style={{ border: 'none', background: 'transparent', fontSize: '1.5rem', padding: '8px 0', fontWeight: 800, width: '100%' }}
                                        value={field.key === 'aup'
                                            ? Math.round((formData as any)[field.key] * 10000) / 100
                                            : Math.round((formData as any)[field.key] * 100) / 100}
                                        onChange={e => {
                                            const val = Number(e.target.value);
                                            setFormData({
                                                ...formData,
                                                [field.key]: field.key === 'aup' ? val / 100 : val
                                            });
                                        }}
                                    />
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        {field.key === 'aup' ? '%' : '₸ (Тенге)'}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '24px', background: 'rgba(59,130,246,0.05)', padding: '20px', borderRadius: '16px', border: '1px dashed var(--accent)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                <strong>Подсказка:</strong> Финансовые показатели автоматически обновляются при загрузке спецификации Excel на вкладке «Документы».
                            </p>
                        </div>
                    </div>
                )}

                {/* Docs Tab — с загрузкой спец. и обычных файлов */}
                {activeTab === 'docs' && (
                    <div className="glass-card" style={{ padding: '32px' }}>
                        <h3 style={{ fontWeight: 800, marginBottom: '24px', fontSize: '1.1rem' }}>Документы проекта</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {docTypes.map(doc => {
                                const currentUrl = project[doc.field];
                                const isUploading = uploadingDoc === doc.key || (doc.isSpec && specParsing);
                                const fileName = currentUrl ? decodeURIComponent(currentUrl.split('/').pop() || '') : null;

                                return (
                                    <div key={doc.key} style={{
                                        display: 'flex', alignItems: 'center', gap: '16px',
                                        padding: '20px', borderRadius: '16px',
                                        background: 'var(--bg-secondary)', border: '1px solid var(--border)', transition: 'all 0.2s'
                                    }}>
                                        <div style={{ fontSize: '1.5rem', width: '42px', textAlign: 'center' }}>{doc.icon}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{doc.label}</div>
                                            {currentUrl ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                    <CheckCircle size={14} color="#10b981" />
                                                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>{fileName}</span>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                    <AlertCircle size={14} color="var(--text-muted)" />
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Файл не загружен</span>
                                                </div>
                                            )}
                                            {doc.isSpec && specParsing && (
                                                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>⏳ Парсинг финансовых данных...</div>
                                            )}
                                            {doc.isSpec && specResult && (
                                                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                                                    ✅ Данные из файла обновлены! Перейдите на вкладку «Экономика».
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {currentUrl && (
                                                <a href={currentUrl} target="_blank" rel="noreferrer"
                                                    style={{
                                                        padding: '10px 16px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)',
                                                        color: '#10b981', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                        gap: '6px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600
                                                    }}
                                                ><Download size={16} /> Скачать</a>
                                            )}
                                            <label style={{
                                                padding: '10px 16px', borderRadius: '10px',
                                                background: isUploading ? 'var(--bg-tertiary)' : 'rgba(59,130,246,0.1)',
                                                color: isUploading ? 'var(--text-muted)' : 'var(--accent)',
                                                border: 'none', cursor: isUploading ? 'wait' : 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600
                                            }}>
                                                <Upload size={16} />
                                                {isUploading ? 'Загрузка...' : (currentUrl ? 'Заменить' : 'Загрузить')}
                                                <input
                                                    type="file"
                                                    style={{ display: 'none' }}
                                                    disabled={isUploading}
                                                    accept={doc.isSpec ? '.xlsx,.xls' : undefined}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            if (doc.isSpec) {
                                                                handleSpecUpload(file);
                                                            } else {
                                                                handleDocUpload(doc.key, file);
                                                            }
                                                        }
                                                        e.target.value = '';
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Gantt Tab */}
                {activeTab === 'gantt' && (
                    <div className="glass-card" style={{ padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Диаграмма Ганта</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '4px 0 0' }}>
                                    Загрузите Excel с колонками: Задача/Название, Начало, Окончание, Исполнитель (опционально)
                                </p>
                            </div>
                            <label style={{
                                padding: '10px 20px', borderRadius: '12px',
                                background: ganttLoading ? 'var(--bg-tertiary)' : 'rgba(59,130,246,0.1)',
                                color: ganttLoading ? 'var(--text-muted)' : 'var(--accent)',
                                border: 'none', cursor: ganttLoading ? 'wait' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700
                            }}>
                                <Upload size={18} />
                                {ganttLoading ? 'Обработка...' : 'Загрузить Excel для Ганта'}
                                <input
                                    type="file"
                                    style={{ display: 'none' }}
                                    accept=".xlsx,.xls"
                                    disabled={ganttLoading}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleGanttUpload(file);
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                        </div>

                        {ganttTasks.length === 0 ? (
                            <div style={{
                                padding: '60px 40px', textAlign: 'center',
                                background: 'var(--bg-secondary)', borderRadius: '16px',
                                border: '2px dashed var(--border)'
                            }}>
                                <BarChart3 size={48} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.3 }} />
                                <h4 style={{ color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px' }}>Нет данных для диаграммы</h4>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto' }}>
                                    Загрузите Excel-файл с расписанием задач для автоматического построения диаграммы Ганта.
                                </p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                {/* Заголовок (месяцы/дни) */}
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: totalDays * 28 + 300 }}>
                                    {/* Шкала дат */}
                                    <div style={{ display: 'flex', marginLeft: '300px', marginBottom: '8px' }}>
                                        {Array.from({ length: totalDays }).map((_, i) => {
                                            const d = new Date(ganttMinDate.getTime() + i * 86400000);
                                            const showLabel = i === 0 || d.getDate() === 1 || (totalDays <= 60 && d.getDay() === 1);
                                            return (
                                                <div key={i} style={{
                                                    width: '28px', minWidth: '28px', textAlign: 'center',
                                                    fontSize: '0.6rem', color: 'var(--text-muted)',
                                                    borderLeft: d.getDate() === 1 ? '1px solid var(--border)' : 'none'
                                                }}>
                                                    {showLabel ? `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')}` : ''}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Задачи */}
                                    {ganttTasks.map((task, idx) => {
                                        const startOffset = Math.max(0, Math.floor((new Date(task.start_date).getTime() - ganttMinDate.getTime()) / 86400000));
                                        const duration = Math.max(1, Math.ceil((new Date(task.end_date).getTime() - new Date(task.start_date).getTime()) / 86400000));
                                        const color = colors[idx % colors.length];

                                        return (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', minHeight: '36px', marginBottom: '4px' }}>
                                                {/* Название */}
                                                <div style={{
                                                    width: '300px', minWidth: '300px', paddingRight: '12px',
                                                    fontSize: '0.8rem', fontWeight: 600, display: 'flex', flexDirection: 'column'
                                                }}>
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                                                    {task.assignee && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{task.assignee}</span>}
                                                </div>
                                                {/* Бар */}
                                                <div style={{ position: 'relative', flexGrow: 1, height: '28px' }}>
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: `${startOffset * 28}px`,
                                                        width: `${duration * 28}px`,
                                                        height: '24px',
                                                        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                                                        borderRadius: '6px',
                                                        top: '2px',
                                                        boxShadow: `0 2px 8px ${color}44`,
                                                        transition: 'all 0.3s',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        paddingLeft: '8px',
                                                        fontSize: '0.65rem',
                                                        color: 'white',
                                                        fontWeight: 700,
                                                        overflow: 'hidden',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {duration > 2 && `${duration}дн`}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Summary */}
                                <div style={{
                                    marginTop: '24px', padding: '16px', borderRadius: '12px',
                                    background: 'var(--bg-secondary)', display: 'flex', gap: '32px'
                                }}>
                                    <div>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>ЗАДАЧ</span>
                                        <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--accent)' }}>{ganttTasks.length}</div>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>ПЕРИОД</span>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                            {ganttMinDate.toLocaleDateString('ru')} — {ganttMaxDate.toLocaleDateString('ru')}
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>ДЛИТЕЛЬНОСТЬ</span>
                                        <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{totalDays} дн.</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Save Button */}
                <div style={{
                    display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '32px',
                    padding: '24px 0', borderTop: '1px solid var(--border)'
                }}>
                    <Link to={`/projects/${id}`}>
                        <button type="button" className="secondary" style={{ padding: '12px 32px' }}>Отмена</button>
                    </Link>
                    <button
                        type="submit" className="primary" disabled={saving}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 40px', opacity: saving ? 0.7 : 1 }}
                    >
                        <Save size={20} />
                        {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ProjectEditPage;
