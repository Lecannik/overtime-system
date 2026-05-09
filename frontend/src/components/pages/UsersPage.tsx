import React, { useEffect, useState, useCallback } from 'react';
import { 
  UserPlus, Trash2, Shield, Mail, RefreshCw, Edit2, Cloud, Search, Filter, 
  ArrowUpDown, ChevronUp, ChevronDown, Building, Users as UsersIcon, 
  Briefcase, ShieldAlert, Settings
} from 'lucide-react';
import UserModal from '../modals/UserModal';
import ImportMSUsersModal from '../modals/ImportMSUsersModal';
import { deleteUser, resetUserPassword, resetUser2FA, getUsers, getDepartments, getRoles } from '../../services/api';
import type { User } from '../../types';
import { useColumnSettings } from '../../hooks/useColumnSettings';
import ColumnSettings from '../molecules/ColumnSettings';

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Фильтры и сортировка
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('full_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterCompany, setFilterCompany] = useState('');

  // Настройка колонок
  const USER_COLUMNS = [
    { id: 'full_name', label: 'Сотрудник' },
    { id: 'role', label: 'Роль' },
    { id: 'company', label: 'Предприятие' },
    { id: 'department', label: 'Отдел' },
    { id: 'position', label: 'Должность' },
    { id: 'status', label: 'Статус' },
  ];

  const colSettings = useColumnSettings('users_cols', USER_COLUMNS);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // Справочники
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);

  // Состояния пагинации
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchFilters = async () => {
    try {
      const [deptsData, rolesData] = await Promise.all([
        getDepartments(),
        getRoles()
      ]);
      setDepartments(deptsData);
      setRoles(rolesData);
    } catch (err) {
      console.error('Ошибка загрузки фильтров', err);
    }
  };

  const fetchData = useCallback(async (currentPage: number = page) => {
    try {
      setLoading(true);
      const data = await getUsers({
        page: currentPage,
        page_size: 15,
        search,
        sort_by: sortBy,
        sort_order: sortOrder,
        role: filterRole || undefined,
        department_id: filterDept ? parseInt(filterDept) : undefined,
        company: filterCompany || undefined
      });
      setUsers(data.items || []);
      setTotalPages(data.pages || 1);
      setPage(data.page || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortOrder, filterRole, filterDept, filterCompany]);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Удалить пользователя?')) {
      try {
        await deleteUser(id);
        fetchData(page);
      } catch (err) {
        alert('Ошибка при удалении');
      }
    }
  };

  const handleResetPassword = async (id: number) => {
    if (window.confirm('Сбросить пароль этого пользователя на "admin123"?')) {
      try {
        await resetUserPassword(id);
        alert('Пароль успешно сброшен на "admin123"');
      } catch (err) {
        alert('Ошибка при сбросе пароля');
      }
    }
  };

  const handleReset2FA = async (id: number) => {
    if (window.confirm('Сбросить 2FA этого пользователя? Это отключит защиту и позволит войти без кода.')) {
      try {
        await resetUser2FA(id);
        alert('2FA успешно отключена для пользователя');
        fetchData(page);
      } catch (err) {
        alert('Ошибка при сбросе 2FA');
      }
    }
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown size={14} style={{ opacity: 0.3, marginLeft: '6px' }} />;
    return sortOrder === 'asc' ? <ChevronUp size={14} style={{ marginLeft: '6px' }} /> : <ChevronDown size={14} style={{ marginLeft: '6px' }} />;
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Команда</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Управление доступом, ролями и структурой сотрудников.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              style={{
                width: '40px', height: '40px', borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                background: showColumnSettings ? 'var(--accent)' : 'var(--bg-secondary)',
                color: showColumnSettings ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border)',
                transition: 'all 0.3s'
              }}
              title="Настройка колонок"
            >
              <Settings size={20} className={showColumnSettings ? 'rotate-90' : ''} />
            </button>

            {showColumnSettings && (
              <ColumnSettings 
                columns={colSettings.columns}
                visibleColumnIds={colSettings.visibleColumnIds}
                onToggle={colSettings.toggleColumn}
                onReorder={colSettings.reorderColumns}
              />
            )}
          </div>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '10px 16px', borderRadius: '12px' }}
          >
            <Cloud size={18} /> ИМПОРТ ИЗ MICROSOFT 365
          </button>
          <button onClick={() => { setSelectedUser(null); setIsModalOpen(true); }} className="primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
            <UserPlus size={18} /> НОВЫЙ СОТРУДНИК
          </button>
        </div>
      </div>

      {/* Панель фильтров */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div style={{ flex: '1', minWidth: '250px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Поиск по имени или email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              value={filterRole}
              onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
              style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="">Все роли</option>
              {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>

          <select
            value={filterDept}
            onChange={(e) => { setFilterDept(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="">Все отделы</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <select
            value={filterCompany}
            onChange={(e) => { setFilterCompany(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="">Все компании</option>
            <option value="Polymedia">Polymedia</option>
            <option value="AJ_techCom">AJ_techCom</option>
          </select>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                {colSettings.activeColumns.map(col => (
                  <th 
                    key={col.id} 
                    onClick={() => (col.id === 'full_name' || col.id === 'role') ? toggleSort(col.id === 'full_name' ? 'full_name' : 'role') : undefined} 
                    style={{ padding: '16px', textAlign: 'left', cursor: (col.id === 'full_name' || col.id === 'role') ? 'pointer' : 'default' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {col.label}
                      {col.id === 'full_name' && <SortIcon field="full_name" />}
                      {col.id === 'role' && <SortIcon field="role" />}
                    </div>
                  </th>
                ))}
                <th style={{ padding: '16px', textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody style={{ color: 'var(--text-primary)' }}>
              {loading && users.length === 0 ? (
                <tr><td colSpan={colSettings.activeColumns.length + 1} style={{ padding: '40px', textAlign: 'center' }}>Загрузка...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={colSettings.activeColumns.length + 1} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Пользователи не найдены</td></tr>
              ) : (
                users.map((u: any) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="table-row-hover">
                    {colSettings.activeColumns.map(col => (
                      <td key={col.id} style={{ padding: '16px' }}>
                        {col.id === 'full_name' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, border: '1px solid var(--border)' }}>
                              {u.full_name[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Mail size={12} /> {u.email}
                              </div>
                            </div>
                          </div>
                        )}
                        {col.id === 'role' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                            <Shield size={14} color="var(--accent)" />
                            {u.role}
                          </div>
                        )}
                        {col.id === 'company' && (
                          <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Building size={14} color="var(--text-muted)" />
                            {u.company}
                          </div>
                        )}
                        {col.id === 'department' && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <UsersIcon size={14} color="var(--text-muted)" />
                            {u.department_name || '—'}
                          </div>
                        )}
                        {col.id === 'position' && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Briefcase size={12} />
                            {u.position_name || '—'}
                          </div>
                        )}
                        {col.id === 'status' && (
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: u.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: u.is_active ? '#10b981' : '#ef4444'
                          }}>
                            {u.is_active ? 'Активен' : 'Заблокирован'}
                          </span>
                        )}
                      </td>
                    ))}
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleEdit(u)}
                          title="Редактировать"
                          className="action-button-modern"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleResetPassword(u.id)}
                          title="Сбросить пароль"
                          className="action-button-modern"
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button
                          onClick={() => handleReset2FA(u.id)}
                          title="Сбросить 2FA"
                          className="action-button-modern"
                          style={{ color: u.is_2fa_enabled ? '#f59e0b' : 'var(--text-muted)', opacity: u.is_2fa_enabled ? 1 : 0.4 }}
                          disabled={!u.is_2fa_enabled}
                        >
                          <ShieldAlert size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          title="Удалить пользователя"
                          className="action-button-modern"
                          style={{ color: '#ef4444' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginTop: '32px' }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '8px 16px', opacity: page === 1 ? 0.5 : 1, cursor: page === 1 ? 'default' : 'pointer', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
          >
            Назад
          </button>
          <span style={{ fontWeight: 600 }}>
            Страница {page} из {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '8px 16px', opacity: page === totalPages ? 0.5 : 1, cursor: page === totalPages ? 'default' : 'pointer', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
          >
            Вперед
          </button>
        </div>
      )}

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
        editData={selectedUser}
      />
      <ImportMSUsersModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(count) => {
          alert(`Успешно импортировано ${count} пользователей`);
          fetchData();
        }}
      />
    </div>
  );
};

export default UsersPage;