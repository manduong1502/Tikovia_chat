import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import io from 'socket.io-client';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import RightSidebar from './components/RightSidebar';
import VideoCall from './components/VideoCall';
import NetworkBanner from './components/NetworkBanner';
import ContactsView from './components/ContactsView';
import DiaryView from './components/DiaryView';
import Lightbox from './components/Lightbox';
import BottomNav from './components/BottomNav';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Hooks
import useAuth from './hooks/useAuth';
import useCall from './hooks/useCall';
import usePushNotification from './hooks/usePushNotification';

const ProfileView = React.lazy(() => import('./components/ProfileView'));
const TasksView = React.lazy(() => import('./components/TasksView'));

export default function App() {
  // === PWA Service Worker Auto-Update ===
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      r && setInterval(() => { r.update(); }, 30000);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      console.log('[PWA] Phát hiện phiên bản mới. Đang tự động cập nhật...');
      updateServiceWorker(true);
    }
  }, [needRefresh]);

  // === Auth Hook ===
  const { user, setUser, token, isOnline, handleAuthSuccess, handleLogout, API_URL } = useAuth();

  // === Core Chat State ===
  const [socket, setSocket] = useState(null);
  const [conversations, setConversations] = useState(() => {
    try {
      const cached = localStorage.getItem('chat_conversations_cache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) { return []; }
  });
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
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

  // === Last Read Timestamps ===
  const [lastReadTimestamps, setLastReadTimestamps] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_last_read_timestamps');
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  });

  // === Offline Outbox ===
  const [offlineOutbox, setOfflineOutbox] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_offline_outbox');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const offlineOutboxRef = useRef(offlineOutbox);
  useEffect(() => {
    offlineOutboxRef.current = offlineOutbox;
    try { localStorage.setItem('chat_offline_outbox', JSON.stringify(offlineOutbox)); } catch (e) {}
  }, [offlineOutbox]);

  // === Call Hook ===
  const {
    callState, setCallState, callInfo, setCallInfo,
    localStream, setLocalStream, remoteStream, setRemoteStream,
    peerInstance, setPeerInstance, handleStartCall,
  } = useCall();

  // === Push Notification Hook ===
  const {
    pushStatus, dismissedPushBanner,
    checkPushNotificationStatus, subscribeUserToPush,
    handleEnablePushNotifications, dismissPushBanner,
  } = usePushNotification(token, socket);

  // === Refs ===
  const activeConversationRef = useRef(null);
  const conversationsRef = useRef(conversations);
  const mobileActiveViewRef = useRef(mobileActiveView);

  useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { mobileActiveViewRef.current = mobileActiveView; }, [mobileActiveView]);

  // === Fetch Functions ===
  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);

        if (activeConversationRef.current) {
          const latestActive = data.find(c => c.id === activeConversationRef.current.id);
          if (latestActive) setActiveConversation(latestActive);
        }

        localStorage.setItem('chat_conversations_cache', JSON.stringify(data));

        const onlineIds = [];
        data.forEach(c => {
          c.members.forEach(m => {
            if (m.user.id !== user?.id && m.user.status === 'online') {
              onlineIds.push(m.user.id);
            }
          });
        });
        setOnlineUsers(Array.from(new Set(onlineIds)));
      }
    } catch (e) { console.error('Lỗi tải danh sách chat:', e); }
  }, [token, API_URL, user]);

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
    } catch (e) { console.error('Lỗi lấy số lượng công việc:', e); }
  }, [token, API_URL]);

  const fetchGlobalTasksCountRef = useRef(fetchGlobalTasksCount);
  useEffect(() => { fetchGlobalTasksCountRef.current = fetchGlobalTasksCount; }, [fetchGlobalTasksCount]);

  // === Offline Outbox Sync ===
  const sendOfflineOutbox = useCallback((socketConn) => {
    const currentOutbox = offlineOutboxRef.current;
    if (currentOutbox.length === 0) return;
    console.log(`Bắt đầu đồng bộ ${currentOutbox.length} tin nhắn từ outbox...`);
    currentOutbox.forEach(msg => { socketConn.emit('send-message', msg); });
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

    newSocket.on('connect', () => {
      console.log('Socket.io connected:', newSocket.id);
      newSocket.emit('register-user', user.id);
      
      const activeConv = activeConversationRef.current;
      if (activeConv) {
        newSocket.emit('join-conversation', activeConv.id);
      }
      
      const savedSub = localStorage.getItem('chat_push_subscription');
      if (savedSub) {
        try {
          const subscription = JSON.parse(savedSub);
          newSocket.emit('sync-push-subscription', { subscription });
        } catch (e) {}
      }
      
      sendOfflineOutbox(newSocket);
    });

    // Lắng nghe tin nhắn mới
    newSocket.on('receive-message', (newMessage) => {
      const activeConv = activeConversationRef.current;
      const isChatVisible = (window.innerWidth > 768) || (mobileActiveViewRef.current === 'chat');
      if (activeConv && activeConv.id === newMessage.conversationId && isChatVisible) {
        setLastReadTimestamps(prev => {
          const updated = { ...prev, [newMessage.conversationId]: new Date().toISOString() };
          localStorage.setItem('chat_last_read_timestamps', JSON.stringify(updated));
          return updated;
        });

        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          if (newMessage.tempId) {
            const index = prev.findIndex(m => m.id === newMessage.tempId);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = { ...newMessage, tempId: undefined };
              return updated;
            }
          }
          const fallbackIndex = prev.findIndex(m => 
            m.status === 'sending' && m.senderId === newMessage.senderId && 
            m.content === newMessage.content && m.type === newMessage.type
          );
          if (fallbackIndex !== -1) {
            const updated = [...prev];
            updated[fallbackIndex] = { ...newMessage, tempId: undefined };
            return updated;
          }
          return [...prev, newMessage];
        });
      }

      if (newMessage.type === 'task') fetchGlobalTasksCountRef.current();
      fetchConversations();
    });

    newSocket.on('conversation-updated', () => { fetchConversations(); });
    newSocket.on('conversation-removed', ({ conversationId }) => {
      // Nếu đang xem conversation bị xóa, quay về danh sách
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
      if (!activeConv || activeConv.id !== conversationId) return;
      setTypingUsers(prev => {
        if (isTyping) {
          if (prev.some(u => u.userId === userId)) return prev;
          return [...prev, { userId, displayName }];
        } else {
          return prev.filter(u => u.userId !== userId);
        }
      });
    });
    newSocket.on('user-status-changed', ({ userId, status }) => {
      setOnlineUsers(prev => status === 'online' 
        ? (prev.includes(userId) ? prev : [...prev, userId])
        : prev.filter(id => id !== userId));
    });
    newSocket.on('message-pin-toggled', ({ messageId, isPinned, message }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned, pinnedBy: message.pinnedBy, pinnedAt: message.pinnedAt } : m));
    });
    newSocket.on('message-reaction-updated', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    });
    newSocket.on('message-recalled', ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isRecalled: true, content: null, metadata: null, isPinned: false, pinnedBy: null, pinnedAt: null } : m));
    });
    newSocket.on('message-edited', ({ messageId, content }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content } : m));
    });
    newSocket.on('task-status-updated', ({ taskId, status, assigneeId, assigneeName }) => {
      setMessages(prev => prev.map(m => {
        if (m.type === 'task') {
          try {
            const meta = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
            if (meta && meta.taskId === taskId) {
              meta.status = status;
              if (assigneeId) { meta.assigneeId = assigneeId; meta.assigneeName = assigneeName; }
              return { ...m, metadata: JSON.stringify(meta) };
            }
          } catch (e) {}
        }
        return m;
      }));
      fetchGlobalTasksCountRef.current();
    });
    newSocket.on('reminder-trigger', (reminder) => {
      if (Notification.permission === 'granted') {
        new Notification(`⏰ Nhắc hẹn: ${reminder.title}`, { body: `Tạo bởi: ${reminder.creatorName}`, icon: '/favicon.ico' });
      } else {
        alert(`⏰ [Nhắc hẹn] ${reminder.title} (Tạo bởi: ${reminder.creatorName})`);
      }
    });

    return () => { newSocket.disconnect(); };
  }, [token, user]);

  // === Service Worker Message Handler ===
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleSWMessage = (event) => {
      if (event.data?.type === 'SWITCH_CONVERSATION') {
        const { conversationId } = event.data;
        const targetConv = conversationsRef.current.find(c => c.id === conversationId);
        if (targetConv) {
          setActiveConversation(targetConv);
          setMobileActiveView('chat');
        } else {
          fetchConversations().then(() => {
            setConversations(latestConvs => {
              const conv = latestConvs.find(c => c.id === conversationId);
              if (conv) { setActiveConversation(conv); setMobileActiveView('chat'); }
              return latestConvs;
            });
          });
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => { navigator.serviceWorker.removeEventListener('message', handleSWMessage); };
  }, [token]);

  // === URL Query Parameter Handler ===
  useEffect(() => {
    if (conversations?.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const convId = urlParams.get('convId');
      if (convId) {
        const target = conversations.find(c => c.id === convId);
        if (target) {
          setActiveConversation(target);
          setMobileActiveView('chat');
          const url = new URL(window.location.href);
          url.searchParams.delete('convId');
          window.history.replaceState({}, '', url.pathname + url.search);
        }
      }
    }
  }, [conversations]);

  // === Initial Data Loading ===
  useEffect(() => {
    if (token) {
      fetchConversations();
      fetchGlobalTasksCount();
      checkPushNotificationStatus();
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        subscribeUserToPush(token);
      }
    }
  }, [token]);

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
      setLastReadTimestamps(prev => {
        const updated = { ...prev, [activeConversation.id]: new Date().toISOString() };
        localStorage.setItem('chat_last_read_timestamps', JSON.stringify(updated));
        return updated;
      });
    }
  }, [activeConversation]);

  useEffect(() => {
    if (!activeConversation || !token) return;
    fetch(`${API_URL}/chat/conversations/${activeConversation.id}/messages?limit=50`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then(data => {
        const msgList = Array.isArray(data) ? data : [];
        setMessages(msgList);
        if (msgList.length < 50) setHasMoreMessages(false);
      })
      .catch(err => {
        console.error('Lỗi tải tin nhắn:', err);
        setMessages([]);
      });
    if (socket) socket.emit('join-conversation', activeConversation.id);
  }, [activeConversation, token, socket]);

  // === IndexedDB Sync ===
  useEffect(() => {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      const request = indexedDB.open('ChatTikoviaDB', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put(activeConversation ? activeConversation.id : null, 'activeConversationId');
      };
    }
  }, [activeConversation]);

  // === Action Handlers ===
  const fetchOlderMessages = useCallback(async () => {
    if (isLoadingOlder || !hasMoreMessages || !activeConversation || !token || messages.length === 0) return;
    setIsLoadingOlder(true);
    const oldestMessageId = messages[0].id;
    try {
      const res = await fetch(`${API_URL}/chat/conversations/${activeConversation.id}/messages?before=${oldestMessageId}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length < 50) setHasMoreMessages(false);
        if (data.length > 0) setMessages(prev => [...data, ...prev]);
      }
    } catch (e) { console.error('Lỗi tải tin nhắn cũ:', e); }
    finally { setIsLoadingOlder(false); }
  }, [isLoadingOlder, hasMoreMessages, activeConversation, token, messages, API_URL]);

  const handleSendMessage = useCallback((messageData) => {
    const tempId = 'temp-' + Date.now();
    const payload = { ...messageData, senderId: user.id, tempId };
    const fullMessage = {
      id: tempId, senderId: user.id,
      sender: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, username: user.username },
      createdAt: new Date().toISOString(), status: 'sending', ...messageData
    };
    if (activeConversationRef.current && messageData.conversationId === activeConversationRef.current.id) {
      setMessages(prev => [...prev, fullMessage]);
    }
    if (isOnline && socket?.connected) {
      socket.emit('send-message', payload);
    } else {
      setOfflineOutbox(prev => [...prev, payload]);
    }
  }, [user, isOnline, socket]);

  const handlePinMessage = useCallback((messageId, conversationId) => {
    if (socket) socket.emit('pin-message', { messageId, conversationId, pinnedBy: user.id });
  }, [socket, user]);

  const handleToggleReaction = useCallback((messageId, emojiType) => {
    if (socket && activeConversation) {
      socket.emit('toggle-reaction', { messageId, userId: user.id, type: emojiType, conversationId: activeConversation.id });
    }
  }, [socket, activeConversation, user]);

  const handleRecallMessage = useCallback((messageId) => {
    if (socket && activeConversation) {
      socket.emit('recall-message', { messageId, conversationId: activeConversation.id, userId: user.id });
    }
  }, [socket, activeConversation, user]);

  const handleEditMessage = useCallback((messageId, newContent) => {
    if (socket && activeConversation) {
      socket.emit('edit-message', { messageId, content: newContent, conversationId: activeConversation.id });
    }
  }, [socket, activeConversation]);

  const handleDeleteMessageForMe = useCallback(async (messageId) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/chat/messages/${messageId}/delete-for-me`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) { setMessages(prev => prev.filter(m => m.id !== messageId)); }
      else { const errData = await res.json(); alert(errData.error || 'Lỗi khi xóa tin nhắn'); }
    } catch (e) { console.error('Lỗi xóa tin nhắn:', e); }
  }, [token, API_URL]);

  const handleUpdateNickname = useCallback((targetUserId, nickname) => {
    setActiveConversation(prev => {
      if (!prev) return null;
      return { ...prev, members: prev.members.map(m => m.user.id === targetUserId ? { ...m, nickname } : m) };
    });
    fetchConversations();
  }, [fetchConversations]);

  // === Computed Values ===
  const totalUnreadChats = useMemo(() => {
    if (!conversations || !Array.isArray(conversations)) return 0;
    let total = 0;
    conversations.forEach(conv => {
      if (activeConversation?.id === conv.id) return;
      const lastMsg = conv.messages?.[0];
      if (lastMsg && lastMsg.senderId !== user?.id && lastMsg.sender?.id !== user?.id) {
        const lastRead = lastReadTimestamps?.[conv.id];
        if (!lastRead || new Date(lastMsg.createdAt) > new Date(lastRead)) total += 1;
      }
    });
    return total;
  }, [conversations, activeConversation, lastReadTimestamps, user]);

  // === Render ===
  if (!token || !user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div style={styles.appContainer}>
      <NetworkBanner />

      <div style={styles.mainLayout}>
        {/* 1. Left Sidebar */}
        <Sidebar
          user={user} token={token} conversations={conversations}
          activeConversation={activeConversation}
          setActiveConversation={(conv) => { setActiveConversation(conv); setMobileActiveView('chat'); }}
          onlineUsers={onlineUsers}
          onLogout={() => { handleLogout(socket); setConversations([]); setActiveConversation(null); setMessages([]); setMobileActiveView('list'); }}
          onRefreshConversations={fetchConversations}
          onShowProfile={() => setShowProfile(true)}
          mobileActiveView={mobileActiveView} setMobileActiveView={setMobileActiveView}
          className={mobileActiveView === 'list' ? 'mobile-show-list' : 'mobile-hide-list'}
          theme={theme} toggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
          pushStatus={pushStatus} onEnablePush={handleEnablePushNotifications}
          dismissedPushBanner={dismissedPushBanner} onDismissPushBanner={dismissPushBanner}
          onShowTasks={() => { setShowTasks(prev => !prev); setShowProfile(false); }}
          pendingTasksCount={pendingTasksCount} lastReadTimestamps={lastReadTimestamps}
        />

        {/* Mock views */}
        <ContactsView mobileActiveView={mobileActiveView} user={user} conversations={conversations} />
        <DiaryView mobileActiveView={mobileActiveView} user={user} />

        {/* 2. Center: Chat or Tasks */}
        {showTasks || mobileActiveView === 'tasks' ? (
          <Suspense fallback={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', background: 'var(--bg-chat-gradient)', color: 'var(--text-secondary)' }}>
              <span className="typing-dot"></span><span className="typing-dot"></span><span className="typing-dot"></span>
              <p style={{ marginTop: '10px', fontSize: '0.85rem' }}>Đang tải bảng công việc...</p>
            </div>
          }>
            <TasksView
              user={user} token={token}
              onClose={() => { setShowTasks(false); if (mobileActiveView === 'tasks') setMobileActiveView('list'); }}
              onSelectConversation={(convId) => {
                const target = conversations.find(c => c.id === convId);
                if (target) { setActiveConversation(target); setShowTasks(false); setMobileActiveView('chat'); }
              }}
              socket={socket} mobileActiveView={mobileActiveView} setMobileActiveView={setMobileActiveView}
              className={(showTasks || mobileActiveView === 'tasks') ? 'mobile-show-chat' : 'mobile-hide-chat'}
            />
          </Suspense>
        ) : (
          <ChatWindow
            user={user} token={token} conversation={activeConversation} conversations={conversations}
            wallpaper={activeWallpaper} messages={messages} typingUsers={typingUsers}
            onSendMessage={handleSendMessage} onPinMessage={handlePinMessage}
            onToggleReaction={handleToggleReaction} onRecallMessage={handleRecallMessage}
            onEditMessage={handleEditMessage} onDeleteMessage={handleDeleteMessageForMe}
            onStartCall={(isVideo) => handleStartCall(isVideo, activeConversation, user)}
            toggleRightSidebar={() => {
              const nextState = !showRightSidebar;
              setShowRightSidebar(nextState);
              setMobileActiveView(nextState ? 'options' : 'chat');
            }}
            onlineUsers={onlineUsers} mobileActiveView={mobileActiveView} setMobileActiveView={setMobileActiveView}
            className={mobileActiveView === 'chat' ? 'mobile-show-chat' : 'mobile-hide-chat'}
            onImageClick={(url) => setLightboxImage(url)}
            fetchOlderMessages={fetchOlderMessages} hasMoreMessages={hasMoreMessages} isLoadingOlder={isLoadingOlder}
          />
        )}

        {/* 3. Right Sidebar */}
        {showRightSidebar && activeConversation && (
          <RightSidebar
            user={user} token={token} conversation={activeConversation} socket={socket}
            onClose={() => { setShowRightSidebar(false); setMobileActiveView('chat'); }}
            onUpdateNickname={handleUpdateNickname}
            onUpdateWallpaper={(val) => {
              setActiveWallpaper(val);
              if (activeConversation) {
                if (val) localStorage.setItem(`chat_wallpaper_${activeConversation.id}`, val);
                else localStorage.removeItem(`chat_wallpaper_${activeConversation.id}`);
              }
            }}
            mobileActiveView={mobileActiveView} setMobileActiveView={setMobileActiveView}
            className={mobileActiveView === 'options' ? 'mobile-show-options' : 'mobile-hide-options'}
            onImageClick={(url) => setLightboxImage(url)}
          />
        )}
      </div>

      {/* 4. Video/Voice Call Overlay */}
      <VideoCall
        user={user} token={token} socket={socket}
        callState={callState} setCallState={setCallState}
        callInfo={callInfo} setCallInfo={setCallInfo}
        localStream={localStream} setLocalStream={setLocalStream}
        remoteStream={remoteStream} setRemoteStream={setRemoteStream}
        peerInstance={peerInstance} setPeerInstance={setPeerInstance}
        conversation={activeConversation}
      />

      {/* 5. Profile Overlay */}
      {showProfile && (
        <Suspense fallback={
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(10px)' }}>
            <span className="typing-dot"></span><span className="typing-dot"></span><span className="typing-dot"></span>
          </div>
        }>
          <ProfileView
            user={user} token={token}
            onClose={() => { setShowProfile(false); if (mobileActiveView === 'profile') setMobileActiveView('list'); }}
            onProfileUpdate={(updatedUser) => { setUser(updatedUser); fetchConversations(); }}
            pushStatus={pushStatus} onEnablePush={handleEnablePushNotifications}
            mobileActiveView={mobileActiveView}
          />
        </Suspense>
      )}

      {/* 6. Lightbox */}
      <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />

      {/* 7. Bottom Navigation (Mobile) */}
      <BottomNav
        mobileActiveView={mobileActiveView} setMobileActiveView={setMobileActiveView}
        showProfile={showProfile} setShowProfile={setShowProfile}
        totalUnreadChats={totalUnreadChats} pendingTasksCount={pendingTasksCount}
      />
    </div>
  );
}

const styles = {
  appContainer: {
    height: '100%', width: '100%', position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    backgroundColor: 'var(--bg-primary)',
  },
  mainLayout: {
    flex: 1, display: 'flex', height: '100%', width: '100%', overflow: 'hidden',
  },
};
