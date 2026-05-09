import React, { useEffect, useState } from 'react';
import {
    getCounterparties, getLeads, getDeals,
    createCounterparty, updateCounterparty, getUsers
} from '../../services/api';
import LoadingOverlay from '../atoms/LoadingOverlay';
import {
    Users, Building2, Phone, Mail, FileText, Search,
    Plus, Edit3, X, Save, ExternalLink, User as UserIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';

const CounterpartiesPage: React.FC = () => {
    const [counterparties, setCounterparties] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [deals, setDeals] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedCp, setSelectedCp] = useState<any | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        inn: '',
        kpp: '',
        ogrn: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        legal_address: '',
        postal_address: '',
        manager_id: '' as string | number
    });

    const resetForm = () => setFormData({
        name: '', inn: '', kpp: '', ogrn: '', contact_person: '', phone: '', email: '', address: '', legal_address: '', postal_address: '', manager_id: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [cpData, leadData, dealData, userData] = await Promise.all([
                getCounterparties(),
                getLeads(),
                getDeals(),
                getUsers()
            ]);
            setCounterparties(cpData);
            setLeads(leadData);
            setDeals(dealData);
            setUsers(Array.isArray(userData) ? userData : (userData?.items || []));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editMode && selectedCp) {
                const updated = await updateCounterparty(selectedCp.id, formData);
                setSelectedCp(updated);
            } else {
                await createCounterparty(formData);
            }
            setShowModal(false);
            setEditMode(false);
            resetForm();
            fetchData();
        } catch (err) {
            alert(editMode ? 'Ошибка при обновлении контрагента' : 'Ошибка при создании контрагента');
        }
    };

    const openEditModal = () => {
        if (!selectedCp) return;
        setFormData({
            name: selectedCp.name || '',
            inn: selectedCp.inn || '',
            kpp: selectedCp.kpp || '',
            ogrn: selectedCp.ogrn || '',
            contact_person: selectedCp.contact_person || '',
            phone: selectedCp.phone || '',
            email: selectedCp.email || '',
            address: selectedCp.address || '',
            legal_address: selectedCp.legal_address || '',
            postal_address: selectedCp.postal_address || '',
            manager_id: selectedCp.manager_id || ''
        });
        setEditMode(true);
        setShowModal(true);
    };

    const openCreateModal = () => {
        resetForm();
        setEditMode(false);
        setShowModal(true);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredCp = counterparties.filter(cp =>
        cp.name.toLowerCase().includes(search.toLowerCase()) ||
        cp.inn?.includes(search)
    );

    if (loading) return <LoadingOverlay />;

    return (
        <div className="animate-fade-in" style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 100px)' }}>
            {/* Left Sidebar: List */}
            <div className="glass-card" style={{ width: '350px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Users size={20} /> Контрагенты</div>
                        <button
                            onClick={openCreateModal}
                            style={{ padding: '6px', borderRadius: '8px', background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex' }}
                            title="Добавить контрагента"
                        >
                            <Plus size={18} />
                        </button>
                    </h2>
                    <div className="search-container" style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            placeholder="Поиск по имени или ИНН..."
                            className="glass-input"
                            style={{ width: '100%', paddingLeft: '36px' }}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredCp.map(cp => (
                        <div
                            key={cp.id}
                            onClick={() => setSelectedCp(cp)}
                            style={{
                                padding: '16px 20px',
                                borderBottom: '1px solid var(--border)',
                                cursor: 'pointer',
                                background: selectedCp?.id === cp.id ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                                transition: 'all 0.2s',
                                borderLeft: selectedCp?.id === cp.id ? '4px solid var(--accent)' : '4px solid transparent'
                            }}
                        >
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{cp.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>ИНН: {cp.inn || '—'}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Detailed View */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingBottom: '40px' }}>
                {!selectedCp ? (
                    <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        <Building2 size={64} style={{ opacity: 0.2, marginBottom: '16px' }} />
                        <p>Выберите контрагента для просмотра истории</p>
                    </div>
                ) : (
                    <>
                        {/* Summary Header */}
                        <div className="glass-card" style={{ padding: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>{selectedCp.name}</h1>
                                    <div style={{ display: 'flex', gap: '20px', marginTop: '16px', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            <Phone size={16} /> {selectedCp.phone || 'Нет телефона'}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            <Mail size={16} /> {selectedCp.email || 'Нет почты'}
                                        </div>
                                        {selectedCp.manager_id && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontSize: '0.9rem', fontWeight: 600 }}>
                                                <UserIcon size={16} /> Менеджер: {users.find((u: any) => u.id === selectedCp.manager_id)?.full_name || 'Загрузка...'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                    <button
                                        onClick={openEditModal}
                                        style={{
                                            padding: '10px 20px', borderRadius: '12px',
                                            background: 'rgba(59, 130, 246, 0.1)',
                                            color: 'var(--accent)', border: 'none', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            fontWeight: 600, fontSize: '0.85rem',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Edit3 size={16} /> Редактировать
                                    </button>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Реквизиты</div>
                                        <div style={{ fontSize: '0.9rem', marginTop: '4px' }}>ИНН: {selectedCp.inn || '—'}</div>
                                        <div style={{ fontSize: '0.9rem' }}>КПП: {selectedCp.kpp || '—'}</div>
                                        {selectedCp.ogrn && <div style={{ fontSize: '0.9rem' }}>ОГРН: {selectedCp.ogrn}</div>}
                                    </div>
                                </div>
                            </div>
                            {/* Адреса */}
                            {(selectedCp.address || selectedCp.legal_address || selectedCp.postal_address) && (
                                <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', fontSize: '0.85rem' }}>
                                    {selectedCp.legal_address && <div style={{ marginBottom: '4px' }}><strong>Юр. адрес:</strong> {selectedCp.legal_address}</div>}
                                    {selectedCp.postal_address && <div style={{ marginBottom: '4px' }}><strong>Почтовый:</strong> {selectedCp.postal_address}</div>}
                                    {selectedCp.address && <div><strong>Факт. адрес:</strong> {selectedCp.address}</div>}
                                </div>
                            )}
                        </div>

                        {/* Stats Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                            <div className="glass-card" style={{ padding: '20px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>ЛИДЫ</div>
                                <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{leads.filter(l => l.counterparty_id === selectedCp.id).length}</div>
                            </div>
                            <div className="glass-card" style={{ padding: '20px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>СДЕЛКИ В РАБОТЕ</div>
                                <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{deals.filter(d => d.counterparty_id === selectedCp.id).length}</div>
                            </div>
                            <div className="glass-card" style={{ padding: '20px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>ОБЩИЙ ОБОРОТ</div>
                                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent)' }}>
                                    {deals.filter(d => d.counterparty_id === selectedCp.id).reduce((sum, d) => sum + (d.budget || 0), 0).toLocaleString()} ₽
                                </div>
                            </div>
                        </div>

                        {/* Linked Entities */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="glass-card" style={{ padding: '24px' }}>
                                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}><FileText size={18} /> История сделок</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {deals.filter(d => d.counterparty_id === selectedCp.id).map(d => (
                                        <Link key={d.id} to={`/deals/${d.id}`} className="item-card clickable" style={{ textDecoration: 'none', color: 'inherit', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {d.title} <ExternalLink size={12} />
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(d.created_at).toLocaleDateString()}</div>
                                            </div>
                                            <div style={{ fontWeight: 800, color: 'var(--accent)' }}>{d.budget?.toLocaleString()} ₽</div>
                                        </Link>
                                    ))}
                                    {deals.filter(d => d.counterparty_id === selectedCp.id).length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Сделок не найдено</p>}
                                </div>
                            </div>

                            <div className="glass-card" style={{ padding: '24px' }}>
                                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}><Users size={18} /> Активные Лиды</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {leads.filter(l => l.counterparty_id === selectedCp.id).map(l => (
                                        <Link key={l.id} to={`/leads/${l.id}`} className="item-card clickable" style={{ textDecoration: 'none', color: 'inherit', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {l.title} <ExternalLink size={12} />
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.source || 'Прямой контакт'}</div>
                                            </div>
                                        </Link>
                                    ))}
                                    {leads.filter(l => l.counterparty_id === selectedCp.id).length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Лидов не найдено</p>}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={() => { setShowModal(false); setEditMode(false); }}>
                    <div className="glass-card" style={{ width: '500px', padding: '32px', borderRadius: '24px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                                {editMode ? 'Редактировать контрагента' : 'Новый контрагент'}
                            </h2>
                            <button onClick={() => { setShowModal(false); setEditMode(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Название компании *</label>
                                <input
                                    className="modern-input"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>ИНН</label>
                                    <input className="modern-input" value={formData.inn} onChange={e => setFormData({ ...formData, inn: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>КПП</label>
                                    <input className="modern-input" value={formData.kpp} onChange={e => setFormData({ ...formData, kpp: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>ОГРН</label>
                                    <input className="modern-input" value={formData.ogrn} onChange={e => setFormData({ ...formData, ogrn: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Контактное лицо</label>
                                <input className="modern-input" value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Телефон</label>
                                    <input className="modern-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Email</label>
                                    <input className="modern-input" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Юридический адрес</label>
                                <input className="modern-input" value={formData.legal_address} onChange={e => setFormData({ ...formData, legal_address: e.target.value })} />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Почтовый адрес</label>
                                <input className="modern-input" value={formData.postal_address} onChange={e => setFormData({ ...formData, postal_address: e.target.value })} />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Ответственный менеджер</label>
                                <select
                                    className="modern-input"
                                    value={formData.manager_id}
                                    onChange={e => setFormData({ ...formData, manager_id: e.target.value })}
                                >
                                    <option value="">Не назначен</option>
                                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                                </select>
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Фактический адрес</label>
                                <textarea
                                    className="modern-input"
                                    style={{ minHeight: '60px', resize: 'none' }}
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={() => { setShowModal(false); setEditMode(false); }} className="btn-secondary" style={{ flex: 1, padding: '12px', borderRadius: '12px' }}>Отмена</button>
                                <button type="submit" className="primary" style={{ flex: 1, padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Save size={16} />
                                    {editMode ? 'Сохранить' : 'Создать'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CounterpartiesPage;
