import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
    Clock, FileCheck, Activity,
    Download, PieChart as PieIcon, ClipboardCheck, Calendar
} from 'lucide-react';
import Header from '../layout/Header';
import Skeleton from '../common/Skeleton';
import api, {
    getAnalyticsSummary, getProjectAnalytics,
    getDepartmentAnalytics, exportAnalytics,
    getUserAnalytics, getReviewAnalytics
} from '../../services/api';
import { COMPANY_LABELS } from '../../constants/locale';

const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#0ea5e9', '#6366f1'];
const STATUS_COLORS: Record<string, string> = {
    'Одобрено': '#10b981',
    'Ожидает': '#f59e0b',
    'Отклонено': '#ef4444'
};

const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
    <div className="glass-card" style={{ flex: '1', minWidth: '240px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{title}</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{value}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '4px' }}>{sub}</p>
        </div>
        <div className="icon-shape" style={{ background: 'var(--bg-tertiary)', color: color || 'var(--primary)', width: '56px', height: '56px', borderRadius: '16px' }}>
            <Icon size={28} />
        </div>
    </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="glass-card" style={{ padding: '12px 16px', border: 'none', boxShadow: 'var(--elevation-2)' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>{label}</p>
                {payload.map((p: any, i: number) => (
                    <div key={i}>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: p.color || 'var(--primary)', fontWeight: 600 }}>
                            {p.name}: {p.value.toFixed(1)}ч
                        </p>
                        {p.payload.project_name && (
                            <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Проект: {p.payload.project_name}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const AnalyticsPage: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [summary, setSummary] = useState<any>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [period, setPeriod] = useState<string>('all');
    const [customDates, setCustomDates] = useState({ start: '', end: '' });
    const [compareBy, setCompareBy] = useState<'projects' | 'departments' | 'users'>('projects');
    const [selectedCompany, setSelectedCompany] = useState<string>('all');
    const [selectedProject, setSelectedProject] = useState<string>('all');
    const [userStats, setUserStats] = useState<any[]>([]);
    const [reviewStats, setReviewStats] = useState<any>(null);

    const getFilterParams = () => {
        const params: any = {};
        const now = new Date();

        if (period === 'week') {
            const start = new Date(); start.setDate(now.getDate() - 7);
            params.start_date = start.toISOString();
        } else if (period === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            params.start_date = start.toISOString();
        } else if (period === 'custom') {
            if (customDates.start) params.start_date = new Date(customDates.start).toISOString();
            if (customDates.end) params.end_date = new Date(customDates.end).toISOString();
        }

        if (selectedCompany && selectedCompany !== 'all') params.company = selectedCompany;
        if (selectedProject && selectedProject !== 'all') params.project_id = Number(selectedProject);
        return params;
    };

    const fetchAll = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) { navigate('/login'); return; }

            const me = await api.get('/auth/me');
            setUser(me.data);

            const params = getFilterParams();
            const [sum, projData, deptData, uStats, revStats, allProjects] = await Promise.all([
                getAnalyticsSummary(params),
                getProjectAnalytics(params),
                getDepartmentAnalytics(params).catch(() => []),
                getUserAnalytics(params).catch(() => []),
                getReviewAnalytics(params).catch(() => null),
                api.get('/projects/').then(r => r.data).catch(() => [])
            ]);

            setSummary(sum);
            setProjects(projData);
            setDepartments(deptData);
            setUserStats(uStats);
            setReviewStats(revStats);
            if (!projectsList.length) setProjectsList(allProjects); // Сохраняем список для фильтра
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const [projectsList, setProjectsList] = useState<any[]>([]);

    useEffect(() => {
        if (period !== 'custom' || (customDates.start && customDates.end)) {
            fetchAll();
        }
    }, [period, selectedCompany, selectedProject, customDates.start, customDates.end]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = getFilterParams();
            const blob = await exportAnalytics(params);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = `report_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(url); document.body.removeChild(a);
        } catch { alert('Ошибка экспорта'); }
        finally { setExporting(false); }
    };

    const pieData = summary ? [
        { name: 'Одобрено', value: summary.approved_requests },
        { name: 'Ожидает', value: summary.pending_requests },
        { name: 'Отклонено', value: summary.rejected_requests },
    ].filter(d => d.value > 0) : [];

    if (loading && !summary) return <div className="page-container"><Skeleton height={800} /></div>;

    return (
        <div className="page-container animate-fade-in">
            <Header user={user} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>Аналитическая панель</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Обзор производительности и затрат ресурсов.</p>
                </div>
                <button className="primary" onClick={handleExport} disabled={exporting}>
                    <Download size={18} /> Экспорт (.xlsx)
                </button>
            </div>

            {/* Filters */}
            <div className="glass-card" style={{ padding: '20px 24px', marginBottom: '32px', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Calendar size={20} style={{ color: 'var(--primary)' }} />
                    <select value={period} onChange={e => setPeriod(e.target.value)} style={{ minWidth: '180px' }}>
                        <option value="all">За всё время</option>
                        <option value="week">Последние 7 дней</option>
                        <option value="month">Этот месяц</option>
                        <option value="custom">Выбрать период...</option>
                    </select>
                </div>

                {period === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="date" value={customDates.start} onChange={e => setCustomDates({ ...customDates, start: e.target.value })} />
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                        <input type="date" value={customDates.end} onChange={e => setCustomDates({ ...customDates, end: e.target.value })} />
                        <button className="primary" onClick={fetchAll}>Применить</button>
                    </div>
                )}

                <div style={{ borderLeft: '1px solid var(--border)', height: '24px' }}></div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-secondary)', padding: '6px 16px', borderRadius: '100px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Компания:</span>
                    <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} style={{ width: 'auto', border: 'none', background: 'transparent', padding: '4px 8px' }}>
                        <option value="all">Все</option>
                        {Object.entries(COMPANY_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-secondary)', padding: '6px 16px', borderRadius: '100px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Проект:</span>
                    <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{ width: 'auto', border: 'none', background: 'transparent', padding: '4px 8px' }}>
                        <option value="all">Все проекты</option>
                        {projectsList.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
                <StatCard title="Всего часов" value={`${summary?.total_hours?.toFixed(1) || 0}ч`} sub="Суммарная переработка" icon={Clock} color="var(--primary)" />
                <StatCard title="Заявок" value={summary?.total_requests || 0} sub="Всего создано" icon={FileCheck} color="var(--success)" />
                <StatCard title="Ожидает" value={summary?.pending_requests || 0} sub="Требуют внимания" icon={Activity} color="var(--warning)" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                <div className="glass-card">
                    <h4 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <PieIcon size={20} style={{ color: 'var(--primary)' }} /> Статусы заявок
                    </h4>
                    <div style={{ height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value" stroke="none">
                                    {pieData.map((_entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[_entry.name] || COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div>
                            <h4 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Сравнение</h4>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {selectedProject !== 'all'
                                    ? `Проект: ${projectsList.find(p => String(p.id) === selectedProject)?.name || ''}`
                                    : selectedCompany !== 'all' ? `Компания: ${selectedCompany}` : 'За выбранный период'}
                            </p>
                        </div>
                        <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '12px' }}>
                            {['projects', 'departments', 'users'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setCompareBy(mode as any)}
                                    style={{
                                        padding: '6px 16px', fontSize: '0.75rem', borderRadius: '8px', border: 'none',
                                        background: compareBy === mode ? 'var(--bg-secondary)' : 'transparent',
                                        color: compareBy === mode ? 'var(--primary)' : 'var(--text-secondary)',
                                        boxShadow: compareBy === mode ? 'var(--card-shadow)' : 'none'
                                    }}
                                >
                                    {mode === 'projects' ? 'Проекты' : mode === 'departments' ? 'Отделы' : 'Люди'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={(compareBy === 'projects' ? projects : compareBy === 'departments' ? departments : userStats)
                                    .sort((a, b) => b.total_hours - a.total_hours)
                                    .slice(0, compareBy === 'users' ? 8 : 12)}
                                layout={compareBy === 'users' ? 'horizontal' : 'vertical'}
                                margin={{ left: compareBy === 'users' ? 0 : 120, right: 30, top: 10, bottom: 20 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={compareBy !== 'users'} horizontal={compareBy === 'users'} stroke="var(--border)" opacity={0.4} />
                                <XAxis
                                    type={compareBy === 'users' ? 'category' : 'number'}
                                    dataKey={compareBy === 'users' ? "full_name" : undefined}
                                    axisLine={false} tickLine={false}
                                    tick={{ fontSize: 9, fill: 'var(--text-secondary)' }}
                                    interval={0}
                                    angle={compareBy === 'users' ? -45 : 0}
                                    textAnchor={compareBy === 'users' ? "end" : "middle"}
                                    height={compareBy === 'users' ? 80 : 30}
                                />
                                <YAxis
                                    type={compareBy === 'users' ? 'number' : 'category'}
                                    dataKey={compareBy !== 'users' ? (compareBy === 'projects' ? "project_name" : "department_name") : "total_hours"}
                                    axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                                    width={compareBy === 'users' ? 40 : 120}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-tertiary)', opacity: 0.4 }} />
                                <Bar dataKey="total_hours" fill="var(--primary)" radius={compareBy !== 'users' ? [0, 6, 6, 0] : [6, 6, 0, 0]} barSize={compareBy === 'users' ? 30 : 16} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {reviewStats && (
                <div className="glass-card" style={{ padding: '32px', border: 'none', background: 'var(--primary)', color: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                        <ClipboardCheck size={32} />
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Качество согласования</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
                        {[
                            { l: 'Запрошено', v: reviewStats.total_requested_hours, u: 'ч' },
                            { l: 'Утверждено', v: reviewStats.total_approved_hours, u: 'ч' },
                            { l: 'Точно', v: reviewStats.exact_match_count, u: '' },
                            { l: 'Срезано', v: reviewStats.less_than_requested_count, u: '' },
                            { l: 'Добавлено', v: reviewStats.more_than_requested_count, u: '' },
                        ].map((stat, i) => (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.12)', padding: '20px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px', opacity: 0.9 }}>{stat.l}</p>
                                <p style={{ fontSize: '1.75rem', fontWeight: 900 }}>{stat.v?.toFixed(stat.u ? 1 : 0)}<span style={{ fontSize: '1rem', marginLeft: '4px' }}>{stat.u}</span></p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalyticsPage;
