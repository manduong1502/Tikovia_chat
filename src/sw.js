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

// Lắng nghe sự kiện push từ máy chủ thông báo đẩy (Apple APNs / Google FCM)
self.addEventListener('push', (event) => {
  const fallbackShow = () => {
    return self.registration.showNotification('ChatTikovia', {
      body: 'Bạn có tin nhắn mới',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      silent: false,
      renotify: true,
      vibrate: [200, 100, 200],
      tag: `msg-fallback-${Date.now()}`,
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
            tag: `missed-call-${Date.now()}`,
            silent: false,
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

    // Sử dụng tag riêng biệt cho từng tin nhắn để iOS APNs & Android FCM luôn bật Banner và phát chuông báo
    const uniqueMsgId = data.data?.messageId || data.messageId || data.timestamp || Date.now();
    const notificationTag = data.isCall
      ? 'incoming-call'
      : data.tag === 'device-test'
        ? `device-test-${Date.now()}`
        : `msg-${uniqueMsgId}`;

    let safeIcon = data.icon || '/pwa-192x192.png';
    const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
    const uploadsIdx = typeof safeIcon === 'string' ? safeIcon.indexOf('/api/uploads/') : -1;
    if (typeof safeIcon !== 'string' || safeIcon.includes('dicebear.com') || safeIcon.toLowerCase().endsWith('.svg')) {
      safeIcon = '/pwa-192x192.png';
    } else if (uploadsIdx !== -1) {
      safeIcon = `${apiBase}${safeIcon.slice(uploadsIdx)}`;
    } else if (safeIcon.startsWith('http://localhost') || safeIcon.startsWith('http://127.0.0.1') || safeIcon.startsWith('http://192.168.')) {
      safeIcon = '/pwa-192x192.png';
    }

    const options = {
      body: data.body || 'Bạn có tin nhắn mới',
      icon: safeIcon,
      badge: '/pwa-192x192.png',
      timestamp: data.timestamp || Date.now(),
      silent: false,
      renotify: true,
      vibrate: data.isCall
        ? [500, 300, 500, 300, 500, 300, 500, 300, 500]
        : [250, 120, 250],
      tag: notificationTag,
      requireInteraction: Boolean(data.isCall),
      data: {
        url: data.url || data.data?.url || '/',
        conversationId: pushConvId,
        type: data.type || data.data?.type || 'message'
      }
    };

    const showPromise = self.registration
      .showNotification(title, options)
      .catch(() => self.registration.showNotification(title, { ...options, icon: '/pwa-192x192.png' }))
      .catch(() => fallbackShow());

    const notifyClientsPromise = clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        if ('setAppBadge' in self.navigator) {
          self.navigator.setAppBadge().catch(() => {});
        }
        windowClients.forEach((client) => {
          client.postMessage({
            type: 'SW_PUSH_RECEIVED',
            payload: data
          });
        });
      })
      .catch(() => {});

    event.waitUntil(Promise.all([showPromise, notifyClientsPromise]));
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

// Dọn dẹp các thông báo cũ trên thanh trạng thái điện thoại khi người dùng mở xem cuộc trò chuyện
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_CONVERSATION_NOTIFICATIONS') {
    const targetConvId = event.data.conversationId;
    self.registration
      .getNotifications()
      .then((notifications) => {
        notifications.forEach((n) => {
          if (!targetConvId || n.data?.conversationId === targetConvId) {
            n.close();
          }
        });
      })
      .catch(() => {});
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const conversationId = notificationData.conversationId;

  // Tự động đóng tất cả các thông báo khác cùng thuộc cuộc hội thoại vừa bấm
  if (conversationId) {
    self.registration
      .getNotifications()
      .then((notifications) => {
        notifications.forEach((n) => {
          if (n.data?.conversationId === conversationId) {
            n.close();
          }
        });
      })
      .catch(() => {});
  }

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
