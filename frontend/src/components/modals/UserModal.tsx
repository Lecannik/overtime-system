import React, { useState, useEffect } from 'react';
import { X, User, Mail, Shield, Building2, Globe, AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { createUser, updateUser, getDepartments } from '../../services/api';
import { ROLE_LABELS, COMPANY_LABELS } from '../../constants/locale';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editData?: any;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onSuccess, editData }) => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('employee');
    const [company, setCompany] = useState('Polymedia');
    const [departmentId, setDepartmentId] = useState<number | ''>('');
    const [departments, setDepartments] = useState<any[]>([]);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            getDepartments().then(setDepartments).catch(() => { });
            if (editData) {
                setFullName(editData.full_name || '');
                setEmail(editData.email || '');
                setRole(editData.role || 'employee');
                setCompany(editData.company || 'Polymedia');
                setDepartmentId(editData.department_id || '');
                setPassword(''); // Не нужно при редактировании
            } else {
                setFullName('');
                setEmail('');
                setRole('employee');
                setCompany('Polymedia');
                setDepartmentId('');
                setPassword('changeme123'); // Значение по умолчанию
            }
        }
    }, [isOpen, editData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const data = {
                full_name: fullName,
                email,
                role,
                company,
                department_id: departmentId || undefined,
                password: !editData ? password : undefined
            };
            if (editData) {
                await updateUser(editData.id, data);
            } else {
                await createUser(data);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Ошибка при сохранении пользователя');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 3000 }}>
            <div className="modal-content glass-card animate-scale-in"
                style={{ maxWidth: '520px', padding: 0, overflow: 'hidden', borderRadius: '24px' }}
                onClick={e => e.stopPropagation()}>

                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontWeight: 800, fontSize: '1.25rem' }}>{editData ? 'Редактировать сотрудника' : 'Новый сотрудник'}</h3>
                    <button onClick={onClose} className="action-button-modern" style={{ width: '40px', height: '40px' }}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {error && (
                        <div style={{ padding: '16px', background: '#fee2e2', color: 'var(--danger)', borderRadius: '12px', fontSize: '0.875rem', display: 'flex', gap: '8px', fontWeight: 600 }}>
                            <AlertCircle size={20} /> {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label>ФИО</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Иванов Иван Иванович" style={{ paddingLeft: '44px' }} required />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="i.ivanov@company.com" style={{ paddingLeft: '44px' }} required />
                        </div>
                    </div>

                    {!editData && (
                        <div className="form-group">
                            <label>Начальный пароль</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Сложный пароль"
                                    style={{ paddingLeft: '44px', paddingRight: '44px' }}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="form-group">
                            <label>Роль</label>
                            <div style={{ position: 'relative' }}>
                                <Shield size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <select value={role} onChange={e => setRole(e.target.value)} style={{ paddingLeft: '44px' }}>
                                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Компания</label>
                            <div style={{ position: 'relative' }}>
                                <Globe size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <select value={company} onChange={e => setCompany(e.target.value)} style={{ paddingLeft: '44px' }}>
                                    {Object.entries(COMPANY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Отдел</label>
                        <div style={{ position: 'relative' }}>
                            <Building2 size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <select value={departmentId} onChange={e => setDepartmentId(e.target.value ? Number(e.target.value) : '')} style={{ paddingLeft: '44px' }}>
                                <option value="">Без отдела</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                        <button type="button" onClick={onClose} className="secondary" style={{ flex: 1, padding: '14px' }}>Отмена</button>
                        <button type="submit" className="primary" disabled={loading} style={{ flex: 1.5, padding: '14px' }}>
                            {loading ? 'Подождите...' : (editData ? 'Сохранить изменения' : 'Создать сотрудника')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
