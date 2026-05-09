import React, { useEffect, useState, useCallback } from 'react';
import { getOvertimes, reviewOvertime } from '../../services/api';
import LoadingOverlay from '../atoms/LoadingOverlay';
import ReviewModal from '../modals/ReviewModal';
import { Check, Clock, User, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const ReviewPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Получаем заявки, требующие согласования именно этим пользователем
      // Бэкенд сам отфильтрует по роли (Manager/Head/Admin)
      const data = await getOvertimes({ status: 'PENDING' });
      setItems(data.items || data);
    } catch (err) {
      console.error('Failed to fetch review items:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReviewAction = async (id: number, approved: boolean, comment: string, approvedHours?: number) => {
    // Для администратора можно добавить выбор роли (as_role), но по умолчанию берем текущую
    await reviewOvertime(id, approved, comment, undefined, approvedHours);
    fetchData();
  };

  const handleOpenReview = (item: any) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  if (loading && !items.length) return <LoadingOverlay />;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Согласование</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
          Список переработок, ожидающих вашего решения.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {items.length === 0 ? (
          <div className="glass-card" style={{
            textAlign: 'center',
            padding: '80px 48px',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'var(--bg-tertiary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Check size={32} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Всё согласовано!</p>
              <p style={{ marginTop: '4px' }}>На данный момент новых заявок нет.</p>
            </div>
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              className="glass-card table-row-hover"
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: '24px',
                alignItems: 'center',
                padding: '20px 24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => handleOpenReview(item)}
            >
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px',
                background: 'var(--bg-tertiary)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)',
                color: 'var(--accent)'
              }}>
                <User size={24} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{item.user?.full_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
                    {item.user?.department_name || 'Без отдела'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    <Clock size={16} color="var(--accent)" />
                    {item.hours}ч
                    {item.project && (
                      <Link
                        to={`/projects/${item.project.id}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="hover-link" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>
                          ({item.project.name})
                        </span>
                      </Link>
                    )}
                    {!item.project && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>
                        (Внутренний)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                    {item.description}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  className="btn-secondary"
                  style={{
                    padding: '10px 16px',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  ПРОВЕРИТЬ <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <ReviewModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchData}
          item={selectedItem}
          onAction={handleReviewAction}
        />
      )}
    </div>
  );
};

export default ReviewPage;
