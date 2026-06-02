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

// Lắng nghe sự kiện push từ máy chủ thông báo đẩy
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'ChatTikovia';
    
    const options = {
      body: data.body || 'Bạn có tin nhắn mới',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };

    // Chỉ hiển thị thông báo đẩy lên khay hệ thống nếu tab ứng dụng đang đóng hoặc không hiển thị (active/visible)
    const promiseChain = clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      const isAppVisible = windowClients.some(client => client.visibilityState === 'visible');
      if (isAppVisible) {
        // Ứng dụng đang mở và người dùng đang nhìn thấy -> không cần hiện thông báo đẩy hệ thống
        return;
      }
      return self.registration.showNotification(title, options);
    });

    event.waitUntil(promiseChain);
  } catch (err) {
    console.error('Lỗi giải mã push notification payload:', err);
  }
});

// Lắng nghe sự kiện click vào thông báo đẩy
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    // Tìm xem tab ứng dụng có đang mở sẵn không
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url === urlToOpen && 'focus' in client) {
        return client.focus();
      }
    }
    // Nếu tab chưa mở, mở tab mới
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  });

  event.waitUntil(promiseChain);
});
