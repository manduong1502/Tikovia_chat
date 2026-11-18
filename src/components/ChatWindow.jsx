import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ChatInput from './ChatInput';
import ChatHeader from './chatWindow/ChatHeader';
import ChatSearchBar from './chatWindow/ChatSearchBar';
import PinnedBanner from './chatWindow/PinnedBanner';
import ForwardModal from './chatWindow/ForwardModal';
import MessageItem from './chatWindow/MessageItem';
import { styles } from './chatWindow/chatWindowStyles';
import { API_URL, getRelativeDateString } from './chatWindow/chatWindowUtils';

// Cửa sổ hiển thị: chỉ vẽ N tin nhắn cuối để DOM không phình mãi khi cuộn xa lên lịch sử
const INITIAL_WINDOW_SIZE = 150;
const WINDOW_EXPAND_STEP = 100;
const WINDOW_TRIM_THRESHOLD = 250;
const WINDOW_TRIM_DELAY_MS = 400;
const GROUP_GAP_MS = 15 * 60 * 1000;

/**
 * Chỉ vẽ lại khung chat khi dữ liệu liên quan thật sự thay đổi.
 * Danh sách người online thay đổi liên tục (mỗi lần ai đó khoá/mở máy) nhưng khung chat chỉ cần biết
 * "người đang chat cùng có online không" → so sánh đúng giá trị đó thay vì cả mảng.
 */
function areChatWindowPropsEqual(prev, next) {
  const nextKeys = Object.keys(next);
  if (nextKeys.length !== Object.keys(prev).length) return false;
  for (const key of nextKeys) {
    if (key === 'onlineUsers') continue;
    if (prev[key] !== next[key]) return false;
  }
  const conv = next.conversation;
  if (!conv || conv.isGroup) return true;
  const other = conv.members?.find((m) => m.user?.id !== next.user?.id);
  if (!other) return true;
  const prevOnline = Array.isArray(prev.onlineUsers) && prev.onlineUsers.includes(other.user.id);
  const nextOnline = Array.isArray(next.onlineUsers) && next.onlineUsers.includes(other.user.id);
  return prevOnline === nextOnline;
}

/**
 * Tính kích thước cửa sổ hiển thị mới khi danh sách tin nhắn / cuộc hội thoại / chế độ tìm kiếm thay đổi.
 * - Đổi phòng → về mặc định.
 * - Tin cũ được nạp thêm ở đầu → nới cửa sổ đúng bằng số tin mới để chúng hiện ra.
 * - Tin thêm/bớt ở cuối → giữ nguyên vị trí bắt đầu (không cắt bớt dòng phía trên khi đang đọc).
 * - Tắt tìm kiếm khi đang đọc giữa chừng → giữ nguyên toàn bộ dòng đang vẽ (sẽ thu gọn khi quay về đáy).
 */
function computeNextWindowSize(prev, convId, messages, searchActive, isStuckToBottom) {
  if (prev.convId !== convId) return INITIAL_WINDOW_SIZE;
  let size = prev.size;
  const prevMessages = prev.messages;
  if (prevMessages !== messages && prevMessages?.length > 0 && messages?.length > 0) {
    const delta = messages.length - prevMessages.length;
    const prevFirstId = prevMessages[0]?.id;
    if (delta > 0 && messages[0]?.id !== prevFirstId && messages[delta]?.id === prevFirstId) {
      size += delta;
    } else if (delta !== 0 && messages[0]?.id === prevFirstId) {
      size = Math.max(1, size + delta);
    }
  }
  if (prev.searchActive && !searchActive && !isStuckToBottom) {
    size = Math.max(size, messages?.length || 0);
  }
  return size;
}

export default React.memo(ChatWindow, areChatWindowPropsEqual);

