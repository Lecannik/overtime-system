import React, { useState, useEffect } from 'react';
import {
    X, Save, User as UserIcon, Tag, Building,
    Mail, Phone, Globe, CheckCircle, ArrowRight
} from 'lucide-react';
import { updateLead, getCRMStages, getUsersList, getCounterparties, getCRMTasks, convertLeadToDeal } from '../../services/api';
import LoadingOverlay from '../atoms/LoadingOverlay';
import type { Lead, Counterparty, Task } from '../../types';

interface LeadDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    lead: Lead;
}

const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ isOpen, onClose, onSuccess, lead }) => {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'tasks'>('general');
    const [stages, setStages] = useState<any[]>([]);
    const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);

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
        if (isOpen && lead) {
            setFormData({
                title: lead.title || '',
                description: lead.description || '',
                contact_name: lead.contact_name || '',
                contact_phone: lead.contact_phone || '',
                contact_email: lead.contact_email || '',
                source: lead.source || '',
                stage_id: lead.stage_id?.toString() || '',
                counterparty_id: lead.counterparty_id?.toString() || ''
            });
            fetchMetadata();
        }
    }, [isOpen, lead]);

    const fetchMetadata = async () => {
        try {
            const [stagesData, usersData, cpData, tasksData] = await Promise.all([
                getCRMStages('LEAD'),
                getUsersList(),
                getCounterparties(),
                getCRMTasks({ lead_id: lead.id })
            ]);
            setStages(stagesData);
            setCounterparties(cpData);
            setTasks(tasksData);
        } catch (err) {
            console.error('Ошибка загрузки метаданных', err);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateLead(lead.id, {
                ...formData,
                stage_id: formData.stage_id ? Number(formData.stage_id) : null,
                counterparty_id: formData.counterparty_id ? Number(formData.counterparty_id) : null
            });
            onSuccess();
            onClose();
        } catch (err) {
            alert('Ошибка при сохранении лида');
        } finally {
            setLoading(false);
        }
    };

    const handleConvert = async () => {
        if (window.confirm('Конвертировать этот лид в сделку?')) {
            setLoading(true);
            try {
                await convertLeadToDeal(lead.id);
                alert('Лид успешно конвертирован в сделку!');
                onSuccess();
                onClose();
            } catch (err) {
                alert('Ошибка при конвертации');
            } finally {
                setLoading(false);
            }
        }
    };

    if (!isOpen || !lead) return null;

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button
            type="button"
            onClick={() => setActiveTab(id)}
            style={{
                padding: '10px 16px',
                border: 'none',
                background: activeTab === id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                color: activeTab === id ? 'var(--accent)' : 'var(--text-muted)',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.9rem',
                fontWeight: activeTab === id ? 600 : 400
            }}
        >
            <Icon size={16} />
            {label}
        </button>
    );

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 3000 }}>
            <div className="modal-content glass-card animate-scale-in"
                style={{ maxWidth: '700px', padding: 0, overflow: 'hidden', borderRadius: '24px' }}
                onClick={e => e.stopPropagation()}>

                {loading && <LoadingOverlay />}

                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <UserIcon size={22} />
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 800, fontSize: '1.3rem', margin: 0 }}>Лид: {formData.title}</h3>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {lead.id} • {lead.source || 'Источник не указан'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="action-button-modern" style={{ width: '40px', height: '40px' }}><X size={20} /></button>
                </div>

                {/* Tabs */}
                <div style={{ padding: '8px 32px', display: 'flex', gap: '8px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    <TabButton id="general" label="Информация" icon={Tag} />
                    <TabButton id="tasks" label="Задачи" icon={CheckCircle} />
                </div>

                <form onSubmit={handleSave} style={{ padding: '32px' }}>

                    {activeTab === 'general' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Название лида / Компании</label>
                                <input className="modern-input" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                            </div>

                            <div className="form-group">
                                <label>Контактное лицо</label>
                                <div style={{ position: 'relative' }}>
                                    <UserIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input className="modern-input" style={{ paddingLeft: '36px' }} value={formData.contact_name} onChange={e => setFormData({ ...formData, contact_name: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Стадия</label>
                                <select className="modern-input" value={formData.stage_id} onChange={e => setFormData({ ...formData, stage_id: e.target.value })}>
                                    <option value="">Не выбрана</option>
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
                                <label>Контрагент</label>
                                <div style={{ position: 'relative' }}>
                                    <Building size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <select className="modern-input" style={{ paddingLeft: '36px' }} value={formData.counterparty_id} onChange={e => setFormData({ ...formData, counterparty_id: e.target.value })}>
                                        <option value="">Не выбран</option>
                                        {counterparties.map(cp => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Источник</label>
                                <div style={{ position: 'relative' }}>
                                    <Globe size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input className="modern-input" style={{ paddingLeft: '36px' }} value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Описание / Комментарии</label>
                                <textarea className="modern-input" style={{ minHeight: '80px' }} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'tasks' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {tasks.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px', background: 'var(--bg-tertiary)', borderRadius: '16px' }}>
                                    <CheckCircle size={32} style={{ marginBottom: '12px', opacity: 0.2 }} />
                                    <p>Задач по лиду пока нет</p>
                                </div>
                            ) : (
                                tasks.map(t => (
                                    <div key={t.id} className="glass-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${t.status === 'DONE' ? '#10b981' : 'var(--accent)'}` }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t.title}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.deadline ? new Date(t.deadline).toLocaleDateString() : 'Без срока'}</div>
                                        </div>
                                        <span className={`status-badge status-${t.status.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{t.status}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', gap: '16px' }}>
                        <button type="button" onClick={handleConvert} className="btn-secondary" style={{ color: '#10b981', border: '1px solid #10b981' }}>
                            <ArrowRight size={18} style={{ marginRight: '8px' }} /> КОНВЕРТИРОВАТЬ В СДЕЛКУ
                        </button>
                        <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
                            <button type="button" onClick={onClose} className="secondary">Отмена</button>
                            <button type="submit" className="primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Save size={20} /> СОХРАНИТЬ
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LeadDetailModal;
