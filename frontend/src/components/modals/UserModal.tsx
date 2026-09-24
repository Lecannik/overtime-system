/* eslint-disable */
import React, { useState, useEffect, useCallback } from 'react';
import { X, User as UserIcon, Mail, Shield, Building2, Globe, AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { createUser, updateUser, getDepartments } from '../../services/api';
import { ROLE_LABELS, COMPANY_LABELS } from '../../constants/locale';
import type { User, Department } from '../../types';
import { AxiosError } from 'axios';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editData?: User | null;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onSuccess, editData }) => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('employee');
    const [company, setCompany] = useState('Polymedia');
    const [departmentId, setDepartmentId] = useState<number | ''>('');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const init = useCallback(async () => {
        try {
            const depts = await getDepartments();
            setDepartments(depts);
            
            if (editData) {
                setFullName(editData.full_name || '');
                setEmail(editData.email || '');
                setRole(editData.role || 'employee');
                setCompany(editData.company || 'Polymedia');
                setDepartmentId(editData.department_id || '');
                setPassword('');
            } else {
                setFullName('');
                setEmail('');
                setRole('employee');
                setCompany('Polymedia');
                setDepartmentId('');
                setPassword('changeme123');
            }
        } catch (err) {
            console.error('Failed to init UserModal', err);
        }
    }, [editData]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                init();
            }, 0);
        }
    }, [isOpen, init]);

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
                await updateUser(editData.id, data as any);
            } else {
                await createUser(data as any);
            }
            onSuccess();
            onClose();
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ detail?: string }>;
            setError(axiosError.response?.data?.detail || 'Ошибка при сохранении пользователя');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 3000 }}>
            <div className="modal-content glass-card animate-scale-in"
                style={{ maxWidth: '520px', padding: 0 }}
                onClick={e => e.stopPropagation()}>

                <div className="modal-header-responsive" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', flexShrink: 0 }}>
                    <h3 style={{ fontWeight: 800, fontSize: '1.2rem' }}>{editData ? 'Редактировать сотрудника' : 'Новый сотрудник'}</h3>
                    <button onClick={onClose} className="action-button-modern" style={{ width: '38px', height: '38px' }}><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body-responsive" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {error && (
                        <div style={{ padding: '14px 16px', background: '#fee2e2', color: 'var(--danger)', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', gap: '8px', fontWeight: 600 }}>
                            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} /> <span>{error}</span>
                        </div>
                    )}

                    <div className="form-group">
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>ФИО</label>
                        <div style={{ position: 'relative' }}>
                            <UserIcon size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Иванов Иван Иванович" style={{ paddingLeft: '44px' }} required />
                        </div>
                    </div>

                    <div className="form-group">
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="i.ivanov@company.com" style={{ paddingLeft: '44px' }} required />
                        </div>
                    </div>

                    {!editData && (
                        <div className="form-group">
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Начальный пароль</label>
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

                    <div className="modal-two-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group" style={{ minWidth: 0 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Роль</label>
                            <div style={{ position: 'relative' }}>
                                <Shield size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <select value={role} onChange={e => setRole(e.target.value)} style={{ paddingLeft: '44px' }}>
                                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group" style={{ minWidth: 0 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Компания</label>
                            <div style={{ position: 'relative' }}>
                                <Globe size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <select value={company} onChange={e => setCompany(e.target.value)} style={{ paddingLeft: '44px' }}>
                                    {Object.entries(COMPANY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Отдел</label>
                        <div style={{ position: 'relative' }}>
                            <Building2 size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <select value={departmentId} onChange={e => setDepartmentId(e.target.value ? Number(e.target.value) : '')} style={{ paddingLeft: '44px' }}>
                                <option value="">Без отдела</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="modal-footer-responsive" style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                        <button type="button" onClick={onClose} className="secondary" style={{ flex: 1, padding: '12px', minHeight: '44px', justifyContent: 'center' }}>Отмена</button>
                        <button type="submit" className="primary" disabled={loading} style={{ flex: 1.5, padding: '12px', minHeight: '44px', justifyContent: 'center', fontWeight: 700 }}>
                            {loading ? 'Подождите...' : (editData ? 'Сохранить изменения' : 'Создать сотрудника')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
