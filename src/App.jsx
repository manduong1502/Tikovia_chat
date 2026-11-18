import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import io from 'socket.io-client';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import RightSidebar from './components/RightSidebar';
import VideoCall from './components/VideoCall';
import NetworkBanner from './components/NetworkBanner';
import ContactsView from './components/ContactsView';
import Lightbox from './components/Lightbox';
import BottomNav from './components/BottomNav';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Hooks
import useAuth from './hooks/useAuth';
import useCall from './hooks/useCall';
import usePushNotification from './hooks/usePushNotification';
import { initAudioUnlock, playNotificationChime } from './utils/sound';

const ProfileView = React.lazy(() => import('./components/ProfileView'));
const TasksView = React.lazy(() => import('./components/TasksView'));

export default function App() {
  // Mở khóa AudioContext & HTML5 Audio ngay từ cử chỉ chạm đầu tiên trên điện thoại (iOS/Android)
  useEffect(() => {
    initAudioUnlock();
  }, []);
  // === PWA Service Worker Auto-Update ===
  // Kiểm tra bản mới khi mở lại ứng dụng + định kỳ 30 phút (trước đây 30 giây/lần → tốn pin & dữ liệu di động)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegistered(r) {
      if (!r) return;
      r.update();
      let lastCheck = Date.now();
      const checkForUpdate = () => {
        if (Date.now() - lastCheck < 5 * 60 * 1000) return;
        lastCheck = Date.now();
        r.update().catch(() => {});
      };
      setInterval(checkForUpdate, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
    }
  });

  useEffect(() => {
    if (needRefresh) {
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  // Khi có phiên bản mới: KHÔNG tải lại ngay lúc người dùng đang gõ tin hoặc đang gọi điện.
  // Chờ tới lúc ứng dụng bị ẩn (khoá màn hình / chuyển app) rồi mới tải lại trong nền.
  const callStateRef = useRef('idle');
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let refreshing = false;
    let pendingReload = false;

    const reloadNow = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    const tryDeferredReload = () => {
      if (!pendingReload || refreshing) return;
      if (document.visibilityState === 'hidden' && callStateRef.current === 'idle') {
        reloadNow();
      }
    };

    const handleControllerChange = () => {
      if (refreshing) return;
      if (document.visibilityState === 'hidden' && callStateRef.current === 'idle') {
        reloadNow();
      } else {
        pendingReload = true;
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    document.addEventListener('visibilitychange', tryDeferredReload);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', tryDeferredReload);
    };
  }, []);

  // === Auth Hook ===
  const { user, setUser, token, isOnline, handleAuthSuccess, handleLogout, API_URL } = useAuth();

  // === Core Chat State ===
  const [socket, setSocket] = useState(null);
  const [conversations, setConversations] = useState(() => {
    try {
      const cached = localStorage.getItem('chat_conversations_cache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'light' ? '#f6f8fb' : '#0a0d14');
    }
  }, [theme]);

  // === UI State ===
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [mobileActiveView, setMobileActiveView] = useState('list');
  const [showProfile, setShowProfile] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [activeWallpaper, setActiveWallpaper] = useState('');
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [inAppToast, setInAppToast] = useState(null);
  const lastChimeTimeRef = useRef(0);
  const toastTimeoutRef = useRef(null);
  const notifiedMessageIdsRef = useRef(new Set());

  const recordNotifiedMessageId = useCallback((msgId) => {
    if (!msgId) return false;
    const set = notifiedMessageIdsRef.current;
    if (set.has(msgId)) return true;
    set.add(msgId);
    if (set.size > 200) {
      const first = set.values().next().value;
      set.delete(first);
    }
    return false;
  }, []);

  const triggerSoundAndToast = useCallback((toastData, playSound = true) => {
    const now = Date.now();
    if (playSound && now - lastChimeTimeRef.current > 1200) {
      lastChimeTimeRef.current = now;
      playNotificationChime();
    }
    if (toastData) {
      setInAppToast(toastData);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setInAppToast(null);
      }, 4500);
    }
  }, []);

  // === Last Read Timestamps ===
  const [lastReadTimestamps, setLastReadTimestamps] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_last_read_timestamps');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // === Offline Outbox ===
  const [offlineOutbox, setOfflineOutbox] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_offline_outbox');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const offlineOutboxRef = useRef(offlineOutbox);
  useEffect(() => {
    offlineOutboxRef.current = offlineOutbox;
    try {
      localStorage.setItem('chat_offline_outbox', JSON.stringify(offlineOutbox));
    } catch (e) {}
  }, [offlineOutbox]);

  // === Call Hook ===
  const {
    callState, setCallState, callInfo, setCallInfo,
    localStream, setLocalStream, remoteStream, setRemoteStream,
    peerInstance, setPeerInstance, remoteAudioRef, handleStartCall
  } = useCall();

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // === Push Notification Hook ===
  const {
    pushStatus,
    dismissedPushBanner,
    checkPushNotificationStatus,
    handleEnablePushNotifications,
    handleTestPushNotification,
    dismissPushBanner
  } = usePushNotification(token, socket);

  // === Refs ===
  const activeConversationRef = useRef(null);
  const conversationsRef = useRef(conversations);
  const mobileActiveViewRef = useRef(mobileActiveView);
  const messagesRef = useRef(messages);
  const hasMoreMessagesRef = useRef(hasMoreMessages);
  const loadingOlderRef = useRef(false);
  const sessionExpiredRef = useRef(() => {});
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    hasMoreMessagesRef.current = hasMoreMessages;
  }, [hasMoreMessages]);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Lưu bộ nhớ đệm danh sách hội thoại (để mở app hiện ngay) theo kiểu gom nhóm:
  // ghi 1 lần sau 1,2 giây yên lặng hoặc ngay khi ứng dụng bị ẩn, thay vì ghi đồng bộ ở MỖI tin nhắn đến (gây khựng trên điện thoại yếu)
  useEffect(() => {
    if (!token) return undefined;
    const writeCache = () => {
      try {
        localStorage.setItem('chat_conversations_cache', JSON.stringify(conversations));
      } catch (e) {}
    };
    const timer = setTimeout(writeCache, 1200);
    const flushOnHide = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(timer);
        writeCache();
      }
    };
    document.addEventListener('visibilitychange', flushOnHide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', flushOnHide);
    };
  }, [conversations, token]);
  useEffect(() => {
    mobileActiveViewRef.current = mobileActiveView;
  }, [mobileActiveView]);

  // === Fetch Functions ===
  const fetchConversations = useCallback(async (overrideToken = null) => {
    const activeToken = typeof overrideToken === 'string' && overrideToken ? overrideToken : token;
    if (!activeToken) return null;
    try {
      const res = await fetch(`${API_URL}/chat/conversations`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.status === 401) {
        // Chỉ đăng xuất nếu token vừa bị từ chối vẫn là token hiện hành (tránh request cũ vừa bị thay thế khi đổi mật khẩu)
        if (localStorage.getItem('chat_token') === activeToken) {
          sessionExpiredRef.current();
        }
        return null;
      }
      if (res.ok) {
        const data = await res.json();
        setConversations(data);

        if (activeConversationRef.current) {
          const latestActive = data.find((c) => c.id === activeConversationRef.current.id);
          if (latestActive) setActiveConversation(latestActive);
        }

        const onlineIds = [];
        data.forEach((c) => {
          c.members?.forEach((m) => {
            if (m.user?.id !== user?.id && m.user?.status === 'online') {
              onlineIds.push(m.user.id);
            }
          });
        });
        const nextOnline = Array.from(new Set(onlineIds));
        setOnlineUsers((prev) =>
          prev.length === nextOnline.length && nextOnline.every((id) => prev.includes(id)) ? prev : nextOnline
        );
        return data;
      }
    } catch (e) {
      console.error('Lỗi tải danh sách chat:', e);
    }
    return null;
  }, [token, API_URL, user]);

  const fetchGlobalTasksCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const count = (data.assignedToMe || []).filter(
          (t) => t.status === 'pending' || t.status === 'in_progress'
        ).length;
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

  // === Offline Outbox Sync ===
  const sendOfflineOutbox = useCallback((socketConn) => {
    const currentOutbox = offlineOutboxRef.current;
    if (currentOutbox.length === 0) return;
    currentOutbox.forEach((msg) => {
      socketConn.emit('send-message', msg);
    });
    setOfflineOutbox([]);
  }, []);

  // === Socket.io Initialization ===
  useEffect(() => {
    if (!token || !user) return;

    const socketUrl = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL;
    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    setSocket(newSocket);

    // Phiên đăng nhập bị thu hồi (đổi mật khẩu ở máy khác) hoặc token hết hạn → đăng xuất sạch sẽ thiết bị này
    // (Bỏ qua nếu thiết bị này vừa tự đổi mật khẩu và đã lưu token mới vào localStorage)
    newSocket.on('connect_error', (err) => {
      if (localStorage.getItem('chat_token') !== token) return;
      const msg = String(err?.message || '');
      if (msg.includes('Session revoked') || msg.includes('Invalid token') || msg.includes('Token missing')) {
        sessionExpiredRef.current(msg.includes('Session revoked') ? 'revoked' : 'expired');
      }
    });
    newSocket.on('force-logout', () => {
      if (localStorage.getItem('chat_token') !== token) return;
      sessionExpiredRef.current('revoked');
    });

    newSocket.on('connect', () => {
      newSocket.emit('register-user', user.id);

      fetchConversations();
      fetchGlobalTasksCountRef.current();

      const activeConv = activeConversationRef.current;
      if (activeConv) {
        newSocket.emit('join-conversation', activeConv.id);
        fetch(`${API_URL}/chat/conversations/${activeConv.id}/messages?limit=50`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (Array.isArray(data)) {
              setMessages(data);
            }
          })
          .catch(() => {});
      }

      sendOfflineOutbox(newSocket);
    });

    // Lắng nghe tin nhắn mới (Cập nhật state trực tiếp không cần gọi lại fetchConversations)
    newSocket.on('receive-message', (newMessage) => {
      const activeConv = activeConversationRef.current;
      const isChatVisible = window.innerWidth > 768 || mobileActiveViewRef.current === 'chat';
      const isViewingThisConv = Boolean(activeConv && activeConv.id === newMessage.conversationId && isChatVisible);

      if (isViewingThisConv) {
        const nowIso = new Date().toISOString();
        setLastReadTimestamps((prev) => {
          const updated = { ...prev, [newMessage.conversationId]: nowIso };
          localStorage.setItem('chat_last_read_timestamps', JSON.stringify(updated));
          return updated;
        });

        // Đồng bộ trạng thái đã đọc lên server khi đang mở xem trực tiếp
        if (newMessage.senderId !== user.id) {
          fetch(`${API_URL}/chat/conversations/${newMessage.conversationId}/read`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => {});
        }

        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          if (newMessage.tempId) {
            const index = prev.findIndex((m) => m.id === newMessage.tempId);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = { ...newMessage, tempId: undefined };
              return updated;
            }
          }
          const fallbackIndex = prev.findIndex(
            (m) =>
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

      const isFromOther = newMessage.senderId !== user.id && newMessage.sender?.id !== user.id;
      const existingConv = conversationsRef.current.find((c) => c.id === newMessage.conversationId);
      const alreadyNotified = recordNotifiedMessageId(newMessage.id);

      if (isViewingThisConv && document.visibilityState === 'visible') {
        setTimeout(() => {
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'CLEAR_CONVERSATION_NOTIFICATIONS',
              conversationId: newMessage.conversationId
            });
          }
        }, 450);
      }

      if (isFromOther && !existingConv?.isMuted && !alreadyNotified) {
        const senderTitle = existingConv?.isGroup
          ? `${existingConv.name || 'Nhóm chat'} • ${newMessage.sender?.displayName || 'Thành viên'}`
          : newMessage.sender?.displayName || 'Tin nhắn mới';

        let previewBody = newMessage.content || 'Bạn có tin nhắn mới';
        if (newMessage.type === 'image') previewBody = '📷 Đã gửi một hình ảnh';
        else if (newMessage.type === 'file') previewBody = '📁 Đã gửi một tệp đính kèm';
        else if (newMessage.type === 'voice') previewBody = '🎙️ Đã gửi một tin nhắn thoại';
        else if (newMessage.type === 'location') previewBody = '📍 Đã chia sẻ một vị trí';
        else if (newMessage.type === 'sticker') previewBody = '✨ Đã gửi một nhãn dán';
        else if (newMessage.type === 'task') previewBody = `📋 Công việc: ${newMessage.content || ''}`;
        else if (newMessage.type === 'reminder') previewBody = `⏰ Nhắc hẹn: ${newMessage.content || ''}`;

        triggerSoundAndToast(
          !isViewingThisConv
            ? {
                title: senderTitle,
                body: previewBody,
                conversationId: newMessage.conversationId
              }
            : null,
          true
        );
      }

      // Cập nhật danh sách hội thoại ngay tại chỗ (tránh bão HTTP request)
      const existsInList = Boolean(existingConv);
      if (existsInList) {
        setConversations((prev) => {
          const updatedList = prev.map((c) => {
            if (c.id !== newMessage.conversationId) return c;
            return {
              ...c,
              messages: [newMessage],
              updatedAt: newMessage.createdAt || new Date().toISOString(),
              unreadCount: isViewingThisConv
                ? 0
                : isFromOther
                  ? (c.unreadCount || 0) + 1
                  : c.unreadCount || 0,
              lastReadAt: isViewingThisConv ? new Date().toISOString() : c.lastReadAt
            };
          });
          updatedList.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          return updatedList;
        });
      } else {
        fetchConversations();
      }
    });

    newSocket.on('conversation-updated', () => {
      fetchConversations();
    });

    // Đã đọc trên thiết bị khác (hoặc vừa trả lời) → xoá số chưa đọc + thông báo cũ của cuộc trò chuyện này trên máy hiện tại
    newSocket.on('conversation-read-sync', ({ conversationId, lastReadAt } = {}) => {
      if (!conversationId) return;
      const readIso = lastReadAt || new Date().toISOString();
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0, lastReadAt: readIso } : c))
      );
      setLastReadTimestamps((prev) => {
        const updated = { ...prev, [conversationId]: readIso };
        try {
          localStorage.setItem('chat_last_read_timestamps', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_CONVERSATION_NOTIFICATIONS',
          conversationId
        });
      }
    });

    newSocket.on('conversation-removed', ({ conversationId }) => {
      const activeConv = activeConversationRef.current;
      if (activeConv && activeConv.id === conversationId) {
        setActiveConversation(null);
        setMessages([]);
        setMobileActiveView('list');
      }
      fetchConversations();
    });

    newSocket.on('user-typing', ({ conversationId, userId, displayName, isTyping }) => {
      const activeConv = activeConversationRef.current;
      if (!activeConv || activeConv.id !== conversationId || userId === user.id) return;
      setTypingUsers((prev) => {
        if (isTyping) {
          if (prev.some((u) => u.userId === userId)) return prev;
          return [...prev, { userId, displayName }];
        } else {
          if (!prev.some((u) => u.userId === userId)) return prev;
          return prev.filter((u) => u.userId !== userId);
        }
      });
    });

    // Trạng thái online thay đổi liên tục (mỗi lần ai đó khoá/mở máy) → chỉ cập nhật state khi thật sự khác,
    // tránh vẽ lại toàn bộ giao diện vô ích
    newSocket.on('user-status-changed', ({ userId, status }) => {
      setOnlineUsers((prev) => {
        const isListed = prev.includes(userId);
        if (status === 'online') return isListed ? prev : [...prev, userId];
        return isListed ? prev.filter((id) => id !== userId) : prev;
      });
    });

    newSocket.on('message-pin-toggled', ({ messageId, isPinned, message }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, isPinned, pinnedBy: message.pinnedBy, pinnedAt: message.pinnedAt }
            : m
        )
      );
    });

    newSocket.on('message-pinned', (updatedMsg) => {
      if (!updatedMsg?.id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === updatedMsg.id
            ? { ...m, isPinned: updatedMsg.isPinned, pinnedBy: updatedMsg.pinnedBy, pinnedAt: updatedMsg.pinnedAt }
            : m
        )
      );
    });

    newSocket.on('message-reaction-updated', ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    });

    newSocket.on('message-recalled', ({ messageId, conversationId }) => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller && messageId) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_MESSAGE_NOTIFICATION',
          messageId
        });
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, isRecalled: true, content: null, metadata: null, isPinned: false, pinnedBy: null, pinnedAt: null }
            : m
        )
      );
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const lastMsg = c.messages?.[0];
          if (lastMsg && lastMsg.id === messageId) {
            return { ...c, messages: [{ ...lastMsg, isRecalled: true, content: null }] };
          }
          return c;
        })
      );
    });

    newSocket.on('message-edited', ({ messageId, conversationId, content }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content } : m)));
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const lastMsg = c.messages?.[0];
          if (lastMsg && lastMsg.id === messageId) {
            return { ...c, messages: [{ ...lastMsg, content }] };
          }
          return c;
        })
      );
    });

    newSocket.on('task-status-updated', ({ taskId, status, assigneeId, assigneeName }) => {
      setMessages((prev) =>
        prev.map((m) => {
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
            } catch (e) {}
          }
          return m;
        })
      );
      fetchGlobalTasksCountRef.current();
    });

    newSocket.on('reminder-trigger', (reminder) => {
      triggerSoundAndToast(
        {
          title: `⏰ Nhắc hẹn: ${reminder.title}`,
          body: `Tạo bởi: ${reminder.creatorName} - Đã đến giờ hẹn!`,
          conversationId: reminder.conversationId
        },
        true
      );
    });

    return () => {
      newSocket.disconnect();
    };
  }, [token, user, API_URL, fetchConversations, sendOfflineOutbox, triggerSoundAndToast]);

  // Mở thẳng phòng chat theo ID (dùng khi người dùng chạm vào thông báo đẩy trên iPhone / Android)
  const openConversationById = useCallback(
    async (convId) => {
      if (!convId || !token) return false;
      const activateConv = (conv) => {
        setActiveConversation(conv);
        setShowProfile(false);
        setShowTasks(false);
        setShowRightSidebar(false);
        setMobileActiveView('chat');
      };

      const existing = conversationsRef.current.find((c) => c.id === convId);
      if (existing) {
        activateConv(existing);
        return true;
      }

      const freshList = await fetchConversations();
      if (Array.isArray(freshList)) {
        const found = freshList.find((c) => c.id === convId);
        if (found) {
          activateConv(found);
          return true;
        }
      }
      return false;
    },
    [token, fetchConversations]
  );

  // Đọc & xử lý ý định mở cuộc trò chuyện từ cả URL (?convId=...) VÀ Cache Storage dùng chung với Service Worker
  // (Khắc phục triệt để việc iOS Standalone PWA bỏ qua tham số URL khi mở từ màn hình khóa)
  const consumePendingNotificationIntent = useCallback(async () => {
    if (!token) return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlConvId = urlParams.get('convId');
      if (urlConvId) {
        const url = new URL(window.location.href);
        url.searchParams.delete('convId');
        window.history.replaceState({}, '', url.pathname + url.search);
        await openConversationById(urlConvId);
      }
    } catch (e) {}

    if ('caches' in window) {
      try {
        const cache = await caches.open('chattikovia-nav-intent-v1');
        const matched = await cache.match('/__open_conversation__');
        if (matched) {
          await cache.delete('/__open_conversation__');
          const intent = await matched.json().catch(() => null);
          if (intent?.conversationId && (!intent.ts || Date.now() - intent.ts < 120000)) {
            await openConversationById(intent.conversationId);
          }
        }
      } catch (e) {}
    }
  }, [token, openConversationById]);

  // === Service Worker Message Handler ===
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleSWMessage = (event) => {
      if (event.data?.type === 'SW_PUSH_RECEIVED') {
        const payload = event.data.payload || {};
        const pushConvId = payload.conversationId || payload.data?.conversationId || null;
        const pushMsgId = payload.data?.messageId || payload.messageId || null;

        // Nếu nhận tín hiệu thu hồi qua Push khi ứng dụng vừa mở lại trước khi Socket kịp kết nối
        if (payload.type === 'message-recalled' && pushMsgId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pushMsgId
                ? { ...m, isRecalled: true, content: null, metadata: null, isPinned: false, pinnedBy: null, pinnedAt: null }
                : m
            )
          );
          fetchConversations();
          return;
        }

        const activeConv = activeConversationRef.current;
        const isChatVisible = window.innerWidth > 768 || mobileActiveViewRef.current === 'chat';
        const isViewingThisConv = Boolean(activeConv && activeConv.id === pushConvId && isChatVisible);

        if (isViewingThisConv && document.visibilityState === 'visible' && pushConvId) {
          setTimeout(() => {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'CLEAR_CONVERSATION_NOTIFICATIONS',
                conversationId: pushConvId
              });
            }
          }, 350);
        }

        // Nếu tin nhắn này đã được thông báo qua Socket.io thì bỏ qua để tránh kêu chuông 2 lần
        if (pushMsgId && recordNotifiedMessageId(pushMsgId)) {
          return;
        }

        // Nếu Web Push đến trước khi Socket kịp kết nối lại sau khi mở khóa màn hình, đồng bộ ngay dữ liệu mới
        fetchConversations();
        if (activeConv && pushConvId && activeConv.id === pushConvId && token) {
          fetch(`${API_URL}/chat/conversations/${activeConv.id}/messages?limit=50`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (Array.isArray(data)) setMessages(data);
            })
            .catch(() => {});
        }

        // Cuộc gọi đến đã có nhạc chuông riêng của VideoCall -> không phát chồng chuông tin nhắn
        if (payload.isCall || payload.type === 'incoming-call') {
          return;
        }

        triggerSoundAndToast(
          !isViewingThisConv && payload.title
            ? {
                title: payload.title,
                body: payload.body || 'Bạn có thông báo mới',
                conversationId: pushConvId
              }
            : null,
          true
        );
      } else if (event.data?.type === 'SWITCH_CONVERSATION') {
        const { conversationId } = event.data;
        if ('caches' in window) {
          caches
            .open('chattikovia-nav-intent-v1')
            .then((c) => c.delete('/__open_conversation__'))
            .catch(() => {});
        }
        openConversationById(conversationId);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    };
  }, [token, API_URL, fetchConversations, openConversationById, recordNotifiedMessageId, triggerSoundAndToast]);

  // === Initial Data Loading, Notification Deep-Link & Foreground Wakeup Sync ===
  useEffect(() => {
    if (token) {
      fetchConversations().then(() => {
        consumePendingNotificationIntent();
      });
      fetchGlobalTasksCount();
      checkPushNotificationStatus();
      consumePendingNotificationIntent();
    }
  }, [token, fetchConversations, fetchGlobalTasksCount, checkPushNotificationStatus, consumePendingNotificationIntent]);

  // Tự động đồng bộ lại tin nhắn, mở phòng chat vừa chạm từ thông báo & kết nối Socket ngay khi mở khoá điện thoại
  useEffect(() => {
    if (!token) return;
    const handleAppWakeup = () => {
      if (document.visibilityState !== 'visible') return;
      if (socket && !socket.connected) {
        socket.connect();
      }
      consumePendingNotificationIntent();
      fetchConversations();
      fetchGlobalTasksCountRef.current();

      const activeConv = activeConversationRef.current;
      if (activeConv) {
        fetch(`${API_URL}/chat/conversations/${activeConv.id}/messages?limit=50`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (Array.isArray(data)) setMessages(data);
          })
          .catch(() => {});

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'CLEAR_CONVERSATION_NOTIFICATIONS',
            conversationId: activeConv.id
          });
        }
      }
    };

    const handleFocusOrPageShow = () => {
      consumePendingNotificationIntent();
    };

    document.addEventListener('visibilitychange', handleAppWakeup);
    window.addEventListener('pageshow', handleFocusOrPageShow);
    window.addEventListener('focus', handleFocusOrPageShow);
    return () => {
      document.removeEventListener('visibilitychange', handleAppWakeup);
      window.removeEventListener('pageshow', handleFocusOrPageShow);
      window.removeEventListener('focus', handleFocusOrPageShow);
    };
  }, [token, socket, API_URL, fetchConversations, consumePendingNotificationIntent]);

  // === Active Conversation Effects ===
  useEffect(() => {
    if (activeConversation) {
      setActiveWallpaper(localStorage.getItem(`chat_wallpaper_${activeConversation.id}`) || '');
    } else {
      setActiveWallpaper('');
    }
  }, [activeConversation]);

  useEffect(() => {
    setHasMoreMessages(true);
    setTypingUsers([]);
    if (activeConversation) {
      const nowIso = new Date().toISOString();
      setLastReadTimestamps((prev) => {
        const updated = { ...prev, [activeConversation.id]: nowIso };
        localStorage.setItem('chat_last_read_timestamps', JSON.stringify(updated));
        return updated;
      });
      // Xóa ngay số đếm chưa đọc trên giao diện khi mở cuộc hội thoại
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversation.id ? { ...c, unreadCount: 0, lastReadAt: nowIso } : c))
      );

      // Báo cho Service Worker tự động đóng các thông báo cũ của phòng chat này trên thanh thông báo điện thoại
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_CONVERSATION_NOTIFICATIONS',
          conversationId: activeConversation.id
        });
      }
    }
  }, [activeConversation?.id]);

  useEffect(() => {
    if (!activeConversation || !token) return;
    fetch(`${API_URL}/chat/conversations/${activeConversation.id}/messages?limit=50`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const msgList = Array.isArray(data) ? data : [];
        setMessages(msgList);
        if (msgList.length < 50) setHasMoreMessages(false);
      })
      .catch((err) => {
        console.error('Lỗi tải tin nhắn:', err);
        setMessages([]);
      });
    if (socket) socket.emit('join-conversation', activeConversation.id);
  }, [activeConversation?.id, token, socket, API_URL]);

  // === Action Handlers ===
  // Dùng ref đồng bộ (loadingOlderRef) chống gọi trùng khi nhiều sự kiện scroll bắn trong cùng 1 khung hình,
  // khử trùng lặp ID tin nhắn và giữ tham chiếu hàm ổn định để ChatWindow (React.memo) không phải vẽ lại thừa
  const fetchOlderMessages = useCallback(async () => {
    const activeConv = activeConversationRef.current;
    const currentMessages = messagesRef.current;
    if (
      loadingOlderRef.current ||
      !hasMoreMessagesRef.current ||
      !activeConv ||
      !token ||
      currentMessages.length === 0
    ) {
      return;
    }
    loadingOlderRef.current = true;
    setIsLoadingOlder(true);
    const convIdAtStart = activeConv.id;
    const oldestMessageId = currentMessages[0].id;
    try {
      const res = await fetch(
        `${API_URL}/chat/conversations/${convIdAtStart}/messages?before=${oldestMessageId}&limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok && activeConversationRef.current?.id === convIdAtStart) {
        const data = await res.json();
        if (data.length < 50) {
          hasMoreMessagesRef.current = false;
          setHasMoreMessages(false);
        }
        if (data.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const uniqueOlder = data.filter((m) => m?.id && !existingIds.has(m.id));
            return uniqueOlder.length > 0 ? [...uniqueOlder, ...prev] : prev;
          });
        }
      }
    } catch (e) {
      console.error('Lỗi tải tin nhắn cũ:', e);
    } finally {
      loadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [token, API_URL]);

  const handleSendMessage = useCallback(
    (messageData) => {
      const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      const payload = { ...messageData, senderId: user.id, tempId };
      const fullMessage = {
        id: tempId,
        senderId: user.id,
        sender: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, username: user.username },
        createdAt: new Date().toISOString(),
        status: 'sending',
        ...messageData
      };
      if (activeConversationRef.current && messageData.conversationId === activeConversationRef.current.id) {
        setMessages((prev) => [...prev, fullMessage]);
      }
      if (isOnline && socket?.connected) {
        socket.emit('send-message', payload);
      } else {
        setOfflineOutbox((prev) => [...prev, payload]);
      }
    },
    [user, isOnline, socket]
  );

  const handlePinMessage = useCallback(
    (messageId, conversationId) => {
      if (socket) socket.emit('pin-message', { messageId, conversationId, pinnedBy: user.id });
    },
    [socket, user]
  );

  const handleToggleReaction = useCallback(
    (messageId, emojiType) => {
      if (socket && activeConversation) {
        socket.emit('toggle-reaction', {
          messageId,
          userId: user.id,
          type: emojiType,
          conversationId: activeConversation.id
        });
      }
    },
    [socket, activeConversation, user]
  );

  const handleRecallMessage = useCallback(
    (messageId) => {
      if (socket && activeConversation) {
        socket.emit('recall-message', { messageId, conversationId: activeConversation.id, userId: user.id });
      }
    },
    [socket, activeConversation, user]
  );

  const handleEditMessage = useCallback(
    (messageId, newContent) => {
      if (socket && activeConversation) {
        socket.emit('edit-message', { messageId, content: newContent, conversationId: activeConversation.id });
      }
    },
    [socket, activeConversation]
  );

  const handleDeleteMessageForMe = useCallback(
    async (messageId) => {
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/chat/messages/${messageId}/delete-for-me`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        } else {
          const errData = await res.json();
          alert(errData.error || 'Lỗi khi xóa tin nhắn');
        }
      } catch (e) {
        console.error('Lỗi xóa tin nhắn:', e);
      }
    },
    [token, API_URL]
  );

  const handleUpdateNickname = useCallback(
    (targetUserId, nickname) => {
      setActiveConversation((prev) => {
        if (!prev) return null;
        return { ...prev, members: prev.members.map((m) => (m.user.id === targetUserId ? { ...m, nickname } : m)) };
      });
      fetchConversations();
    },
    [fetchConversations]
  );

  const handleToggleMute = useCallback((convId, muted) => {
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, isMuted: muted } : c)));
    setActiveConversation((prev) => (prev && prev.id === convId ? { ...prev, isMuted: muted } : prev));
  }, []);

  const performLogout = useCallback(() => {
    handleLogout(socket);
    setConversations([]);
    setActiveConversation(null);
    setMessages([]);
    setMobileActiveView('list');
  }, [handleLogout, socket]);

  // Cập nhật hàm xử lý hết phiên mới nhất cho các listener Socket / fetch dùng qua ref
  useEffect(() => {
    sessionExpiredRef.current = (reason = 'expired') => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;
      performLogout();
      setTimeout(() => {
        alert(
          reason === 'revoked'
            ? '🔒 Mật khẩu tài khoản vừa được thay đổi trên thiết bị khác. Vui lòng đăng nhập lại bằng mật khẩu mới.'
            : '⏰ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        );
        isLoggingOutRef.current = false;
      }, 50);
    };
  }, [performLogout]);

  // Các hàm truyền xuống ChatWindow được giữ nguyên tham chiếu (useCallback) để React.memo bỏ qua các lần vẽ lại không cần thiết
  const handleStartCallInActive = useCallback(
    (isVideo) => handleStartCall(isVideo, activeConversationRef.current, user),
    [handleStartCall, user]
  );

  const handleToggleRightSidebar = useCallback(() => {
    const nextState = !showRightSidebar;
    setShowRightSidebar(nextState);
    setMobileActiveView(nextState ? 'options' : 'chat');
  }, [showRightSidebar]);

  const handleOpenLightbox = useCallback((url) => setLightboxImage(url), []);

  // === Computed Values ===
  const totalUnreadChats = useMemo(() => {
    if (!conversations || !Array.isArray(conversations)) return 0;
    let total = 0;
    conversations.forEach((conv) => {
      if (activeConversation?.id === conv.id) return;
      if (typeof conv.unreadCount === 'number' && conv.unreadCount > 0) {
        total += conv.unreadCount;
        return;
      }
      const lastMsg = conv.messages?.[0];
      if (lastMsg && lastMsg.senderId !== user?.id && lastMsg.sender?.id !== user?.id) {
        const lastRead = lastReadTimestamps?.[conv.id] || conv.lastReadAt;
        if (!lastRead || new Date(lastMsg.createdAt) > new Date(lastRead)) total += 1;
      }
    });
    return total;
  }, [conversations, activeConversation, lastReadTimestamps, user]);

  // Đồng bộ huy hiệu (App Badge) trên màn hình chính điện thoại (iOS/Android PWA)
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const totalBadge = totalUnreadChats + pendingTasksCount;
    if ('setAppBadge' in navigator && 'clearAppBadge' in navigator) {
      if (totalBadge > 0) {
        navigator.setAppBadge(totalBadge).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  }, [totalUnreadChats, pendingTasksCount]);

  // === Render ===
  if (!token || !user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div style={styles.appContainer}>
      <NetworkBanner />

      {/* Thanh thông báo nổi trong ứng dụng (In-App Notification Banner) */}
      {inAppToast && (
        <div
          onClick={() => {
            if (inAppToast.conversationId) {
              const target = conversations.find((c) => c.id === inAppToast.conversationId);
              if (target) {
                setActiveConversation(target);
                setShowTasks(false);
                setShowProfile(false);
                setMobileActiveView('chat');
              }
            }
            setInAppToast(null);
          }}
          style={{
            position: 'fixed',
            top: 'calc(8px + env(safe-area-inset-top, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            width: 'min(92vw, 400px)',
            background: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(99, 102, 241, 0.45)',
            borderRadius: '16px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 14px 34px rgba(0, 0, 0, 0.45)',
            cursor: 'pointer'
          }}
          className="anim-scale-in"
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              flexShrink: 0
            }}
          >
            🔔
          </div>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <div
              style={{
                fontSize: '0.84rem',
                fontWeight: '700',
                color: '#ffffff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {inAppToast.title}
            </div>
            <div
              style={{
                fontSize: '0.76rem',
                color: '#cbd5e1',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: '2px'
              }}
            >
              {inAppToast.body}
            </div>
          </div>
        </div>
      )}

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
          onLogout={performLogout}
          onRefreshConversations={fetchConversations}
          onShowProfile={() => {
            setShowProfile(true);
            setShowTasks(false);
            setMobileActiveView('profile');
          }}
          mobileActiveView={mobileActiveView}
          setMobileActiveView={setMobileActiveView}
          className={mobileActiveView === 'list' ? 'mobile-show-list' : 'mobile-hide-list'}
          theme={theme}
          toggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
          pushStatus={pushStatus}
          onEnablePush={handleEnablePushNotifications}
          dismissedPushBanner={dismissedPushBanner}
          onDismissPushBanner={dismissPushBanner}
          onShowTasks={() => {
            setShowTasks((prev) => {
              const next = !prev;
              if (next) setMobileActiveView('tasks');
              else if (mobileActiveView === 'tasks') setMobileActiveView('list');
              return next;
            });
            setShowProfile(false);
          }}
          pendingTasksCount={pendingTasksCount}
          lastReadTimestamps={lastReadTimestamps}
        />

        {/* Danh bạ */}
        <ContactsView
          mobileActiveView={mobileActiveView}
          user={user}
          conversations={conversations}
          onlineUsers={onlineUsers}
          onSelectConversation={(conv) => {
            setActiveConversation(conv);
            setMobileActiveView('chat');
          }}
        />

        {/* 2. Center: Chat or Tasks */}
        {showTasks || mobileActiveView === 'tasks' ? (
          <Suspense
            fallback={
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  width: '100%',
                  background: 'var(--bg-chat-gradient)',
                  color: 'var(--text-secondary)'
                }}
              >
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <p style={{ marginTop: '10px', fontSize: '0.85rem' }}>Đang tải bảng công việc...</p>
              </div>
            }
          >
            <TasksView
              user={user}
              token={token}
              onClose={() => {
                setShowTasks(false);
                if (mobileActiveView === 'tasks') setMobileActiveView('list');
              }}
              onSelectConversation={(convId) => {
                const target = conversations.find((c) => c.id === convId);
                if (target) {
                  setActiveConversation(target);
                  setShowTasks(false);
                  setMobileActiveView('chat');
                }
              }}
              socket={socket}
              mobileActiveView={mobileActiveView}
              setMobileActiveView={setMobileActiveView}
              className={showTasks || mobileActiveView === 'tasks' ? 'mobile-show-chat' : 'mobile-hide-chat'}
            />
          </Suspense>
        ) : (
          <ChatWindow
            user={user}
            token={token}
            socket={socket}
            conversation={activeConversation}
            conversations={conversations}
            wallpaper={activeWallpaper}
            messages={messages}
            typingUsers={typingUsers}
            onSendMessage={handleSendMessage}
            onPinMessage={handlePinMessage}
            onToggleReaction={handleToggleReaction}
            onRecallMessage={handleRecallMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessageForMe}
            onStartCall={handleStartCallInActive}
            toggleRightSidebar={handleToggleRightSidebar}
            onlineUsers={onlineUsers}
            mobileActiveView={mobileActiveView}
            setMobileActiveView={setMobileActiveView}
            className={mobileActiveView === 'chat' ? 'mobile-show-chat' : 'mobile-hide-chat'}
            onImageClick={handleOpenLightbox}
            fetchOlderMessages={fetchOlderMessages}
            hasMoreMessages={hasMoreMessages}
            isLoadingOlder={isLoadingOlder}
          />
        )}

        {/* 3. Right Sidebar */}
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
            onToggleMute={handleToggleMute}
            onUpdateWallpaper={(val) => {
              setActiveWallpaper(val);
              if (activeConversation) {
                if (val) localStorage.setItem(`chat_wallpaper_${activeConversation.id}`, val);
                else localStorage.removeItem(`chat_wallpaper_${activeConversation.id}`);
              }
            }}
            mobileActiveView={mobileActiveView}
            setMobileActiveView={setMobileActiveView}
            className={mobileActiveView === 'options' ? 'mobile-show-options' : 'mobile-hide-options'}
            onImageClick={(url) => setLightboxImage(url)}
          />
        )}
      </div>

      {/* 4. Video/Voice Call Overlay */}
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
        remoteAudioRef={remoteAudioRef}
        conversation={activeConversation}
      />

      {/* 5. Profile Overlay */}
      {showProfile && (
        <Suspense
          fallback={
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          }
        >
          <ProfileView
            user={user}
            token={token}
            onClose={() => {
              setShowProfile(false);
              if (mobileActiveView === 'profile') setMobileActiveView('list');
            }}
            onProfileUpdate={(updatedUser, newToken) => {
              if (newToken) {
                // Đổi mật khẩu: chuyển sang token mới → Socket tự kết nối lại bằng phiên mới
                handleAuthSuccess(updatedUser, newToken);
                fetchConversations(newToken);
              } else {
                setUser(updatedUser);
                fetchConversations();
              }
            }}
            pushStatus={pushStatus}
            onEnablePush={handleEnablePushNotifications}
            onTestPush={handleTestPushNotification}
            mobileActiveView={mobileActiveView}
            currentSocketId={socket?.id || null}
          />
        </Suspense>
      )}

      {/* 6. Lightbox */}
      <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />

      {/* 7. Bottom Navigation (Mobile) */}
      <BottomNav
        mobileActiveView={mobileActiveView}
        setMobileActiveView={setMobileActiveView}
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        setShowTasks={setShowTasks}
        totalUnreadChats={totalUnreadChats}
        pendingTasksCount={pendingTasksCount}
      />
    </div>
  );
}

const styles = {
  appContainer: {
    height: 'var(--app-height, 100dvh)',
    width: '100%',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingLeft: 'env(safe-area-inset-left, 0px)',
    paddingRight: 'env(safe-area-inset-right, 0px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-primary)'
  },
  mainLayout: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    height: '100%',
    width: '100%',
    overflow: 'hidden'
  }
};