function ChatWindow({
  user,
  token,
  conversation,
  conversations = [],
  wallpaper = '',
  messages,
  typingUsers,
  onSendMessage,
  onPinMessage,
  onToggleReaction,
  onRecallMessage,
  onEditMessage,
  onDeleteMessage,
  onStartCall, // Trực tiếp gọi
  toggleRightSidebar,
  onlineUsers,
  mobileActiveView,
  setMobileActiveView,
  className,
  onImageClick,
  fetchOlderMessages,
  hasMoreMessages,
  isLoadingOlder,
  socket = null
}) {
  const [activePopoverMsgId, setActivePopoverMsgId] = useState(null);
  const [activeReactMsgId, setActiveReactMsgId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [popoverDirection, setPopoverDirection] = useState('up');
  const [manuallyShownTimes, setManuallyShownTimes] = useState(new Set());
  const [popoverStyle, setPopoverStyle] = useState({});

  // Trạng thái tìm kiếm tin nhắn trong phòng chat
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);

  // Lọc danh sách tin nhắn khớp từ khóa (kiểm tra !isRecalled và chuỗi hợp lệ trước để không lỗi với tin đã thu hồi có content = null)
  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return messages.filter(
      (msg) =>
        !msg.isRecalled &&
        msg.type === 'text' &&
        typeof msg.content === 'string' &&
        msg.content.toLowerCase().includes(q)
    );
  }, [searchQuery, messages]);

  const searchMatchIds = useMemo(() => new Set(searchMatches.map(m => m.id)), [searchMatches]);
  const activeSearchMatchId = searchMatches[activeSearchIndex]?.id;

  // Tự động chuyển chỉ mục tìm kiếm khi độ dài kết quả thay đổi
  useEffect(() => {
    if (searchMatches.length > 0) {
      setActiveSearchIndex(searchMatches.length - 1);
    } else {
      setActiveSearchIndex(-1);
    }
  }, [searchMatches.length]);

  // Tự động cuộn đến tin nhắn đang chọn trong kết quả tìm kiếm
  useEffect(() => {
    if (searchMatches.length > 0 && activeSearchIndex !== -1) {
      const activeId = searchMatches[activeSearchIndex]?.id;
      const element = document.getElementById(`msg-${activeId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSearchIndex, searchMatches]);

  const handlePrevSearch = () => {
    if (searchMatches.length === 0) return;
    setActiveSearchIndex(prev => (prev - 1 + searchMatches.length) % searchMatches.length);
  };

  const handleNextSearch = () => {
    if (searchMatches.length === 0) return;
    setActiveSearchIndex(prev => (prev + 1) % searchMatches.length);
  };

  // Trạng thái chuyển tiếp tin nhắn & Kéo-Thả tệp trực tiếp vào cửa sổ Chat
  const [forwardingMsg, setForwardingMsg] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardSearchTerm, setForwardSearchTerm] = useState('');
  const [selectedForwardConvs, setSelectedForwardConvs] = useState([]);
  const [forwardNote, setForwardNote] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState([]);
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files')) {
      dragCounterRef.current += 1;
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      setDroppedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleSendForward = () => {
    if (selectedForwardConvs.length === 0 || !forwardingMsg) return;
    
    const parsedMeta = forwardingMsg.metadata
      ? (typeof forwardingMsg.metadata === 'string' ? JSON.parse(forwardingMsg.metadata) : forwardingMsg.metadata)
      : null;

    selectedForwardConvs.forEach((convId) => {
      onSendMessage({
        conversationId: convId,
        type: forwardingMsg.type,
        content: forwardingMsg.content,
        metadata: parsedMeta
      });
      if (forwardNote.trim()) {
        onSendMessage({
          conversationId: convId,
          type: 'text',
          content: forwardNote.trim()
        });
      }
    });

    setShowForwardModal(false);
    setForwardingMsg(null);
    setSelectedForwardConvs([]);
    setForwardSearchTerm('');
    setForwardNote('');
  };

  const handleCloseForwardModal = () => {
    setShowForwardModal(false);
    setSelectedForwardConvs([]);
    setForwardNote('');
  };

  const handleConsumeDroppedFiles = useCallback(() => setDroppedFiles([]), []);

  const messagesEndRef = useRef(null);
  const chatFeedRef = useRef(null);
  const touchTimeoutRef = useRef(null);
  const lastConversationIdRef = useRef(null);
  const lastScrollHeightRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  const lastMessageCountRef = useRef(0);
  const lastMessagesRef = useRef(null);
  const lastFirstVisibleIdRef = useRef(null);
  const lastVisibleCountRef = useRef(0);
  const stickToBottomRef = useRef(true);
  const expandPendingRef = useRef(false);
  const trimTimerRef = useRef(null);
  const justTrimmedUntilRef = useRef(0);
  const windowSizeRef = useRef(INITIAL_WINDOW_SIZE);

  // ===== Cửa sổ hiển thị (render window) =====
  const convId = conversation?.id;
  const isSearchActive = searchQuery.trim() !== '';
  const [windowState, setWindowState] = useState(() => ({
    convId,
    messages,
    searchActive: isSearchActive,
    size: INITIAL_WINDOW_SIZE
  }));
  let windowSize = windowState.size;
  if (windowState.convId !== convId || windowState.messages !== messages || windowState.searchActive !== isSearchActive) {
    // Cập nhật trạng thái ngay trong lúc render (mẫu "derived state" của React) → không có khung hình nào bị vẽ sai cửa sổ
    windowSize = computeNextWindowSize(windowState, convId, messages, isSearchActive, stickToBottomRef.current);
    setWindowState({ convId, messages, searchActive: isSearchActive, size: windowSize });
  }
  windowSizeRef.current = windowSize;

  // Đang tìm kiếm → vẽ toàn bộ để cuộn tới kết quả bằng document.getElementById
  const startIndex = isSearchActive ? 0 : Math.max(0, messages.length - windowSize);
  const visibleMessages = useMemo(
    () => (startIndex === 0 ? messages : messages.slice(startIndex)),
    [messages, startIndex]
  );

  // Dải phân cách ngày / nhóm tin liên tiếp: tính theo tin liền kề THẬT trong toàn bộ danh sách (kể cả ngoài cửa sổ)
  const rowMeta = useMemo(() => {
    const result = [];
    const from = Math.max(0, startIndex - 1);
    const times = [];
    const days = [];
    for (let i = from; i < messages.length; i++) {
      const date = new Date(messages[i].createdAt);
      times.push(date.getTime());
      days.push(date.toDateString());
    }
    for (let i = startIndex; i < messages.length; i++) {
      const msg = messages[i];
      const prevMsg = messages[i - 1];
      const nextMsg = messages[i + 1];
      const k = i - from;

      const showDateSeparator = !prevMsg || days[k - 1] !== days[k];

      const isGroupStart = !prevMsg || 
        prevMsg.senderId !== msg.senderId || 
        (times[k] - times[k - 1]) >= GROUP_GAP_MS ||
        showDateSeparator;

      const isGroupEnd = !nextMsg ||
        nextMsg.senderId !== msg.senderId ||
        (times[k + 1] - times[k]) >= GROUP_GAP_MS ||
        (days[k + 1] !== days[k]);

      result.push({ showDateSeparator, isGroupStart, isGroupEnd });
    }
    return result;
  }, [messages, startIndex]);

  // Tra cứu thành viên theo id (biệt danh người gửi / người được trả lời)
  const memberById = useMemo(() => {
    const map = new Map();
    (conversation?.members || []).forEach((m) => {
      const id = m.user?.id;
      if (id !== undefined && !map.has(id)) map.set(id, m);
    });
    return map;
  }, [conversation?.members]);

  // Lọc các tin nhắn được ghim
  const pinnedMessages = useMemo(() => messages.filter(m => m.isPinned), [messages]);

  // Giá trị mới nhất cho các hàm thao tác ổn định (actions) đọc qua ref → hàm không đổi danh tính giữa các lần render
  const latestRef = useRef({});
  latestRef.current = {
    conversation,
    token,
    onToggleReaction,
    onPinMessage,
    onRecallMessage,
    onDeleteMessage,
    onStartCall,
    onImageClick
  };

  // Ảnh tải xong làm khung chat cao thêm → nếu đang bám đáy thì kéo xuống đáy, tránh "trôi" lên giữa chừng
  const handleMediaLoaded = useCallback(() => {
    const feed = chatFeedRef.current;
    if (!feed) return;
    if (stickToBottomRef.current) {
      feed.scrollTop = feed.scrollHeight;
    }
    lastScrollHeightRef.current = feed.scrollHeight;
    lastScrollTopRef.current = feed.scrollTop;
  }, []);

  // Thu gọn cửa sổ về mặc định khi người dùng đã quay lại đáy (chờ cuộn dừng hẳn để không cắt ngang quán tính cuộn trên iOS)
  const scheduleWindowTrim = useCallback(() => {
    if (trimTimerRef.current) clearTimeout(trimTimerRef.current);
    trimTimerRef.current = setTimeout(() => {
      trimTimerRef.current = null;
      if (!stickToBottomRef.current) return;
      justTrimmedUntilRef.current = Date.now() + 250;
      setWindowState((s) => (
        s.size > WINDOW_TRIM_THRESHOLD && !s.searchActive ? { ...s, size: INITIAL_WINDOW_SIZE } : s
      ));
    }, WINDOW_TRIM_DELAY_MS);
  }, []);

  useEffect(() => () => {
    if (trimTimerRef.current) clearTimeout(trimTimerRef.current);
    trimTimerRef.current = null;
  }, [convId]);

  // Các thao tác trên từng dòng tin nhắn — một đối tượng duy nhất, ổn định suốt vòng đời component
  const actions = useMemo(() => {
    // Tính vị trí popover theo khoảng cách tới mép khung chat rồi mở menu cho tin nhắn
    const openPopoverAt = (triggerEl, msgId, isMsgMe) => {
      if (!chatFeedRef.current) return false;
      const wrapperEl = triggerEl.closest('.chat-message-bubble')?.parentElement || triggerEl.parentElement;
      if (!wrapperEl) return false;

      const rect = wrapperEl.getBoundingClientRect();
      const feedRect = chatFeedRef.current.getBoundingClientRect();
      const distFromTop = rect.top - feedRect.top;
      const distFromBottom = feedRect.bottom - rect.bottom;

      // Menu đầy đủ (cảm xúc + 7 dòng thao tác) cao ~295px → nếu phía trên hẹp dưới 310px và phía dưới rộng hơn thì xổ xuống
      let dir = 'up';
      if (distFromTop < 310 && distFromBottom > distFromTop) {
        dir = 'down';
      }
      setPopoverDirection(dir);
      
      const isMobile = window.innerWidth <= 768;
      let positionStyle = {};
      
      if (isMobile) {
        const popoverWidth = 240;
        const padding = 10;
        const wrapperCenter = rect.left + rect.width / 2;
        let pageLeft = wrapperCenter - popoverWidth / 2;
        
        const minPageLeft = feedRect.left + padding;
        const maxPageLeft = feedRect.right - popoverWidth - padding;
        pageLeft = Math.max(minPageLeft, Math.min(pageLeft, maxPageLeft));
        
        const localLeft = pageLeft - rect.left;
        
        positionStyle = {
          left: `${localLeft}px`,
          right: 'auto',
          transform: 'none',
          top: dir === 'down' ? 'calc(100% + 8px)' : 'auto',
          bottom: dir === 'up' ? 'calc(100% + 8px)' : 'auto'
        };
      } else {
        positionStyle = {
          left: isMsgMe ? 'auto' : 'calc(100% + 12px)',
          right: isMsgMe ? 'calc(100% + 12px)' : 'auto',
          transform: 'none',
          top: dir === 'down' ? '0px' : 'auto',
          bottom: dir === 'up' ? '0px' : 'auto'
        };
      }
      
      setPopoverStyle(positionStyle);
      setActivePopoverMsgId(msgId);
      return true;
    };

    return {
      openPopover: (e, msgId, isMsgMe) => {
        e.stopPropagation();
        openPopoverAt(e.currentTarget, msgId, isMsgMe);
      },
      startLongPress: (e, msgId, isMsgMe) => {
        if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
        const currentTarget = e.currentTarget;
        touchTimeoutRef.current = setTimeout(() => {
          if (openPopoverAt(currentTarget, msgId, isMsgMe)) {
            if (navigator.vibrate) navigator.vibrate(50); // Phản hồi rung nhẹ
          }
        }, 400); // 400ms long press
      },
      cancelLongPress: () => {
        if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
      },
      closePopover: () => setActivePopoverMsgId(null),
      setReactPicker: (msgId) => setActiveReactMsgId(msgId),
      toggleTime: (msgId) => {
        setManuallyShownTimes(prev => {
          const newSet = new Set(prev);
          if (newSet.has(msgId)) {
            newSet.delete(msgId);
          } else {
            newSet.add(msgId);
          }
          return newSet;
        });
      },
      toggleReaction: (msgId, emoji) => latestRef.current.onToggleReaction(msgId, emoji),
      reply: (msg) => setReplyingTo(msg),
      forward: (msg) => {
        setForwardingMsg(msg);
        setShowForwardModal(true);
      },
      // Ghim / bỏ ghim tin nhắn
      pin: (msgId) => {
        const { onPinMessage: pinMessage, conversation: currentConversation } = latestRef.current;
        pinMessage(msgId, currentConversation.id);
      },
      edit: (msg) => setEditingMsg(msg),
      recall: (msgId) => latestRef.current.onRecallMessage(msgId),
      deleteForMe: (msgId) => latestRef.current.onDeleteMessage(msgId),
      imageClick: (url) => {
        const { onImageClick: openImage } = latestRef.current;
        if (openImage) {
          openImage(url);
        } else {
          window.open(url, '_blank');
        }
      },
      mediaLoaded: handleMediaLoaded,
      startCall: (isVideo) => latestRef.current.onStartCall(isVideo),
      updateTaskStatus: async (taskId, newStatus) => {
        try {
          const res = await fetch(`${API_URL}/tasks/${taskId}/status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${latestRef.current.token}`
            },
            body: JSON.stringify({ status: newStatus })
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Lỗi cập nhật trạng thái');
          }
        } catch (e) {
          alert(e.message);
        }
      }
    };
  }, [handleMediaLoaded]);

  // Cuộn thông minh: "dính đáy" khi người dùng đang ở cuối cuộc trò chuyện, giữ nguyên vị trí khi đang đọc tin cũ
  // hoặc khi tải thêm / mở rộng tin nhắn cũ ở phía trên. Chạy trước khi trình duyệt vẽ (layout effect) để không thấy giật.
  useLayoutEffect(() => {
    if (!conversation) return;

    const isNewConversation = lastConversationIdRef.current !== conversation.id;
    lastConversationIdRef.current = conversation.id;

    const feed = chatFeedRef.current;
    if (!feed) return;

    const prevCount = lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;
    const messagesChanged = lastMessagesRef.current !== messages;
    lastMessagesRef.current = messages;
    const prevFirstVisibleId = lastFirstVisibleIdRef.current;
    const prevVisibleCount = lastVisibleCountRef.current;
    lastFirstVisibleIdRef.current = visibleMessages[0]?.id;
    lastVisibleCountRef.current = visibleMessages.length;
    expandPendingRef.current = false;

    if (isNewConversation) {
      // Đổi cuộc hội thoại: luôn bắt đầu ở đáy (kể cả khi tin nhắn của phòng mới tải về sau)
      stickToBottomRef.current = true;
      feed.scrollTop = feed.scrollHeight;
      lastScrollHeightRef.current = feed.scrollHeight;
      lastScrollTopRef.current = feed.scrollTop;
      return;
    }

    const lastMsg = messages[messages.length - 1];
    const appendedByMe =
      messages.length > prevCount && lastMsg && (lastMsg.senderId === user.id || lastMsg.status === 'sending');

    // Các dòng phía trên thay đổi (tải tin cũ từ máy chủ, mở rộng/thu gọn cửa sổ, bật/tắt tìm kiếm)
    const isTopShift =
      prevVisibleCount > 0 &&
      visibleMessages.length > 0 &&
      visibleMessages[0].id !== prevFirstVisibleId;

    if (isTopShift && !stickToBottomRef.current && !appendedByMe) {
      // Đang đọc lịch sử phía trên → bù chiều cao để nội dung đang xem đứng yên (không bù 2 lần nếu trình duyệt đã neo)
      const heightDifference = feed.scrollHeight - lastScrollHeightRef.current;
      const prevTop = lastScrollTopRef.current;
      const liveTop = feed.scrollTop;
      const alreadyAnchored = Math.abs(liveTop - (prevTop + heightDifference)) < Math.abs(liveTop - prevTop);
      if (!alreadyAnchored) {
        feed.scrollTop = liveTop + heightDifference;
      }
    } else if (stickToBottomRef.current || appendedByMe) {
      // Đang ở đáy (hoặc chính mình vừa gửi) → bám đáy. Tin mới đến dùng cuộn mượt, các trường hợp khác cuộn tức thì
      stickToBottomRef.current = true;
      const isSmallAppend = messages.length - prevCount > 0 && messages.length - prevCount <= 3;
      if (isSmallAppend) {
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        });
      } else {
        feed.scrollTop = feed.scrollHeight;
      }
    }

    lastScrollHeightRef.current = feed.scrollHeight;
    lastScrollTopRef.current = feed.scrollTop;

    if (stickToBottomRef.current && windowSizeRef.current > WINDOW_TRIM_THRESHOLD) {
      scheduleWindowTrim();
    }
  }, [visibleMessages, messages, typingUsers, conversation?.id]);

  // Lắng nghe sự kiện cuộn để mở rộng cửa sổ hiển thị / kích hoạt tải thêm tin nhắn cũ
  const handleScroll = () => {
    const feed = chatFeedRef.current;
    if (!feed) return;

    // Bỏ qua sự kiện scroll giả do trình duyệt kẹp lại scrollHeight ngay khoảnh khắc thu gọn cửa sổ ở đáy
    if (Date.now() < justTrimmedUntilRef.current) {
      feed.scrollTop = feed.scrollHeight;
      lastScrollHeightRef.current = feed.scrollHeight;
      lastScrollTopRef.current = feed.scrollTop;
      stickToBottomRef.current = true;
      return;
    }

    // Cập nhật scrollHeight hiện tại của hộp thoại để so khớp khi render
    lastScrollHeightRef.current = feed.scrollHeight;
    lastScrollTopRef.current = feed.scrollTop;
    // Người dùng ở cách đáy dưới 120px → coi như đang "bám đáy"
    stickToBottomRef.current = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 120;

    if (stickToBottomRef.current && windowSizeRef.current > WINDOW_TRIM_THRESHOLD && !isSearchActive) {
      scheduleWindowTrim();
    }

    // Nếu cuộn lên gần đỉnh (cách đỉnh <= 15px)
    if (feed.scrollTop <= 15) {
      if (startIndex > 0) {
        // Còn tin cũ trong bộ nhớ chưa vẽ → mở rộng cửa sổ (không cần gọi mạng)
        if (!expandPendingRef.current) {
          expandPendingRef.current = true;
          setWindowState((s) => ({ ...s, size: s.size + WINDOW_EXPAND_STEP }));
        }
      } else {
        fetchOlderMessages();
      }
    }
  };

  if (!conversation) {
    return (
      <div style={styles.emptyContainer} className={`anim-fade ${className || ''}`}>
        <img 
          src="/pwa-192x192.png" 
          alt="ChatTikovia" 
          style={styles.emptyImg} 
        />
        <h2>Chào mừng đến với ChatTikovia</h2>
        <p>Chọn một cuộc hội thoại từ menu bên trái để bắt đầu chat nội bộ bảo mật.</p>
      </div>
    );
  }

  // Lấy thông tin đối phương (nếu chat 1v1)
  const isGroup = conversation.isGroup;
  const otherMember = !isGroup ? conversation.members.find(m => m.user.id !== user.id) : null;
  const isOnline = otherMember ? onlineUsers.includes(otherMember.user.id) : false;

  const chatTitle = isGroup
    ? conversation.name
    : (otherMember?.nickname || otherMember?.user.displayName || 'Người dùng Zalo');
  const chatAvatar = isGroup
    ? (conversation.avatarUrl || null)
    : (otherMember?.user.avatarUrl || null);

  // Tìm biệt danh của người gửi tin nhắn
  const getSenderName = (msg) => {
    if (msg.senderId === user.id) return 'Bạn';
    const member = memberById.get(msg.senderId);
    return member?.nickname || msg.sender?.displayName || 'Người dùng';
  };

  // Tên người gửi của tin nhắn được trả lời
  const getReplySenderName = (replyTo) => {
    if (replyTo.senderId === user.id) return 'Bạn';
    return memberById.get(replyTo.senderId)?.nickname || replyTo.sender?.displayName || 'Người dùng';
  };

  return (
    <div 
      style={{
        ...styles.container,
        ...(wallpaper ? { background: wallpaper, backgroundImage: wallpaper } : {})
      }} 
      className={`anim-fade ${className || ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Lớp phủ Kéo-Thả Tệp/Ảnh trực tiếp vào khung chat */}
      {isDraggingOver && (
        <div
          style={{
            position: 'absolute',
            inset: '12px',
            zIndex: 999,
            background: 'rgba(15, 23, 42, 0.82)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '2px dashed var(--primary)',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: '#ffffff',
            pointerEvents: 'none'
          }}
          className="anim-fade"
        >
          <div style={{ fontSize: '3rem' }}>📂</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>Thả ảnh hoặc tài liệu vào đây</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Hỗ trợ gửi nhiều ảnh và tệp đính kèm cùng lúc (Tối đa 100MB/tệp)
          </div>
        </div>
      )}
      {/* Top Header */}
      <ChatHeader
        title={chatTitle}
        avatarUrl={chatAvatar}
        isGroup={isGroup}
        isOnline={isOnline}
        memberCount={conversation.members.length}
        showSearch={showSearch}
        onToggleSearch={() => {
          setShowSearch(prev => !prev);
          if (showSearch) setSearchQuery('');
        }}
        onStartCall={onStartCall}
        toggleRightSidebar={toggleRightSidebar}
        setMobileActiveView={setMobileActiveView}
      />

      {/* In-chat Search Bar */}
      {showSearch && (
        <ChatSearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          matchCount={searchMatches.length}
          activeSearchIndex={activeSearchIndex}
          onPrev={handlePrevSearch}
          onNext={handleNextSearch}
          onClose={() => {
            setShowSearch(false);
            setSearchQuery('');
          }}
        />
      )}

      {/* Pinned Messages Banner */}
      {pinnedMessages.length > 0 && <PinnedBanner pinnedMessages={pinnedMessages} />}

      {/* Messages Feed */}
      <div 
        style={styles.chatFeed} 
        ref={chatFeedRef} 
        onClick={() => { setActivePopoverMsgId(null); setActiveReactMsgId(null); }}
        onScroll={handleScroll}
      >
        {isLoadingOlder && (
          <div style={styles.loadingOlder}>
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
          </div>
        )}
        {messages.length === 0 ? (
          <div style={styles.startChat}>
            <p>Bắt đầu cuộc trò chuyện. Hãy gửi lời chào!</p>
          </div>
        ) : (
          visibleMessages.map((msg, i) => {
            const meta = rowMeta[i];
            const isMe = msg.senderId === user.id;
            const isPopoverOpen = activePopoverMsgId === msg.id;
            return (
              <MessageItem
                key={msg.id}
                msg={msg}
                isMe={isMe}
                userId={user.id}
                dateSeparatorText={meta.showDateSeparator ? getRelativeDateString(msg.createdAt) : null}
                isGroupStart={meta.isGroupStart}
                isGroupEnd={meta.isGroupEnd}
                senderName={!isMe && isGroup && meta.isGroupStart ? getSenderName(msg) : null}
                replySenderName={msg.replyTo ? getReplySenderName(msg.replyTo) : null}
                isPopoverOpen={isPopoverOpen}
                popoverDirection={isPopoverOpen ? popoverDirection : null}
                popoverStyle={isPopoverOpen ? popoverStyle : null}
                isReactPickerOpen={activeReactMsgId === msg.id}
                isTimeShown={manuallyShownTimes.has(msg.id)}
                isSearchMatch={searchMatchIds.has(msg.id)}
                isActiveSearchMatch={activeSearchMatchId !== undefined && activeSearchMatchId === msg.id}
                actions={actions}
              />
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div style={styles.messageRow}>
            <div style={{...styles.messageBubble, background: 'var(--bg-glass)', borderRadius: '16px 16px 16px 4px', display: 'flex', alignItems: 'center', padding: '10px 14px'}}>
              <span style={{marginRight: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)'}}>
                {typingUsers.map(u => u.displayName).join(', ')} đang nhập
              </span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Component */}
      <ChatInput 
        token={token} 
        user={user}
        socket={socket}
        conversation={conversation}
        onSendMessage={onSendMessage} 
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        editingMsg={editingMsg}
        setEditingMsg={setEditingMsg}
        onEditMessage={onEditMessage}
        droppedFiles={droppedFiles}
        onConsumeDroppedFiles={handleConsumeDroppedFiles}
      />

      {/* Forward Modal */}
      {showForwardModal && forwardingMsg && (
        <ForwardModal
          forwardingMsg={forwardingMsg}
          conversations={conversations}
          user={user}
          forwardSearchTerm={forwardSearchTerm}
          setForwardSearchTerm={setForwardSearchTerm}
          forwardNote={forwardNote}
          setForwardNote={setForwardNote}
          selectedForwardConvs={selectedForwardConvs}
          setSelectedForwardConvs={setSelectedForwardConvs}
          onClose={handleCloseForwardModal}
          onSend={handleSendForward}
        />
      )}
    </div>
  );
}
