import React, { useState, useEffect } from 'react';
import {
    X, User, Briefcase, FileUp, Download,
    CheckCircle, MessageSquare, Plus, AlertCircle, RefreshCcw, Building2, Trash2, Calendar
} from 'lucide-react';
import {
    getTask, updateTask, uploadTaskAttachment,
    downloadTaskAttachment, getAssignableUsers, createTaskComment, deleteTask, getTaskTypes, getTaskStatuses, type TaskType, type TaskStatus
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface TaskDetailModalProps {
    taskId: number;
    onClose: () => void;
    onUpdate: () => void;
}

/**
 * Модальное окно с детальной информацией о задаче.
 * Позволяет изменять статус, ответственного, добавлять комментарии и файлы.
 */
const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ taskId, onClose, onUpdate }) => {
    const { user: currentUser } = useAuth();
    const [task, setTask] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
    const [taskStatuses, setTaskStatuses] = useState<TaskStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [postingComment, setPostingComment] = useState(false);

    useEffect(() => {
        fetchData();
    }, [taskId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [taskData, usersData, typesData, statusesData] = await Promise.all([
                getTask(taskId),
                getAssignableUsers(),
                getTaskTypes(),
                getTaskStatuses()
            ]);
            setTask(taskData);
            setUsers(Array.isArray(usersData) ? usersData : (usersData?.items || []));
            setTaskTypes(typesData);
            setTaskStatuses(statusesData);
        } catch (err) {
            console.error('Error fetching task details:', err);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateTask = async (updates: any) => {
        // Оптимистичное обновление локального состояния для мгновенного отклика UI
        if (task) {
            const optimisticTask = { ...task, ...updates };
            
            // Синхронизируем вложенные объекты для визуальной консистентности (цвета, иконки)
            if (updates.type_id) {
                const newType = taskTypes.find(t => t.id === updates.type_id);
                if (newType) optimisticTask.task_type = newType;
            }
            if (updates.status_id) {
                const newStatus = taskStatuses.find(s => s.id === updates.status_id);
                if (newStatus) optimisticTask.task_status = newStatus;
            }
            if (updates.assigned_id) {
                const newUser = users.find(u => u.id === updates.assigned_id);
                if (newUser) optimisticTask.assigned = newUser;
            }
            
            setTask(optimisticTask);
        }

        try {
            const updated = await updateTask(taskId, updates);
            setTask(updated);
            // Уведомляем родителя об изменениях (тихое обновление)
            onUpdate();
        } catch (err) {
            console.error('Ошибка обновления задачи:', err);
            // В случае ошибки возвращаем актуальные данные с сервера
            fetchData();
            alert('Ошибка при обновлении задачи');
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setUploading(true);
        try {
            for (let i = 0; i < e.target.files.length; i++) {
                await uploadTaskAttachment(taskId, e.target.files[i]);
            }
            const updatedTask = await getTask(taskId);
            setTask(updatedTask);
        } catch (err) {
            alert('Ошибка при загрузке файла');
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = async (attachmentId: number, filename: string) => {
        try {
            const blob = await downloadTaskAttachment(attachmentId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            alert('Ошибка при скачивании файла');
        }
    };

    const handlePostComment = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!commentText.trim()) return;
        setPostingComment(true);
        try {
            await createTaskComment(taskId, commentText);
            setCommentText('');
            const updatedTask = await getTask(taskId);
            setTask(updatedTask);
        } catch (err) {
            alert('Ошибка при отправке комментария');
        } finally {
            setPostingComment(false);
        }
    };

    if (loading) return null;
    if (!task) return null;

    const isCreator = task.creator_id === currentUser?.id;
    const isAssigned = task.assigned_id === currentUser?.id;
    const isAdmin = (currentUser as any)?.role_name === 'admin';
    const isDeptHead = task.department?.manager_id === currentUser?.id;
    const canControl = isCreator || isAdmin || isDeptHead;

    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
            {/* Используем форму с preventDefault для предотвращения случайных перезагрузок */}
            <form 
                onSubmit={(e) => e.preventDefault()}
                className="glass-card animate-scale-in" 
                style={{ width: '900px', maxWidth: '95vw', maxHeight: '95vh', overflow: 'hidden', padding: 0, borderRadius: '28px', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}
            >
                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', boxShadow: 'var(--card-shadow)' }}>
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Задача #{task.id}</h2>
                                <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: task.task_type?.color ? task.task_type.color + '22' : 'var(--bg-tertiary)',
                                    color: task.task_type?.color || 'var(--text-muted)'
                                }}>
                                    {task.task_type?.name || task.type || 'Другое'}
                                </span>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>Создана: {new Date(task.created_at).toLocaleString()}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="icon-button"><X size={20} /></button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '32px' }}>
                    {/* Left Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        <section>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>{task.title}</h3>
                                <span className={`priority-tag ${task.priority?.toLowerCase() || 'medium'}`} style={{ fontSize: '0.75rem', padding: '4px 12px' }}>{task.priority || 'MEDIUM'}</span>
                            </div>
                            <div className="glass-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', minHeight: '120px', fontSize: '0.95rem', lineHeight: 1.7, borderRadius: '16px' }}>
                                {task.description || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Описание отсутствует</span>}
                            </div>
                        </section>

                        <section>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Вложения</h4>
                                <label className="action-link" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                    <Plus size={16} /> Добавить файлы
                                    <input type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} disabled={uploading} />
                                </label>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                {task.attachments?.map((file: any) => (
                                    <div key={file.id} className="glass-card" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-tertiary)', borderRadius: '12px', border: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                            <FileUp size={16} color="var(--accent)" />
                                            <div style={{ overflow: 'hidden' }}>
                                                <p style={{ fontSize: '0.8rem', fontWeight: 600, margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{file.filename}</p>
                                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0 }}>{(file.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => handleDownload(file.id, file.filename)} className="icon-button-small" style={{ color: 'var(--accent)' }}>
                                            <Download size={16} />
                                        </button>
                                    </div>
                                ))}
                                {(!task.attachments || task.attachments.length === 0) && (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '32px', border: '1px dashed var(--border)', borderRadius: '16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        Файлы еще не добавлены
                                    </div>
                                )}
                            </div>
                        </section>

                        <section>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Обсуждение</h4>
                                <MessageSquare size={16} color="var(--text-muted)" />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                                {task.comments?.map((comment: any) => (
                                    <div key={comment.id} style={{ display: 'flex', gap: '14px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border)' }}>
                                            <User size={18} color="var(--text-muted)" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{comment.author?.full_name || 'Пользователь'}</span>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(comment.created_at).toLocaleString()}</span>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, background: comment.author_id === currentUser?.id ? 'var(--bg-tertiary)' : 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '0 16px 16px 16px', border: '1px solid var(--border)' }}>
                                                {comment.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!task.comments || task.comments.length === 0) && (
                                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px' }}>Нет комментариев. Будьте первым!</p>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '12px', background: 'var(--bg-secondary)', padding: '8px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                                <input
                                    className="modern-input"
                                    placeholder="Ваше сообщение..."
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handlePostComment();
                                        }
                                    }}
                                    style={{ flex: 1, border: 'none', background: 'transparent' }}
                                />
                                <button
                                    type="button"
                                    onClick={handlePostComment}
                                    className="primary"
                                    disabled={postingComment || !commentText.trim()}
                                    style={{ padding: '8px 24px', borderRadius: '10px' }}
                                >
                                    {postingComment ? '...' : 'Отправить'}
                                </button>
                            </div>
                        </section>
                    </div>

                    {/* Right Column (Info) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="glass-card" style={{ padding: '24px', borderRadius: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Тип задачи</label>
                                <select
                                    className="modern-input"
                                    value={task.task_type?.id || ''}
                                    onChange={(e) => handleUpdateTask({ type_id: Number(e.target.value) })}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                    disabled={!canControl}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.9rem' }}
                                >
                                    <option value="" disabled>Выберите тип...</option>
                                    {taskTypes.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Статус задачи</label>
                                <select
                                    className="modern-input"
                                    value={task.status_id || ''}
                                    onChange={(e) => handleUpdateTask({ status_id: Number(e.target.value) })}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.9rem', fontWeight: 600, borderLeft: `4px solid ${task.task_status?.color || 'transparent'}` }}
                                >
                                    {taskStatuses.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Ответственный</label>
                                <select
                                    className="modern-input"
                                    value={task.assigned_id || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        handleUpdateTask({ assigned_id: val ? Number(val) : null });
                                    }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                    disabled={!canControl}
                                    style={{ width: '100%', padding: '10px', fontSize: '0.9rem' }}
                                >
                                    <option value="">Не назначен</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                                </select>
                            </div>

                            <div style={{ position: 'relative' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                    Крайний срок
                                </label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <Calendar 
                                        size={18} 
                                        style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', pointerEvents: 'none' }} 
                                    />
                                    <input
                                        type="date"
                                        className="modern-input"
                                        value={task.deadline ? new Date(task.deadline).toLocaleDateString('en-CA') : ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            handleUpdateTask({ deadline: val ? val : null });
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') e.preventDefault();
                                        }}
                                        disabled={!canControl}
                                        style={{ 
                                            width: '100%', 
                                            padding: '10px 10px 10px 40px', 
                                            fontSize: '0.9rem',
                                            cursor: canControl ? 'pointer' : 'default'
                                        }}
                                        onClick={(e) => {
                                            if (canControl) {
                                                try {
                                                    // @ts-ignore - showPicker is a newer standard
                                                    e.target.showPicker();
                                                } catch (err) {}
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="glass-card" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <User size={16} color="var(--text-muted)" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase' }}>Автор задачи</p>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{task.creator?.full_name}</p>
                                </div>
                            </div>

                            {task.project_id && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Briefcase size={16} color="var(--accent)" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase' }}>Проект</p>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{task.project?.name}</p>
                                    </div>
                                </div>
                            )}

                            {task.lead_id && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <User size={16} color="#0ea5e9" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase' }}>Лид CRM</p>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>ID #{task.lead_id}</p>
                                    </div>
                                </div>
                            )}

                            {task.deal_id && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(217, 119, 6, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Building2 size={16} color="#d97706" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase' }}>Сделка CRM</p>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>ID #{task.deal_id}</p>
                                    </div>
                                </div>
                            )}

                            {task.department && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Building2 size={16} color="#6366f1" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase' }}>Отдел</p>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{task.department.name}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {(task.task_status?.name.includes('REVIEW')) && (
                            <div className="glass-card" style={{ padding: '20px', borderRadius: '18px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d97706', marginBottom: '12px' }}>
                                    <AlertCircle size={18} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>ОЖИДАЕТ ПРОВЕРКИ</span>
                                </div>
                                {canControl ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                const doneStatus = taskStatuses.find(s => s.name.includes('DONE'));
                                                if (doneStatus) handleUpdateTask({ status_id: doneStatus.id });
                                            }}
                                            className="primary"
                                            style={{ background: '#10b981', width: '100%' }}
                                        >
                                            ПРИНЯТЬ РАБОТУ
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                const progressStatus = taskStatuses.find(s => s.name.includes('IN PROGRESS'));
                                                if (progressStatus) handleUpdateTask({ status_id: progressStatus.id });
                                            }}
                                            className="btn-secondary"
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                        >
                                            <RefreshCcw size={16} /> ВЕРНУТЬ В РАБОТУ
                                        </button>
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Ожидайте, пока автор или администратор проверят результат задачи.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '20px 32px', background: 'rgba(255,255,255,0.05)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        {canControl && (
                            <button
                                type="button"
                                onClick={async (e) => {
                                    e.preventDefault();
                                    if (window.confirm('Вы уверены, что хотите удалить эту задачу?')) {
                                        await deleteTask(taskId);
                                        onUpdate();
                                        onClose();
                                    }
                                }}
                                className="btn-secondary"
                                style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                            >
                                <Trash2 size={16} /> Удалить задачу
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button type="button" onClick={onClose} className="btn-secondary">Закрыть</button>
                        {(task.task_status?.name.includes('IN PROGRESS') && isAssigned) && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    const reviewStatus = taskStatuses.find(s => s.name.includes('REVIEW'));
                                    if (reviewStatus) handleUpdateTask({ status_id: reviewStatus.id });
                                }}
                                className="primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <CheckCircle size={18} /> ОТПРАВИТЬ НА ПРОВЕРКУ
                            </button>
                        )}
                        {(task.task_status?.name.includes('TODO') && isAssigned) && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    const progressStatus = taskStatuses.find(s => s.name.includes('IN PROGRESS'));
                                    if (progressStatus) handleUpdateTask({ status_id: progressStatus.id });
                                }}
                                className="primary"
                            >
                                НАЧАТЬ РАБОТУ
                            </button>
                        )}
                    </div>
                </div>
            </form>
            {uploading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexDirection: 'column', gap: '20px', backdropFilter: 'blur(4px)' }}>
                    <div className="spinner" style={{ width: '50px', height: '50px' }}></div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontWeight: 800, fontSize: '1.2rem', margin: 0 }}>Загрузка файлов</p>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', margin: '4px 0 0' }}>Подождите, пожалуйста...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskDetailModal;
