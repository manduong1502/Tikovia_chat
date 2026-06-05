import React, { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

export default function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') + '/auth';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/login' : '/register';
    const payload = isLogin 
      ? { username, password }
      : { username, password, displayName, phone };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Có lỗi xảy ra, vui lòng thử lại');
      }

      localStorage.setItem('chat_token', data.token);
      localStorage.setItem('chat_user', JSON.stringify(data.user));
      onAuthSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Background Floating Blobs */}
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>
      <div className="bg-blob blob-3"></div>

      <div style={styles.authCard} className="glass-card anim-scale-in auth-card" key={isLogin ? 'login' : 'register'}>
        {/* Brand Logo Header */}
        <div style={styles.logoContainer}>
          <div style={styles.logoGlow}></div>
          <div style={{ zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: '#ffffff'}}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
        </div>

        <h2 style={styles.title}>{isLogin ? 'Đăng nhập ChatTikovia' : 'Đăng ký Tài khoản'}</h2>
        <p style={styles.subtitle}>
          {isLogin ? 'Ứng dụng chat nội bộ bảo mật của doanh nghiệp' : 'Điền thông tin của bạn để bắt đầu'}
        </p>

        {error && <div style={styles.errorAlert}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Tên đăng nhập</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập"
              className="input-premium"
              style={styles.input}
            />
          </div>

          {!isLogin && (
            <>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Tên hiển thị</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nhập tên hiển thị (Ví dụ: Nguyễn Văn A)"
                  className="input-premium"
                  style={styles.input}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Số điện thoại</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Nhập số điện thoại (tùy chọn)"
                  className="input-premium"
                  style={styles.input}
                />
              </div>
            </>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Mật khẩu</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="input-premium"
                style={{ ...styles.input, width: '100%', paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={styles.submitBtn}
            className="btn-interactive"
          >
            {loading ? 'Đang xử lý...' : isLogin ? 'Đăng Nhập' : 'Tạo Tài Khoản'}
          </button>
        </form>

        <div style={styles.switchAuth}>
          <span>{isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}</span>
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            style={styles.switchBtn}
            className="btn-interactive"
          >
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#070a13',
    position: 'relative',
    overflow: 'hidden',
  },
  authCard: {
    width: '100%',
    maxWidth: '400px',
    padding: '40px 32px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    zIndex: 10,
    background: 'rgba(17, 21, 32, 0.65)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
  },
  logoContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '60px',
    height: '60px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(59, 130, 246, 0.45) 100%)',
    border: '1px solid rgba(99, 102, 241, 0.35)',
    margin: '0 auto 20px auto',
    position: 'relative',
    boxShadow: '0 8px 25px rgba(99, 102, 241, 0.35)',
  },
  logoGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 'inherit',
    background: 'inherit',
    filter: 'blur(10px)',
    opacity: 0.8,
    zIndex: 1,
  },
  title: {
    fontSize: '1.65rem',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: '8px',
    color: 'var(--text-primary)',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    marginBottom: '28px',
    lineHeight: '1.45',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    letterSpacing: '0.2px',
    paddingLeft: '2px'
  },
  input: {
    padding: '12px 16px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '0.92rem',
    outline: 'none',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    width: '100%'
  },
  submitBtn: {
    padding: '13px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--primary-gradient)',
    color: '#ffffff',
    border: 'none',
    fontSize: '0.92rem',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '12px',
    boxShadow: '0 6px 20px rgba(99, 102, 241, 0.35)',
    transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  errorAlert: {
    background: 'rgba(244, 63, 94, 0.15)',
    border: '1px solid rgba(244, 63, 94, 0.25)',
    color: '#fb7185',
    padding: '11px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.82rem',
    marginBottom: '16px',
    textAlign: 'center',
  },
  switchAuth: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    marginTop: '24px',
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
  },
  switchBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.82rem',
    transition: 'color 0.2s ease',
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
