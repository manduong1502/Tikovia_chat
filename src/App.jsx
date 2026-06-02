import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import RightSidebar from './components/RightSidebar';
import VideoCall from './components/VideoCall';
import ProfileModal from './components/ProfileModal';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [socket, setSocket] = useState(null);
  const [conversations, setConversations] = useState([]);
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

  // Trạng thái thông báo đẩy (Web Push)
  const [pushStatus, setPushStatus] = useState('checking'); // 'checking', 'granted', 'prompt', 'denied', 'unsupported', 'insecure'
  const [dismissedPushBanner, setDismissedPushBanner] = useState(
    localStorage.getItem('chat_dismissed_push_banner') === 'true'
  );

  // Offline status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineOutbox, setOfflineOutbox] = useState([]);

  // WebRTC Calling States
  const [callState, setCallState] = useState('idle'); // 'idle', 'calling', 'incoming', 'connected'
  const [callInfo, setCallInfo] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerInstance, setPeerInstance] = useState(null);

  const activeConversationRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Đồng bộ activeConversationRef để lướt socket dùng đúng state mới nhất
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  // Khôi phục phiên đăng nhập từ LocalStorage & tự động tải lại khi Service Worker cập nhật
  useEffect(() => {
    const savedToken = localStorage.getItem('chat_token');
    const savedUser = localStorage.getItem('chat_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }

    // Tự động reload ứng dụng khi có Service Worker mới kiểm soát trang
    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }

    // Lắng nghe sự kiện Online/Offline của trình duyệt
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      }
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
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    setUser(null);
    setToken(null);
    setConversations([]);
    setActiveConversation(null);
    setMessages([]);
    setMobileActiveView('list');
  };

  // Khởi tạo Socket.io
  useEffect(() => {
    if (!token || !user) return;

    const socketUrl = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL;
    const newSocket = io(socketUrl);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket.io connected:', newSocket.id);
      newSocket.emit('register-user', user.id);
      
      // Đồng bộ các tin nhắn offline lên server khi có mạng lại
      sendOfflineOutbox(newSocket);
    });

    // Lắng nghe tin nhắn mới
    newSocket.on('receive-message', (newMessage) => {
      // Nếu tin nhắn thuộc cuộc hội thoại đang active
      const activeConv = activeConversationRef.current;
      if (activeConv && activeConv.id === newMessage.conversationId) {
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev; // Tránh trùng lặp
          return [...prev, newMessage];
        });
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
        if (subscription) {
          setPushStatus('granted');
        } else {
          setPushStatus('prompt'); // Quyền được bật nhưng chưa subscribe/hoặc bị mất token
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
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      console.log('Trình duyệt không hỗ trợ Web Push.');
      setPushStatus('unsupported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      const keyRes = await fetch(`${API_URL}/chat/push-key`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (!keyRes.ok) throw new Error('Không thể tải khoá push public key từ máy chủ');
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

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }

      const subRes = await fetch(`${API_URL}/chat/push-subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ subscription })
      });

      if (subRes.ok) {
        console.log('Đăng ký nhận thông báo đẩy thành công.');
        setPushStatus('granted');
        return true;
      } else {
        console.error('Không thể đồng bộ subscription lên server.');
        setPushStatus('prompt');
        return false;
      }
    } catch (e) {
      console.error('Lỗi thiết lập thông báo đẩy:', e);
      setPushStatus('prompt');
      return false;
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
        const success = await subscribeUserToPush(token);
        if (success) {
          alert('Bật thông báo đẩy thành công!');
        } else {
          alert('Đăng ký với máy chủ thất bại. Vui lòng tải lại trang và thử lại.');
        }
      } else if (permission === 'denied') {
        setPushStatus('denied');
        alert('Bạn đã chặn quyền thông báo. Vui lòng bật lại quyền thông báo trong cài đặt trình duyệt.');
      } else {
        setPushStatus('prompt');
      }
    } catch (err) {
      console.error('Lỗi khi kích hoạt thông báo:', err);
      alert('Đã xảy ra lỗi: ' + err.message);
    }
  };

  // Gọi fetchConversations khi login xong và kiểm tra quyền thông báo đẩy
  useEffect(() => {
    if (token) {
      fetchConversations();
      checkPushNotificationStatus();
      
      // Nếu quyền đã được bật từ trước, chạy đồng bộ nền mà không cần click của người dùng
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        subscribeUserToPush(token);
      }
    }
  }, [token]);

  // Tải lịch sử tin nhắn khi đổi cuộc hội thoại active
  useEffect(() => {
    if (!activeConversation || !token) return;

    fetch(`${API_URL}/chat/conversations/${activeConversation.id}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setMessages(data))
      .catch(err => console.error('Lỗi tải tin nhắn:', err));

    // Đăng ký join room socket
    if (socket) {
      socket.emit('join-conversation', activeConversation.id);
    }
  }, [activeConversation, token, socket]);

  // Gửi tin nhắn mới (hỗ trợ offline outbox)
  const handleSendMessage = (messageData) => {
    const tempId = 'temp-' + Date.now();
    const payload = {
      ...messageData,
      senderId: user.id
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
      ...messageData
    };

    if (isOnline && socket && socket.connected) {
      // Online gửi qua socket
      socket.emit('send-message', payload);
    } else {
      // Offline: Lưu tạm vào outbox và render lên UI chế độ gửi tạm
      setOfflineOutbox(prev => [...prev, payload]);
      setMessages(prev => [...prev, { ...fullMessage, status: 'sending' }]);
      console.log('Đang offline, đã lưu tin nhắn vào outbox tạm.');
    }
  };

  // Đồng bộ Outbox khi có mạng lại
  const sendOfflineOutbox = (socketConn) => {
    if (offlineOutbox.length === 0) return;
    console.log(`Bắt đầu đồng bộ ${offlineOutbox.length} tin nhắn từ outbox...`);
    offlineOutbox.forEach(msg => {
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

  if (!token || !user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div style={styles.appContainer}>
      {/* Thanh cảnh báo offline */}
      {!isOnline && (
        <div style={styles.offlineBanner}>
          ⚠️ Bạn đang mất kết nối Internet. Tin nhắn sẽ tự động gửi đi khi khôi phục mạng.
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
        />

        {/* 2. Center Chat window */}
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
        />

        {/* 3. Far Right Sidebar (Tùy chọn) */}
        {showRightSidebar && activeConversation && (
          <RightSidebar
            user={user}
            token={token}
            conversation={activeConversation}
            onClose={() => {
              setShowRightSidebar(false);
              setMobileActiveView('chat');
            }}
            onUpdateNickname={handleUpdateNickname}
            mobileActiveView={mobileActiveView}
            setMobileActiveView={setMobileActiveView}
            className={mobileActiveView === 'options' ? 'mobile-show-options' : 'mobile-hide-options'}
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
      />

      {/* 5. Overlay Trang cá nhân (Profile) */}
      {showProfile && (
        <ProfileModal
          user={user}
          token={token}
          onClose={() => setShowProfile(false)}
          onProfileUpdate={(updatedUser) => {
            setUser(updatedUser);
            fetchConversations();
          }}
          pushStatus={pushStatus}
          onEnablePush={handleEnablePushNotifications}
        />
      )}
    </div>
  );
}

const styles = {
  appContainer: {
    height: '100vh',
    width: '100vw',
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
  }
};
