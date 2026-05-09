import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createDeal, getCRMStages, getCounterparties, getUsers, getLeads } from '../../services/api';
import { ChevronLeft, Save, DollarSign, Tag, Building2, User, FileText } from 'lucide-react';
import LoadingOverlay from '../atoms/LoadingOverlay';

const DealCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [stages, setStages] = useState<any[]>([]);
    const [counterparties, setCounterparties] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        budget: 0,
        currency: 'RUB',
        stage_id: '',
        assigned_id: '',
        counterparty_id: '',
        lead_id: ''
    });

    useEffect(() => {
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const [stagesData, cpData, usersData, leadsData] = await Promise.all([
                getCRMStages('DEAL'),
                getCounterparties(),
                getUsers({ page_size: 1000 }),
                getLeads()
            ]);
            setStages(stagesData);
            setCounterparties(cpData);
            setUsers(usersData.items || usersData || []);
            setLeads(leadsData.items || leadsData || []);

            if (stagesData.length > 0) {
                setFormData(prev => ({ ...prev, stage_id: stagesData[0].id.toString() }));
            }
        } catch (err) {
            console.error('Ошибка загрузки метаданных', err);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const newDeal = await createDeal({
                ...formData,
                stage_id: formData.stage_id ? Number(formData.stage_id) : null,
                assigned_id: formData.assigned_id ? Number(formData.assigned_id) : null,
                counterparty_id: formData.counterparty_id ? Number(formData.counterparty_id) : null,
                lead_id: formData.lead_id ? Number(formData.lead_id) : null,
                budget: Number(formData.budget)
            });
            alert('Сделка успешно создана!');
            navigate(`/deals/${newDeal.id}`);
        } catch (err) {
            alert('Ошибка при создании сделки');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in">
            {loading && <LoadingOverlay />}

            <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Link to="/crm" className="icon-button" style={{ background: 'var(--bg-secondary)' }}>
                    <ChevronLeft size={20} />
                </Link>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Создание новой сделки</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Зафиксируйте коммерческое предложение или контракт.</p>
                </div>
            </div>

            <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px' }}>
                <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <label>Название сделки</label>
                        <input className="modern-input" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required placeholder="Напр. Модернизация ИТ-структуры" />
                    </div>

                    <div className="form-group">
                        <label>Бюджет / Сумма</label>
                        <div style={{ position: 'relative' }}>
                            <DollarSign size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input type="number" className="modern-input" style={{ paddingLeft: '36px' }} value={formData.budget} onChange={e => setFormData({ ...formData, budget: Number(e.target.value) })} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Валюта</label>
                        <select className="modern-input" value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })}>
                            <option value="RUB">RUB</option>
                            <option value="KZT">KZT</option>
                            <option value="USD">USD</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Стадия</label>
                        <div style={{ position: 'relative' }}>
                            <Tag size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <select className="modern-input" style={{ paddingLeft: '36px' }} value={formData.stage_id} onChange={e => setFormData({ ...formData, stage_id: e.target.value })}>
                                <option value="">Выберите стадию</option>
                                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Ответственный менеджер</label>
                        <div style={{ position: 'relative' }}>
                            <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <select className="modern-input" style={{ paddingLeft: '36px' }} value={formData.assigned_id} onChange={e => setFormData({ ...formData, assigned_id: e.target.value })}>
                                <option value="">Не назначен</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Контрагент (Клиент)</label>
                        <div style={{ position: 'relative' }}>
                            <Building2 size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <select className="modern-input" style={{ paddingLeft: '36px' }} value={formData.counterparty_id} onChange={e => setFormData({ ...formData, counterparty_id: e.target.value })}>
                                <option value="">Не выбран</option>
                                {counterparties.map(cp => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Связанный лид</label>
                        <select className="modern-input" value={formData.lead_id} onChange={e => setFormData({ ...formData, lead_id: e.target.value })}>
                            <option value="">Не связан</option>
                            {leads.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                        </select>
                    </div>

                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <label>Детали сделки / Объем работ</label>
                        <textarea className="modern-input" style={{ minHeight: '100px' }} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    </div>

                    <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '16px' }}>
                        <button type="button" onClick={() => navigate('/crm')} className="secondary">Отмена</button>
                        <button type="submit" className="primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Save size={20} /> Создать сделку
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DealCreatePage;
