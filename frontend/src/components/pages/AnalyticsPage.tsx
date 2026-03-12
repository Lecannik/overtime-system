import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
    Clock, FileCheck, Users, Briefcase, Activity,
    Calendar, ArrowUpRight, ArrowDownRight, Search
} from 'lucide-react';
import Header from '../layout/Header';
import api, { getAnalyticsSummary, getProjectAnalytics, getDepartmentAnalytics } from '../../services/api';

const COLORS = ['#1e40af', '#15803d', '#b91c1c', '#3b82f6', '#10b981', '#ef4444'];
const STATUS_COLORS: Record<string, string> = {
    'Approved': '#15803d',
    'Pending': '#b45309',
    'Rejected': '#b91c1c'
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid #e2e8f0',
                padding: '12px 16px',
                borderRadius: '12px',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
            }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{label}</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#1e40af', fontWeight: 600 }}>
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
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchAll = async () => {
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

                const [sum, proj, dept] = await Promise.all([
                    getAnalyticsSummary(),
                    getProjectAnalytics(),
                    getDepartmentAnalytics().catch(() => [])
                ]);

                setSummary(sum);
                setProjects(proj);
                setDepartments(dept);
            } catch (err) {
                console.error(err);
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [navigate]);

    if (loading) return (
        <div className="page-container animate-pulse">
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Загрузка аналитических данных...</p>
        </div>
    );

    const filteredProjects = projects.filter(p =>
        p.project_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredDepts = departments.filter(d =>
        d.department_name.toLowerCase().includes(searchQuery.toLowerCase())
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
                            style={{ padding: '10px 10px 10px 36px', borderRadius: '10px', fontSize: '0.85rem' }}
                        />
                    </div>
                    <button style={{
                        padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border)',
                        background: 'var(--bg-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                        gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)',
                        fontFamily: 'inherit'
                    }}>
                        <Calendar size={18} /> Последние 30 дней
                    </button>
                    <button className="primary" style={{ width: 'auto', padding: '12px 24px' }}>Экспорт</button>
                </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '40px' }}>
                <StatCard
                    title="Общие трудозатраты"
                    value={`${summary?.total_hours?.toFixed(1) || 0}ч`}
                    sub="Суммарная переработка за период"
                    icon={Clock}
                    color="#1e40af"
                    trend={12}
                />
                <StatCard
                    title="Активные заявки"
                    value={summary?.total_requests || 0}
                    sub="Всего создано в системе"
                    icon={FileCheck}
                    color="#15803d"
                />
                <StatCard
                    title="Ожидает решения"
                    value={summary?.pending_requests || 0}
                    sub="Заявки, требующие внимания"
                    icon={Activity}
                    color="#b45309"
                    trend={-5}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '32px', marginBottom: '32px' }}>
                {/* Distribution Chart */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '24px' }}>Распределение по статусам</h4>
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

                {/* Main Projects Chart */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Переработки по проектам</h4>
                        <Briefcase size={20} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div style={{ flex: 1, minHeight: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredProjects}>
                                <defs>
                                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="project_name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="total_hours" name="Часы" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Section - Full Width Bar Chart */}
            <div className="glass-card">
                <div style={{ marginBottom: '32px' }}>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={22} style={{ color: 'var(--accent)' }} />
                        Нагрузка на подразделения
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
