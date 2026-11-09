import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Khôi phục phiên đăng nhập từ LocalStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('chat_token');
    const savedUser = localStorage.getItem('chat_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));

      // Tự động đồng bộ thông tin cá nhân mới nhất từ server (Stale-While-Revalidate)
      fetch(`${API_URL}/auth/me?_=${Date.now()}`, {
        headers: { 
          'Authorization': `Bearer ${savedToken}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
        .then(res => {
          if (res.status === 401 || res.status === 403) {
            throw new Error('UNAUTHORIZED');
          }
          if (res.ok) return res.json();
          throw new Error('FETCH_ERROR');
        })
        .then(latestUser => {
          setUser(latestUser);
          localStorage.setItem('chat_user', JSON.stringify(latestUser));
        })
        .catch(err => {
          console.warn('Lỗi đồng bộ profile:', err);
          if (err.message === 'UNAUTHORIZED') {
            handleLogout();
          }
        });
    }

    // Lắng nghe sự kiện Online/Offline của trình duyệt
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Xử lý khi đăng nhập/đăng ký thành công
  const handleAuthSuccess = useCallback((userData, userToken) => {
    setUser(userData);
    setToken(userToken);
  }, []);

  // Đăng xuất
  const handleLogout = useCallback(async (socket) => {
    // Huỷ đăng ký thiết bị nhận thông báo đẩy của tài khoản cũ trước khi xoá token
    try {
      const currentToken = localStorage.getItem('chat_token');
      const savedSubStr = localStorage.getItem('chat_push_subscription');
      let endpoint = null;
      if (savedSubStr) {
        const parsed = JSON.parse(savedSubStr);
        endpoint = parsed?.endpoint;
      }
      if (!endpoint && 'serviceWorker' in navigator && 'PushManager' in window) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        endpoint = sub?.endpoint;
      }
      if (currentToken && endpoint) {
        await fetch(`${API_URL}/chat/device-unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentToken}`
          },
          body: JSON.stringify({ endpoint })
        }).catch(() => {});
      }
    } catch (e) {}

    if (socket) {
      socket.disconnect();
    }
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    localStorage.removeItem('chat_push_subscription');
    localStorage.removeItem('chat_conversations_cache');
    localStorage.removeItem('chat_last_read_timestamps');
    localStorage.removeItem('chat_offline_outbox');
    if (typeof navigator !== 'undefined' && navigator.clearAppBadge) {
      navigator.clearAppBadge().catch(() => {});
    }
    setUser(null);
    setToken(null);
  }, []);

  return {
    user,
    setUser,
    token,
    isOnline,
    handleAuthSuccess,
    handleLogout,
    API_URL,
  };
}
