import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Dọn dẹp cache cũ và Precache các tài nguyên tĩnh được liệt kê bởi Vite
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Kích hoạt Service Worker mới ngay lập tức
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
      resolve(null);
    }
  });
};

// Lắng nghe sự kiện push từ máy chủ thông báo đẩy (Apple APNs / Google FCM)
self.addEventListener('push', (event) => {
  const fallbackShow = () => {
    return self.registration.showNotification('ChatTikovia', {
      body: 'Bạn có thông báo mới',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      data: { url: '/' }
    });
  };

  if (!event.data) {
    event.waitUntil(fallbackShow());
    return;
  }

  try {
    const data = event.data.json();
    const title = data.title || 'ChatTikovia';
    const pushConvId = data.conversationId || data.data?.conversationId || null;

    // Nếu người gọi tắt máy khi chưa bắt máy -> Đóng ngay thông báo đổ chuông trên màn hình khóa điện thoại
    if (data.type === 'call-ended') {
      const cancelCallChain = self.registration
        .getNotifications({ tag: 'incoming-call' })
        .then((notifications) => {
          notifications.forEach((n) => n.close());
          return self.registration.showNotification(title || '📞 Cuộc gọi nhỡ', {
            body: data.body || 'Cuộc gọi đến đã kết thúc',
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: 'missed-call',
            renotify: true,
            vibrate: [150, 80, 150],
            data: {
              url: data.url || '/',
              conversationId: pushConvId
            }
          });
        });
      event.waitUntil(cancelCallChain);
      return;
    }

    const notificationTag = data.tag || (pushConvId ? `conv-${pushConvId}` : 'new-message');

    let safeIcon = data.icon || '/pwa-192x192.png';
    if (safeIcon.includes('dicebear.com') || safeIcon.toLowerCase().endsWith('.svg')) {
      safeIcon = '/pwa-192x192.png';
    } else if (safeIcon.startsWith('/api/uploads/')) {
      const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
      safeIcon = `${apiBase}${safeIcon}`;
    }

    const options = {
      body: data.body || 'Bạn có tin nhắn mới',
      icon: safeIcon,
      badge: '/pwa-192x192.png',
      timestamp: data.timestamp || Date.now(),
      vibrate: data.isCall
        ? [500, 300, 500, 300, 500, 300, 500, 300, 500]
        : [200, 100, 200],
      tag: notificationTag,
      renotify: true,
      requireInteraction: Boolean(data.isCall),
      actions: data.isCall
        ? [{ action: 'open', title: '📞 Mở cuộc gọi' }]
        : [{ action: 'open', title: '💬 Xem ngay' }],
      data: {
        url: data.url || data.data?.url || '/',
        conversationId: pushConvId,
        type: data.type || data.data?.type || 'message'
      }
    };

    const promiseChain = Promise.all([
      clients.matchAll({ type: 'window', includeUncontrolled: true }),
      getActiveConversationId()
    ])
      .then(([windowClients, activeConvId]) => {
        // Cập nhật huy hiệu (Badge) trên biểu tượng màn hình chính điện thoại
        if ('setAppBadge' in self.navigator) {
          self.navigator.setAppBadge().catch(() => {});
        }

        const isAppFocused = windowClients.some((client) => client.focused);

        // Nếu là thông báo kiểm tra thiết bị (device-test) hoặc cuộc gọi đến thì luôn hiển thị
        if (notificationTag === 'device-test' || data.isCall) {
          return self.registration.showNotification(title, options);
        }

        // Chỉ bỏ qua thông báo nếu ứng dụng đang mở (focused) và người dùng đang xem ĐÚNG cuộc trò chuyện đó
        if (isAppFocused && activeConvId && pushConvId && activeConvId === pushConvId) {
          return;
        }

        return self.registration.showNotification(title, options);
      })
      .catch(() => fallbackShow());

    event.waitUntil(promiseChain);
  } catch (err) {
    event.waitUntil(fallbackShow());
  }
});

// Tự động gia hạn đăng ký Push nếu trình duyệt hoặc hệ điều hành di động xoay vòng Endpoint
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const options = event.oldSubscription?.options;
        if (!options) return;
        const newSub = await self.registration.pushManager.subscribe(options);
        const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        windowClients.forEach((client) => {
          client.postMessage({
            type: 'PUSH_SUBSCRIPTION_CHANGED',
            subscription: newSub.toJSON ? newSub.toJSON() : newSub
          });
        });
      } catch (e) {}
    })()
  );
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

  const promiseChain = clients
    .matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          client.focus();
          if (conversationId) {
            client.postMessage({
              type: 'SWITCH_CONVERSATION',
              conversationId
            });
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen).then((windowClient) => {
          if (windowClient && conversationId) {
            setTimeout(() => {
              windowClient.postMessage({
                type: 'SWITCH_CONVERSATION',
                conversationId
              });
            }, 1500);
          }
        });
      }
    });

  event.waitUntil(promiseChain);
});
