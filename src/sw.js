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

// Huy hiệu đơn sắc (trắng trên nền trong suốt) cho thanh trạng thái Android — dùng icon màu sẽ bị hiển thị thành ô vuông trắng
const STATUS_BAR_BADGE = '/badge-96x96.png';
const APP_ICON = '/pwa-192x192.png';

// iOS / Safari không hỗ trợ thay thế thông báo theo tag ổn định → giữ mỗi tin nhắn 1 thông báo riêng
// Android / Chrome / Edge / Firefox: gộp thông báo theo cuộc trò chuyện (giống Zalo/Messenger) để không tràn khay thông báo
function isAppleWebKitPush() {
  const ua = (self.navigator && self.navigator.userAgent) || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR|SamsungBrowser/i.test(ua);
}

// Lắng nghe sự kiện push từ máy chủ thông báo đẩy (Apple APNs / Google FCM)
self.addEventListener('push', (event) => {
  const fallbackShow = () => {
    return self.registration.showNotification('ChatTikovia', {
      body: 'Bạn có tin nhắn mới',
      icon: APP_ICON,
      badge: STATUS_BAR_BADGE,
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

  let data;
  try {
    data = event.data.json();
  } catch (err) {
    // Payload không phải JSON → vẫn bắt buộc hiển thị thông báo (yêu cầu userVisibleOnly của iOS WebKit)
    event.waitUntil(fallbackShow());
    return;
  }

  event.waitUntil(
    handlePushPayload(data).catch(() => fallbackShow())
  );
});

async function handlePushPayload(data) {
  const title = data.title || 'ChatTikovia';
  const pushConvId = data.conversationId || data.data?.conversationId || null;
  const messageId = data.data?.messageId || data.messageId || null;

  // Cập nhật con số trên biểu tượng ứng dụng (iOS 16.4+ / Android) ngay cả khi ứng dụng đang đóng
  const badgeCount = Number(data.badgeCount) > 0 ? Number(data.badgeCount) : 1;
  if ('setAppBadge' in self.navigator) {
    self.navigator.setAppBadge(badgeCount).catch(() => {});
  }

  // Nếu người gọi tắt máy khi chưa bắt máy -> Đóng ngay thông báo đổ chuông trên màn hình khóa điện thoại
  if (data.type === 'call-ended') {
    const ringing = await self.registration.getNotifications({ tag: 'incoming-call' }).catch(() => []);
    ringing.forEach((n) => n.close());
    await self.registration.showNotification(title || '📞 Cuộc gọi nhỡ', {
      body: data.body || 'Cuộc gọi đến đã kết thúc',
      icon: APP_ICON,
      badge: STATUS_BAR_BADGE,
      tag: `missed-call-${Date.now()}`,
      silent: false,
      renotify: true,
      vibrate: [150, 80, 150],
      data: {
        url: data.url || '/',
        conversationId: pushConvId,
        type: 'missed-call'
      }
    });
    await notifyOpenClients(data);
    return;
  }

  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

  let safeIcon = data.icon || APP_ICON;
  const uploadsIdx = typeof safeIcon === 'string' ? safeIcon.indexOf('/api/uploads/') : -1;
  if (typeof safeIcon !== 'string' || safeIcon.includes('dicebear.com') || safeIcon.toLowerCase().endsWith('.svg')) {
    safeIcon = APP_ICON;
  } else if (uploadsIdx !== -1) {
    safeIcon = `${apiBase}${safeIcon.slice(uploadsIdx)}`;
  } else if (!safeIcon.startsWith('https://') && !safeIcon.startsWith('/')) {
    safeIcon = APP_ICON;
  }

  // Ảnh xem trước chỉ chấp nhận từ máy chủ API nội bộ
  let safeImage;
  if (typeof data.image === 'string' && data.image.startsWith(`${apiBase}/api/uploads/`)) {
    safeImage = data.image;
  }

  const msgType = data.type || data.data?.type || 'message';
  const isCall = Boolean(data.isCall);
  const isChatMessage = msgType === 'message' && Boolean(pushConvId) && !isCall;
  const shouldGroup = isChatMessage && !data.isMention && !isAppleWebKitPush();

  let finalTitle = title;
  let finalBody = data.body || 'Bạn có tin nhắn mới';
  let notificationTag;
  let groupedMessageIds = messageId ? [messageId] : [];
  let groupedLines = [];
  let groupedCount = 1;

  if (isCall) {
    notificationTag = 'incoming-call';
  } else if (data.tag === 'device-test') {
    notificationTag = `device-test-${Date.now()}`;
  } else if (shouldGroup) {
    // Gộp các tin nhắn chưa đọc của cùng 1 cuộc trò chuyện vào 1 thông báo (hiển thị tối đa 5 dòng gần nhất)
    notificationTag = `conv-${pushConvId}`;
    const line = data.groupName && data.senderName ? `${data.senderName}: ${finalBody}` : finalBody;
    const existing = await self.registration.getNotifications({ tag: notificationTag }).catch(() => []);
    const prev = existing[0]?.data || {};
    groupedCount = (Number(prev.count) || 0) + 1;
    groupedLines = [...(Array.isArray(prev.lines) ? prev.lines : []), line].slice(-5);
    groupedMessageIds = [...(Array.isArray(prev.messageIds) ? prev.messageIds : []), messageId]
      .filter(Boolean)
      .slice(-50);
    const baseTitle = data.groupName || data.senderName || title;
    finalTitle = groupedCount > 1 ? `${baseTitle} (${groupedCount} tin nhắn mới)` : title;
    finalBody = groupedCount > 1 ? groupedLines.join('\n') : finalBody;
  } else {
    // iOS: mỗi tin nhắn 1 tag riêng để APNs luôn bật banner + phát âm thanh
    notificationTag = `msg-${messageId || data.timestamp || Date.now()}`;
  }

  const baseData = {
    url: data.url || data.data?.url || '/',
    conversationId: pushConvId,
    messageId,
    messageIds: groupedMessageIds,
    lines: groupedLines,
    count: groupedCount,
    type: msgType
  };

  const options = {
    body: finalBody,
    icon: safeIcon,
    badge: STATUS_BAR_BADGE,
    ...(safeImage ? { image: safeImage } : {}),
    dir: 'ltr',
    lang: 'vi',
    timestamp: data.timestamp || Date.now(),
    silent: false,
    renotify: true,
    vibrate: isCall ? [500, 300, 500, 300, 500, 300, 500, 300, 500] : [250, 120, 250],
    tag: notificationTag,
    requireInteraction: isCall,
    actions: isCall
      ? [
          { action: 'answer', title: '📞 Trả lời' },
          { action: 'dismiss', title: 'Từ chối' }
        ]
      : isChatMessage
        ? [{ action: 'open', title: '💬 Xem tin nhắn' }]
        : [],
    data: baseData
  };

  try {
    await self.registration.showNotification(finalTitle, options);
  } catch (e) {
    // Một số trình duyệt cũ không hỗ trợ image/actions → hiển thị lại bản tối giản
    await self.registration.showNotification(finalTitle, {
      body: finalBody,
      icon: APP_ICON,
      badge: STATUS_BAR_BADGE,
      tag: notificationTag,
      silent: false,
      renotify: true,
      vibrate: options.vibrate,
      data: baseData
    });
  }

  await notifyOpenClients(data);
}

function notifyOpenClients(data) {
  return clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((windowClients) => {
      windowClients.forEach((client) => {
        client.postMessage({
          type: 'SW_PUSH_RECEIVED',
          payload: data
        });
      });
    })
    .catch(() => {});
}

// Tự động gia hạn đăng ký Push nếu trình duyệt hoặc hệ điều hành di động xoay vòng Endpoint
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        let newSub = event.newSubscription || null;
        if (!newSub) {
          const options = event.oldSubscription?.options;
          if (options && options.applicationServerKey) {
            newSub = await self.registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: options.applicationServerKey
            });
          }
        }
        if (!newSub) return;
        // Ứng dụng sẽ tự đồng bộ token mới lên máy chủ (nếu đang mở) hoặc ở lần mở kế tiếp (checkPushNotificationStatus)
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

// Dọn dẹp các thông báo cũ trên thanh trạng thái điện thoại khi người dùng mở xem cuộc trò chuyện hoặc khi tin nhắn bị thu hồi
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_CONVERSATION_NOTIFICATIONS') {
    const targetConvId = event.data.conversationId;
    const task = self.registration
      .getNotifications()
      .then((notifications) => {
        notifications.forEach((n) => {
          if (n.tag === 'incoming-call') return;
          if (!targetConvId || n.data?.conversationId === targetConvId) {
            n.close();
          }
        });
      })
      .catch(() => {});
    if (event.waitUntil) event.waitUntil(task);
  } else if (event.data?.type === 'CLEAR_MESSAGE_NOTIFICATION' && event.data.messageId) {
    const targetId = event.data.messageId;
    const task = self.registration
      .getNotifications()
      .then((notifications) => {
        notifications.forEach((n) => {
          const ids = Array.isArray(n.data?.messageIds) ? n.data.messageIds : [];
          if (n.tag === `msg-${targetId}` || n.data?.messageId === targetId || ids.includes(targetId)) {
            n.close();
          }
        });
      })
      .catch(() => {});
    if (event.waitUntil) event.waitUntil(task);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notificationData = event.notification.data || {};
  const conversationId = notificationData.conversationId;

  // Tự động đóng tất cả các thông báo khác cùng thuộc cuộc hội thoại vừa bấm
  const closeSiblings = conversationId
    ? self.registration
        .getNotifications()
        .then((notifications) => {
          notifications.forEach((n) => {
            if (n.data?.conversationId === conversationId) {
              n.close();
            }
          });
        })
        .catch(() => {})
    : Promise.resolve();

  // Chỉ cho phép mở đường dẫn nội bộ của ứng dụng (chống chuyển hướng ra trang ngoài qua dữ liệu thông báo)
  let urlObj;
  try {
    urlObj = new URL(notificationData.url || '/', self.location.origin);
  } catch (e) {
    urlObj = new URL('/', self.location.origin);
  }
  if (urlObj.origin !== self.location.origin) {
    urlObj = new URL('/', self.location.origin);
  }
  if (conversationId) {
    urlObj.searchParams.set('convId', conversationId);
  }
  const urlToOpen = urlObj.href;

  const promiseChain = clients
    .matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then((windowClients) => {
      const existingClient = windowClients.find((c) => 'focus' in c);
      if (existingClient) {
        return existingClient
          .focus()
          .catch(() => existingClient)
          .then((focused) => {
            const target = focused || existingClient;
            if (conversationId) {
              target.postMessage({
                type: 'SWITCH_CONVERSATION',
                conversationId
              });
            }
          });
      }
      if (clients.openWindow) {
        // Ứng dụng sẽ tự mở đúng cuộc trò chuyện nhờ tham số ?convId trên URL
        return clients.openWindow(urlToOpen);
      }
      return undefined;
    });

  event.waitUntil(Promise.all([closeSiblings, promiseChain]));
});
