import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus, AlertCircle, Loader2, Globe, Check } from 'lucide-react';
import api from '../../services/api';

interface ImportMSUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (count: number) => void;
}

const ImportMSUsersModal: React.FC<ImportMSUsersModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [msUsers, setMsUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchMSUsers();
            setSelectedIds(new Set());
            setSearch('');
        }
    }, [isOpen]);

    const fetchMSUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/admin/ms-users');
            setMsUsers(response.data);
        } catch (err: any) {
            console.error('MS Fetch Error:', err);
            setError(err.response?.data?.detail || 'Не удалось получить пользователей из Microsoft. Проверьте настройки API и ключи в .env.');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

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
            const response = await api.post('/admin/ms-import', usersToImport);
            onSuccess(response.data.imported);
            onClose();
        } catch (err: any) {
            alert('Ошибка при импорте: ' + (err.response?.data?.detail || err.message));
        } finally {
            setImporting(false);
        }
    };

    const filteredUsers = msUsers.filter(u => {
        const searchLower = search.toLowerCase();
        return (
            (u.displayName || '').toLowerCase().includes(searchLower) ||
            (u.mail || u.userPrincipalName || '').toLowerCase().includes(searchLower) ||
            (u.jobTitle || '').toLowerCase().includes(searchLower)
        );
    });

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
            <div className="modal-content glass-card animate-scale-in"
                style={{ maxWidth: '850px', width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <div style={{ padding: '8px', borderRadius: '10px', background: 'var(--accent-gradient)', color: 'white' }}>
                                <Globe size={20} />
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Импорт из Office 365</h2>

                            <button
                                onClick={async () => {
                                    try {
                                        setLoading(true);
                                        const res = await api.post('/admin/test-email');
                                        alert(res.data.message);
                                    } catch (err: any) {
                                        alert('Ошибка: ' + (err.response?.data?.detail || err.message));
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                className="secondary"
                                style={{ marginLeft: '16px', padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px' }}
                            >
                                <AlertCircle size={14} style={{ marginRight: '6px' }} />
                                Проверить почту
                            </button>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Выберите сотрудников организации для добавления в систему</p>
                    </div>
                    <button onClick={onClose} className="action-button-modern" style={{ padding: '8px', borderRadius: '50%' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Search and Selection Tools */}
                <div style={{ padding: '16px 32px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
                        <input
                            type="text"
                            placeholder="Поиск по имени, почте или должности..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="form-input"
                            style={{ paddingLeft: '44px', width: '100%', marginBottom: 0 }}
                        />
                    </div>
                    <button
                        onClick={handleSelectAll}
                        className="secondary-button"
                        style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}
                    >
                        {selectedIds.size === filteredUsers.length && filteredUsers.length > 0 ? 'Снять выделение' : 'Выбрать всех'}
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '16px' }}>
                            <Loader2 size={40} className="animate-spin" style={{ color: 'var(--accent)' }} />
                            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Связываюсь с Microsoft Azure...</p>
                        </div>
                    ) : error ? (
                        <div style={{ padding: '32px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', gap: '16px' }}>
                            <AlertCircle size={24} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                            <div>
                                <h4 style={{ color: 'var(--danger)', fontWeight: 700, marginBottom: '4px' }}>Ошибка интеграции</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>{error}</p>
                                <button onClick={fetchMSUsers} className="primary-button" style={{ marginTop: '16px', padding: '8px 16px', fontSize: '0.85rem' }}>Попробовать снова</button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                    <div
                                        key={user.id}
                                        onClick={() => handleToggleSelect(user.id)}
                                        className={`glass-card ${selectedIds.has(user.id) ? 'active' : ''}`}
                                        style={{
                                            padding: '16px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '16px',
                                            border: selectedIds.has(user.id) ? '2px solid var(--accent)' : '1px solid var(--border)',
                                            background: selectedIds.has(user.id) ? 'rgba(79, 70, 229, 0.05)' : 'var(--bg-secondary)',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{
                                            width: '24px', height: '24px', borderRadius: '6px',
                                            border: '2px solid ' + (selectedIds.has(user.id) ? 'var(--accent)' : 'var(--border)'),
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: selectedIds.has(user.id) ? 'var(--accent)' : 'transparent',
                                            color: 'white', flexShrink: 0
                                        }}>
                                            {selectedIds.has(user.id) && <Check size={16} strokeWidth={3} />}
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {user.displayName}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                                                {user.mail || user.userPrincipalName}
                                            </div>
                                            {user.jobTitle && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                                                    {user.jobTitle}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    Пользователи не найдены
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '20px 32px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Выбрано: <span style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 800 }}>{selectedIds.size}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={onClose} className="secondary-button" style={{ minWidth: '120px' }}>Отмена</button>
                        <button
                            onClick={handleImport}
                            disabled={selectedIds.size === 0 || importing}
                            className="primary-button"
                            style={{ minWidth: '160px', gap: '10px' }}
                        >
                            {importing ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <UserPlus size={18} />
                            )}
                            {importing ? 'Импорт...' : 'Добавить выбранных'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportMSUsersModal;
