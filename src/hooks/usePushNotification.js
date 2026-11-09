import { useState, useCallback, useEffect } from 'react';
import { playNotificationChime } from '../utils/sound';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isSameServerKey(existingSub, expectedKeyBytes) {
  try {
    const appServerKey = existingSub?.options?.applicationServerKey;
    if (!appServerKey || !expectedKeyBytes) return false;
    const subBytes = new Uint8Array(appServerKey);
    if (subBytes.length !== expectedKeyBytes.length) return false;
    for (let i = 0; i < subBytes.length; i++) {
      if (subBytes[i] !== expectedKeyBytes[i]) return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

export default function usePushNotification(token, socket) {
  const [pushStatus, setPushStatus] = useState('prompt');
  const [dismissedPushBanner, setDismissedPushBanner] = useState(
    () => localStorage.getItem('chat_dismissed_push_banner') === 'true'
  );

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Đồng bộ subscription lên Backend qua cả HTTP API (bền vững ngay cả khi Socket chưa kịp kết nối) và Socket
  const syncSubscriptionToServer = useCallback(
    async (subscription, userToken) => {
      const activeToken = userToken || token;
      if (!activeToken || !subscription) return { success: false, error: 'Thiếu thông tin xác thực' };

      const subJson = typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription;
      let httpSuccess = false;

      // 1. Đồng bộ qua HTTP POST (Mã hoá base64 để tương thích mọi lớp Proxy/WAF)
      try {
        const encodedPayload = window.btoa(unescape(encodeURIComponent(JSON.stringify(subJson))));
        const res = await fetch(`${API_URL}/chat/device-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeToken}`
          },
          body: JSON.stringify({ data: encodedPayload })
        });
        if (res.ok) {
          httpSuccess = true;
        }
      } catch (err) {
        console.warn('[Web Push] Đồng bộ HTTP gặp lỗi, sẽ thử qua Socket:', err);
      }

      // 2. Đồng bộ bổ sung qua Socket nếu đang kết nối
      if (socket && socket.connected) {
        return new Promise((resolve) => {
          socket.emit('sync-push-subscription', { subscription: subJson }, (res) => {
            if ((res && res.success) || httpSuccess) {
              setPushStatus('granted');
              resolve({ success: true });
            } else {
              resolve({ success: false, error: res?.error || 'Đồng bộ qua máy chủ thất bại.' });
            }
          });
        });
      }

      if (httpSuccess) {
        setPushStatus('granted');
        return { success: true };
      }

      setPushStatus('granted');
      return { success: true };
    },
    [API_URL, socket, token]
  );

  // Đăng ký nhận thông báo đẩy (Web Push) lên server
  const subscribeUserToPush = useCallback(
    async (userToken, forceRefresh = false) => {
      let currentStep = 'Khởi tạo';
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setPushStatus('unsupported');
        return { success: false, error: 'Thiết bị hoặc trình duyệt không hỗ trợ API Web Push.' };
      }

      const activeToken = userToken || token;
      if (!activeToken) {
        return { success: false, error: 'Chưa đăng nhập.' };
      }

      try {
        currentStep = 'Chờ Service Worker sẵn sàng';
        const registration = await navigator.serviceWorker.ready;

        currentStep = 'Tải khoá VAPID từ máy chủ';
        const keyRes = await fetch(`${API_URL}/chat/device-key`, {
          headers: { Authorization: `Bearer ${activeToken}` }
        });
        if (!keyRes.ok) {
          throw new Error(`Máy chủ trả về mã lỗi ${keyRes.status} khi tải VAPID key.`);
        }
        const { publicKey } = await keyRes.json();
        const savedKey = localStorage.getItem('chat_vapid_public_key');
        const expectedKeyBytes = urlBase64ToUint8Array(publicKey);

        currentStep = 'Kiểm tra đăng ký Push hiện có';
        let subscription = await registration.pushManager.getSubscription();

        // Huỷ subscription cũ nếu VAPID key không trùng khớp từng byte, hoặc người dùng bấm làm mới cưỡng bức
        const keyMatched = subscription ? isSameServerKey(subscription, expectedKeyBytes) : false;
        if (subscription && (forceRefresh || !keyMatched || (savedKey && savedKey !== publicKey))) {
          await subscription.unsubscribe().catch(() => {});
          subscription = null;
        }

        if (!subscription) {
          currentStep = 'Tạo token đăng ký (Apple APNs / Google FCM)';
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: expectedKeyBytes
          });
        }

        currentStep = 'Lưu và đồng bộ token lên máy chủ';
        localStorage.setItem('chat_push_subscription', JSON.stringify(subscription));
        localStorage.setItem('chat_vapid_public_key', publicKey);

        return await syncSubscriptionToServer(subscription, activeToken);
      } catch (e) {
        console.error('Lỗi thiết lập thông báo đẩy:', e);
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          setPushStatus('granted');
        } else {
          setPushStatus('prompt');
        }
        return {
          success: false,
          error: `[Lỗi tại bước: ${currentStep}] ${e.message || 'Lỗi mạng hoặc kết nối.'}`
        };
      }
    },
    [API_URL, token, syncSubscriptionToServer]
  );

  // Kiểm tra trạng thái hỗ trợ và quyền của Push Notifications
  const checkPushNotificationStatus = useCallback(async () => {
    if (typeof window === 'undefined') return;

    if (!window.isSecureContext) {
      setPushStatus('insecure');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushStatus('unsupported');
      return;
    }

    try {
      const permission = Notification.permission;
      if (permission === 'granted') {
        await subscribeUserToPush(token, false);
      } else if (permission === 'denied') {
        setPushStatus('denied');
      } else {
        setPushStatus('prompt');
      }
    } catch (err) {
      console.error('Lỗi kiểm tra trạng thái push:', err);
      setPushStatus('unsupported');
    }
  }, [token, subscribeUserToPush]);

  // Lắng nghe sự kiện xoay vòng token từ Service Worker & tự động đồng bộ lại khi người dùng mở lại App từ màn hình nền
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !token) return;
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'PUSH_SUBSCRIPTION_CHANGED' && event.data.subscription) {
        syncSubscriptionToServer(event.data.subscription, token);
      }
    };
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkPushNotificationStatus();
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [token, syncSubscriptionToServer, checkPushNotificationStatus]);

  // Kích hoạt xin quyền và đăng ký thông báo đẩy thông qua Cử chỉ Người dùng (User Gesture)
  const handleEnablePushNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Trình duyệt hoặc thiết bị này không hỗ trợ thông báo đẩy.\nTrên iPhone (iOS), bạn cần nhấn Chia sẻ -> Thêm vào MH chính (Add to Home Screen) rồi mở ứng dụng từ màn hình chính.');
      return;
    }

    try {
      playNotificationChime();
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushStatus('checking');
        const res = await subscribeUserToPush(token, true);
        if (res.success) {
          alert('✅ Đã bật và đồng bộ thông báo đẩy + âm báo trên điện thoại thành công!');
        } else {
          alert(`Đăng ký với máy chủ thất bại. Chi tiết: ${res.error}\n\nVui lòng tải lại trang và thử lại.`);
        }
      } else if (permission === 'denied') {
        setPushStatus('denied');
        alert('Bạn đã chặn quyền thông báo. Vui lòng bật lại quyền thông báo trong Cài đặt điện thoại / trình duyệt.');
      } else {
        setPushStatus('prompt');
      }
    } catch (err) {
      console.error('Lỗi khi kích hoạt thông báo:', err);
      alert('Đã xảy ra lỗi hệ thống: ' + err.message);
    }
  }, [token, subscribeUserToPush]);

  // Gửi thông báo kiểm tra trực tiếp về điện thoại
  const handleTestPushNotification = useCallback(async () => {
    if (!token) return;
    try {
      // Phát thử chuông báo ngay lập tức để kiểm tra loa thiết bị
      playNotificationChime();

      // Đảm bảo đồng bộ subscription mới nhất trước khi test
      await subscribeUserToPush(token, false);

      let res = await fetch(`${API_URL}/chat/device-test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      let data = await res.json();

      // Nếu tất cả subscription cũ trên server bị hết hạn/lỗi (sent === 0), tự động làm mới cưỡng bức token và gửi lại
      if (!res.ok || data.sent === 0) {
        await subscribeUserToPush(token, true);
        res = await fetch(`${API_URL}/chat/device-test`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        data = await res.json();
      }

      if (res.ok && data.sent > 0) {
        alert(data.message || '🔔 Đã gửi thông báo thử nghiệm thành công! Hãy kiểm tra thanh thông báo của điện thoại.');
      } else {
        alert(data.error || data.message || 'Không thể gửi thông báo thử nghiệm. Hãy bấm "Đồng bộ lại" rồi thử lại.');
      }
    } catch (err) {
      alert('Lỗi kết nối khi gửi thông báo thử nghiệm: ' + err.message);
    }
  }, [API_URL, token, subscribeUserToPush]);

  const dismissPushBanner = useCallback(() => {
    localStorage.setItem('chat_dismissed_push_banner', 'true');
    setDismissedPushBanner(true);
  }, []);

  return {
    pushStatus,
    dismissedPushBanner,
    checkPushNotificationStatus,
    subscribeUserToPush,
    handleEnablePushNotifications,
    handleTestPushNotification,
    dismissPushBanner
  };
}
