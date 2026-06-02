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
  console.log('[Service Worker] Nhận được sự kiện push chạy nền:', event);
  if (!event.data) {
    console.warn('[Service Worker] Push event không có dữ liệu data.');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[Service Worker] Dữ liệu push nhận được:', data);
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
      console.log(`[Service Worker] Số lượng client đang quản lý: ${windowClients.length}`);
      const isAppVisible = windowClients.some(client => {
        console.log(`[Service Worker] Client URL: ${client.url}, Trạng thái hiển thị: ${client.visibilityState}`);
        return client.visibilityState === 'visible';
      });

      if (isAppVisible) {
        console.log('[Service Worker] Ứng dụng đang mở và hiển thị -> Bỏ qua không hiện thông báo đẩy hệ thống.');
        return;
      }
      console.log('[Service Worker] Ứng dụng đang tắt hoặc ẩn -> Kích hoạt hiển thị thông báo đẩy hệ thống.');
      return self.registration.showNotification(title, options);
    });

    event.waitUntil(promiseChain);
  } catch (err) {
    console.error('[Service Worker] Lỗi giải mã hoặc hiển thị push notification:', err);
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
