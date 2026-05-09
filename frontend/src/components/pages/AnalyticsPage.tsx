import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
    Download, Calendar, DollarSign, TrendingUp, Briefcase, Clock, FileCheck
} from 'lucide-react';
import Skeleton from '../common/Skeleton';
import {
    api,
    getAnalyticsSummary, getProjectAnalytics,
    getDepartmentAnalytics, exportAnalytics,
    getCompanyFinances
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
                            {p.name}: {(p.value || 0).toFixed(1)}ч
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
    const [projectsList, setProjectsList] = useState<any[]>([]);
    const [finances, setFinances] = useState<any>(null);

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
            const params = getFilterParams();
            const [sum, projData, deptData, allProjects, financeData] = await Promise.all([
                getAnalyticsSummary(params),
                getProjectAnalytics(params),
                getDepartmentAnalytics(params).catch(() => []),
                api.get('/projects/').then(r => r.data).catch(() => []),
                getCompanyFinances().catch(() => null)
            ]);

            setSummary(sum);
            setProjects(projData);
            setDepartments(deptData);
            setFinances(financeData);
            if (!projectsList.length) setProjectsList(allProjects);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

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
            window.URL.revokeObjectURL(url);
        } catch { alert('Ошибка экспорта'); }
        finally { setExporting(false); }
    };

    const pieData = summary ? [
        { name: 'Одобрено', value: summary.approved_requests },
        { name: 'Ожидает', value: summary.pending_requests },
        { name: 'Отклонено', value: summary.rejected_requests },
    ].filter(d => d.value > 0) : [];

    if (loading && !summary) return <div style={{ padding: '40px' }}><Skeleton height={800} /></div>;

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>Аналитика</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Обзор производительности и затрат ресурсов.</p>
                </div>
                <button className="primary" onClick={handleExport} disabled={exporting}>
                    <Download size={18} /> Экспорт (.xlsx)
                </button>
            </div>

            {/* Filters */}
            <div className="glass-card" style={{ padding: '20px 24px', marginBottom: '32px', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={18} color="var(--text-muted)" />
                    <select className="modern-input" style={{ width: '160px', padding: '8px 12px' }} value={period} onChange={e => setPeriod(e.target.value)}>
                        <option value="all">За всё время</option>
                        <option value="week">Последняя неделя</option>
                        <option value="month">Текущий месяц</option>
                        <option value="custom">Указать период</option>
                    </select>
                </div>

                {period === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="date" className="modern-input" style={{ padding: '6px 12px' }} value={customDates.start} onChange={e => setCustomDates({ ...customDates, start: e.target.value })} />
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                        <input type="date" className="modern-input" style={{ padding: '6px 12px' }} value={customDates.end} onChange={e => setCustomDates({ ...customDates, end: e.target.value })} />
                    </div>
                )}

                <div style={{ width: '1px', height: '32px', background: 'var(--border)' }}></div>

                <select className="modern-input" style={{ width: '180px', padding: '8px 12px' }} value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                    <option value="all">Все компании</option>
                    {Object.entries(COMPANY_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                    ))}
                </select>

                <select className="modern-input" style={{ width: '220px', padding: '8px 12px' }} value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                    <option value="all">Все проекты</option>
                    {projectsList.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
                <StatCard title="Всего часов" value={`${(summary?.total_hours || 0).toFixed(1)}ч`} sub="Учтено в системе" icon={Clock} color="#3b82f6" />
                <StatCard title="Одобрено" value={`${(summary?.approved_hours || 0).toFixed(1)}ч`} sub="Подтверждено ГИПами" icon={FileCheck} color="#10b981" />

                {finances && (
                    <>
                        <StatCard
                            title="Оборот проектов"
                            value={`${finances.total_turnover?.toLocaleString()} ₽`}
                            sub="Активные контракты"
                            icon={DollarSign}
                            color="#10b981"
                        />
                        <StatCard
                            title="Чистая прибыль"
                            value={`${finances.total_profit?.toLocaleString()} ₽`}
                            sub="С учетом переработок"
                            icon={TrendingUp}
                            color="#3b82f6"
                        />
                    </>
                )}
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '24px' }}>Статус заявок</h3>
                    <div style={{ height: '400px', minHeight: '400px', display: 'flex' }}>
                        <div style={{ flex: 1.5 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value">
                                        {pieData.map((entry, index) => (
                                            <Cell key={index} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px', paddingLeft: '24px' }}>
                            {pieData.map((d, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: STATUS_COLORS[d.name] || COLORS[i % COLORS.length] }}></div>
                                    <div style={{ fontSize: '0.85rem' }}>
                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.value}</span>
                                        <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>{d.name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Сравнение показателей</h3>
                        <div className="toggle-group">
                            <button className={compareBy === 'projects' ? 'active' : ''} onClick={() => setCompareBy('projects')}>Проекты</button>
                            <button className={compareBy === 'departments' ? 'active' : ''} onClick={() => setCompareBy('departments')}>Отделы</button>
                        </div>
                    </div>
                    <div style={{ height: '400px', minHeight: '400px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={compareBy === 'projects' ? projects.slice(0, 8) : departments}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: 'var(--text-secondary)' }}
                                    interval={0}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar
                                    dataKey="total_hours"
                                    name="Всего"
                                    fill="var(--primary)"
                                    radius={[4, 4, 0, 0]}
                                    onClick={(data) => data.id && navigate(`/projects/${data.id}`)}
                                    style={{ cursor: 'pointer' }}
                                />
                                <Bar
                                    dataKey="approved_hours"
                                    name="Одобрено"
                                    fill="#10b981"
                                    radius={[4, 4, 0, 0]}
                                    onClick={(data) => data.id && navigate(`/projects/${data.id}`)}
                                    style={{ cursor: 'pointer' }}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Project Profitability Table - Moved outside and expanded */}
            <div className="glass-card" style={{ padding: '24px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <Briefcase size={22} color="var(--accent)" />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Рентабельность проектов</h3>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                <th style={{ padding: '16px' }}>Проект</th>
                                <th style={{ padding: '16px' }}>Оборот</th>
                                <th style={{ padding: '16px' }}>Затраты (ОТ)</th>
                                <th style={{ padding: '16px' }}>Чистая прибыль</th>
                                <th style={{ padding: '16px' }}>Маржа</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projectsList.filter(p => (p.turnover > 0 || p.extra_data?.total_overtime_cost > 0)).map(project => {
                                const margin = project.turnover ? (project.net_profit / project.turnover * 100) : 0;
                                return (
                                    <tr key={project.id} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                                        <td style={{ padding: '16px' }}>
                                            <Link to={`/projects/${project.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                <div style={{ fontWeight: 700 }} className="hover-link">{project.name}</div>
                                            </Link>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {project.id}</div>
                                        </td>
                                        <td style={{ padding: '16px' }}>{project.turnover?.toLocaleString()} ₸</td>
                                        <td style={{ padding: '16px', color: 'var(--text-muted)' }}>
                                            {project.extra_data?.total_overtime_cost?.toLocaleString() || 0} ₸
                                        </td>
                                        <td style={{ padding: '16px', fontWeight: 700, color: project.net_profit > 0 ? '#10b981' : '#ef4444' }}>
                                            {project.net_profit?.toLocaleString()} ₸
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ flex: 1, height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden', minWidth: '100px' }}>
                                                    <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, margin))}%`, background: margin > 20 ? '#10b981' : (margin > 0 ? '#f59e0b' : '#ef4444') }}></div>
                                                </div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{margin.toFixed(1)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;
