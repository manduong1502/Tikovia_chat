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
          if (res.status === 401) {
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
    if (socket) {
      socket.disconnect();
    }
    // Xóa active conversation trong IndexedDB khi đăng xuất
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      const request = indexedDB.open('ChatTikoviaDB', 1);
      request.onsuccess = (e) => {
        const db = e.target.result;
        if (db.objectStoreNames.contains('settings')) {
          const tx = db.transaction('settings', 'readwrite');
          tx.objectStore('settings').delete('activeConversationId');
        }
      };
    }
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
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
