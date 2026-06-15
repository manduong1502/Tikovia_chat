import React, { useState, useEffect } from 'react';

export default function NetworkBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [show, setShow] = useState(false);
  const [type, setType] = useState('offline'); // 'offline' | 'restored'

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setType('restored');
      setShow(true);
      
      // Tự động ẩn banner khôi phục sau 4 giây
      const timer = setTimeout(() => {
        setShow(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setType('offline');
      setShow(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Nếu lúc mới vào app đã offline, hiển thị banner offline luôn
    if (!navigator.onLine) {
      setShow(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!show) return null;

  const isOffline = type === 'offline';

  return (
    <div style={{
      ...styles.banner,
      backgroundColor: isOffline ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
      borderColor: isOffline ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
      boxShadow: isOffline ? '0 8px 32px rgba(239, 68, 68, 0.15)' : '0 8px 32px rgba(16, 185, 129, 0.15)',
    }}>
      <div style={styles.content}>
        <div style={{
          ...styles.dot,
          backgroundColor: isOffline ? '#ef4444' : '#10b981',
          boxShadow: isOffline ? '0 0 10px #ef4444' : '0 0 10px #10b981',
        }} />
        <span style={styles.text}>
          {isOffline 
            ? 'Mất kết nối mạng. Đang chạy ở chế độ offline...' 
            : 'Đã khôi phục kết nối Internet. Đang đồng bộ...'}
        </span>
      </div>
      {!isOffline && (
        <button 
          onClick={() => setShow(false)} 
          style={styles.closeBtn}
        >
          ✕
        </button>
      )}
    </div>
  );
}

const styles = {
  banner: {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    backdropFilter: 'blur(20px)',
    border: '1px solid',
    borderRadius: '16px',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    minWidth: '320px',
    maxWidth: '90%',
    animation: 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    transition: 'all 0.3s ease',
    fontFamily: "'Outfit', 'Inter', sans-serif",
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  text: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '500',
    letterSpacing: '-0.2px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s',
    outline: 'none',
    ':hover': {
      color: '#ffffff'
    }
  }
};

// Injection animation keyframes to document
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from {
        transform: translate(-50%, -40px);
        opacity: 0;
      }
      to {
        transform: translate(-50%, 0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}
