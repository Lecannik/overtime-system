import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check } from 'lucide-react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../services/api';
import { formatTime } from '../../constants/locale';

const NotificationBell: React.FC = () => {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        try {
            const data = await getNotifications();
            setNotifications(data);
            setUnreadCount(data.filter((n: any) => !n.is_read).length);
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s

        let ws: WebSocket | null = null;
        let reconnectTimeout: any = null;

        const connectWebSocket = () => {
            const token = localStorage.getItem('token');
            if (!token) return;

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/api/v1/ws?token=${token}`;
            
            ws = new WebSocket(wsUrl);

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket event received:', data);
                    if (data.type === 'NEW_NOTIFICATION' || data.type === 'OVERTIME_UPDATED' || data.type === 'OVERTIME_CREATED') {
                        fetchNotifications();
                        window.dispatchEvent(new CustomEvent('overtime_update', { detail: data }));
                    }
                } catch (e) {
                    console.error('WebSocket message error:', e);
                }
            };

            ws.onclose = (e) => {
                console.log('WebSocket connection closed. Attempting reconnect in 5s...', e);
                reconnectTimeout = setTimeout(connectWebSocket, 5000);
            };

            ws.onerror = (e) => {
                console.error('WebSocket error:', e);
                ws?.close();
            };
        };

        connectWebSocket();

        return () => {
            clearInterval(interval);
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            if (ws) {
                ws.onclose = null; // Prevent reconnect on unmount
                ws.close();
            }
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkRead = async (id: number) => {
        await markNotificationRead(id);
        fetchNotifications();
    };

    const handleMarkAllRead = async () => {
        await markAllNotificationsRead();
        fetchNotifications();
    };

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="action-button-modern"
                style={{
                    position: 'relative',
                    color: unreadCount > 0 ? 'var(--accent)' : 'var(--text-secondary)',
                    padding: 0
                }}
            >
                <Bell size={18} fill={unreadCount > 0 ? 'var(--accent)' : 'none'} fillOpacity={0.2} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: '-4px', right: '-4px', background: 'var(--danger)', color: 'white',
                        fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '10px', border: '2px solid var(--bg-secondary)',
                        lineHeight: 1
                    }}>
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="glass-card animate-fade-in" style={{
                    position: 'absolute', top: '50px', right: '0', width: '360px', maxHeight: '480px',
                    zIndex: 1000, padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 20px 25px -5px rgba(0,0,10,0.2)', border: '1px solid var(--border)'
                }}>
                    <div style={{ padding: '16px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Уведомления</h4>
                        {unreadCount > 0 && (
                            <button onClick={handleMarkAllRead} style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none' }}>
                                Прочитать все
                            </button>
                        )}
                    </div>

                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Bell size={32} style={{ opacity: 0.2, marginBottom: '12px', margin: '0 auto' }} />
                                <p style={{ fontSize: '0.85rem' }}>У вас пока нет уведомлений</p>
                            </div>
                        ) : (
                            notifications.map((n: any) => (
                                <div
                                    key={n.id}
                                    style={{
                                        padding: '16px 20px', borderBottom: '1px solid var(--border)',
                                        background: n.is_read ? 'transparent' : 'rgba(59, 130, 246, 0.03)',
                                        transition: 'background 0.2s', position: 'relative'
                                    }}
                                >
                                    {!n.is_read && <div style={{ position: 'absolute', left: '0', top: '16px', bottom: '16px', width: '3px', background: 'var(--accent)', borderRadius: '0 4px 4px 0' }}></div>}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: n.is_read ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{n.title}</p>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                            {formatTime(n.created_at)}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.message}</p>
                                    {!n.is_read && (
                                        <button
                                            onClick={() => handleMarkRead(n.id)}
                                            style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', padding: '0', cursor: 'pointer' }}
                                        >
                                            <Check size={12} /> Пометить прочитанным
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
