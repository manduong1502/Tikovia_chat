import { precacheAndRoute } from 'workbox-precaching';

// Precaching các tài nguyên tĩnh được liệt kê bởi Vite
precacheAndRoute(self.__WB_MANIFEST);

// Ép buộc kích hoạt Service Worker mới ngay lập tức mà không cần chờ đợi người dùng đóng các tab
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Truy cập IndexedDB lấy activeConversationId
const getActiveConversationId = () => {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('ChatTikoviaDB', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('settings')) {
          resolve(null);
          return;
        }
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const getReq = store.get('activeConversationId');
        getReq.onsuccess = () => {
          resolve(getReq.result || null);
        };
        getReq.onerror = () => {
          resolve(null);
        };
      };
      request.onerror = () => {
        resolve(null);
      };
    } catch (err) {
      console.error('[Service Worker] Lỗi truy cập IndexedDB:', err);
      resolve(null);
    }
  });
};

// Lắng nghe sự kiện push từ máy chủ thông báo đẩy
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Nhận được sự kiện push chạy nền:', event);
  
  const fallbackShow = () => {
    return self.registration.showNotification('ChatTikovia', {
      body: 'Bạn có tin nhắn mới',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [100, 50, 100],
      data: { url: '/' }
    });
  };

  if (!event.data) {
    console.warn('[Service Worker] Push event không có dữ liệu data.');
    event.waitUntil(fallbackShow());
    return;
  }

  try {
    const data = event.data.json();
    console.log('[Service Worker] Dữ liệu push nhận được:', data);
    const title = data.title || 'ChatTikovia';
    const pushConvId = data.conversationId;
    
    const options = {
      body: data.body || 'Bạn có tin nhắn mới',
      icon: data.icon || '/pwa-192x192.png', // Dùng avatar của người gửi nếu có, ngược lại dùng logo mặc định
      badge: '/pwa-192x192.png',
      vibrate: data.isCall ? [500, 500, 500, 500, 500, 500, 500, 500, 500, 500] : [100, 50, 100],
      tag: data.tag || 'new-message',
      renotify: true,
      requireInteraction: !!data.isCall,
      data: {
        url: data.url || '/',
        conversationId: pushConvId
      }
    };

    // Kiểm tra song song clients và IndexedDB để xử lý thông báo thông minh
    const promiseChain = Promise.all([
      clients.matchAll({ type: 'window', includeUncontrolled: true }),
      getActiveConversationId()
    ]).then(([windowClients, activeConvId]) => {
      console.log(`[Service Worker] Clients: ${windowClients.length}, activeConvId in DB: ${activeConvId}, pushConvId: ${pushConvId}`);
      
      const isAppFocused = windowClients.some(client => {
        console.log(`[Service Worker] Client URL: ${client.url}, focused: ${client.focused}`);
        return client.focused;
      });

      // Chỉ bỏ qua thông báo nếu ứng dụng đang mở (focused) và người dùng đang ở ĐÚNG cuộc trò chuyện nhận tin nhắn
      if (isAppFocused && activeConvId && pushConvId && activeConvId === pushConvId) {
        console.log('[Service Worker] Ứng dụng đang focused và người dùng đang xem đúng cuộc hội thoại này -> Bỏ qua thông báo đẩy.');
        return;
      }
      
      console.log('[Service Worker] Kích hoạt hiển thị thông báo đẩy hệ thống.');
      return self.registration.showNotification(title, options);
    }).catch(err => {
      console.error('[Service Worker] Lỗi trong luồng kiểm tra hiển thị thông báo:', err);
      return fallbackShow();
    });

    event.waitUntil(promiseChain);
  } catch (err) {
    console.error('[Service Worker] Lỗi giải mã hoặc hiển thị push notification:', err);
    event.waitUntil(fallbackShow());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const notificationData = event.notification.data || {};
  const conversationId = notificationData.conversationId;
  
  let targetUrl = notificationData.url || '/';
  if (conversationId) {
    const urlObj = new URL(targetUrl, self.location.origin);
    urlObj.searchParams.set('convId', conversationId);
    targetUrl = urlObj.pathname + urlObj.search;
  }
  const urlToOpen = new URL(targetUrl, self.location.origin).href;

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    // Tìm xem có bất kỳ tab ứng dụng nào đang mở sẵn không để tránh mở nhiều tab trùng lặp
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if ('focus' in client) {
        client.focus();
        if (conversationId) {
          // Phát tin nhắn để Client tự chuyển màn hình cuộc trò chuyện tương ứng
          client.postMessage({
            type: 'SWITCH_CONVERSATION',
            conversationId: conversationId
          });
        }
        return;
      }
    }
    // Nếu chưa có tab nào mở, mở tab mới và truyền tham số chuyển hướng
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen).then((windowClient) => {
        if (windowClient && conversationId) {
          // Chờ 1.5 giây cho React load xong và đăng ký sự kiện trước khi bắn tín hiệu chuyển phòng
          setTimeout(() => {
            windowClient.postMessage({
              type: 'SWITCH_CONVERSATION',
              conversationId: conversationId
            });
          }, 1500);
        }
      });
    }
  });

  event.waitUntil(promiseChain);
});
