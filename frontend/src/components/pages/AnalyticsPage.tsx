import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
    Clock, FileCheck, Users, Activity,
    ArrowUpRight, ArrowDownRight, Search, Download, ChevronDown
} from 'lucide-react';
import Header from '../layout/Header';
import Skeleton from '../common/Skeleton';
import api, { getAnalyticsSummary, getProjectAnalytics, getDepartmentAnalytics, exportAnalytics, getUserAnalytics, getReviewAnalytics } from '../../services/api';

const COLORS = ['#1e40afff', '#15803d', '#b91c1c', '#3b82f6', '#10b981', '#ef4444'];
const STATUS_COLORS: Record<string, string> = {
    'Approved': '#15803d',
    'Pending': '#b45309',
    'Rejected': '#b91c1c'
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'var(--bg-secondary)',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--border)',
                padding: '12px 16px',
                borderRadius: '12px',
                boxShadow: 'var(--card-shadow)',
                color: 'var(--text-primary)'
            }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem' }}>{label}</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>
                    {payload[0].name}: {payload[0].value.toFixed(1)}
                </p>
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
    const [searchQuery, setSearchQuery] = useState('');

    // Filtering states
    const [period, setPeriod] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [compareBy, setCompareBy] = useState<'projects' | 'departments' | 'users' | 'companies'>('projects');
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [selectedCompany, setSelectedCompany] = useState<string>('all');
    const [userStats, setUserStats] = useState<any[]>([]);
    const [reviewStats, setReviewStats] = useState<any>(null);
    const [companyStats, setCompanyStats] = useState<any[]>([]);

    const getFilterParams = () => {
        const params: any = {};
        const now = new Date();

        if (period === 'week') {
            const start = new Date();
            start.setDate(now.getDate() - 7);
            params.start_date = start.toISOString();
        } else if (period === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            params.start_date = start.toISOString();
        } else if (period === 'prev_month') {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            params.start_date = start.toISOString();
            params.end_date = end.toISOString();
        } else if (period === 'custom' && startDate) {
            params.start_date = new Date(startDate).toISOString();
            if (endDate) params.end_date = new Date(endDate).toISOString();
        }

        if (selectedCompany !== 'all') {
            params.company = selectedCompany;
        }

        return params;
    };

    const fetchAll = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const me = await api.get('/auth/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(me.data);

            if (me.data.must_change_password) {
                navigate('/profile');
                return;
            }

            const params = getFilterParams();
            const userParams = { ...params };
            if (selectedProjectId) {
                userParams.project_id = selectedProjectId;
            }

            const [sum, proj, dept, uStats, revStats, cStats] = await Promise.all([
                getAnalyticsSummary(params),
                getProjectAnalytics(params),
                getDepartmentAnalytics(params).catch(() => []),
                getUserAnalytics(userParams).catch(() => []),
                getReviewAnalytics(params).catch(() => null),
                me.data.role === 'admin' ? api.get('/analytics/companies', { params }).then(res => res.data).catch(() => []) : Promise.resolve([])
            ]);

            setSummary(sum);
            setProjects(proj);
            setDepartments(dept);
            setUserStats(uStats);
            setReviewStats(revStats);
            setCompanyStats(cStats);
        } catch (err) {
            console.error(err);
            navigate('/login');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, [period, startDate, endDate, selectedProjectId, selectedCompany]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = getFilterParams();
            const blob = await exportAnalytics(params);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `overtime_report_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Export failed', err);
            alert('Не удалось экспортировать данные за выбранный период');
        } finally {
            setExporting(false);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.project_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredDepts = departments.filter(d =>
        d.department_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredUsers = userStats.filter(u =>
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const pieData = summary ? [
        { name: 'Approved', value: summary.approved_requests },
        { name: 'Pending', value: summary.pending_requests },
        { name: 'Rejected', value: summary.rejected_requests },
    ].filter(d => d.value > 0) : [];

    const StatCard = ({ title, value, sub, icon: Icon, color, trend }: any) => (
        <div className="glass-card" style={{ flex: '1', minWidth: '280px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ padding: '10px', borderRadius: '14px', background: `${color}15`, color: color }}>
                    <Icon size={24} />
                </div>
                {trend && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '20px',
                        fontSize: '0.75rem', fontWeight: 700, background: trend > 0 ? '#dcfce7' : '#fee2e2', color: trend > 0 ? '#166534' : '#991b1b'
                    }}>
                        {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 500 }}>{title}</p>
            <h3 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>{value}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>{sub}</p>
        </div>
    );

    if (loading && !summary) return (
        <div className="page-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
                <div style={{ width: '400px' }}><Skeleton height={60} /></div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Skeleton height={52} width={250} />
                    <Skeleton height={52} width={180} />
                    <Skeleton height={52} width={120} />
                </div>
            </div>
            <div style={{ display: 'flex', gap: '24px', marginBottom: '40px' }}>
                <div style={{ flex: 1 }}><Skeleton height={140} borderRadius={20} /></div>
                <div style={{ flex: 1 }}><Skeleton height={140} borderRadius={20} /></div>
                <div style={{ flex: 1 }}><Skeleton height={140} borderRadius={20} /></div>
            </div>
            <div style={{ height: '400px' }}><Skeleton height={400} borderRadius={20} /></div>
        </div>
    );

    return (
        <div className="page-container">
            <Header user={user} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '8px' }}>Аналитическая панель</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Обзор производительности и затрат ресурсов в реальном времени.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: '250px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            placeholder="Поиск по графику..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ padding: '10px 10px 10px 36px', borderRadius: '10px', fontSize: '0.85rem', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                        />
                    </div>

                    {/* Period Selector */}
                    <div style={{ position: 'relative' }}>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            style={{
                                padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border)',
                                background: 'var(--bg-primary)', cursor: 'pointer', appearance: 'none',
                                paddingRight: '40px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)',
                                fontFamily: 'inherit'
                            }}
                        >
                            <option value="all">За всё время</option>
                            <option value="week">За неделю</option>
                            <option value="month">С начала месяца</option>
                            <option value="prev_month">Прошлый месяц</option>
                            <option value="custom">Период...</option>
                        </select>
                        <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                    </div>

                    {/* Company Selector (Admin only) */}
                    {user?.role === 'admin' && (
                        <div style={{ position: 'relative' }}>
                            <select
                                value={selectedCompany}
                                onChange={(e) => setSelectedCompany(e.target.value)}
                                style={{
                                    padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border)',
                                    background: 'var(--bg-primary)', cursor: 'pointer', appearance: 'none',
                                    paddingRight: '40px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)',
                                    fontFamily: 'inherit'
                                }}
                            >
                                <option value="all">Все компании</option>
                                <option value="Polymedia">Polymedia</option>
                                <option value="AJ-techCom">AJ-techCom</option>
                            </select>
                            <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                        </div>
                    )}

                    {period === 'custom' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem' }}
                            />
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem' }}
                            />
                        </div>
                    )}

                    <button
                        className="primary"
                        style={{ width: 'auto', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={handleExport}
                        disabled={exporting}
                    >
                        {exporting ? '...' : <Download size={18} />}
                        Выгрузить
                    </button>
                </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '40px' }}>
                <StatCard
                    title="Общие трудозатраты"
                    value={`${summary?.total_hours?.toFixed(1) || 0}ч`}
                    sub={period === 'all' ? "Суммарная переработка" : "За выбранный период"}
                    icon={Clock}
                    color="#1e40af"
                />
                <StatCard
                    title="Заявки за период"
                    value={summary?.total_requests || 0}
                    sub="Всего создано заявок"
                    icon={FileCheck}
                    color="#15803d"
                />
                <StatCard
                    title="Ожидает решения"
                    value={summary?.pending_requests || 0}
                    sub="Требуют внимания сейчас"
                    icon={Activity}
                    color="#b45309"
                />
            </div>

            {/* Review Analytics Report */}
            {reviewStats && (
                <div className="glass-card animate-fade-in" style={{ marginBottom: '40px', background: 'var(--bg-primary)', border: '2px solid var(--accent)', borderStyle: 'dashed' }}>
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <FileCheck size={24} style={{ color: 'var(--accent)' }} /> Отчет по качеству согласования
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Сравнение запрошенных сотрудниками часов и фактически одобренных менеджерами.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                        <div style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-secondary)' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Запрошено (план)</p>
                            <p style={{ fontSize: '1.75rem', fontWeight: 900 }}>{reviewStats.total_requested_hours.toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>ч</span></p>
                        </div>
                        <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid var(--success)' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', marginBottom: '8px' }}>Утверждено (факт)</p>
                            <p style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--success)' }}>{reviewStats.total_approved_hours.toFixed(1)} <span style={{ fontSize: '1rem', opacity: 0.7 }}>ч</span></p>
                        </div>
                        <div style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-secondary)' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Сверх запрошенного</p>
                            <p style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--accent)' }}>{reviewStats.more_than_requested_count}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>заявок</p>
                        </div>
                        <div style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-secondary)' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>С понижением (частично)</p>
                            <p style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--warning)' }}>{reviewStats.less_than_requested_count}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>заявок</p>
                        </div>
                        <div style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-secondary)' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Полное соответствие</p>
                            <p style={{ fontSize: '1.75rem', fontWeight: 900 }}>{reviewStats.exact_match_count}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>заявок</p>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '32px', marginBottom: '32px' }}>
                {/* Distribution Chart */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '24px' }}>Статусы за период</h4>
                    <div style={{ flex: 1, minHeight: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={105}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Compare Dashboard */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Сравнение показателей</h4>
                        <div style={{ display: 'flex', background: 'var(--bg-primary)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <button
                                onClick={() => setCompareBy('projects')}
                                style={{
                                    padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: 'none',
                                    background: compareBy === 'projects' ? 'var(--accent)' : 'transparent',
                                    color: compareBy === 'projects' ? 'white' : 'var(--text-muted)',
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >Проекты</button>
                            <button
                                onClick={() => setCompareBy('departments')}
                                style={{
                                    padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: 'none',
                                    background: compareBy === 'departments' ? 'var(--accent)' : 'transparent',
                                    color: compareBy === 'departments' ? 'white' : 'var(--text-muted)',
                                    cursor: 'pointer', transition: 'all 0.2s', marginRight: '4px'
                                }}
                            >Отделы</button>
                            <button
                                onClick={() => setCompareBy('users')}
                                style={{
                                    padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: 'none',
                                    background: compareBy === 'users' ? 'var(--accent)' : 'transparent',
                                    color: compareBy === 'users' ? 'white' : 'var(--text-muted)',
                                    cursor: 'pointer', transition: 'all 0.2s', marginRight: '4px'
                                }}
                            >Сотрудники</button>
                            {user?.role === 'admin' && (
                                <button
                                    onClick={() => setCompareBy('companies')}
                                    style={{
                                        padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: 'none',
                                        background: compareBy === 'companies' ? 'var(--accent)' : 'transparent',
                                        color: compareBy === 'companies' ? 'white' : 'var(--text-muted)',
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >Компании</button>
                            )}
                        </div>
                    </div>

                    {compareBy === 'users' && (
                        <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Фильтр по проекту:</span>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <select
                                    value={selectedProjectId || ''}
                                    onChange={(e) => setSelectedProjectId(e.target.value || null)}
                                    style={{
                                        width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                                        background: 'var(--bg-primary)', fontSize: '0.85rem', appearance: 'none'
                                    }}
                                >
                                    <option value="">Все проекты</option>
                                    {projects.map(p => (
                                        <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                            </div>
                        </div>
                    )}

                    <div style={{ flex: 1, minHeight: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            {compareBy === 'users' ? (
                                <BarChart data={filteredUsers} layout="vertical" margin={{ left: 20, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                    <YAxis type="category" dataKey="full_name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={120} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="total_hours" name="Часы" fill="var(--accent)" radius={[0, 8, 8, 0]} />
                                </BarChart>
                            ) : compareBy === 'companies' ? (
                                <BarChart data={companyStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis dataKey="company" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend verticalAlign="top" align="right" />
                                    <Bar dataKey="hours" name="Часы" fill="var(--accent)" radius={[8, 8, 0, 0]} />
                                    <Bar dataKey="requests" name="Кол-во заявок" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            ) : (
                                <AreaChart data={compareBy === 'projects' ? filteredProjects : filteredDepts}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis dataKey={compareBy === 'projects' ? "project_name" : "department_name"} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="total_hours" name="Часы" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                                </AreaChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Detailed Load Distribution */}
            <div className="glass-card">
                <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={22} style={{ color: 'var(--accent)' }} />
                        Трудозатраты по подразделениям
                    </h4>
                </div>
                <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredDepts} barSize={40}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="department_name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="total_hours" name="Часы" fill="var(--accent)" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;
