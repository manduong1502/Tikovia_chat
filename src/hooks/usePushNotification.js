import { useState, useCallback } from 'react';

export default function usePushNotification(token, socket) {
  const [pushStatus, setPushStatus] = useState('prompt');
  const [dismissedPushBanner, setDismissedPushBanner] = useState(
    () => localStorage.getItem('chat_dismissed_push_banner') === 'true'
  );

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        // Tải public key từ server để so khớp
        try {
          const keyRes = await fetch(`${API_URL}/chat/device-key`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (keyRes.ok) {
            const { publicKey } = await keyRes.json();
            const savedKey = localStorage.getItem('chat_vapid_public_key');
            
            if (publicKey !== savedKey || !subscription) {
              console.log('[Web Push] Phát hiện VAPID key thay đổi hoặc mất subscription. Đang đăng ký lại...');
              localStorage.setItem('chat_vapid_public_key', publicKey);
              await subscribeUserToPush(token);
            } else {
              setPushStatus('granted');
            }
          } else {
            setPushStatus(subscription ? 'granted' : 'prompt');
          }
        } catch (fetchErr) {
          console.warn('Lỗi kiểm tra VAPID key từ server:', fetchErr);
          // Nếu offline mà quyền đã được cấp, giữ trạng thái là granted để không hiện banner
          setPushStatus('granted');
        }
      } else if (permission === 'denied') {
        setPushStatus('denied');
      } else {
        setPushStatus('prompt');
      }
    } catch (err) {
      console.error('Lỗi kiểm tra trạng thái push:', err);
      setPushStatus('unsupported');
    }
  }, [token, API_URL]);

  // Đăng ký nhận thông báo đẩy (Web Push) lên server
  const subscribeUserToPush = useCallback(async (userToken) => {
    let currentStep = 'Khởi tạo';
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      console.log('Trình duyệt không hỗ trợ Web Push.');
      setPushStatus('unsupported');
      return { success: false, error: 'Thiết bị hoặc trình duyệt không hỗ trợ API Web Push.' };
    }

    try {
      currentStep = 'Chờ Service Worker sẵn sàng';
      const registration = await navigator.serviceWorker.ready;
      
      currentStep = 'Tải khoá VAPID từ máy chủ';
      const keyRes = await fetch(`${API_URL}/chat/device-key`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (!keyRes.ok) {
        throw new Error(`Máy chủ trả về mã lỗi ${keyRes.status} khi tải VAPID key.`);
      }
      const { publicKey } = await keyRes.json();

      const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
          .replace(/\-/g, '+')
          .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      currentStep = 'Huỷ đăng ký push cũ trên trình duyệt';
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe().catch(err => {
          console.warn('Lỗi khi huỷ đăng ký cũ:', err);
        });
      }

      currentStep = 'Tạo token đăng ký (Web Push Service của Google/Apple)';
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      currentStep = 'Đồng bộ token đăng ký lên máy chủ qua Socket';
      // Lưu trữ subscription và public key tương ứng vào LocalStorage
      localStorage.setItem('chat_push_subscription', JSON.stringify(subscription));
      localStorage.setItem('chat_vapid_public_key', publicKey);

      if (socket && socket.connected) {
        return new Promise((resolve) => {
          socket.emit('sync-push-subscription', { subscription }, (res) => {
            if (res && res.success) {
              console.log('Đăng ký nhận thông báo đẩy thành công qua Socket.');
              setPushStatus('granted');
              resolve({ success: true });
            } else {
              resolve({ success: false, error: res?.error || 'Đồng bộ qua socket thất bại.' });
            }
          });
        });
      } else {
        // Nếu chưa có socket kết nối, lưu trữ thành công cục bộ vẫn được coi là tạm thời thành công
        // vì khi socket kết nối nó sẽ tự động được gửi lên server.
        console.log('Lưu token cục bộ thành công, sẽ đồng bộ khi có kết nối socket.');
        setPushStatus('granted');
        return { success: true };
      }
    } catch (e) {
      console.error('Lỗi thiết lập thông báo đẩy:', e);
      // Nếu offline mà quyền đã được cấp, giữ trạng thái là granted để không hiện banner
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        setPushStatus('granted');
      } else {
        setPushStatus('prompt');
      }
      return { success: false, error: `[Bản vá - Lỗi tại bước: ${currentStep}] ${e.message || 'Lỗi mạng hoặc kết nối.'}` };
    }
  }, [socket, API_URL]);

  // Kích hoạt xin quyền và đăng ký thông báo đẩy thông qua Cử chỉ Người dùng (User Gesture)
  const handleEnablePushNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Trình duyệt hoặc thiết bị này không hỗ trợ thông báo đẩy.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushStatus('checking');
        const res = await subscribeUserToPush(token);
        if (res.success) {
          alert('Bật thông báo đẩy thành công!');
        } else {
          alert(`Đăng ký với máy chủ thất bại. Chi tiết: ${res.error}\n\nVui lòng tải lại trang và thử lại.`);
        }
      } else if (permission === 'denied') {
        setPushStatus('denied');
        alert('Bạn đã chặn quyền thông báo. Vui lòng bật lại quyền thông báo trong cài đặt trình duyệt.');
      } else {
        setPushStatus('prompt');
      }
    } catch (err) {
      console.error('Lỗi khi kích hoạt thông báo:', err);
      alert('Đã xảy ra lỗi hệ thống: ' + err.message);
    }
  }, [token, subscribeUserToPush]);

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
    dismissPushBanner,
  };
}
