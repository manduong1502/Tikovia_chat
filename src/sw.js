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
const NAV_INTENT_CACHE = 'chattikovia-nav-intent-v1';
const NAV_INTENT_KEY = '/__open_conversation__';

// iOS / Safari không hỗ trợ actions/vibrate/requireInteraction và không gộp theo tag như Android
function isAppleWebKitPush() {
  const ua = (self.navigator && self.navigator.userAgent) || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR|SamsungBrowser/i.test(ua);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveNavigationIntent(conversationId) {
  if (!conversationId || !('caches' in self)) return;
  try {
    const cache = await caches.open(NAV_INTENT_CACHE);
    const body = JSON.stringify({ conversationId, ts: Date.now() });
    await cache.put(
      NAV_INTENT_KEY,
      new Response(body, { headers: { 'Content-Type': 'application/json' } })
    );
  } catch (e) {}
}

// Lắng nghe sự kiện push từ máy chủ thông báo đẩy (Apple APNs / Google FCM)
self.addEventListener('push', (event) => {
  const fallbackShow = () => {
    const apple = isAppleWebKitPush();
    return self.registration.showNotification('ChatTikovia', {
      body: 'Bạn có tin nhắn mới',
      icon: APP_ICON,
      ...(apple ? {} : { badge: STATUS_BAR_BADGE, vibrate: [200, 100, 200], renotify: true }),
      silent: false,
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

  event.waitUntil(handlePushPayload(data).catch(() => fallbackShow()));
});

async function handlePushPayload(data) {
  const apple = isAppleWebKitPush();
  const title = data.title || 'ChatTikovia';
  const pushConvId = data.conversationId || data.data?.conversationId || null;
  const messageId = data.data?.messageId || data.messageId || null;

  // Cập nhật hoặc xoá con số trên biểu tượng ứng dụng (iOS 16.4+ / Android) ngay cả khi ứng dụng đang đóng
  const rawBadge = Number(data.badgeCount);
  if ('setAppBadge' in self.navigator) {
    if (data.type === 'message-recalled' && Number.isFinite(rawBadge) && rawBadge <= 0) {
      if ('clearAppBadge' in self.navigator) {
        self.navigator.clearAppBadge().catch(() => {});
      } else {
        self.navigator.setAppBadge(0).catch(() => {});
      }
    } else {
      const badgeCount = rawBadge > 0 ? rawBadge : 1;
      self.navigator.setAppBadge(badgeCount).catch(() => {});
    }
  }

  // 1. Khi đối phương GỠ / THU HỒI tin nhắn -> Xoá ngay thông báo chứa nội dung cũ trên màn hình khoá điện thoại
  if (data.type === 'message-recalled') {
    const allNotifications = await self.registration.getNotifications().catch(() => []);
    let rebuiltGroupOptions = null;
    let rebuiltGroupTitle = title;

    for (const n of allNotifications) {
      const nData = n.data || {};
      const ids = Array.isArray(nData.messageIds) ? nData.messageIds : [];
      const lines = Array.isArray(nData.lines) ? nData.lines : [];
      const isDirectMatch =
        (messageId && (n.tag === `msg-${messageId}` || nData.messageId === messageId)) ||
        (messageId && ids.includes(messageId));

      if (!isDirectMatch) continue;

      // Nếu thông báo gộp trên Android còn các tin chưa đọc khác trong cùng phòng chat -> giữ lại các tin còn lại
      if (!apple && n.tag === `conv-${pushConvId}` && ids.length > 1 && messageId) {
        const idx = ids.indexOf(messageId);
        const nextIds = ids.filter((id) => id !== messageId);
        // lines chỉ giữ tối đa 5 dòng cuối tương ứng với đuôi của ids
        const lineOffset = ids.length - lines.length;
        const lineIdx = idx - lineOffset;
        const nextLines = lineIdx >= 0 ? lines.filter((_, i) => i !== lineIdx) : lines;
        const nextCount = Math.max(nextIds.length, (Number(nData.count) || 2) - 1);

        if (nextIds.length > 0 && nextLines.length > 0) {
          rebuiltGroupTitle =
            nextCount > 1 ? `${title} (${nextCount} tin nhắn mới)` : title;
          rebuiltGroupOptions = {
            body: nextCount > 1 ? nextLines.join('\n') : nextLines[nextLines.length - 1],
            icon: APP_ICON,
            badge: STATUS_BAR_BADGE,
            tag: `conv-${pushConvId}`,
            silent: true,
            renotify: false,
            data: {
              ...nData,
              messageId: nextIds[nextIds.length - 1],
              messageIds: nextIds,
              lines: nextLines,
              count: nextCount
            }
          };
        }
      }

      n.close();
    }

    if (rebuiltGroupOptions) {
      await self.registration.showNotification(rebuiltGroupTitle, rebuiltGroupOptions);
    } else {
      // Đáp ứng quy tắc bắt buộc userVisibleOnly: true của trình duyệt di động mà không gây rung/chuông,
      // ghi đè nội dung nhạy cảm bằng trạng thái thu hồi rồi tự đóng ngay sau 180ms
      const tempTag = messageId ? `msg-${messageId}` : `recall-${Date.now()}`;
      await self.registration.showNotification(title, {
        body: 'Tin nhắn đã được thu hồi',
        icon: APP_ICON,
        ...(apple ? {} : { badge: STATUS_BAR_BADGE, renotify: false }),
        tag: tempTag,
        silent: true,
        data: {
          url: '/',
          conversationId: pushConvId,
          type: 'message-recalled'
        }
      });
      await delay(180);
      const tempList = await self.registration.getNotifications({ tag: tempTag }).catch(() => []);
      tempList.forEach((n) => n.close());
    }

    await notifyOpenClients(data);
    return;
  }

  // 2. Nếu người gọi tắt máy khi chưa bắt máy -> Đóng ngay mọi thông báo đang đổ chuông trên màn hình khóa
  if (data.type === 'call-ended') {
    const allNotifications = await self.registration.getNotifications().catch(() => []);
    allNotifications.forEach((n) => {
      if (
        n.tag === 'incoming-call' ||
        (typeof n.tag === 'string' && n.tag.startsWith('incoming-call-')) ||
        n.data?.type === 'incoming-call'
      ) {
        n.close();
      }
    });

    await self.registration.showNotification(title || '📞 Cuộc gọi nhỡ', {
      body: data.body || 'Cuộc gọi đến đã kết thúc',
      icon: APP_ICON,
      ...(apple ? {} : { badge: STATUS_BAR_BADGE, renotify: true, vibrate: [150, 80, 150] }),
      tag: `missed-call-${Date.now()}`,
      silent: false,
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

  const msgType = data.type || data.data?.type || (data.isCall ? 'incoming-call' : 'message');
  const isCall = Boolean(data.isCall || msgType === 'incoming-call');
  const isChatMessage = msgType === 'message' && Boolean(pushConvId) && !isCall;
  const shouldGroup = isChatMessage && !data.isMention && !apple;

  // Android / máy tính: nếu người dùng ĐANG mở ứng dụng trên màn hình, chỉ báo trong app (chuông + banner nội bộ),
  // không bật thêm thông báo hệ thống để tránh kêu 2 lần. iOS vẫn luôn hiển thị (bắt buộc theo quy định WebKit).
  if (!apple && !isCall && data.tag !== 'device-test') {
    const windowClients = await clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .catch(() => []);
    const hasFocusedVisibleClient = windowClients.some(
      (c) => c.focused === true && c.visibilityState === 'visible'
    );
    if (hasFocusedVisibleClient) {
      await notifyOpenClients(data);
      return;
    }
  }

  let finalTitle = title;
  let finalBody = data.body || 'Bạn có tin nhắn mới';
  let notificationTag;
  let groupedMessageIds = messageId ? [messageId] : [];
  let groupedLines = [];
  let groupedCount = 1;

  if (isCall) {
    // Trên iPhone: luôn dùng tag riêng cho mỗi cuộc gọi để APNs bật banner + phát tiếng chuông hệ thống 100%
    notificationTag = apple ? `incoming-call-${data.timestamp || Date.now()}` : 'incoming-call';
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
    type: isCall ? 'incoming-call' : msgType
  };

  // Trên iOS WebKit: tuyệt đối không truyền actions / vibrate / requireInteraction để đảm bảo tương thích chuẩn APNs
  const options = apple
    ? {
        body: finalBody,
        icon: safeIcon,
        dir: 'ltr',
        lang: 'vi',
        timestamp: data.timestamp || Date.now(),
        silent: false,
        tag: notificationTag,
        data: baseData
      }
    : {
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
    await self.registration.showNotification(finalTitle, {
      body: finalBody,
      icon: APP_ICON,
      tag: notificationTag,
      silent: false,
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
          if (n.tag === 'incoming-call' || (typeof n.tag === 'string' && n.tag.startsWith('incoming-call-'))) {
            return;
          }
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

  const openAndSwitch = async () => {
    // Lưu ý định mở phòng chat vào Cache Storage dùng chung để iPhone PWA luôn đọc được
    // ngay cả khi iOS Standalone cắt bỏ tham số ?convId trên URL lúc khởi động lạnh
    if (conversationId) {
      await saveNavigationIntent(conversationId);
    }

    const windowClients = await clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      .catch(() => []);

    const existingClient = windowClients.find((c) => 'focus' in c) || windowClients[0];
    if (existingClient) {
      const focused =
        typeof existingClient.focus === 'function'
          ? await existingClient.focus().catch(() => existingClient)
          : existingClient;
      const target = focused || existingClient;
      if (conversationId && target) {
        target.postMessage({
          type: 'SWITCH_CONVERSATION',
          conversationId
        });
        // Gửi lặp lại sau 450ms phòng trường hợp tiến trình WebKit trên iOS vừa rã đông từ nền
        await delay(450);
        target.postMessage({
          type: 'SWITCH_CONVERSATION',
          conversationId
        });
      }
      return;
    }

    if (clients.openWindow) {
      const openedClient = await clients.openWindow(urlToOpen).catch(() => null);
      if (openedClient && conversationId) {
        await delay(500);
        openedClient.postMessage({
          type: 'SWITCH_CONVERSATION',
          conversationId
        });
      }
    }
  };

  event.waitUntil(Promise.all([closeSiblings, openAndSwitch()]));
});
