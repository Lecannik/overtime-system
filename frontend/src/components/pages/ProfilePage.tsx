import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  User as UserIcon,
  Mail,
  Building2,
  Bell,
  ShieldCheck,
  Key,
  Send,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Lock,
  ChevronRight
} from 'lucide-react';
import { updateMyProfile, changePassword, setup2FA, enable2FA, disable2FA } from '../../services/api';
import { ROLE_LABELS, PERMISSION_LABELS } from '../../constants/translations';

const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();

  // Состояния для форм
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    telegram_chat_id: user?.telegram_chat_id || '',
  });

  const [passData, setPassData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // 2FA States
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [preferredMethod, setPreferredMethod] = useState<'email' | 'totp'>(user?.two_fa_method || 'email');

  // Обновляем форму при изменении юзера
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name,
        email: user.email,
        telegram_chat_id: user.telegram_chat_id || '',
      });
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await updateMyProfile(formData);
      await refreshUser();
      setMessage({ type: 'success', text: 'Профиль успешно обновлен' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Ошибка при обновлении профиля' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passData.new_password !== passData.confirm_password) {
      setMessage({ type: 'error', text: 'Пароли не совпадают' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await changePassword(passData.old_password, passData.new_password);
      setPassData({ old_password: '', new_password: '', confirm_password: '' });
      setMessage({ type: 'success', text: 'Пароль успешно изменен' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Ошибка при смене пароля' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetup2FA = async () => {
    setLoading(true);
    try {
      const data = await setup2FA();
      setQrData(data.qr_code);
      setShow2FASetup(true);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Ошибка инициализации 2FA' });
    } finally {
      setLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    setLoading(true);
    try {
      // При включении TOTP мы также обновляем two_fa_method на бэкенде
      await updateMyProfile({ two_fa_method: 'totp' });
      await enable2FA(totpCode);
      await refreshUser();
      setShow2FASetup(false);
      setTotpCode('');
      setMessage({ type: 'success', text: 'Аутентификация через приложение включена!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Неверный код подтверждения' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmail2FA = async () => {
    setLoading(true);
    try {
      const isEnabling = !user?.is_2fa_enabled || user?.two_fa_method !== 'email';
      await updateMyProfile({
        is_2fa_enabled: isEnabling,
        two_fa_method: 'email'
      });
      await refreshUser();
      setMessage({ type: 'success', text: isEnabling ? 'Email 2FA включена!' : '2FA отключена' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Ошибка изменения настроек 2FA' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!window.confirm('Вы уверены, что хотите отключить 2FA? Это снизит безопасность аккаунта.')) return;
    setLoading(true);
    try {
      await disable2FA();
      await refreshUser();
      setMessage({ type: 'success', text: '2FA отключена' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Ошибка при отключении 2FA' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNotify = async () => {
    const nextLevel = user?.notification_level === 0 ? 2 : 0;
    setLoading(true);
    try {
      await updateMyProfile({ notification_level: nextLevel });
      await refreshUser();
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка изменения настроек уведомлений' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>

      {/* HEADER WITH ALERTS */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.04em', margin: 0, color: 'var(--text-primary)' }}>
            Личный кабинет
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '6px' }}>
            Персональные настройки и права доступа в системе.
          </p>
        </div>
        {message && (
          <div className="animate-slide-up" style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 24px', borderRadius: '18px',
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            color: message.type === 'success' ? '#10b981' : '#ef4444',
            border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            fontWeight: 700, boxShadow: '0 8px 20px -8px rgba(0,0,0,0.1)'
          }}>
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            {message.text}
          </div>
        )}
      </div>

      {/* TOP ROW: PERSONAL CARD & SECURITY SETUP */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>

        {/* User Brand Card */}
        <div className="glass-card" style={{ padding: '32px', display: 'flex', gap: '32px', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '150px', height: '150px', background: 'var(--accent)', filter: 'blur(100px)', opacity: 0.1 }}></div>

          <div style={{
            width: '120px', height: '120px', borderRadius: '42px',
            background: 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
            border: '1px solid var(--border)', boxShadow: '0 15px 35px -10px rgba(0,0,0,0.2)'
          }}>
            <UserIcon size={56} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <span style={{
                padding: '4px 12px', background: 'rgba(59, 130, 246, 0.1)',
                color: 'var(--accent)', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                {ROLE_LABELS[user?.role || 'employee'] || user?.role}
              </span>
              <span style={{
                padding: '4px 12px', background: user?.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: user?.is_active ? '#10b981' : '#ef4444', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase'
              }}>
                {user?.is_active ? 'Активен' : 'Заблокирован'}
              </span>
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '12px', letterSpacing: '-0.02em' }}>{user?.full_name}</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Должность:</span>
              <span style={{ fontWeight: 600 }}>{user?.position_name || '—'}</span>
              <span style={{ color: 'var(--text-muted)' }}>Отдел:</span>
              <span style={{ fontWeight: 600 }}>{user?.department_name || '—'}</span>
            </div>
          </div>
        </div>

        {/* 2FA Section */}
        <div style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="icon-shape" style={{
                background: user?.is_2fa_enabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                color: user?.is_2fa_enabled ? '#10b981' : 'var(--text-muted)',
                width: '48px', height: '48px'
              }}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>Двухфакторная защита (2FA)</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {user?.is_2fa_enabled
                    ? `Активен метод: ${user?.two_fa_method === 'email' ? 'Email (Microsoft)' : 'Приложение (TOTP)'}`
                    : 'Дополнительная защита вашего аккаунта'}
                </div>
              </div>
            </div>
            {user?.is_2fa_enabled && (
              <button onClick={handleDisable2FA} className="secondary" style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '0.85rem' }}>Отключить</button>
            )}
          </div>

          {!user?.is_2fa_enabled && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <button
                onClick={handleToggleEmail2FA}
                className="glass-card hover-subtle"
                style={{ padding: '16px', textAlign: 'left', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Mail size={18} color="var(--accent)" />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Email Код</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Письмо с кодом через Microsoft Graph</p>
              </button>

              <button
                onClick={handleSetup2FA}
                className="glass-card hover-subtle"
                style={{ padding: '16px', textAlign: 'left', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Lock size={18} color="#10b981" />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Приложение</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Google или Microsoft Authenticator</p>
              </button>
            </div>
          )}

          {!user?.is_2fa_enabled && show2FASetup && qrData && (
            <div className="animate-fade-in" style={{ padding: '24px', background: 'var(--bg-tertiary)', borderRadius: '20px', border: '1px solid var(--accent-semi)' }}>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ background: 'white', padding: '10px', borderRadius: '12px' }}>
                  <img src={qrData} alt="2FA QR Code" style={{ width: '130px', height: '130px', display: 'block' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.85rem', marginBottom: '16px', lineHeight: 1.6 }}>
                    1. Отсканируйте код в <b>Google Authenticator</b> или <b>Microsoft Authenticator</b>.<br />
                    2. Введите 6-значный код из приложения ниже:
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      className="modern-input"
                      maxLength={6}
                      placeholder="000000"
                      style={{ width: '120px', textAlign: 'center', fontSize: '1.2rem', letterSpacing: '4px', fontWeight: 900 }}
                      value={totpCode}
                      onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    />
                    <button className="primary" onClick={handleEnable2FA} disabled={totpCode.length !== 6}>Подтвердить</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notifications Toggle */}
        <div style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="icon-shape" style={{ background: user?.notification_level !== 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.05)', color: user?.notification_level !== 0 ? 'var(--accent)' : 'var(--text-muted)', width: '48px', height: '48px' }}>
              <Bell size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>Уведомления</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>В Telegram и на электронную почту</div>
            </div>
          </div>
          <button
            onClick={handleToggleNotify}
            style={{
              width: '56px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', position: 'relative',
              background: user?.notification_level !== 0 ? 'var(--accent)' : 'var(--bg-tertiary)', transition: '0.3s'
            }}
          >
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%', background: 'white', position: 'absolute', top: '4px',
              left: user?.notification_level !== 0 ? '32px' : '4px', transition: '0.3s'
            }}></div>
          </button>
        </div>
      </div>

      {/* BOTTOM ROW: EDIT FORM & PERMISSIONS LIST */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>

        {/* Main Edit Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <div className="icon-shape" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent)', width: '44px', height: '44px' }}>
                <UserIcon size={22} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Личные данные</h3>
            </div>

            <form onSubmit={handleUpdateProfile}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="label">Полное имя (ФИО)</label>
                <input
                  className="modern-input"
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Иван Иванович Иванов"
                  required
                  style={{ height: '54px', fontSize: '1rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div className="form-group">
                  <label className="label">E-mail</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      className="modern-input"
                      style={{ paddingLeft: '48px', height: '54px' }}
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      required
                      type="email"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Telegram Chat ID</label>
                  <div style={{ position: 'relative' }}>
                    <Send size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#0088cc' }} />
                    <input
                      className="modern-input"
                      style={{ paddingLeft: '48px', height: '54px' }}
                      value={formData.telegram_chat_id}
                      onChange={e => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <button type="submit" className="primary" disabled={loading} style={{ height: '54px', padding: '0 32px', fontWeight: 700 }}>
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} style={{ marginRight: '10px' }} />}
                Сохранить профиль
              </button>
            </form>
          </div>

          {/* Symmetrical Password Card (below Info) */}
          <div className="glass-card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
              <div className="icon-shape" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', width: '40px', height: '40px' }}>
                <Key size={18} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Смена пароля</h3>
            </div>
            <form onSubmit={handleChangePassword}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <input className="modern-input" type="password" value={passData.old_password} onChange={e => setPassData({ ...passData, old_password: e.target.value })} placeholder="Старый пароль" required />
                <input className="modern-input" type="password" value={passData.new_password} onChange={e => setPassData({ ...passData, new_password: e.target.value })} placeholder="Новый пароль" required />
                <input className="modern-input" type="password" value={passData.confirm_password} onChange={e => setPassData({ ...passData, confirm_password: e.target.value })} placeholder="Повтор" required />
              </div>
              <button type="submit" className="secondary" disabled={loading} style={{ borderColor: 'var(--border)' }}>Обновить безопасность</button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: PERMISSIONS LIST */}
        <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div className="icon-shape" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', width: '44px', height: '44px' }}>
              <Lock size={20} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Ваши права доступа</h3>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
            Перечень активных разрешений, определенных вашей ролью и должностью в компании.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '500px', paddingRight: '8px' }}>
            {user?.permissions && user.permissions.length > 0 ? (
              user.permissions.map((perm) => (
                <div key={perm} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px',
                  background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)',
                  transition: 'all 0.2s', cursor: 'default'
                }}
                  className="hover-subtle">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }}></div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{PERMISSION_LABELS[perm] || perm}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{perm}</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" opacity={0.5} />
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '20px', border: '1px dashed rgba(239, 68, 68, 0.2)' }}>
                <AlertCircle size={32} color="#ef4444" style={{ marginBottom: '12px' }} />
                <div style={{ fontWeight: 700, color: '#ef4444' }}>Права не обнаружены</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Обратитесь к администратору для назначения полномочий.</p>
              </div>
            )}

            {user?.role === 'admin' && (
              <div style={{
                marginTop: '10px', padding: '14px 18px',
                background: 'rgba(16, 185, 129, 0.05)', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ShieldCheck size={20} color="#10b981" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>Права суперпользователя</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>Вам доступны все системные модули без ограничений.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
