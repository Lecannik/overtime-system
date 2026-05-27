import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Search, UserPlus, AlertCircle, Loader2, Globe, Check } from 'lucide-react';
import api from '../../services/api';
import { AxiosError } from 'axios';

interface MSUser {
    id: string;
    displayName: string;
    mail: string;
    userPrincipalName: string;
    jobTitle?: string;
}

interface ImportMSUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (count: number) => void;
}

const ImportMSUsersModal: React.FC<ImportMSUsersModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [msUsers, setMsUsers] = useState<MSUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [importing, setImporting] = useState(false);

    const fetchMSUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/admin/ms-users');
            setMsUsers(response.data);
        } catch (err: unknown) {
            console.error('MS Fetch Error:', err);
            const axiosError = err as AxiosError<{ detail?: string }>;
            setError(axiosError.response?.data?.detail || 'Не удалось получить пользователей из Microsoft. Проверьте настройки API и ключи в .env.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            const init = async () => {
                await fetchMSUsers();
                // Move state updates inside async to avoid "synchronous" warning
                setSelectedIds(new Set());
                setSearch('');
            };
            init();
        }
    }, [isOpen, fetchMSUsers]);

    const handleToggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const filteredUsers = useMemo(() => {
        return msUsers.filter(u => 
            u.displayName.toLowerCase().includes(search.toLowerCase()) || 
            u.mail?.toLowerCase().includes(search.toLowerCase()) ||
            u.userPrincipalName.toLowerCase().includes(search.toLowerCase())
        );
    }, [msUsers, search]);

    const handleSelectAll = () => {
        const filtered = filteredUsers;
        if (selectedIds.size === filtered.length && filtered.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(u => u.id)));
        }
    };

    const handleImport = async () => {
        if (selectedIds.size === 0) return;
        
        try {
            setImporting(true);
            const usersToImport = msUsers.filter(u => selectedIds.has(u.id));
            const res = await api.post('/admin/import-ms-users', { users: usersToImport });
            onSuccess(res.data.count);
            onClose();
        } catch (err: unknown) {
            console.error('Import Error:', err);
            const axiosError = err as AxiosError<{ detail?: string }>;
            setError(axiosError.response?.data?.detail || 'Ошибка при импорте пользователей');
        } finally {
            setImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-content glass-card" style={{ maxWidth: '700px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                {/* Header */}
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                            <Globe size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Импорт из Microsoft</h2>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Выберите пользователей из вашей организации Office 365</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="action-button-modern"><X size={20} /></button>
                </div>

                {/* Search */}
                <div style={{ padding: '16px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input 
                            type="text" 
                            placeholder="Поиск по имени или email..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: '44px', height: '48px', borderRadius: '12px' }}
                        />
                    </div>
                </div>

                {/* Main Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '16px' }}>
                            <Loader2 className="spin" size={32} style={{ color: 'var(--primary)' }} />
                            <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Загрузка пользователей...</p>
                        </div>
                    ) : error ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>
                            <AlertCircle size={40} style={{ color: 'var(--error)', marginBottom: '16px' }} />
                            <p style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '8px' }}>Ошибка</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>{error}</p>
                            <button onClick={fetchMSUsers} className="primary" style={{ marginTop: '24px', padding: '10px 24px' }}>Попробовать снова</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                    {filteredUsers.length} пользователей найдено
                                </span>
                                <button 
                                    onClick={handleSelectAll}
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                                >
                                    {selectedIds.size === filteredUsers.length && filteredUsers.length > 0 ? 'Снять всё' : 'Выбрать всех'}
                                </button>
                            </div>

                            {filteredUsers.map(user => (
                                <div 
                                    key={user.id} 
                                    onClick={() => handleToggleSelect(user.id)}
                                    style={{ 
                                        padding: '12px 16px', 
                                        borderRadius: '12px', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '16px',
                                        cursor: 'pointer',
                                        background: selectedIds.has(user.id) ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                                        border: '1px solid',
                                        borderColor: selectedIds.has(user.id) ? 'var(--primary)' : 'transparent',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{ 
                                        width: '20px', 
                                        height: '20px', 
                                        borderRadius: '6px', 
                                        border: '2px solid',
                                        borderColor: selectedIds.has(user.id) ? 'var(--primary)' : 'var(--border)',
                                        background: selectedIds.has(user.id) ? 'var(--primary)' : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff'
                                    }}>
                                        {selectedIds.has(user.id) && <Check size={14} strokeWidth={4} />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{user.displayName}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user.mail || user.userPrincipalName}</div>
                                    </div>
                                    {user.jobTitle && (
                                        <div style={{ padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            {user.jobTitle}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {filteredUsers.length === 0 && (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Ничего не найдено по запросу "{search}"
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={onClose} disabled={importing} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}>Отмена</button>
                    <button 
                        onClick={handleImport} 
                        className="primary" 
                        disabled={selectedIds.size === 0 || importing}
                        style={{ padding: '12px 32px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}
                    >
                        {importing ? <Loader2 size={18} className="spin" /> : <UserPlus size={18} />}
                        ИМПОРТИРОВАТЬ ({selectedIds.size})
                    </button>
                </div>
            </div>
            
            <style>{`
                .action-button-modern {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    background: var(--bg-tertiary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    cursor: pointer;
                    color: var(--text-secondary);
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default ImportMSUsersModal;
