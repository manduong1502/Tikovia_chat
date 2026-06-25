import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiCamera, FiEye, FiEyeOff, FiUser, FiLock, FiBell, FiChevronLeft, FiLogOut } from 'react-icons/fi';
import Avatar from './Avatar';

export default function ProfileView({ 
  user, 
  token, 
  onClose, 
  onProfileUpdate, 
  pushStatus, 
  onEnablePush,
  mobileActiveView
}) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const avatarFileInputRef = useRef(null);

  // Đồng bộ lại state khi prop user thay đổi (đặc biệt khi SWR load xong bản mới nhất từ server)
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setPhone(user.phone || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  // Tự động tắt thông báo toast sau 3 giây
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);
  
  // Password states
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Active section for desktop dashboard layout: 'info', 'security', 'notifications'
  const [activeSection, setActiveSection] = useState('info');

  const getPermissionText = (status) => {
    switch (status) {
      case 'granted': return 'Đã bật thông báo';
      case 'prompt': return 'Chưa kích hoạt';
      case 'denied': return 'Bị chặn bởi trình duyệt';
      case 'unsupported': return 'Thiết bị không hỗ trợ';
      case 'insecure': return 'Không bảo mật (Cần HTTPS)';
      case 'checking': return 'Đang kiểm tra...';
      default: return 'Không xác định';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'granted': return '#10b981';
      case 'prompt': return '#f59e0b';
      case 'denied': return '#ef4444';
      case 'unsupported':
      case 'insecure': return '#ef4444';
      default: return 'var(--text-secondary)';
    }
  };

  const shouldShowButton = (status) => {
    return status === 'prompt' || status === 'granted';
  };

  const getHelpText = (status) => {
    switch (status) {
      case 'insecure':
        return '⚠️ Tính năng thông báo đẩy yêu cầu kết nối HTTPS bảo mật. Vui lòng thiết lập SSL/HTTPS cho tên miền của bạn để kích hoạt.';
      case 'unsupported':
        return '⚠️ Thiết bị hoặc trình duyệt này không hỗ trợ Push API. Hãy đảm bảo bạn đã cài đặt ứng dụng vào màn hình chính (Add to Home Screen) trên iOS/Android.';
      case 'denied':
        return '❌ Quyền thông báo đang bị từ chối. Hãy mở cài đặt trình duyệt hoặc cài đặt ứng dụng trên điện thoại để cấp quyền thông báo.';
      case 'granted':
        return '✅ Thiết bị này đã đăng ký nhận thông báo đẩy thành công. Bạn sẽ nhận được chuông/rung khi có tin nhắn/cuộc gọi mới kể cả khi đóng ứng dụng.';
      case 'prompt':
      default:
        return '💡 Bật thông báo đẩy để nhận tin nhắn mới và cuộc gọi đến ngay tức thì khi ứng dụng đang đóng hoặc chạy nền.';
    }
  };

  const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') + '/auth/profile';
  const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').endsWith('/api')
    ? (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').slice(0, -4)
    : (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const payload = {
      displayName,
      phone,
      avatarUrl
    };

    if (password && newPassword) {
      payload.password = password;
      payload.newPassword = newPassword;
    }

    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Lỗi cập nhật trang cá nhân');
      }

      localStorage.setItem('chat_user', JSON.stringify(data.user));
      onProfileUpdate(data.user);
      setSuccess('Cập nhật thông tin trang cá nhân thành công!');
      
      setPassword('');
      setNewPassword('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRandomAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    const newAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${randomSeed}`;
    setAvatarUrl(newAvatar);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      setError('');
      setSuccess('Đang tải ảnh lên...');
      
      const res = await fetch(`${BASE_URL}/api/chat/upload?local=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) throw new Error('Không thể tải ảnh lên server');

      const data = await res.json();
      const fullUrl = `${BASE_URL}${data.url}`;
      setAvatarUrl(fullUrl);
      setError(''); // Clear error
      setSuccess('Tải ảnh đại diện lên thành công! Đang tự động lưu...');

      const saveRes = await fetch(API_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName,
          phone,
          avatarUrl: fullUrl
        })
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error || 'Lỗi cập nhật ảnh đại diện mới');
      }

      localStorage.setItem('chat_user', JSON.stringify(saveData.user));
      onProfileUpdate(saveData.user);
      setError(''); // Clear error
      setSuccess('Cập nhật ảnh đại diện thành công!');
    } catch (err) {
      setError(err.message || 'Lỗi khi upload và lưu ảnh đại diện');
      setSuccess(''); // Clear success on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container} className="anim-fade scroll-optimized">
      {/* Background Floating Blobs */}
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>

      {/* Toast Alert */}
      {(error || success) && (
        <div style={styles.toastContainer} className="anim-scale-in">
          <div style={error ? styles.errorToast : styles.successToast}>
            <span>{error || success}</span>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="profile-header-bar glass">
        <h3 className="profile-header-title">Trang cá nhân của bạn</h3>
        <button onClick={onClose} className="profile-close-btn btn-interactive" title="Đóng">
          <FiX size={20} />
        </button>
      </div>

      <div className="profile-dashboard-wrapper">
        {/* Left Card: Summary Profile Card */}
        <div className="glass-card profile-left-card">
          <div style={styles.avatarEditContainer}>
            <div style={styles.avatarBorderGlow}>
              <Avatar url={avatarUrl} name={displayName || user.displayName || user.username} size={110} />
            </div>
            <div style={styles.avatarButtons}>
              <button type="button" onClick={handleRandomAvatar} style={styles.avatarActionBtn} className="btn-interactive" title="Tạo avatar ngẫu nhiên">
                <FiCamera size={14} />
                <span>Ngẫu nhiên</span>
              </button>
              <button type="button" onClick={() => avatarFileInputRef.current?.click()} style={styles.avatarActionBtn} className="btn-interactive" title="Tải ảnh lên">
                <span>📤</span>
                <span>Tải ảnh</span>
              </button>
            </div>
            <input 
              type="file" 
              ref={avatarFileInputRef} 
              onChange={handleAvatarUpload} 
              accept="image/*" 
              style={{ display: 'none' }} 
            />
          </div>

          <div style={styles.userMeta}>
            <h2 style={styles.metaName}>{displayName || user.displayName}</h2>
            <span style={styles.metaUsername}>@{user.username}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Bản cập nhật: v1.2.0</span>
            {phone && <span style={styles.metaPhone}>📞 {phone}</span>}
          </div>

          {/* Desktop tabs/navigation inside the card */}
          <div className="profile-desktop-tabs">
            <button 
              onClick={() => setActiveSection('info')} 
              style={{...styles.desktopTabBtn, ...(activeSection === 'info' ? styles.desktopTabBtnActive : {})}}
              className="btn-interactive"
            >
              <FiUser size={18} />
              <span>Thông tin tài khoản</span>
            </button>
            <button 
              onClick={() => setActiveSection('security')} 
              style={{...styles.desktopTabBtn, ...(activeSection === 'security' ? styles.desktopTabBtnActive : {})}}
              className="btn-interactive"
            >
              <FiLock size={18} />
              <span>Đổi mật khẩu</span>
            </button>
            <button 
              onClick={() => setActiveSection('notifications')} 
              style={{...styles.desktopTabBtn, ...(activeSection === 'notifications' ? styles.desktopTabBtnActive : {})}}
              className="btn-interactive"
            >
              <FiBell size={18} />
              <span>Thông báo điện thoại</span>
            </button>
          </div>
        </div>

        {/* Right Area: Detailed Forms */}
        <div className="profile-right-content">

          <form onSubmit={handleSave} style={styles.formContainer}>
            {/* Section 1: Personal Info */}
            {(activeSection === 'info' || mobileActiveView === 'profile') && (
              <div style={styles.sectionCard} className="glass-card">
                <div style={styles.sectionHeader}>
                  <FiUser size={20} style={{ color: 'var(--primary)' }} />
                  <h3>Thông tin tài khoản</h3>
                </div>
                
                <div style={styles.formGrid}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Tên tài khoản (Không thể sửa)</label>
                    <input type="text" value={user.username} disabled className="input-premium" style={styles.disabledInput} />
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Tên hiển thị</label>
                    <input 
                      type="text" 
                      required 
                      value={displayName} 
                      onChange={(e) => setDisplayName(e.target.value)} 
                      placeholder="Nhập tên hiển thị..." 
                      className="input-premium"
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Số điện thoại liên hệ</label>
                    <input 
                      type="text" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                      placeholder="Nhập số điện thoại..." 
                      className="input-premium"
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Đường dẫn ảnh đại diện (Avatar URL)</label>
                    <input 
                      type="text" 
                      value={avatarUrl} 
                      onChange={(e) => setAvatarUrl(e.target.value)} 
                      placeholder="https://..." 
                      className="input-premium"
                      style={styles.input}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Security & Password */}
            {(activeSection === 'security' || mobileActiveView === 'profile') && (
              <div style={styles.sectionCard} className="glass-card">
                <div style={styles.sectionHeader}>
                  <FiLock size={20} style={{ color: 'var(--primary)' }} />
                  <h3>Bảo mật & Thay đổi mật khẩu</h3>
                </div>

                <div style={styles.formGrid}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Mật khẩu hiện tại</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type={showOldPassword ? 'text' : 'password'} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="Nhập mật khẩu cũ..." 
                        className="input-premium"
                        style={{ ...styles.input, width: '100%', paddingRight: '44px' }} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        style={styles.eyeBtn}
                        className="btn-interactive"
                      >
                        {showOldPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Mật khẩu mới</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type={showNewPassword ? 'text' : 'password'} 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        placeholder="Nhập mật khẩu mới..." 
                        className="input-premium"
                        style={{ ...styles.input, width: '100%', paddingRight: '44px' }} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        style={styles.eyeBtn}
                        className="btn-interactive"
                      >
                        {showNewPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Notification settings */}
            {(activeSection === 'notifications' || mobileActiveView === 'profile') && (
              <div style={styles.sectionCard} className="glass-card">
                <div style={styles.sectionHeader}>
                  <FiBell size={20} style={{ color: 'var(--primary)' }} />
                  <h3>Cấu hình nhận thông báo điện thoại</h3>
                </div>

                <div style={styles.notificationWrapper}>
                  <div style={styles.notificationStatusRow}>
                    <span style={styles.statusLabel}>
                      Trạng thái hiện tại: <strong style={{ color: getStatusColor(pushStatus) }}>{getPermissionText(pushStatus)}</strong>
                    </span>
                    {shouldShowButton(pushStatus) && (
                      <button 
                        type="button" 
                        onClick={onEnablePush}
                        style={styles.enablePushBtn}
                        className="btn-interactive"
                      >
                        {pushStatus === 'granted' ? 'Đăng ký lại' : 'Bật thông báo'}
                      </button>
                    )}
                  </div>
                  <p style={styles.notificationHelpText}>
                    {getHelpText(pushStatus)}
                  </p>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div style={styles.actionButtons}>
              <button type="submit" disabled={loading} style={styles.submitBtn} className="btn-interactive">
                {loading ? 'Đang cập nhật...' : 'Lưu tất cả thay đổi'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
    backgroundColor: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    overflowAnchor: 'none'
  },
  toastContainer: {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    width: '90%',
    maxWidth: '400px',
    display: 'flex',
    justifyContent: 'center'
  },
  errorToast: {
    padding: '12px 20px',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    borderRadius: '16px',
    fontSize: '0.88rem',
    fontWeight: '600',
    boxShadow: '0 10px 25px rgba(239, 68, 68, 0.3)',
    textAlign: 'center',
    width: '100%'
  },
  successToast: {
    padding: '12px 20px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    borderRadius: '16px',
    fontSize: '0.88rem',
    fontWeight: '600',
    boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)',
    textAlign: 'center',
    width: '100%'
  },
  // Header styles are now handled by CSS classes (.profile-header-bar and .profile-close-btn)
  // Layout styles are now handled by CSS classes (.profile-dashboard-wrapper and .profile-left-card)
  avatarEditContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px'
  },
  avatarBorderGlow: {
    position: 'relative',
    borderRadius: '50%',
    padding: '4px',
    background: 'var(--primary-gradient)',
    boxShadow: '0 0 24px var(--border-glow)'
  },
  avatarButtons: {
    display: 'flex',
    gap: '8px'
  },
  avatarActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    cursor: 'pointer'
  },
  userMeta: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  metaName: {
    fontSize: '1.3rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '4px'
  },
  metaUsername: {
    fontSize: '0.85rem',
    color: 'var(--primary)',
    fontWeight: '600',
    display: 'block',
    marginBottom: '6px'
  },
  metaPhone: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)'
  },
  // Tab styles are now handled by CSS class (.profile-desktop-tabs)
  desktopTabBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'none',
    border: '1px solid transparent',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.88rem',
    fontWeight: '600',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s var(--transition-spring)'
  },
  desktopTabBtnActive: {
    background: 'rgba(99, 102, 241, 0.08)',
    borderColor: 'rgba(99, 102, 241, 0.15)',
    color: 'var(--primary)'
  },
  // Right content styles are now handled by CSS class (.profile-right-content)
  errorAlert: {
    padding: '12px 16px',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    border: '1px solid rgba(244, 63, 94, 0.25)',
    borderRadius: '12px',
    color: 'var(--danger)',
    fontSize: '0.85rem',
    fontWeight: '500'
  },
  successAlert: {
    padding: '12px 16px',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    borderRadius: '12px',
    color: 'var(--secondary)',
    fontSize: '0.85rem',
    fontWeight: '500'
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  sectionCard: {
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '12px',
    'h3': {
      fontSize: '1rem',
      fontWeight: '700',
      color: 'var(--text-primary)',
      margin: 0
    }
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '20px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-secondary)'
  },
  input: {
    padding: '10px 12px',
    fontSize: '0.88rem'
  },
  disabledInput: {
    padding: '10px 12px',
    fontSize: '0.88rem',
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px'
  },
  notificationWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  notificationStatusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statusLabel: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)'
  },
  enablePushBtn: {
    padding: '8px 16px',
    fontSize: '0.78rem',
    fontWeight: '600',
    color: '#ffffff',
    background: 'var(--primary-gradient)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer'
  },
  notificationHelpText: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    lineHeight: '1.3rem',
    margin: 0
  },
  actionButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '10px'
  },
  submitBtn: {
    padding: '12px 24px',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#ffffff',
    background: 'var(--primary-gradient)',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.25)'
  }
};
