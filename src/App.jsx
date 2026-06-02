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

  // Sidebars toggle
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [mobileActiveView, setMobileActiveView] = useState('list'); // 'list', 'chat', 'options'
  const [showProfile, setShowProfile] = useState(false);

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

  const API_URL = 'http://localhost:5000/api';

  // Đồng bộ activeConversationRef để lướt socket dùng đúng state mới nhất
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  // Khôi phục phiên đăng nhập từ LocalStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('chat_token');
    const savedUser = localStorage.getItem('chat_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
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

    const newSocket = io('http://localhost:5000');
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

    // Xin quyền thông báo đẩy (Push notification)
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

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

  // Gọi fetchConversations khi login xong
  useEffect(() => {
    if (token) {
      fetchConversations();
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
