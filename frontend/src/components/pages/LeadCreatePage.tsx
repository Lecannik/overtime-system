import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createLead, getCRMStages, getCounterparties } from '../../services/api';
import { ChevronLeft, Save, User, Phone, Mail, Building2, Globe, Tag } from 'lucide-react';
import LoadingOverlay from '../atoms/LoadingOverlay';

const LeadCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [stages, setStages] = useState<any[]>([]);
    const [counterparties, setCounterparties] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        source: '',
        stage_id: '',
        counterparty_id: ''
    });

    useEffect(() => {
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const [stagesData, cpData] = await Promise.all([
                getCRMStages('LEAD'),
                getCounterparties()
            ]);
            setStages(stagesData);
            setCounterparties(cpData);
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
            const newLead = await createLead({
                ...formData,
                stage_id: formData.stage_id ? Number(formData.stage_id) : null,
                counterparty_id: formData.counterparty_id ? Number(formData.counterparty_id) : null
            });
            alert('Лид успешно создан!');
            navigate(`/leads/${newLead.id}`);
        } catch (err) {
            alert('Ошибка при создании лида');
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
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Создание нового лида</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Заполните информацию о потенциальном клиенте.</p>
                </div>
            </div>

            <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px' }}>
                <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <label>Название / Компания</label>
                        <input className="modern-input" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required placeholder="Напр. ООО СпецМонтаж" />
                    </div>

                    <div className="form-group">
                        <label>Контактное лицо</label>
                        <div style={{ position: 'relative' }}>
                            <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input className="modern-input" style={{ paddingLeft: '36px' }} value={formData.contact_name} onChange={e => setFormData({ ...formData, contact_name: e.target.value })} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Стадия</label>
                        <select className="modern-input" value={formData.stage_id} onChange={e => setFormData({ ...formData, stage_id: e.target.value })}>
                            <option value="">Выберите стадию</option>
                            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Телефон</label>
                        <div style={{ position: 'relative' }}>
                            <Phone size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input className="modern-input" style={{ paddingLeft: '36px' }} value={formData.contact_phone} onChange={e => setFormData({ ...formData, contact_phone: e.target.value })} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input type="email" className="modern-input" style={{ paddingLeft: '36px' }} value={formData.contact_email} onChange={e => setFormData({ ...formData, contact_email: e.target.value })} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Контрагент (если уже есть в базе)</label>
                        <select className="modern-input" value={formData.counterparty_id} onChange={e => setFormData({ ...formData, counterparty_id: e.target.value })}>
                            <option value="">Не выбран</option>
                            {counterparties.map(cp => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Источник</label>
                        <input className="modern-input" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} placeholder="Напр. Сайт, Прямой звонок" />
                    </div>

                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <label>Описание</label>
                        <textarea className="modern-input" style={{ minHeight: '120px' }} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    </div>

                    <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '16px' }}>
                        <button type="button" onClick={() => navigate('/crm')} className="secondary">Отмена</button>
                        <button type="submit" className="primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Save size={20} /> Создать лид
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LeadCreatePage;
