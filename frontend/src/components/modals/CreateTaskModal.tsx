import React, { useState, useEffect } from 'react';
import { FileUp, X } from 'lucide-react';
import { createTask, getTaskTypes, getTaskStatuses, getAssignableUsers, type TaskType } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface CreateTaskModalProps {
    projectId?: number;
    dealId?: number;
    leadId?: number;
    parentName: string;
    onClose: () => void;
    onSuccess: () => void;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ projectId, dealId, leadId, parentName, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [newTask, setNewTask] = useState({
        type_id: undefined as number | undefined,
        status_id: undefined as number | undefined,
        priority: 'MEDIUM',
        description: '',
        start_date: '',
        end_date: '',
        assigned_id: undefined as number | undefined,
        department_id: undefined as number | undefined
    });

    useEffect(() => {
        const init = async () => {
            const [types, statuses, usersData] = await Promise.all([
                getTaskTypes(),
                getTaskStatuses(),
                getAssignableUsers()
            ]);
            setTaskTypes(types);
            setUsers(Array.isArray(usersData) ? usersData : (usersData?.items || []));
            
            // Set defaults
            const todoStatus = statuses.find(s => s.name.includes('TODO'));
            setNewTask(prev => ({ 
                ...prev, 
                type_id: types.length > 0 ? types[0].id : undefined,
                status_id: todoStatus?.id
            }));

            // Extract departments from users for simplicity, or just leave it empty for backend to guess
        };
        init();
    }, []);

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);

        const selectedType = taskTypes.find(t => t.id === newTask.type_id);
        const typeName = selectedType?.name || 'Задача';
        const autoTitle = `${parentName} - ${typeName}`;

        try {
            const createdTask = await createTask({
                ...newTask,
                title: autoTitle,
                project_id: projectId || null,
                deal_id: dealId || null,
                lead_id: leadId || null,
                creator_id: user.id,
                start_date: newTask.start_date || null,
                deadline: newTask.end_date || null
            });

            if (selectedFiles && selectedFiles.length > 0) {
                for (let i = 0; i < selectedFiles.length; i++) {
                    const formData = new FormData();
                    formData.append('file', selectedFiles[i]);
                    await fetch(`/api/v1/tasks/${createdTask.id}/attachments`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                        body: formData
                    });
                }
            }

            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            alert('Ошибка при создании задачи');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
            <div className="glass-card animate-scale-in" style={{ width: '500px', padding: '32px', borderRadius: '24px', position: 'relative' }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', right: '24px', top: '24px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                    <X size={20} />
                </button>

                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '24px' }}>Новая задача</h2>
                <form onSubmit={handleCreateTask}>
                    <div style={{ marginBottom: '16px' }}>
                        <label className="label">Ответственный</label>
                        <select
                            className="modern-input"
                            value={newTask.assigned_id || ''}
                            onChange={e => setNewTask({ ...newTask, assigned_id: e.target.value ? Number(e.target.value) : undefined })}
                            style={{ width: '100%' }}
                        >
                            <option value="">Не назначен</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.full_name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label className="label">Тип задачи</label>
                            <select
                                className="modern-input"
                                value={newTask.type_id || ''}
                                onChange={e => setNewTask({ ...newTask, type_id: Number(e.target.value) })}
                                required
                            >
                                <option value="" disabled>Выберите тип...</option>
                                {taskTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="label">Приоритет</label>
                            <select
                                className="modern-input"
                                value={newTask.priority}
                                onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                            >
                                <option value="LOW">Низкий</option>
                                <option value="MEDIUM">Средний</option>
                                <option value="HIGH">Высокий</option>
                                <option value="CRITICAL">Критический</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label className="label">Дата начала</label>
                            <input
                                type="date"
                                className="modern-input"
                                value={newTask.start_date}
                                onChange={e => setNewTask({ ...newTask, start_date: e.target.value })}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="label">Дедлайн</label>
                            <input
                                type="date"
                                className="modern-input"
                                value={newTask.end_date}
                                onChange={e => setNewTask({ ...newTask, end_date: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label className="label">Описание</label>
                        <textarea
                            className="modern-input"
                            style={{ minHeight: '100px', resize: 'none' }}
                            value={newTask.description}
                            onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                            placeholder="Опишите детали задачи..."
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600 }}>
                            <FileUp size={18} />
                            {selectedFiles && selectedFiles.length > 0
                                ? `Выбрано файлов: ${selectedFiles.length}`
                                : 'Прикрепить файлы'}
                            <input
                                type="file"
                                multiple
                                style={{ display: 'none' }}
                                onChange={(e) => setSelectedFiles(e.target.files)}
                            />
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Отмена</button>
                        <button type="submit" className="primary" style={{ flex: 1 }} disabled={loading}>
                            {loading ? 'Создание...' : 'Создать'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateTaskModal;
