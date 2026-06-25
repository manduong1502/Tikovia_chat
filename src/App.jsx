import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import io from 'socket.io-client';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import RightSidebar from './components/RightSidebar';
import VideoCall from './components/VideoCall';
import NetworkBanner from './components/NetworkBanner';
import { useRegisterSW } from 'virtual:pwa-register/react';
import Avatar from './components/Avatar';
import { FiMessageSquare, FiUsers, FiCompass, FiBookOpen, FiUser, FiSearch, FiCheckSquare } from 'react-icons/fi';

const ProfileView = React.lazy(() => import('./components/ProfileView'));
const TasksView = React.lazy(() => import('./components/TasksView'));


export default function App() {
  // Tự động phát hiện và cập nhật Service Worker khi có code mới trên server
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Quét tìm bản cập nhật mới mỗi 30 giây chạy ngầm
      r && setInterval(() => {
        r.update();
      }, 30000);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      console.log('[PWA] Phát hiện phiên bản mới của ứng dụng. Đang tự động cập nhật và reload...');
      updateServiceWorker(true);
    }
  }, [needRefresh]);

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [socket, setSocket] = useState(null);
  const [conversations, setConversations] = useState(() => {
    try {
      const cached = localStorage.getItem('chat_conversations_cache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.error('Lỗi khôi phục cache conversations:', e);
      return [];
    }
  });
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]); // Danh sách người đang gõ chữ
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Sidebars toggle
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [mobileActiveView, setMobileActiveView] = useState('list'); // 'list', 'chat', 'options'
  const [showProfile, setShowProfile] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [lightboxImage, setLightboxImage] = useState(null);

  // Trạng thái thông báo đẩy (Web Push)
  const [pushStatus, setPushStatus] = useState('checking'); // 'checking', 'granted', 'prompt', 'denied', 'unsupported', 'insecure'
  const [dismissedPushBanner, setDismissedPushBanner] = useState(
    localStorage.getItem('chat_dismissed_push_banner') === 'true'
  );

  // Offline status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineOutbox, setOfflineOutbox] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_offline_outbox');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Lỗi khôi phục outbox từ localStorage:', e);
      return [];
    }
  });

  const offlineOutboxRef = useRef(offlineOutbox);

  useEffect(() => {
    offlineOutboxRef.current = offlineOutbox;
    try {
      localStorage.setItem('chat_offline_outbox', JSON.stringify(offlineOutbox));
    } catch (e) {
      console.error('Lỗi lưu outbox vào localStorage:', e);
    }
  }, [offlineOutbox]);

  // WebRTC Calling States
  const [callState, setCallState] = useState('idle'); // 'idle', 'calling', 'incoming', 'connected'
  const [callInfo, setCallInfo] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerInstance, setPeerInstance] = useState(null);

  const activeConversationRef = useRef(null);
  const conversationsRef = useRef(conversations);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Đồng bộ activeConversationRef để lướt socket dùng đúng state mới nhất
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  // Đồng bộ danh sách cuộc hội thoại vào ref để tránh stale closure
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Khôi phục phiên đăng nhập từ LocalStorage & tự động tải lại khi Service Worker cập nhật
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
  const handleAuthSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
  };

  // Đăng xuất
  const handleLogout = async () => {
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
    setConversations([]);
    setActiveConversation(null);
    setMessages([]);
    setMobileActiveView('list');
  };

  // Lấy số lượng công việc chưa hoàn thành được giao cho tôi
  const fetchGlobalTasksCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const count = (data.assignedToMe || []).filter(t => t.status === 'pending' || t.status === 'in_progress').length;
        setPendingTasksCount(count);
      }
    } catch (e) {
      console.error('Lỗi lấy số lượng công việc:', e);
    }
  }, [token, API_URL]);

  const fetchGlobalTasksCountRef = useRef(fetchGlobalTasksCount);
  useEffect(() => {
    fetchGlobalTasksCountRef.current = fetchGlobalTasksCount;
  }, [fetchGlobalTasksCount]);

  // Khởi tạo Socket.io với cấu hình tự động kết nối lại mạnh mẽ
  useEffect(() => {
    if (!token || !user) return;

    const socketUrl = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL;
    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'], // Đảm bảo hoạt động kể cả khi tường lửa chặn Websocket
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket.io connected:', newSocket.id);
      newSocket.emit('register-user', user.id);
      
      // QUAN TRỌNG: Tự động tham gia lại phòng chat đang xem khi socket kết nối/kết nối lại
      const activeConv = activeConversationRef.current;
      if (activeConv) {
        newSocket.emit('join-conversation', activeConv.id);
        console.log(`[Socket.io] Tự động tham gia lại phòng chat: ${activeConv.id}`);
      }
      
      // Tự động đồng bộ Push Subscription từ LocalStorage lên server qua socket khi kết nối thành công!
      const savedSub = localStorage.getItem('chat_push_subscription');
      if (savedSub) {
        try {
          const subscription = JSON.parse(savedSub);
          newSocket.emit('sync-push-subscription', { subscription });
        } catch (e) {
          console.error('Lỗi phân tích cú pháp push token lưu trữ:', e);
        }
      }
      
      // Đồng bộ các tin nhắn offline lên server khi có mạng lại
      sendOfflineOutbox(newSocket);
    });

    // Lắng nghe tin nhắn mới
    newSocket.on('receive-message', (newMessage) => {
      // Nếu tin nhắn thuộc cuộc hội thoại đang active
      const activeConv = activeConversationRef.current;
      if (activeConv && activeConv.id === newMessage.conversationId) {
        setMessages(prev => {
          // Tránh trùng lặp nếu đã tồn tại tin nhắn với ID thật
          if (prev.some(m => m.id === newMessage.id)) return prev;

          // Thay thế tin nhắn nháp (Optimistic UI) bằng tin nhắn chính thức từ DB
          if (newMessage.tempId) {
            const index = prev.findIndex(m => m.id === newMessage.tempId);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = { ...newMessage, tempId: undefined };
              return updated;
            }
          }

          // Fallback: Tìm theo nội dung, người gửi và trạng thái 'sending' nếu mất tempId
          const fallbackIndex = prev.findIndex(m => 
            m.status === 'sending' && 
            m.senderId === newMessage.senderId && 
            m.content === newMessage.content &&
            m.type === newMessage.type
          );
          if (fallbackIndex !== -1) {
            const updated = [...prev];
            updated[fallbackIndex] = { ...newMessage, tempId: undefined };
            return updated;
          }

          return [...prev, newMessage];
        });
      }

      if (newMessage.type === 'task') {
        fetchGlobalTasksCountRef.current();
      }

      // Cập nhật tin nhắn cuối cùng trong danh sách sidebar
      fetchConversations();
    });

    // Lắng nghe cập nhật cuộc hội thoại
    newSocket.on('conversation-updated', () => {
      fetchConversations();
    });

    // Lắng nghe trạng thái online/offline
    newSocket.on('user-status-changed', ({ userId, status }) => {
      setOnlineUsers(prev => {
        if (status === 'online') {
          return prev.includes(userId) ? prev : [...prev, userId];
        } else {
          return prev.filter(id => id !== userId);
        }
      });
    });

    // Lắng nghe ghim tin nhắn
    newSocket.on('message-pin-toggled', ({ messageId, isPinned, message }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned, pinnedBy: message.pinnedBy, pinnedAt: message.pinnedAt } : m));
    });

    // Lắng nghe cập nhật cảm xúc tin nhắn
    newSocket.on('message-reaction-updated', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    });

    // Lắng nghe tin nhắn bị thu hồi
    newSocket.on('message-recalled', ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isRecalled: true, content: null, metadata: null, isPinned: false, pinnedBy: null, pinnedAt: null } : m));
    });

    // Lắng nghe cập nhật trạng thái công việc
    newSocket.on('task-status-updated', ({ taskId, status, assigneeId, assigneeName }) => {
      setMessages(prev => prev.map(m => {
        if (m.type === 'task') {
          try {
            const meta = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
            if (meta && meta.taskId === taskId) {
              meta.status = status;
              if (assigneeId) {
                meta.assigneeId = assigneeId;
                meta.assigneeName = assigneeName;
              }
              return { ...m, metadata: JSON.stringify(meta) };
            }
          } catch (e) {
            console.error('Lỗi phân tích metadata khi cập nhật trạng thái task:', e);
          }
        }
        return m;
      }));
      fetchGlobalTasksCountRef.current();
    });

    // Lắng nghe nhắc hẹn đến giờ kích hoạt
    newSocket.on('reminder-trigger', (reminder) => {
      // 1. Hiện thông báo đẩy trên trình duyệt
      if (Notification.permission === 'granted') {
        new Notification(`⏰ Nhắc hẹn: ${reminder.title}`, {
          body: `Tạo bởi: ${reminder.creatorName}`,
          icon: '/favicon.ico'
        });
      } else {
        // 2. Alert in-app
        alert(`⏰ [Nhắc hẹn] ${reminder.title} (Tạo bởi: ${reminder.creatorName})`);
      }
    });

    // Không tự động xin quyền thông báo ở đây để tránh bị trình duyệt di động chặn

    return () => {
      newSocket.disconnect();
    };
  }, [token, user]);

  // Tải danh sách các cuộc hội thoại
  const fetchConversations = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);

        // Cache danh sách cuộc trò chuyện để xem offline
        localStorage.setItem('chat_conversations_cache', JSON.stringify(data));

        // Thu thập trạng thái online của các thành viên khác
        const onlineIds = [];
        data.forEach(c => {
          c.members.forEach(m => {
            if (m.user.id !== user.id && m.user.status === 'online') {
              onlineIds.push(m.user.id);
            }
          });
        });
        setOnlineUsers(Array.from(new Set(onlineIds)));
      }
    } catch (e) {
      console.error('Lỗi tải danh sách chat:', e);
    }
  };

  // Kiểm tra trạng thái hỗ trợ và quyền của Push Notifications
  const checkPushNotificationStatus = async () => {
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
  };

  // Đăng ký nhận thông báo đẩy (Web Push) lên server
  const subscribeUserToPush = async (userToken) => {
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
  };

  // Kích hoạt xin quyền và đăng ký thông báo đẩy thông qua Cử chỉ Người dùng (User Gesture)
  const handleEnablePushNotifications = async () => {
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
  };

  // Lắng nghe tín hiệu chuyển đổi phòng chat từ Service Worker (khi click vào thông báo đẩy)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleSWMessage = (event) => {
      if (event.data && event.data.type === 'SWITCH_CONVERSATION') {
        const { conversationId } = event.data;
        console.log('[App] Nhận tín hiệu chuyển phòng chat từ Service Worker:', conversationId);
        
        // Tìm cuộc trò chuyện dùng ref để tránh stale closure
        const currentConvs = conversationsRef.current;
        const targetConv = currentConvs.find(c => c.id === conversationId);
        if (targetConv) {
          setActiveConversation(targetConv);
          setMobileActiveView('chat');
        } else {
          // Nếu không tìm thấy (ví dụ cuộc trò chuyện mới), tải lại danh sách rồi tìm
          fetchConversations().then(() => {
            setConversations(latestConvs => {
              const conv = latestConvs.find(c => c.id === conversationId);
              if (conv) {
                setActiveConversation(conv);
                setMobileActiveView('chat');
              }
              return latestConvs;
            });
          });
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    };
  }, [token]);

  // Tự động kiểm tra và chuyển hướng phòng chat từ URL query parameter (convId)
  useEffect(() => {
    if (conversations && conversations.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const convId = urlParams.get('convId');
      if (convId) {
        const target = conversations.find(c => c.id === convId);
        if (target) {
          console.log('[App] Tự động mở cuộc trò chuyện từ URL:', convId);
          setActiveConversation(target);
          setMobileActiveView('chat');
          
          // Xóa query parameter khỏi thanh địa chỉ mà không reload trang
          const url = new URL(window.location.href);
          url.searchParams.delete('convId');
          window.history.replaceState({}, '', url.pathname + url.search);
        }
      }
    }
  }, [conversations]);

  // Gọi fetchConversations khi login xong và kiểm tra quyền thông báo đẩy
  useEffect(() => {
    if (token) {
      fetchConversations();
      fetchGlobalTasksCount();
      checkPushNotificationStatus();
      
      // Nếu quyền đã được bật từ trước, chạy đồng bộ nền mà không cần click của người dùng
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        subscribeUserToPush(token);
      }
    }
  }, [token]);

  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Reset hasMoreMessages khi đổi phòng chat
  useEffect(() => {
    setHasMoreMessages(true);
  }, [activeConversation]);

  // Tải lịch sử tin nhắn khi đổi cuộc hội thoại active
  useEffect(() => {
    if (!activeConversation || !token) return;

    fetch(`${API_URL}/chat/conversations/${activeConversation.id}/messages?limit=50`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setMessages(data);
        if (data.length < 50) {
          setHasMoreMessages(false);
        }
      })
      .catch(err => console.error('Lỗi tải tin nhắn:', err));

    // Đăng ký join room socket
    if (socket) {
      socket.emit('join-conversation', activeConversation.id);
    }
  }, [activeConversation, token, socket]);

  // Tải các tin nhắn cũ hơn (Phân trang cuộc trò chuyện)
  const fetchOlderMessages = async () => {
    if (isLoadingOlder || !hasMoreMessages || !activeConversation || !token || messages.length === 0) return;

    setIsLoadingOlder(true);
    const oldestMessageId = messages[0].id;

    try {
      const res = await fetch(`${API_URL}/chat/conversations/${activeConversation.id}/messages?before=${oldestMessageId}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length < 50) {
          setHasMoreMessages(false);
        }
        if (data.length > 0) {
          setMessages(prev => [...data, ...prev]);
        }
      }
    } catch (e) {
      console.error('Lỗi tải tin nhắn cũ:', e);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Đồng bộ activeConversation.id vào IndexedDB để Service Worker nhận diện cuộc trò chuyện đang xem
  useEffect(() => {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      const saveActiveConversationId = (id) => {
        const request = indexedDB.open('ChatTikoviaDB', 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings');
          }
        };
        request.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction('settings', 'readwrite');
          const store = tx.objectStore('settings');
          store.put(id, 'activeConversationId');
        };
      };
      saveActiveConversationId(activeConversation ? activeConversation.id : null);
    }
  }, [activeConversation]);

  // Gửi tin nhắn mới (hỗ trợ Optimistic UI và offline outbox)
  const handleSendMessage = (messageData) => {
    const tempId = 'temp-' + Date.now();
    const payload = {
      ...messageData,
      senderId: user.id,
      tempId // Gửi kèm tempId để server phản hồi khớp tin nhắn
    };
    
    const fullMessage = {
      id: tempId,
      senderId: user.id,
      sender: {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        username: user.username
      },
      createdAt: new Date().toISOString(),
      status: 'sending', // Tất cả tin nhắn mới gửi đi đều có status 'sending' để hiển thị tức thì
      ...messageData
    };

    // Hiển thị ngay lập tức trên giao diện
    setMessages(prev => [...prev, fullMessage]);

    if (isOnline && socket && socket.connected) {
      // Online gửi qua socket
      socket.emit('send-message', payload);
    } else {
      // Offline: Lưu tạm vào outbox
      setOfflineOutbox(prev => [...prev, payload]);
      console.log('Đang offline, đã lưu tin nhắn vào outbox tạm.');
    }
  };

  // Đồng bộ Outbox khi có mạng lại
  const sendOfflineOutbox = (socketConn) => {
    const currentOutbox = offlineOutboxRef.current;
    if (currentOutbox.length === 0) return;
    console.log(`Bắt đầu đồng bộ ${currentOutbox.length} tin nhắn từ outbox...`);
    currentOutbox.forEach(msg => {
      socketConn.emit('send-message', msg);
    });
    setOfflineOutbox([]);
  };

  // Ghim tin nhắn qua socket
  const handlePinMessage = (messageId, conversationId) => {
    if (socket) {
      socket.emit('pin-message', { messageId, conversationId, pinnedBy: user.id });
    }
  };

  // Thả / hủy / đổi cảm xúc qua socket
  const handleToggleReaction = (messageId, emojiType) => {
    if (socket && activeConversation) {
      socket.emit('toggle-reaction', {
        messageId,
        userId: user.id,
        type: emojiType,
        conversationId: activeConversation.id
      });
    }
  };

  // Thu hồi / Gỡ tin nhắn qua socket
  const handleRecallMessage = (messageId) => {
    if (socket && activeConversation) {
      socket.emit('recall-message', {
        messageId,
        conversationId: activeConversation.id,
        userId: user.id
      });
    }
  };

  // Xóa tin nhắn phía tôi qua REST API
  const handleDeleteMessageForMe = async (messageId) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/chat/messages/${messageId}/delete-for-me`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      } else {
        const errData = await res.json();
        alert(errData.error || 'Lỗi khi xóa tin nhắn');
      }
    } catch (e) {
      console.error('Lỗi xóa tin nhắn:', e);
    }
  };

  // Nhận tín hiệu gọi thoại/video từ nút đầu trang chat
  const handleStartCall = (isVideoCall) => {
    if (!activeConversation) return;
    const otherMember = activeConversation.members.find(m => m.user.id !== user.id);
    if (!otherMember) return;

    setCallInfo({
      to: otherMember.user.id,
      from: user.id,
      callerName: otherMember.user.displayName,
      callerAvatar: otherMember.user.avatarUrl,
      isVideo: isVideoCall
    });
    setCallState('calling');
  };

  // Cập nhật biệt danh hiển thị
  const handleUpdateNickname = (targetUserId, nickname) => {
    // Cập nhật state active conversation
    setActiveConversation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        members: prev.members.map(m => m.user.id === targetUserId ? { ...m, nickname } : m)
      };
    });
    fetchConversations();
  };

  const bottomNavItems = [
    { id: 'list', label: 'Tin nhắn', icon: FiMessageSquare },
    { id: 'contacts', label: 'Danh bạ', icon: FiUsers },
    { id: 'tasks', label: 'Công việc', icon: FiCheckSquare },
    { id: 'diary', label: 'Nhật ký', icon: FiBookOpen },
    { id: 'profile', label: 'Cá nhân', icon: FiUser },
  ];

  let activeTabId = showProfile ? 'profile' : mobileActiveView;
  if (activeTabId === 'chat' || activeTabId === 'options') {
    activeTabId = 'list';
  }
  const activeIndex = bottomNavItems.findIndex(item => item.id === activeTabId);
  const capsuleStyle = activeIndex !== -1 ? {
    width: 'calc(20% - 12px)',
    left: `calc(${activeIndex * 20}% + 6px)`,
  } : {};

  const showBottomNav = ['list', 'contacts', 'tasks', 'diary', 'profile'].includes(mobileActiveView) || showProfile;

  // Style configurations for custom views
  const sidebarPlaceholderStyle = {
    width: '340px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid var(--border-color)',
    zIndex: 10
  };

  const placeholderHeaderStyle = {
    padding: '20px',
    borderBottom: '1px solid var(--border-color)',
    marginBottom: '15px'
  };

  const placeholderTitleStyle = {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0
  };

  const placeholderSubStyle = {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)'
  };

  const contactCategoryStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  };

  const contactCategoryHeaderStyle = {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--primary)',
    marginBottom: '4px'
  };

  const contactItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid transparent',
    cursor: 'pointer'
  };

  const contactNameStyle = {
    fontSize: '0.88rem',
    fontWeight: '600',
    color: 'var(--text-primary)'
  };

  const contactStatusStyle = {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)'
  };

  const discoverBannerStyle = {
    background: 'var(--primary-gradient)',
    padding: '16px',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.2)',
    marginBottom: '15px'
  };

  const discoverGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginTop: '10px'
  };

  const discoverItemStyle = {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    cursor: 'pointer'
  };

  const discoverIconStyle = {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.3rem',
    marginBottom: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
  };

  const discoverItemTitleStyle = {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '2px'
  };

  const discoverItemDescStyle = {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)'
  };

  const diaryPostBoxStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-color)'
  };

  const diaryInputStyle = {
    flex: 1,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    padding: '8px 16px',
    fontSize: '0.82rem',
    color: 'var(--text-primary)',
    outline: 'none',
    cursor: 'pointer'
  };

  const diaryPostCardStyle = {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  };

  const diaryPostHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  };

  const diaryPostAuthorStyle = {
    fontSize: '0.88rem',
    fontWeight: '600',
    color: 'var(--text-primary)'
  };

  const diaryPostTimeStyle = {
    fontSize: '0.7rem',
    color: 'var(--text-muted)'
  };

  const diaryPostContentStyle = {
    fontSize: '0.85rem',
    lineHeight: '1.25rem',
    color: 'var(--text-primary)'
  };

  const diaryPostFooterStyle = {
    display: 'flex',
    gap: '12px',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '10px',
    marginTop: '4px'
  };

  const diaryActionBtnStyle = {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-color)',
    borderRadius: '14px',
    padding: '4px 12px',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  };

  const renderContactsView = () => {
    return (
      <div className={`glass mobile-only-view mobile-list-padding ${mobileActiveView === 'contacts' ? 'mobile-show-list' : 'mobile-hide-list'}`} style={sidebarPlaceholderStyle}>
        <div style={placeholderHeaderStyle}>
          <h3 style={placeholderTitleStyle}>Danh bạ</h3>
          <span style={placeholderSubStyle}>Danh sách bạn bè & nhóm</span>
        </div>
        <div style={{ padding: '0 20px 10px 20px' }}>
          <div style={styles.searchWrapper}>
            <FiSearch style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Tìm kiếm danh bạ..."
              className="input-premium"
              style={styles.searchInput}
              readOnly
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }}>
          <div style={contactCategoryStyle}>
            <div style={contactCategoryHeaderStyle}>🏷️ Danh mục</div>
            <div style={contactItemStyle} className="btn-interactive">
              <span style={{ fontSize: '1.2rem' }}>🤝</span>
              <div>
                <div style={contactNameStyle}>Lời mời kết bạn</div>
                <div style={contactStatusStyle}>3 lời mời đang chờ</div>
              </div>
              <span className="badge-count" style={{ marginLeft: 'auto' }}>3</span>
            </div>
            <div style={contactItemStyle} className="btn-interactive">
              <span style={{ fontSize: '1.2rem' }}>👥</span>
              <div>
                <div style={contactNameStyle}>Danh sách nhóm</div>
                <div style={contactStatusStyle}>Quản lý các nhóm chat</div>
              </div>
            </div>
          </div>
          
          <div style={{ ...contactCategoryStyle, marginTop: '20px' }}>
            <div style={contactCategoryHeaderStyle}>👤 Bạn bè mới truy cập</div>
            {[
              { name: 'Nguyễn Hoài Nam', username: 'namnh', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=nam', status: 'Trực tuyến', online: true },
              { name: 'Phạm Minh Tuấn', username: 'tuanpm', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=tuan', status: 'Hoạt động 5 phút trước', online: false },
              { name: 'Lê Thuỳ Trang', username: 'tranglt', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=trang', status: 'Trực tuyến', online: true }
            ].map((c, i) => (
              <div key={i} style={contactItemStyle} className="btn-interactive">
                <Avatar url={c.avatar} name={c.name} size={36} isOnline={c.online} />
                <div>
                  <div style={contactNameStyle}>{c.name}</div>
                  <div style={contactStatusStyle}>@{c.username} • {c.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDiscoverView = () => {
    return (
      <div className={`glass mobile-only-view mobile-list-padding ${mobileActiveView === 'discover' ? 'mobile-show-list' : 'mobile-hide-list'}`} style={sidebarPlaceholderStyle}>
        <div style={placeholderHeaderStyle}>
          <h3 style={placeholderTitleStyle}>Khám phá</h3>
          <span style={placeholderSubStyle}>Tiện ích & Dịch vụ</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }}>
          <div style={discoverBannerStyle}>
            <div style={{ fontWeight: '700', fontSize: '1rem', color: '#fff', marginBottom: '4px' }}>Khám Phá Tikovia Space</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>Trải nghiệm hệ sinh thái mini app đỉnh cao</div>
          </div>
          
          <div style={{ marginTop: '20px' }}>
            <div style={contactCategoryHeaderStyle}>🚀 Mini Apps nổi bật</div>
            <div style={discoverGridStyle}>
              {[
                { title: 'Trò chơi', desc: 'Giải trí đỉnh cao', icon: '🎮', color: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)' },
                { title: 'Âm nhạc', desc: 'Nghe nhạc online', icon: '🎵', color: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' },
                { title: 'Thời tiết', desc: 'Dự báo chi tiết', icon: '🌤️', color: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)' },
                { title: 'Tin tức', desc: 'Cập nhật 24h', icon: '📰', color: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
                { title: 'Quét QR', desc: 'Tiện ích quét nhanh', icon: '🔍', color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
                { title: 'Ví điện tử', desc: 'Thanh toán tiện lợi', icon: '💳', color: 'linear-gradient(135deg, #64748b 0%, #475569 100%)' }
              ].map((app, i) => (
                <div key={i} style={discoverItemStyle} className="btn-interactive">
                  <div style={{ ...discoverIconStyle, background: app.color }}>{app.icon}</div>
                  <div style={discoverItemTitleStyle}>{app.title}</div>
                  <div style={discoverItemDescStyle}>{app.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDiaryView = () => {
    return (
      <div className={`glass mobile-only-view mobile-list-padding ${mobileActiveView === 'diary' ? 'mobile-show-list' : 'mobile-hide-list'}`} style={sidebarPlaceholderStyle}>
        <div style={placeholderHeaderStyle}>
          <h3 style={placeholderTitleStyle}>Nhật ký</h3>
          <span style={placeholderSubStyle}>Khoảnh khắc đáng nhớ</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }}>
          {/* Post Box */}
          <div style={diaryPostBoxStyle} className="glass-card">
            <Avatar url={user.avatarUrl} name={user.displayName} size={36} />
            <input
              type="text"
              placeholder="Hôm nay bạn thế nào?"
              style={diaryInputStyle}
              readOnly
            />
            <span style={{ fontSize: '1.2rem', cursor: 'pointer' }}>📷</span>
          </div>
  
          {/* Feeds */}
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              {
                author: 'Nguyễn Hoài Nam',
                avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=nam',
                time: '1 giờ trước',
                content: 'Vừa hoàn thành xong giao diện mới của Tikovia Chat! Trông mượt mà và xịn xò thực sự 😍',
                likes: 12,
                comments: 4
              },
              {
                author: 'Lê Thuỳ Trang',
                avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=trang',
                time: '5 giờ trước',
                content: 'Cuối tuần bình yên bên tách cà phê ☕ Chúc mọi người một ngày mới tràn đầy năng lượng nha!',
                likes: 24,
                comments: 8
              }
            ].map((post, i) => (
              <div key={i} style={diaryPostCardStyle} className="glass-card">
                <div style={diaryPostHeaderStyle}>
                  <Avatar url={post.avatar} name={post.author} size={36} />
                  <div>
                    <div style={diaryPostAuthorStyle}>{post.author}</div>
                    <div style={diaryPostTimeStyle}>{post.time}</div>
                  </div>
                </div>
                <div style={diaryPostContentStyle}>{post.content}</div>
                <div style={diaryPostFooterStyle}>
                  <button style={diaryActionBtnStyle} className="btn-interactive" type="button">❤️ {post.likes}</button>
                  <button style={diaryActionBtnStyle} className="btn-interactive" type="button">💬 {post.comments}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };


  if (!token || !user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div style={styles.appContainer}>
      <NetworkBanner />


      <div style={styles.mainLayout}>
        {/* 1. Left Sidebar */}
        <Sidebar
          user={user}
          token={token}
          conversations={conversations}
          activeConversation={activeConversation}
          setActiveConversation={(conv) => {
            setActiveConversation(conv);
            setMobileActiveView('chat');
          }}
          onlineUsers={onlineUsers}
          onLogout={handleLogout}
          onRefreshConversations={fetchConversations}
          onShowProfile={() => setShowProfile(true)}
          mobileActiveView={mobileActiveView}
          setMobileActiveView={setMobileActiveView}
          className={mobileActiveView === 'list' ? 'mobile-show-list' : 'mobile-hide-list'}
          theme={theme}
          toggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
          pushStatus={pushStatus}
          onEnablePush={handleEnablePushNotifications}
          dismissedPushBanner={dismissedPushBanner}
          onDismissPushBanner={() => {
            localStorage.setItem('chat_dismissed_push_banner', 'true');
            setDismissedPushBanner(true);
          }}
          onShowTasks={() => {
            setShowTasks(prev => !prev);
            setShowProfile(false);
          }}
          pendingTasksCount={pendingTasksCount}
        />

        {/* Mock custom views for contacts, diary */}
        {renderContactsView()}
        {renderDiaryView()}

        {/* 2. Center Chat window or Tasks View */}
        {showTasks || mobileActiveView === 'tasks' ? (
          <Suspense fallback={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', background: 'var(--bg-chat-gradient)', color: 'var(--text-secondary)' }}>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <p style={{ marginTop: '10px', fontSize: '0.85rem' }}>Đang tải bảng công việc...</p>
            </div>
          }>
            <TasksView
              user={user}
              token={token}
              onClose={() => {
                setShowTasks(false);
                if (mobileActiveView === 'tasks') {
                  setMobileActiveView('list');
                }
              }}
              onSelectConversation={(convId) => {
                const target = conversations.find(c => c.id === convId);
                if (target) {
                  setActiveConversation(target);
                  setShowTasks(false);
                  setMobileActiveView('chat');
                }
              }}
              socket={socket}
              mobileActiveView={mobileActiveView}
              setMobileActiveView={setMobileActiveView}
              className={(showTasks || mobileActiveView === 'tasks') ? 'mobile-show-chat' : 'mobile-hide-chat'}
            />
          </Suspense>
        ) : (
          <ChatWindow
            user={user}
            token={token}
            conversation={activeConversation}
            messages={messages}
            typingUsers={typingUsers}
            onSendMessage={handleSendMessage}
            onPinMessage={handlePinMessage}
            onToggleReaction={handleToggleReaction}
            onRecallMessage={handleRecallMessage}
            onDeleteMessage={handleDeleteMessageForMe}
            onStartCall={handleStartCall}
            toggleRightSidebar={() => {
              const nextState = !showRightSidebar;
              setShowRightSidebar(nextState);
              if (nextState) {
                setMobileActiveView('options');
              } else {
                setMobileActiveView('chat');
              }
            }}
            onlineUsers={onlineUsers}
            mobileActiveView={mobileActiveView}
            setMobileActiveView={setMobileActiveView}
            className={mobileActiveView === 'chat' ? 'mobile-show-chat' : 'mobile-hide-chat'}
            onImageClick={(url) => setLightboxImage(url)}
            fetchOlderMessages={fetchOlderMessages}
            hasMoreMessages={hasMoreMessages}
            isLoadingOlder={isLoadingOlder}
          />
        )}

        {/* 3. Far Right Sidebar (Tùy chọn) */}
        {showRightSidebar && activeConversation && (
          <RightSidebar
            user={user}
            token={token}
            conversation={activeConversation}
            socket={socket}
            onClose={() => {
              setShowRightSidebar(false);
              setMobileActiveView('chat');
            }}
            onUpdateNickname={handleUpdateNickname}
            mobileActiveView={mobileActiveView}
            setMobileActiveView={setMobileActiveView}
            className={mobileActiveView === 'options' ? 'mobile-show-options' : 'mobile-hide-options'}
            onImageClick={(url) => setLightboxImage(url)}
          />
        )}
      </div>

      {/* 4. Overlay Cuộc gọi Video/Thoại */}
      <VideoCall
        user={user}
        token={token}
        socket={socket}
        callState={callState}
        setCallState={setCallState}
        callInfo={callInfo}
        setCallInfo={setCallInfo}
        localStream={localStream}
        setLocalStream={setLocalStream}
        remoteStream={remoteStream}
        setRemoteStream={setRemoteStream}
        peerInstance={peerInstance}
        setPeerInstance={setPeerInstance}
        conversation={activeConversation}
      />

      {/* 5. Overlay Trang cá nhân (Profile) */}
      {showProfile && (
        <Suspense fallback={
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(10px)' }}>
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
          </div>
        }>
          <ProfileView
            user={user}
            token={token}
            onClose={() => {
              setShowProfile(false);
              if (mobileActiveView === 'profile') {
                setMobileActiveView('list');
              }
            }}
            onProfileUpdate={(updatedUser) => {
              setUser(updatedUser);
              fetchConversations();
            }}
            pushStatus={pushStatus}
            onEnablePush={handleEnablePushNotifications}
            mobileActiveView={mobileActiveView}
          />
        </Suspense>
      )}

      {/* 6. Lightbox Xem Ảnh Toàn Màn Hình */}
      {lightboxImage && (
        <div 
          style={styles.lightboxOverlay} 
          onClick={() => setLightboxImage(null)}
          className="anim-fade"
        >
          <button 
            style={styles.lightboxCloseBtn} 
            onClick={(e) => {
              e.stopPropagation();
              setLightboxImage(null);
            }}
          >
            ✕
          </button>
          <img 
            src={lightboxImage} 
            alt="Preview" 
            style={styles.lightboxImg} 
            onClick={(e) => e.stopPropagation()}
            className="anim-scale-in"
          />
        </div>
      )}

      {/* 7. Floating Bottom Navigation Bar (Mobile only) */}
      {showBottomNav && (
        <div className="bottom-nav-floating">
          <div className="bottom-nav-capsule" style={capsuleStyle}></div>
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTabId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'profile') {
                    setShowProfile(true);
                    setMobileActiveView('profile');
                  } else {
                    setShowProfile(false);
                    setMobileActiveView(item.id);
                  }
                }}
                className={`bottom-nav-item-floating ${isActive ? 'active' : ''}`}
              >
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Icon size={20} />
                  {item.id === 'tasks' && pendingTasksCount > 0 && (
                    <span style={styles.badge}>
                      {pendingTasksCount}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.68rem', marginTop: '2px' }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

}

const styles = {
  appContainer: {
    height: '100%',
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-primary)'
  },
  offlineBanner: {
    background: 'var(--danger)',
    color: '#ffffff',
    padding: '6px',
    fontSize: '0.8rem',
    fontWeight: '600',
    textAlign: 'center',
    zIndex: 999
  },
  mainLayout: {
    flex: 1,
    display: 'flex',
    height: '100%',
    width: '100%',
    overflow: 'hidden'
  },
  lightboxOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'rgba(255, 255, 255, 0.15)',
    border: 'none',
    color: '#ffffff',
    fontSize: '24px',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
    zIndex: 100000
  },
  lightboxImg: {
    maxWidth: '90%',
    maxHeight: '90%',
    objectFit: 'contain',
    borderRadius: 'var(--radius-sm)',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
  },
  badge: {
    position: 'absolute',
    top: '-6px',
    right: '-10px',
    backgroundColor: 'var(--danger)',
    color: 'white',
    borderRadius: '10px',
    padding: '2px 5px',
    fontSize: '0.62rem',
    fontWeight: '700',
    lineHeight: '1',
    border: '2px solid var(--bg-secondary)',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '16px',
    height: '16px'
  }
};
