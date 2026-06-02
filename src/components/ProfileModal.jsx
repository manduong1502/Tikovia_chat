import React, { useState, useRef } from 'react';
import { FiX, FiCamera, FiEye, FiEyeOff } from 'react-icons/fi';

export default function ProfileModal({ user, token, onClose, onProfileUpdate }) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const avatarFileInputRef = useRef(null);
  
  // Password states
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

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

      // Lưu lại thông tin mới vào LocalStorage
      localStorage.setItem('chat_user', JSON.stringify(data.user));
      
      onProfileUpdate(data.user);
      setSuccess('Cập nhật thông tin trang cá nhân thành công!');
      
      // Reset password fields
      setPassword('');
      setNewPassword('');

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Tạo ngẫu nhiên Dicebear Avatar
  const handleRandomAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    const newAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${randomSeed}`;
    setAvatarUrl(newAvatar);
  };

  // Upload hình ảnh từ máy tính để làm avatar
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const res = await fetch(`${BASE_URL}/api/chat/upload`, {
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
      setSuccess('Tải ảnh đại diện lên thành công!');
    } catch (err) {
      setError(err.message || 'Lỗi khi upload ảnh');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modalContent} className="glass-card anim-scale-in profile-modal-content">
        <div style={styles.header}>
          <h3>Cập nhật Trang cá nhân</h3>
          <button onClick={onClose} style={styles.closeBtn}><FiX size={20} /></button>
        </div>

        {error && <div style={styles.errorAlert}>{error}</div>}
        {success && <div style={styles.successAlert}>{success}</div>}

        <form onSubmit={handleSave} style={styles.form}>
          {/* Avatar Edit preview */}
          <div style={styles.avatarContainer}>
            <img src={avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username || user.id || 'user'}`} alt="Avatar" style={styles.avatarPreview} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={handleRandomAvatar} style={styles.randomAvatarBtn} title="Tạo avatar ngẫu nhiên">
                <FiCamera size={16} />
                <span>Ngẫu nhiên</span>
              </button>
              <button type="button" onClick={() => avatarFileInputRef.current?.click()} style={styles.randomAvatarBtn} title="Tải ảnh từ máy tính">
                <span style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>📤</span>
                <span>Tải ảnh lên</span>
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

          <div style={styles.inputGroup}>
            <label style={styles.label}>Tên tài khoản (Không thể sửa)</label>
            <input type="text" value={user.username} disabled style={{...styles.input, opacity: 0.5, cursor: 'not-allowed'}} />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Tên hiển thị mới</label>
            <input 
              type="text" 
              required 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)} 
              placeholder="Nhập tên hiển thị..." 
              style={styles.input} 
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Số điện thoại</label>
            <input 
              type="text" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              placeholder="Nhập số điện thoại mới..." 
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
              style={styles.input} 
            />
          </div>

          <div style={{...styles.passwordSection, borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '10px'}}>
            <h4 style={{fontSize: '0.85rem', marginBottom: '10px', color: 'var(--accent)'}}>Thay đổi mật khẩu (Không bắt buộc)</h4>
            
            <div style={{...styles.inputGroup, marginBottom: '12px'}}>
              <label style={styles.label}>Mật khẩu hiện tại</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type={showOldPassword ? 'text' : 'password'} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Nhập mật khẩu cũ..." 
                  style={{ ...styles.input, width: '100%', paddingRight: '44px' }} 
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  style={styles.eyeBtn}
                  title={showOldPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
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
                  style={{ ...styles.input, width: '100%', paddingRight: '44px' }} 
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={styles.eyeBtn}
                  title={showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showNewPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div style={styles.footer}>
            <button type="button" onClick={onClose} style={styles.btnSecondary}>Hủy bỏ</button>
            <button type="submit" disabled={loading} style={styles.btnPrimary}>
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200
  },
  modalContent: {
    width: '420px',
    padding: '24px',
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '10px'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  avatarContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px'
  },
  avatarPreview: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid var(--primary)'
  },
  randomAvatarBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    padding: '5px 12px',
    borderRadius: '16px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    ':hover': {
      background: 'rgba(255,255,255,0.1)'
    }
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  label: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    fontWeight: '600'
  },
  input: {
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none'
  },
  errorAlert: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    padding: '10px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    marginBottom: '15px',
    textAlign: 'center'
  },
  successAlert: {
    background: 'rgba(34, 197, 94, 0.15)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    color: '#4ade80',
    padding: '10px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    marginBottom: '15px',
    textAlign: 'center'
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px'
  },
  btnPrimary: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--primary-gradient)',
    color: 'white',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer'
  },
  btnSecondary: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    fontWeight: '600',
    cursor: 'pointer'
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
    padding: '4px',
    zIndex: 2,
  }
};
