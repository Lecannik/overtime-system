import React, { useEffect, useState } from 'react';
import {
  getDepartmentTree, createDepartment, updateDepartment, deleteDepartment,
  getRoles, getUsersList, getJobPositionsHierarchy,
  createJobPosition, updateJobPosition, deleteJobPosition
} from '../../services/api';
import LoadingOverlay from '../atoms/LoadingOverlay';
import { ChevronRight, ChevronDown, Plus, Edit2, Users, Building, Briefcase, Trash2 } from 'lucide-react';

interface DeptNodeProps {
  dept: any;
  level: number;
  onEdit: (dept: any) => void;
  onAddSub: (parent: any) => void;
  onDelete: (id: number) => void;
}

const DeptNode: React.FC<DeptNodeProps> = ({ dept, level, onEdit, onAddSub, onDelete }) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasSubs = dept.sub_departments && dept.sub_departments.length > 0;

  return (
    <div style={{ marginLeft: level * 24 }}>
      <div className="glass-card" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        marginBottom: '8px',
        borderLeft: `4px solid ${level === 0 ? 'var(--accent)' : 'var(--border)'}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {hasSubs ? (
            <button onClick={() => setIsOpen(!isOpen)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
          ) : <div style={{ width: 18 }} />}
          <Building size={18} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{dept.name}</span>
          {dept.manager && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '8px' }}>
              Руководитель: {dept.manager.full_name}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onAddSub(dept)} title="Добавить подотдел" style={{ color: 'var(--accent)', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
            <Plus size={16} />
          </button>
          <button onClick={() => onEdit(dept)} title="Редактировать" style={{ color: 'var(--text-primary)', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
            <Edit2 size={16} />
          </button>
          <button onClick={() => onDelete(dept.id)} title="Удалить отдел" style={{ color: 'var(--error)', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {isOpen && hasSubs && dept.sub_departments.map((sub: any) => (
        <DeptNode key={sub.id} dept={sub} level={level + 1} onEdit={onEdit} onAddSub={onAddSub} onDelete={onDelete} />
      ))}
    </div>
  );
};

interface PositionNodeProps {
  pos: any;
  level: number;
  onEdit: (pos: any) => void;
  onAddSub: (parent: any) => void;
  onDelete: (id: number) => void;
}

const PositionNode: React.FC<PositionNodeProps> = ({ pos, level, onEdit, onAddSub, onDelete }) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasSubs = pos.sub_positions && pos.sub_positions.length > 0;
  const hasUsers = pos.users && pos.users.length > 0;

  return (
    <div style={{ marginLeft: level * 24 }}>
      <div className="glass-card" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        marginBottom: '8px',
        borderLeft: `4px solid ${level === 0 ? 'var(--accent)' : 'var(--text-muted)'}`,
        background: 'var(--bg-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {hasSubs ? (
            <button onClick={() => setIsOpen(!isOpen)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
          ) : <div style={{ width: 18 }} />}
          <Briefcase size={18} color="var(--text-secondary)" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{pos.name}</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {pos.department && (
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontStyle: 'italic' }}>
                  {pos.department.name}
                </span>
              )}
              {hasUsers && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {pos.users.map((u: any) => (
                    <span key={u.id} style={{ fontSize: '0.65rem', color: 'var(--accent)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: '4px' }}>
                      {u.full_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onAddSub(pos)} title="Добавить подчиненную должность" style={{ color: 'var(--accent)', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
            <Plus size={14} />
          </button>
          <button onClick={() => onEdit(pos)} title="Редактировать" style={{ color: 'var(--text-primary)', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
            <Edit2 size={14} />
          </button>
          <button onClick={() => onDelete(pos.id)} title="Удалить" style={{ color: 'var(--error)', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {isOpen && hasSubs && pos.sub_positions.map((sub: any) => (
        <PositionNode key={sub.id} pos={sub} level={level + 1} onEdit={onEdit} onAddSub={onAddSub} onDelete={onDelete} />
      ))}
    </div>
  );
};

const OrgStructurePage: React.FC = () => {
  const [tree, setTree] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [positionsTree, setPositionsTree] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'departments' | 'positions'>('departments');
  const [formData, setFormData] = useState({ name: '', parent_id: null as number | null, manager_id: '', department_id: null as number | null });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [treeData, rolesData, usersData, posData] = await Promise.all([
        getDepartmentTree(),
        getRoles(),
        getUsersList(),
        getJobPositionsHierarchy()
      ]);
      setTree(treeData);
      setRoles(rolesData);
      setUsers(usersData);
      setPositionsTree(posData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeTab === 'departments') {
        const data = {
          name: formData.name,
          parent_id: formData.parent_id,
          manager_id: formData.manager_id ? Number(formData.manager_id) : null
        };
        if (selectedItem && !formData.parent_id) {
          await updateDepartment(selectedItem.id, data);
        } else {
          await createDepartment(data);
        }
      } else {
        const data = {
          name: formData.name,
          parent_id: formData.parent_id,
          department_id: formData.department_id
        };
        if (selectedItem) {
          await updateJobPosition(selectedItem.id, data);
        } else {
          await createJobPosition(data);
        }
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert('Ошибка при сохранении');
    }
  };

  if (loading) return <LoadingOverlay />;

  return (
    <div className="animate-fade-in">
      {/* Header with Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Оргструктура</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Управление составом отделов и должностной иерархией.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="glass-card" style={{ display: 'flex', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => setActiveTab('departments')}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: activeTab === 'departments' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'departments' ? 'white' : 'var(--text-primary)',
                fontWeight: 600, fontSize: '0.85rem'
              }}
            >
              ОТДЕЛЫ
            </button>
            <button
              onClick={() => setActiveTab('positions')}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: activeTab === 'positions' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'positions' ? 'white' : 'var(--text-primary)',
                fontWeight: 600, fontSize: '0.85rem'
              }}
            >
              ДОЛЖНОСТИ
            </button>
          </div>
          <button className="primary" onClick={() => {
            setSelectedItem(null);
            setFormData({ name: '', parent_id: null, manager_id: '', department_id: null });
            setShowModal(true);
          }}>
            <Plus size={18} /> {activeTab === 'departments' ? 'СОЗДАТЬ ОТДЕЛ' : 'ДОБАВИТЬ ДОЛЖНОСТЬ'}
          </button>
        </div>
      </div>

      {/* Main View */}
      <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'departments' ? '1.5fr 1fr' : '1fr', gap: '32px' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '24px' }}>
            {activeTab === 'departments' ? 'Дерево отделов' : 'Иерархия должностей'}
          </h2>

          {activeTab === 'departments' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tree.map(dept => (
                <DeptNode
                  key={dept.id}
                  dept={dept}
                  level={0}
                  onEdit={(d) => {
                    setSelectedItem(d);
                    setFormData({ 
                      name: d.name, 
                      parent_id: null, 
                      manager_id: d.manager_id?.toString() || '',
                      department_id: null
                    });
                    setShowModal(true);
                  }}
                  onAddSub={(parent) => {
                    setSelectedItem(null);
                    setFormData({ 
                      name: '', 
                      parent_id: parent.id, 
                      manager_id: '',
                      department_id: null
                    });
                    setShowModal(true);
                  }}
                  onDelete={async (id) => {
                    if (window.confirm('Удалить отдел? Все подотделы также будут удалены.')) {
                      await deleteDepartment(id);
                      fetchData();
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {positionsTree.map(pos => (
                <PositionNode
                  key={pos.id}
                  pos={pos}
                  level={0}
                  onEdit={(p) => {
                    setSelectedItem(p);
                    setFormData({ 
                      name: p.name, 
                      parent_id: p.parent_id, 
                      manager_id: '', 
                      department_id: p.department_id 
                    });
                    setShowModal(true);
                  }}
                  onAddSub={(parent) => {
                    setSelectedItem(null);
                    setFormData({ 
                      name: '', 
                      parent_id: parent.id, 
                      manager_id: '', 
                      department_id: parent.department_id 
                    });
                    setShowModal(true);
                  }}
                  onDelete={async (id) => {
                    if (window.confirm('Удалить должность? Сотрудники останутся без привязки.')) {
                      await deleteJobPosition(id);
                      fetchData();
                    }
                  }}
                />
              ))}
              {positionsTree.length === 0 && (
                <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Должности еще не созданы.
                </div>
              )}
            </div>
          )}
        </div>

        {activeTab === 'departments' && (
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '24px' }}>Системные роли</h2>
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
              {roles.map(role => (
                <div key={role.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <Users size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{role.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{role.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="glass-card" style={{ width: '400px', padding: '32px', borderRadius: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '24px' }}>
              {activeTab === 'departments'
                ? (formData.parent_id ? 'Новый подотдел' : (selectedItem ? 'Редактировать отдел' : 'Новый отдел'))
                : (formData.parent_id ? 'Новая подч. должность' : (selectedItem ? 'Редактировать должность' : 'Новая должность'))
              }
            </h2>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '16px' }}>
                <label className="label">Название {activeTab === 'departments' ? 'отдела' : 'должности'}</label>
                <input
                  className="modern-input"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder={activeTab === 'departments' ? 'Маркетинг' : 'Директор'}
                />
              </div>

              {activeTab === 'positions' && (
                <>
                <div style={{ marginBottom: '16px' }}>
                  <label className="label">Привязать к отделу</label>
                  <select
                    className="modern-input"
                    value={formData.department_id || ''}
                    onChange={e => setFormData({ ...formData, department_id: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">Без отдела</option>
                    {(() => {
                      const options: any[] = [];
                      const traverse = (depts: any[], level = 0) => {
                        depts.forEach(d => {
                          options.push(<option key={d.id} value={d.id}>{'\u00A0'.repeat(level * 2)}{d.name}</option>);
                          if (d.sub_departments) traverse(d.sub_departments, level + 1);
                        });
                      };
                      traverse(tree);
                      return options;
                    })()}
                  </select>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label className="label">Вышестоящая должность</label>
                  <select
                    className="modern-input"
                    value={formData.parent_id || ''}
                    onChange={e => setFormData({ ...formData, parent_id: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">Нет (Верхний уровень)</option>
                    {(() => {
                      const options: any[] = [];
                      const traversePos = (nodes: any[], level = 0) => {
                        nodes.forEach(n => {
                          if (n.id !== selectedItem?.id) {
                            options.push(<option key={n.id} value={n.id}>{'\u00A0'.repeat(level * 2)}{n.name}</option>);
                          }
                          if (n.sub_positions) traversePos(n.sub_positions, level + 1);
                        });
                      };
                      traversePos(positionsTree);
                      return options;
                    })()}
                  </select>
                </div>
                </>
              )}

              {activeTab === 'departments' && (
                <div style={{ marginBottom: '24px' }}>
                  <label className="label">Руководитель</label>
                  <select
                    className="modern-input"
                    value={formData.manager_id}
                    onChange={e => setFormData({ ...formData, manager_id: e.target.value })}
                  >
                    <option value="">Без руководителя</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ flex: 1 }}>Отмена</button>
                <button type="submit" className="primary" style={{ flex: 1 }}>Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgStructurePage;
