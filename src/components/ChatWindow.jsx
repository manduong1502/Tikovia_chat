import React, { useEffect, useRef, useState } from 'react';
import { FiPhone, FiVideo, FiSidebar, FiDownload, FiMapPin, FiClock, FiChevronLeft, FiCheckSquare, FiSearch, FiChevronUp, FiChevronDown, FiX, FiSmile, FiCopy, FiCornerUpLeft, FiShare2, FiEdit3, FiTrash2, FiFolder } from 'react-icons/fi';
import { BsPinAngle } from 'react-icons/bs';
import ChatInput from './ChatInput';
import Avatar from './Avatar';

// Component Trình phát Tin nhắn thoại (Voice Message Player) thiết kế tùy chỉnh cao cấp
const VoiceMessagePlayer = React.memo(({ audioUrl }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    // Kiểm tra định kỳ thời lượng nếu metadata load chậm (nhất là trên Chrome di động)
    const durationInterval = setInterval(() => {
      if (audio.duration && isFinite(audio.duration) && duration === 0) {
        setDuration(audio.duration);
        clearInterval(durationInterval);
      }
    }, 500);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      clearInterval(durationInterval);
    };
  }, [duration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(e => console.error("Error playing audio:", e));
      setIsPlaying(true);
    }
  };

  const handleProgressBarClick = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    audio.currentTime = percent * duration;
    setCurrentTime(audio.currentTime);
  };

  const formatDuration = (secs) => {
    if (isNaN(secs) || !isFinite(secs)) return '00:00';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div style={styles.voicePlayerContainer}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <button 
        onClick={togglePlay} 
        style={styles.voicePlayBtn} 
        className="btn-interactive"
        type="button"
      >
        {isPlaying ? (
          // Pause Icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="4" width="4" height="16" rx="1" />
            <rect x="16" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          // Play Icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      
      <div style={styles.voiceTimeline} onClick={handleProgressBarClick}>
        <div style={styles.voiceWaveContainer}>
          {[10, 16, 12, 22, 14, 8, 18, 12, 20, 10, 16, 12, 14, 10, 18, 12].map((h, i, arr) => {
            const isPlayed = duration ? (currentTime / duration) > (i / arr.length) : false;
            return (
              <div 
                key={i} 
                style={{
                  ...styles.voiceWaveBar, 
                  height: `${h}px`,
                  backgroundColor: isPlayed ? 'var(--primary)' : 'var(--text-secondary)',
                  opacity: isPlayed ? 1 : 0.35
                }} 
              />
            );
          })}
        </div>
      </div>
      
      <span style={styles.voiceDuration}>
        {isPlaying ? formatDuration(currentTime) : formatDuration(duration || 0)}
      </span>
    </div>
  );
});

// Hàm tạo hiệu ứng bùng nổ tim/like (Particle reaction burst)
const spawnReactionBurst = (emoji, x, y) => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
  container.style.pointerEvents = 'none';
  container.style.zIndex = '99999';
  document.body.appendChild(container);

  const particleCount = 10;
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('span');
    particle.innerText = emoji;
    particle.style.position = 'absolute';
    particle.style.fontSize = `${16 + Math.random() * 12}px`;
    particle.style.transition = 'all 0.8s cubic-bezier(0.25, 1, 0.5, 1)';
    particle.style.transform = 'translate(-50%, -50%)';
    particle.style.opacity = '1';
    
    container.appendChild(particle);

    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 60;
    const destX = Math.cos(angle) * distance;
    const destY = Math.sin(angle) * distance;

    requestAnimationFrame(() => {
      particle.style.transform = `translate(calc(-50% + ${destX}px), calc(-50% + ${destY}px)) scale(0.3)`;
      particle.style.opacity = '0';
    });
  }

  setTimeout(() => {
    document.body.removeChild(container);
  }, 900);
};

export default function ChatWindow({
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
  isLoadingOlder
}) {
  const [pinnedMessages, setPinnedMessages] = useState([]);
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

  // Lọc danh sách tin nhắn khớp từ khóa
  const searchMatches = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    return messages.filter(msg => 
      msg.type === 'text' && 
      msg.content.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !msg.isRecalled
    );
  }, [searchQuery, messages]);

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

  // Trạng thái chuyển tiếp tin nhắn
  const [forwardingMsg, setForwardingMsg] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardSearchTerm, setForwardSearchTerm] = useState('');
  const [selectedForwardConvs, setSelectedForwardConvs] = useState([]);

  const handleSendForward = () => {
    if (selectedForwardConvs.length === 0 || !forwardingMsg) return;
    
    selectedForwardConvs.forEach(convId => {
      onSendMessage({
        conversationId: convId,
        type: forwardingMsg.type,
        content: forwardingMsg.content,
        metadata: forwardingMsg.metadata ? (typeof forwardingMsg.metadata === 'string' ? JSON.parse(forwardingMsg.metadata) : forwardingMsg.metadata) : null
      });
    });

    setShowForwardModal(false);
    setForwardingMsg(null);
    setSelectedForwardConvs([]);
    setForwardSearchTerm('');
  };

  const messagesEndRef = useRef(null);
  const chatFeedRef = useRef(null);
  const touchTimeoutRef = useRef(null);
  const lastConversationIdRef = useRef(null);
  const lastScrollHeightRef = useRef(0);
  const lastMessageCountRef = useRef(0);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const BASE_URL = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL;

  // Quyết định URL tệp hiển thị (Cục bộ hay Proxy Google Drive)
  const getFileUrl = (content) => {
    if (!content) return '';
    if (content.includes('drive.google.com')) {
      const match = content.match(/[?&]id=([^&]+)/) || content.match(/\/file\/d\/([^/]+)/);
      if (match && match[1]) {
        return `${API_URL}/chat/drive-file/${match[1]}`;
      }
    }
    if (content.startsWith('http')) {
      return content;
    }
    return `${BASE_URL}${content}`;
  };

  // Helper định dạng ngày phân tách dạng Voz
  const getRelativeDateString = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    
    const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const diffTime = dToday - dDate;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dayName = days[date.getDay()];
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const dateStr = `${dayName} ${dd}/${mm}/${yyyy}`;
    
    if (diffDays === 0) {
      return `Hôm nay, ${dateStr}`;
    } else if (diffDays === 1) {
      return `Hôm qua, ${dateStr}`;
    } else if (diffDays > 1) {
      return `${dateStr} (${diffDays} ngày trước)`;
    }
    return dateStr;
  };

  const handleOpenPopover = (e, msgId, isMsgMe) => {
    e.stopPropagation();
    if (!chatFeedRef.current) return;
    
    const triggerEl = e.currentTarget;
    const wrapperEl = triggerEl.closest('.chat-message-bubble')?.parentElement || triggerEl.parentElement;
    if (!wrapperEl) return;

    const rect = wrapperEl.getBoundingClientRect();
    const feedRect = chatFeedRef.current.getBoundingClientRect();
    const distFromTop = rect.top - feedRect.top;
    
    let dir = 'up';
    if (distFromTop < 220) {
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
  };

  // Cuộn thông minh: tránh nhảy giật màn hình khi tải tin nhắn cũ, tự cuộn đáy khi có tin nhắn mới
  useEffect(() => {
    if (!conversation) return;

    const isNewConversation = lastConversationIdRef.current !== conversation.id;
    lastConversationIdRef.current = conversation.id;

    const feed = chatFeedRef.current;
    if (!feed) return;

    if (isNewConversation) {
      // Đổi cuộc hội thoại: Cuộn xuống đáy ngay lập tức
      feed.scrollTop = feed.scrollHeight;
      lastMessageCountRef.current = messages.length;
      lastScrollHeightRef.current = feed.scrollHeight;
      return;
    }

    // Nếu tin nhắn được thêm vào đỉnh (tải tin nhắn cũ)
    const isPrepended = messages.length > lastMessageCountRef.current && 
                        messages[0]?.id !== messages[messages.length - lastMessageCountRef.current]?.id;

    if (isPrepended) {
      // Giữ nguyên vị trí cuộn tương đối bằng cách bù đắp phần chênh lệch chiều cao mới
      const newScrollHeight = feed.scrollHeight;
      const heightDifference = newScrollHeight - lastScrollHeightRef.current;
      feed.scrollTop = feed.scrollTop + heightDifference;
    } else {
      // Nếu có tin nhắn mới hoặc đang gõ chữ
      const isNearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 300;
      if (isNearBottom && messages.length > lastMessageCountRef.current) {
        // Cuộn mượt xuống đáy
        const timer = setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }

    lastMessageCountRef.current = messages.length;
    lastScrollHeightRef.current = feed.scrollHeight;
  }, [messages, typingUsers, conversation?.id]);

  // Lắng nghe sự kiện cuộn để kích hoạt tải thêm tin nhắn cũ
  const handleScroll = () => {
    const feed = chatFeedRef.current;
    if (!feed) return;

    // Cập nhật scrollHeight hiện tại của hộp thoại để so khớp khi render
    lastScrollHeightRef.current = feed.scrollHeight;

    // Nếu cuộn lên gần đỉnh (cách đỉnh <= 15px) và không trong quá trình load tin nhắn
    if (feed.scrollTop <= 15) {
      fetchOlderMessages();
    }
  };

  // Lọc các tin nhắn được ghim
  useEffect(() => {
    setPinnedMessages(messages.filter(m => m.isPinned));
  }, [messages]);

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

  const getChatTitle = () => {
    if (isGroup) return conversation.name;
    return otherMember?.nickname || otherMember?.user.displayName || 'Người dùng Zalo';
  };

  const getChatAvatar = () => {
    if (isGroup) {
      return conversation.avatarUrl || null;
    }
    return otherMember?.user.avatarUrl || null;
  };

  // Tìm biệt danh của người gửi tin nhắn
  const getSenderName = (msg) => {
    if (msg.senderId === user.id) return 'Bạn';
    const member = conversation.members.find(m => m.user.id === msg.senderId);
    return member?.nickname || msg.sender?.displayName || 'Người dùng';
  };

  // Kiểm tra xem tin nhắn có bị ghim không
  const handlePinClick = (msgId) => {
    onPinMessage(msgId, conversation.id);
  };

  // Render reply preview inside the bubble
  const renderReplyContext = (msg) => {
    if (!msg.replyTo) return null;
    const isMeReply = msg.replyTo.senderId === user.id;
    const senderName = isMeReply 
      ? 'Bạn' 
      : (conversation.members.find(m => m.user.id === msg.replyTo.senderId)?.nickname || msg.replyTo.sender?.displayName || 'Người dùng');
    
    return (
      <div style={{
        ...styles.replyContext,
        backgroundColor: msg.senderId === user.id ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.06)',
        color: msg.senderId === user.id ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)'
      }}>
        <div style={styles.replyContextTitle}>{senderName}</div>
        <div style={styles.replyContextBody}>
          {msg.replyTo.isRecalled ? 'Tin nhắn đã bị thu hồi' : msg.replyTo.type === 'text' ? msg.replyTo.content : `[${msg.replyTo.type.toUpperCase()}]`}
        </div>
      </div>
    );
  };

  // Render cuộc gọi Zalo-style
  const renderCallCard = (msg, metadata) => {
    const isVideo = metadata?.callType === 'video';
    const isMissed = metadata?.status === 'missed';
    const duration = metadata?.duration || 0;

    const formatDuration = (sec) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
    };

    let IconComponent = FiPhone;
    if (isVideo) {
      IconComponent = FiVideo;
    }

    const title = isMissed 
      ? `Đã nhỡ cuộc gọi ${isVideo ? 'video' : 'thoại'}`
      : `Cuộc gọi ${isVideo ? 'video' : 'thoại'}`;
      
    const subtitle = isMissed
      ? 'Cuộc gọi nhỡ'
      : formatDuration(duration);

    return (
      <div style={styles.callCardContainer}>
        <div style={styles.callCardHeader}>
          <div style={{
            ...styles.callCardIconContainer,
            backgroundColor: isMissed ? 'var(--danger)' : 'rgba(99, 102, 241, 0.12)'
          }}>
            <IconComponent size={18} style={{ color: isMissed ? '#ffffff' : 'var(--primary)' }} />
          </div>
          <div style={styles.callCardText}>
            <div style={styles.callCardTitle}>{title}</div>
            <div style={styles.callCardSubtitle}>{subtitle}</div>
          </div>
        </div>
        <button 
          style={styles.callCardBtn}
          className="btn-interactive"
          onClick={(e) => {
            e.stopPropagation();
            onStartCall(isVideo);
          }}
        >
          Gọi lại
        </button>
      </div>
    );
  };

  // Get stylized file icon for premium layout (like Zalo/Voz)
  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    
    let bg = '#64748b';
    let symbol = '📄';
    let fontSize = '16px';
    
    if (['doc', 'docx'].includes(ext)) {
      bg = '#1a5fbb';
      symbol = 'W';
    } else if (['xls', 'xlsx'].includes(ext)) {
      bg = '#107c41';
      symbol = 'X';
    } else if (ext === 'pdf') {
      bg = '#e01b22';
      symbol = 'PDF';
      fontSize = '10px';
    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      bg = '#7c3aed';
      return (
        <div style={{
          width: '38px',
          height: '46px',
          borderRadius: '6px',
          background: bg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontFamily: 'system-ui',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          flexShrink: 0,
          position: 'relative'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1px',
            width: '6px',
            margin: '2px 0 1px 0'
          }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ width: '6px', height: '1.5px', background: 'rgba(255,255,255,0.4)', borderRadius: '1px' }} />
            ))}
          </div>
          <span style={{ fontSize: '8px', fontWeight: '800', textTransform: 'uppercase' }}>{ext}</span>
        </div>
      );
    } else if (['ppt', 'pptx'].includes(ext)) {
      bg = '#c43e1c';
      symbol = 'P';
    }
    
    return (
      <div style={{
        width: '38px',
        height: '46px',
        borderRadius: '6px',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontFamily: 'system-ui',
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        flexShrink: 0
      }}>
        <span style={{ fontSize, fontWeight: '800' }}>{symbol}</span>
      </div>
    );
  };

  // Render nội dung tin nhắn dựa trên type
  const renderMessageContent = (msg) => {
    if (msg.isRecalled) {
      return <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Tin nhắn đã bị thu hồi</span>;
    }

    let metadata = {};
    if (msg.metadata) {
      try {
        metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
      } catch (e) {
        console.error('Lỗi parse metadata tin nhắn:', e);
      }
    }

    switch (msg.type) {
      case 'text':
        // Định dạng liên kết URL và tag @
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        
        // Hàm escape các thẻ HTML thô chống tấn công XSS
        const escapeHTML = (str) => {
          if (!str) return '';
          return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        };

        let renderedText = escapeHTML(msg.content);
        
        // Match urls
        renderedText = renderedText.replace(urlRegex, (url) => {
          return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; text-decoration: underline; word-break: break-all;">${url}</a>`;
        });

        // Match mentions (format: @DisplayName)
        const mentionRegex = /@([a-zA-Z0-9À-ỹ\s]+)/g;
        // Đánh dấu đậm các tag mention
        renderedText = renderedText.replace(mentionRegex, (match) => {
          return `<span style="color: #fca5a5; font-weight: bold; background: rgba(239, 68, 68, 0.1); padding: 2px 4px; border-radius: 4px;">${match}</span>`;
        });

        return <div dangerouslySetInnerHTML={{ __html: renderedText }} />;

      case 'sticker':
        const isUrl = msg.content && (msg.content.startsWith('http://') || msg.content.startsWith('https://'));
        const stickerSrc = isUrl ? msg.content : `/stickers/${metadata.stickerId || '1'}.png`;
        return (
          <img 
            src={stickerSrc} 
            alt="Sticker" 
            onError={(e) => {
                // Fallback nếu không có tệp sticker trên đĩa, lấy favicon làm mặc định
                e.target.src = '/favicon.svg';
            }}
            style={styles.stickerImg} 
          />
        );

      case 'image':
        return (
          <div style={styles.imageWrapper}>
            <img 
              src={getFileUrl(msg.content)} 
              alt="Uploaded" 
              style={styles.chatImage} 
              onClick={() => onImageClick ? onImageClick(getFileUrl(msg.content)) : window.open(getFileUrl(msg.content), '_blank')}
              loading="lazy"
            />
          </div>
        );

      case 'file': {
        const rawFileName = metadata.fileName || msg.content.substring(msg.content.lastIndexOf('/') + 1);
        const cleanFileName = rawFileName.replace(/^\d+-/, '');
        const formattedSize = metadata.fileSize 
          ? (metadata.fileSize < 1024 * 1024 
              ? `${(metadata.fileSize / 1024).toFixed(1)} KB` 
              : `${(metadata.fileSize / (1024 * 1024)).toFixed(2)} MB`)
          : '';
        const msgTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        return (
          <div style={{
            width: '290px',
            maxWidth: '100%',
            padding: '12px 14px 28px 14px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(23, 29, 43, 0.95)',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            {/* 1. File Type Icon */}
            {getFileIcon(cleanFileName)}
            
            {/* 2. File Information */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
              gap: '4px'
            }}>
              <span style={{
                fontSize: '0.82rem',
                fontWeight: '600',
                color: '#f8fafc',
                wordBreak: 'break-all',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }} title={cleanFileName}>
                {cleanFileName}
              </span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.7rem',
                color: '#94a3b8'
              }}>
                <span>{formattedSize}</span>
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span style={{ fontSize: '10px' }}>✓</span> Đã có trên máy
                </span>
              </div>
            </div>
            
            {/* 3. Action Buttons */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}>
              <button 
                onClick={() => window.open(metadata.webViewLink || getFileUrl(msg.content), '_blank')}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  color: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                className="btn-interactive"
                title="Xem tài liệu"
              >
                <FiFolder size={12} />
              </button>
              <a 
                href={getFileUrl(msg.content)} 
                download 
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  color: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                className="btn-interactive"
                title="Tải xuống tập tin"
              >
                <FiDownload size={12} />
              </a>
            </div>
            
            {/* Timestamp at bottom left */}
            <span style={{
              position: 'absolute',
              bottom: '8px',
              left: '14px',
              fontSize: '0.65rem',
              color: '#64748b'
            }}>
              {msgTime}
            </span>
          </div>
        );
      }

      case 'voice':
        return (
          <div style={styles.voiceBox}>
            <VoiceMessagePlayer audioUrl={getFileUrl(msg.content)} />
          </div>
        );

      case 'location':
        return (
          <div style={styles.locationBox}>
            <div style={styles.locationHeader}>
              <FiMapPin style={{color: 'var(--danger)', marginRight: '5px'}} />
              <strong>Vị trí đã chia sẻ</strong>
            </div>
            <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px'}}>{metadata.address || 'Xem vị trí bản đồ'}</p>
            <iframe 
              title="Shared Location"
              width="100%" 
              height="150" 
              style={{border: 0, borderRadius: 'var(--radius-sm)'}}
              src={`https://maps.google.com/maps?q=${metadata.lat},${metadata.lng}&z=15&output=embed`}
            />
          </div>
        );

      case 'reminder':
        return (
          <div style={styles.reminderBox}>
            <div style={styles.reminderHeader}>
              <FiClock style={{color: 'var(--accent)', marginRight: '5px'}} />
              <strong>Lịch nhắc hẹn</strong>
            </div>
            <p style={{fontWeight: '600', fontSize: '0.9rem', margin: '4px 0'}}>{msg.content}</p>
            <p style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>
              Hẹn giờ: {new Date(metadata.remindAt).toLocaleString('vi-VN')}
            </p>
          </div>
        );

      case 'task':
        const taskTitle = metadata.title || msg.content;
        const taskDesc = metadata.description || '';
        const assigneeName = metadata.assigneeName || 'Thành viên';
        const assigneeId = metadata.assigneeId;
        const taskId = metadata.taskId;
        const taskStatus = metadata.status || 'pending';
        const taskDueDate = metadata.dueDate;

        // Tính toán hạn chót/quá hạn
        let isOverdue = false;
        let dueStr = '';
        if (taskDueDate) {
          const dDate = new Date(taskDueDate);
          isOverdue = dDate < new Date() && taskStatus !== 'done' && taskStatus !== 'cancelled';
          dueStr = dDate.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        // Định dạng trạng thái công việc
        let statusText = 'Chờ làm';
        let statusColor = 'var(--accent)';
        let statusBg = 'var(--accent-light)';
        if (taskStatus === 'in_progress') {
          statusText = 'Đang làm';
          statusColor = 'var(--primary)';
          statusBg = 'var(--primary-light)';
        } else if (taskStatus === 'done') {
          statusText = 'Hoàn thành';
          statusColor = 'var(--secondary)';
          statusBg = 'var(--secondary-light)';
        } else if (taskStatus === 'cancelled') {
          statusText = 'Đã hủy';
          statusColor = 'var(--danger)';
          statusBg = 'var(--danger-light)';
        }

        const handleUpdateStatus = async (newStatus) => {
          try {
            const res = await fetch(`${API_URL}/tasks/${taskId}/status`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
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
        };

        const isUserAssignee = user.id === assigneeId;
        const isUserAssigner = user.id === msg.senderId;
        const borderLeftColor = isOverdue ? 'var(--danger)' : statusColor;

        return (
          <div style={{
            ...styles.taskCardContainer,
            borderLeft: `4px solid ${borderLeftColor}`,
            opacity: taskStatus === 'done' ? 0.65 : 1
          }}>
            <div style={styles.taskCardHeader}>
              <div style={styles.taskCardTitleRow}>
                <FiCheckSquare size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span style={styles.taskCardTitle} title={taskTitle}>{taskTitle}</span>
              </div>
              <span style={{ ...styles.taskCardStatusBadge, color: statusColor, backgroundColor: statusBg }}>
                {statusText}
              </span>
            </div>
            {taskDesc && <p style={styles.taskCardDesc}>{taskDesc}</p>}
            <div style={styles.taskCardMeta}>
              <div style={styles.taskCardMetaItem}>
                <span style={styles.taskCardMetaLabel}>Người nhận:</span>
                <span style={styles.taskCardMetaVal}>{assigneeName} {isUserAssignee && '(Bạn)'}</span>
              </div>
              {taskDueDate && (
                <div style={styles.taskCardMetaItem}>
                  <span style={styles.taskCardMetaLabel}>Hạn chót:</span>
                  <span style={{ 
                    ...styles.taskCardMetaVal, 
                    color: isOverdue ? 'var(--danger)' : 'var(--text-secondary)',
                    fontWeight: isOverdue ? '600' : 'normal' 
                  }}>
                    {dueStr} {isOverdue && ' (Quá hạn)'}
                  </span>
                </div>
              )}
            </div>
            
            {/* Quick buttons */}
            {(taskStatus !== 'done' && taskStatus !== 'cancelled') && (
              <div style={styles.taskCardActions}>
                {assigneeId === '00000000-0000-0000-0000-000000000001' && taskStatus === 'pending' ? (
                  <button 
                    onClick={() => handleUpdateStatus('in_progress')} 
                    style={styles.taskCardBtnPrimary}
                    className="btn-interactive"
                  >
                    Nhận đơn
                  </button>
                ) : (
                  isUserAssignee && taskStatus === 'pending' && (
                    <button 
                      onClick={() => handleUpdateStatus('in_progress')} 
                      style={styles.taskCardBtnPrimary}
                      className="btn-interactive"
                    >
                      Bắt đầu làm
                    </button>
                  )
                )}
                {isUserAssignee && taskStatus === 'in_progress' && (
                  <button 
                    onClick={() => handleUpdateStatus('done')} 
                    style={styles.taskCardBtnSuccess}
                    className="btn-interactive"
                  >
                    Hoàn thành
                  </button>
                )}
                {(isUserAssigner || isUserAssignee) && (
                  <button 
                    onClick={() => handleUpdateStatus('cancelled')} 
                    style={styles.taskCardBtnDanger}
                    className="btn-interactive"
                  >
                    Hủy việc
                  </button>
                )}
              </div>
            )}
          </div>
        );

      case 'call':
        return renderCallCard(msg, metadata);

      default:
        return <div>{msg.content}</div>;
    }
  };

  return (
    <div 
      style={{
        ...styles.container,
        ...(wallpaper ? { background: wallpaper, backgroundImage: wallpaper } : {})
      }} 
      className={`anim-fade ${className || ''}`}
    >
      {/* Top Header */}
      <div style={styles.header} className="glass">
        <div style={styles.headerInfo}>
          {/* Nút quay lại dành cho Mobile */}
          <button 
            onClick={() => setMobileActiveView('list')} 
            className="mobile-back-btn"
            style={styles.backBtn}
          >
            <FiChevronLeft size={24} />
          </button>
          <Avatar url={getChatAvatar()} name={getChatTitle()} size={40} isOnline={!isGroup && isOnline} />
          <div>
            <h3 style={styles.title}>{getChatTitle()}</h3>
            <span style={styles.status}>
              {isGroup 
                ? `${conversation.members.length} thành viên`
                : (isOnline ? 'Đang hoạt động' : 'Ngoại tuyến')}
            </span>
          </div>
        </div>
        <div style={styles.headerActions}>
          <button 
            title="Tìm kiếm tin nhắn" 
            onClick={() => {
              setShowSearch(prev => !prev);
              if (showSearch) setSearchQuery('');
            }} 
            style={{
              ...styles.headerBtn,
              color: showSearch ? 'var(--primary)' : 'var(--text-primary)'
            }} 
            className="btn-interactive"
          >
            <FiSearch size={18} />
          </button>
          {!isGroup && (
            <>
              <button title="Gọi thoại" onClick={() => onStartCall(false)} style={styles.headerBtn} className="btn-interactive">
                <FiPhone size={18} />
              </button>
              <button title="Gọi Video" onClick={() => onStartCall(true)} style={styles.headerBtn} className="btn-interactive">
                <FiVideo size={18} />
              </button>
            </>
          )}
          <button title="Tùy chọn cuộc trò chuyện" onClick={toggleRightSidebar} style={styles.headerBtn} className="btn-interactive">
            <FiSidebar size={18} />
          </button>
        </div>
      </div>

      {/* In-chat Search Bar */}
      {showSearch && (
        <div style={styles.searchBarContainer} className="glass-card anim-slide-down">
          <FiSearch size={16} style={styles.searchBarIcon} />
          <input 
            type="text"
            placeholder="Tìm từ khóa trong tin nhắn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchBarInput}
            autoFocus
          />
          {searchQuery.trim() && (
            <div style={styles.searchBarNav}>
              <span style={styles.searchBarCount}>
                {searchMatches.length > 0 ? `${activeSearchIndex + 1}/${searchMatches.length}` : '0 kết quả'}
              </span>
              <button 
                onClick={handlePrevSearch} 
                disabled={searchMatches.length <= 1}
                style={styles.searchBarNavBtn}
                className="btn-interactive"
                title="Tin nhắn cũ hơn"
              >
                <FiChevronUp size={16} />
              </button>
              <button 
                onClick={handleNextSearch} 
                disabled={searchMatches.length <= 1}
                style={styles.searchBarNavBtn}
                className="btn-interactive"
                title="Tin nhắn mới hơn"
              >
                <FiChevronDown size={16} />
              </button>
            </div>
          )}
          <button 
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }} 
            style={styles.searchBarCloseBtn}
            className="btn-interactive"
          >
            <FiX size={16} />
          </button>
        </div>
      )}

      {/* Pinned Messages Banner */}
      {pinnedMessages.length > 0 && (
        <div style={styles.pinBanner}>
          <BsPinAngle size={14} style={{color: 'var(--primary)', transform: 'rotate(45deg)', marginRight: '8px'}} />
          <div style={styles.pinText}>
            <strong>Tin ghim: </strong>
            {pinnedMessages[pinnedMessages.length - 1].type === 'text' 
              ? pinnedMessages[pinnedMessages.length - 1].content 
              : `[${pinnedMessages[pinnedMessages.length - 1].type.toUpperCase()}]`}
          </div>
          <span style={styles.pinCount}>{pinnedMessages.length} tin</span>
        </div>
      )}

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
          messages.map((msg, index) => {
            const isMe = msg.senderId === user.id;
            const totalReactions = msg.reactions?.length || 0;
            const reactionCounts = msg.reactions?.reduce((acc, r) => {
              acc[r.type] = (acc[r.type] || 0) + 1;
              return acc;
            }, {}) || {};
            const reactionTypes = Object.keys(reactionCounts).sort((a, b) => reactionCounts[b] - reactionCounts[a]);

            // Kiểm tra tin nhắn kế tiếp có cùng người gửi và gửi cách nhau dưới 2 phút không
            const nextMsg = messages[index + 1];
            const isNearNext = nextMsg && 
              nextMsg.senderId === msg.senderId && 
              (new Date(nextMsg.createdAt) - new Date(msg.createdAt)) < 2 * 60 * 1000;

            const prevMsg = messages[index - 1];
            const showDateSeparator = !prevMsg || 
              new Date(prevMsg.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

            const isGroupStart = !prevMsg || 
              prevMsg.senderId !== msg.senderId || 
              (new Date(msg.createdAt) - new Date(prevMsg.createdAt)) >= 2 * 60 * 1000 ||
              showDateSeparator;

            const isGroupEnd = !nextMsg ||
              nextMsg.senderId !== msg.senderId ||
              (new Date(nextMsg.createdAt) - new Date(msg.createdAt)) >= 2 * 60 * 1000 ||
              (new Date(nextMsg.createdAt).toDateString() !== new Date(msg.createdAt).toDateString());

            const isSingle = isGroupStart && isGroupEnd;

            return (
              <React.Fragment key={msg.id}>
                {showDateSeparator && (
                  <div style={styles.dateSeparator}>
                    <span style={styles.dateSeparatorText}>
                      {getRelativeDateString(msg.createdAt)}
                    </span>
                  </div>
                )}
                <div 
                  id={`msg-${msg.id}`}
                  className="message-row-hover"
                  style={{
                    ...styles.messageRow,
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    justifyContent: isMe ? 'flex-end' : 'flex-start',
                    marginBottom: totalReactions > 0 ? '16px' : isGroupEnd ? '12px' : '3px'
                  }}
                >
                  {!isMe && (
                    !isGroupEnd ? (
                      <div style={{ width: '32px', height: '32px' }} />
                    ) : (
                      <Avatar 
                        url={msg.sender?.avatarUrl} 
                        name={msg.sender?.displayName || msg.sender?.username || 'User'} 
                        size={32} 
                        style={styles.messageAvatar}
                      />
                    )
                  )}
                  <div style={styles.messageContentWrapper}>
                    {!isMe && isGroup && isGroupStart && <span style={styles.senderLabel}>{getSenderName(msg)}</span>}
                    
                    <div style={{
                      ...styles.bubbleWrapper,
                      flexDirection: isMe ? 'row-reverse' : 'row',
                      alignSelf: isMe ? 'flex-end' : 'flex-start'
                    }}>
                      <div 
                        className={`chat-message-bubble ${
                          msg.isRecalled 
                            ? '' 
                            : (msg.type === 'image' || msg.type === 'sticker') 
                            ? 'bubble-media' 
                            : (msg.type === 'call' || msg.type === 'task')
                            ? 'bubble-call' 
                            : isMe 
                            ? 'bubble-sent-premium' 
                            : 'bubble-received-premium'
                        } ${
                          !isSingle
                            ? (isMe
                                ? (isGroupStart ? 'bubble-group-sent-start' : isGroupEnd ? 'bubble-group-sent-end' : 'bubble-group-sent-middle')
                                : (isGroupStart ? 'bubble-group-received-start' : isGroupEnd ? 'bubble-group-received-end' : 'bubble-group-received-middle'))
                            : ''
                        }`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (msg.status === 'sending' || msg.isRecalled) return;
                          if (activePopoverMsgId === msg.id) {
                            setActivePopoverMsgId(null);
                          } else {
                            handleOpenPopover(e, msg.id, isMe);
                          }
                        }}
                        onTouchStart={(e) => {
                          if (msg.status === 'sending' || msg.isRecalled) return;
                          if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
                          const currentTarget = e.currentTarget;
                            touchTimeoutRef.current = setTimeout(() => {
                              if (!chatFeedRef.current) return;
                              const wrapperEl = currentTarget.closest('.chat-message-bubble')?.parentElement || currentTarget.parentElement;
                              if (!wrapperEl) return;

                              const rect = wrapperEl.getBoundingClientRect();
                              const feedRect = chatFeedRef.current.getBoundingClientRect();
                              const distFromTop = rect.top - feedRect.top;
                              
                              let dir = 'up';
                              if (distFromTop < 220) {
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
                                  left: isMe ? 'auto' : 'calc(100% + 12px)',
                                  right: isMe ? 'calc(100% + 12px)' : 'auto',
                                  transform: 'none',
                                  top: dir === 'down' ? '0px' : 'auto',
                                  bottom: dir === 'up' ? '0px' : 'auto'
                                };
                              }
                              
                              setPopoverStyle(positionStyle);
                              setActivePopoverMsgId(msg.id);
                              if (navigator.vibrate) navigator.vibrate(50); // Phản hồi rung nhẹ
                          }, 400); // 400ms long press
                      }}
                      onTouchEnd={() => {
                          if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
                        }}
                      onTouchMove={() => {
                          if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
                        }}
                      onClick={(e) => {
                          e.stopPropagation();
                          if (!isGroupEnd) {
                            setManuallyShownTimes(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(msg.id)) {
                                newSet.delete(msg.id);
                              } else {
                                newSet.add(msg.id);
                              }
                              return newSet;
                            });
                          }
                        }}
                        style={{
                          ...styles.messageBubble,
                          background: msg.isRecalled ? 'rgba(255,255,255,0.02)' : (msg.type === 'image' || msg.type === 'sticker' || msg.type === 'file') ? 'transparent' : ['call', 'task'].includes(msg.type) ? 'var(--bg-glass-active)' : undefined,
                          border: searchMatches.some(m => m.id === msg.id)
                            ? '1px solid #f59e0b'
                            : ((msg.type === 'image' || msg.type === 'sticker' || msg.type === 'file') && !msg.isRecalled ? 'none' : ['call', 'task'].includes(msg.type) ? '1px solid var(--border-color)' : undefined),
                          boxShadow: searchMatches.some(m => m.id === msg.id)
                            ? (searchMatches[activeSearchIndex]?.id === msg.id
                                ? '0 0 0 3px #f59e0b, 0 4px 14px rgba(245, 158, 11, 0.4)'
                                : '0 0 0 2px rgba(245, 158, 11, 0.4)')
                            : ((msg.type === 'image' || msg.type === 'sticker' || msg.type === 'file' || ['call', 'task'].includes(msg.type)) && !msg.isRecalled ? 'none' : undefined),
                          padding: (msg.type === 'image' || msg.type === 'sticker' || msg.type === 'file' || ['call', 'task'].includes(msg.type)) && !msg.isRecalled ? '0' : '10px 14px',
                          color: ['call', 'task'].includes(msg.type) ? 'var(--text-primary)' : isMe ? '#ffffff' : 'var(--text-primary)',
                          borderRadius: ['call', 'task'].includes(msg.type) ? '16px' : isMe ? 'var(--radius-md) var(--radius-md) 4px var(--radius-md)' : 'var(--radius-md) var(--radius-md) var(--radius-md) 4px',
                          cursor: !isGroupEnd ? 'pointer' : 'default',
                          opacity: msg.status === 'sending' ? 0.6 : 1,
                          transform: searchMatches[activeSearchIndex]?.id === msg.id ? 'scale(1.03)' : 'none',
                          transition: 'all 0.25s ease'
                        }}
                      >
                        {renderReplyContext(msg)}
                        {renderMessageContent(msg)}
                      </div>

                      {/* Options Trigger Buttons next to bubble (Desktop hover) */}
                      {!msg.isRecalled && msg.status !== 'sending' && (
                        <div 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            background: 'var(--bg-glass-active)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            border: '1px solid var(--border-color)',
                            padding: '2px 4px',
                            borderRadius: '20px',
                            boxShadow: 'var(--shadow-sm)',
                            pointerEvents: 'auto',
                            transition: 'opacity 0.05s linear'
                          }}
                          className="hover-menu-btn-desktop"
                        >
                          {/* 1. Emoji Reaction Button */}
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveReactMsgId(activeReactMsgId === msg.id ? null : msg.id);
                              }}
                              style={styles.inlineActionBtn}
                              className="btn-interactive"
                              title="Thả cảm xúc"
                            >
                              <FiSmile size={14} />
                            </button>
                            {/* Inline emoji picker popup */}
                            {activeReactMsgId === msg.id && (
                              <div 
                                style={{
                                  position: 'absolute',
                                  bottom: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  marginBottom: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  background: 'rgba(17, 21, 32, 0.95)',
                                  backdropFilter: 'blur(16px)',
                                  WebkitBackdropFilter: 'blur(16px)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  padding: '4px 8px',
                                  borderRadius: '20px',
                                  gap: '6px',
                                  zIndex: 1000,
                                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {['👍', '❤️', '😂', '😮', '😭', '😡'].map(emoji => (
                                  <button
                                    key={emoji}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      spawnReactionBurst(emoji, e.clientX, e.clientY);
                                      onToggleReaction(msg.id, emoji);
                                      setActiveReactMsgId(null);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      fontSize: '1.2rem',
                                      cursor: 'pointer',
                                      padding: '2px',
                                      transition: 'transform 0.15s ease'
                                    }}
                                    className="hover-scale btn-interactive"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 2. Copy Text Button (Only for text type) */}
                          {msg.type === 'text' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(msg.content);
                              }}
                              style={styles.inlineActionBtn}
                              className="btn-interactive"
                              title="Sao chép"
                            >
                              <FiCopy size={14} />
                            </button>
                          )}

                          {/* 3. Reply Button */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplyingTo(msg);
                            }}
                            style={styles.inlineActionBtn}
                            className="btn-interactive"
                            title="Trả lời"
                          >
                            <FiCornerUpLeft size={14} />
                          </button>

                          {/* 4. Forward Button */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setForwardingMsg(msg);
                              setShowForwardModal(true);
                            }}
                            style={styles.inlineActionBtn}
                            className="btn-interactive"
                            title="Chuyển tiếp"
                          >
                            <FiShare2 size={14} />
                          </button>

                          {/* 5. Pin Button */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePinClick(msg.id);
                            }}
                            style={styles.inlineActionBtn}
                            className="btn-interactive"
                            title={msg.isPinned ? "Bỏ ghim" : "Ghim"}
                          >
                            <BsPinAngle size={14} style={{ transform: msg.isPinned ? 'rotate(45deg)' : 'none' }} />
                          </button>

                          {/* 6. Edit Button (Only for own text messages) */}
                          {isMe && msg.type === 'text' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMsg(msg);
                              }}
                              style={styles.inlineActionBtn}
                              className="btn-interactive"
                              title="Sửa tin nhắn"
                            >
                              <FiEdit3 size={14} />
                            </button>
                          )}

                          {/* 7. Recall Button (Only for own messages) */}
                          {isMe && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Bạn có chắc muốn thu hồi tin nhắn này đối với mọi người?')) {
                                  onRecallMessage(msg.id);
                                }
                              }}
                              style={{
                                ...styles.inlineActionBtn,
                                color: 'var(--danger)'
                              }}
                              className="btn-interactive"
                              title="Gỡ tin nhắn"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Popover Action Menu */}
                      {activePopoverMsgId === msg.id && (
                        <div 
                          style={{
                            ...styles.actionPopover,
                            ...popoverStyle
                          }}
                          className={`action-popover-box ${isMe ? 'is-me-popover' : 'is-other-popover'} dir-${popoverDirection}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Emojis selection row */}
                          <div style={styles.popoverEmojisRow}>
                            {['👍', '❤️', '😂', '😮', '😭', '😡'].map(emoji => {
                              const hasReacted = msg.reactions?.some(r => r.userId === user.id && r.type === emoji);
                              return (
                                <button 
                                  key={emoji} 
                                  onClick={(e) => {
                                    spawnReactionBurst(emoji, e.clientX, e.clientY);
                                    onToggleReaction(msg.id, emoji);
                                    setActivePopoverMsgId(null);
                                  }}
                                  style={{
                                    ...styles.popoverEmojiBtn,
                                    background: hasReacted ? 'rgba(255,255,255,0.15)' : 'none'
                                  }}
                                  className="btn-interactive"
                                >
                                  {emoji}
                                </button>
                              );
                            })}
                          </div>

                          {/* Actions list */}
                          <div style={styles.popoverActionsRow}>
                            {msg.type === 'text' && (
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(msg.content);
                                  setActivePopoverMsgId(null);
                                }}
                                style={styles.popoverActionItem}
                                className="btn-interactive"
                              >
                                Sao chép
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                setReplyingTo(msg);
                                setActivePopoverMsgId(null);
                              }}
                              style={styles.popoverActionItem}
                              className="btn-interactive"
                            >
                              Trả lời
                            </button>
                            <button 
                              onClick={() => {
                                handlePinClick(msg.id);
                                setActivePopoverMsgId(null);
                              }}
                              style={styles.popoverActionItem}
                              className="btn-interactive"
                            >
                              {msg.isPinned ? 'Bỏ ghim' : 'Ghim'}
                            </button>
                            <button 
                              onClick={() => {
                                setForwardingMsg(msg);
                                setShowForwardModal(true);
                                setActivePopoverMsgId(null);
                              }}
                              style={styles.popoverActionItem}
                              className="btn-interactive"
                            >
                              Chuyển tiếp
                            </button>
                            {isMe && (
                              <button 
                                onClick={() => {
                                  if (confirm('Bạn có chắc muốn thu hồi tin nhắn này đối với mọi người?')) {
                                    onRecallMessage(msg.id);
                                  }
                                  setActivePopoverMsgId(null);
                                }}
                                style={{...styles.popoverActionItem, color: 'var(--danger)'}}
                                className="btn-interactive"
                              >
                                Gỡ/Thu hồi
                              </button>
                            )}
                            {isMe && !msg.isRecalled && msg.type === 'text' && (
                              <button 
                                onClick={() => {
                                  setEditingMsg(msg);
                                  setActivePopoverMsgId(null);
                                }}
                                style={styles.popoverActionItem}
                                className="btn-interactive"
                              >
                                Sửa tin nhắn
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                  if (confirm('Xóa tin nhắn này phía bạn? Người khác vẫn sẽ nhìn thấy.')) {
                                    onDeleteMessage(msg.id);
                                  }
                                  setActivePopoverMsgId(null);
                              }}
                              style={{...styles.popoverActionItem, color: 'var(--danger)'}}
                              className="btn-interactive"
                            >
                              Xóa phía tôi
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Reaction Badges */}
                    {totalReactions > 0 && (
                      <div style={{
                        ...styles.reactionsWrapper,
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        justifyContent: isMe ? 'flex-end' : 'flex-start'
                      }}>
                        {reactionTypes.map(type => (
                          <div 
                            key={type} 
                            style={styles.reactionBadge} 
                            title={msg.reactions.filter(r => r.type === type).map(r => r.user.displayName).join(', ')}
                          >
                            <span>{type}</span>
                            <span style={styles.reactionCount}>{reactionCounts[type]}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {(isGroupEnd || manuallyShownTimes.has(msg.id) || msg.status === 'sending') && (
                      <span style={{
                        ...styles.messageTime,
                        textAlign: isMe ? 'right' : 'left'
                      }}>
                        {msg.status === 'sending' 
                          ? 'Đang gửi...' 
                          : new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    )}
                  </div>
                </div>
              </React.Fragment>
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
        conversation={conversation}
        onSendMessage={onSendMessage} 
        socket={onSendMessage ? true : false} // Socket signal status
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        editingMsg={editingMsg}
        setEditingMsg={setEditingMsg}
        onEditMessage={onEditMessage}
      />

      {/* Forward Modal */}
      {showForwardModal && forwardingMsg && (
        <div style={styles.modalOverlay} onClick={() => { setShowForwardModal(false); setSelectedForwardConvs([]); }}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()} className="glass-card anim-scale-in">
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Chuyển tiếp tin nhắn</h3>
              <button 
                onClick={() => { setShowForwardModal(false); setSelectedForwardConvs([]); }} 
                style={styles.modalCloseBtn} 
                className="btn-interactive"
              >
                <FiX size={18} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '10px',
                border: '1px dashed var(--border-color)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '8px',
                maxHeight: '60px',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                <strong>Nội dung: </strong>
                {forwardingMsg.type === 'text' ? forwardingMsg.content : `[${forwardingMsg.type.toUpperCase()}]`}
              </div>
              
              <input 
                type="text"
                placeholder="Tìm phòng chat..."
                value={forwardSearchTerm}
                onChange={(e) => setForwardSearchTerm(e.target.value)}
                style={styles.modalInput}
              />
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                maxHeight: '200px',
                overflowY: 'auto',
                marginTop: '8px',
                paddingRight: '4px'
              }} className="scroll-optimized">
                {conversations
                  .filter(conv => {
                    if (conv.isGroup) {
                      return conv.name?.toLowerCase().includes(forwardSearchTerm.toLowerCase());
                    } else {
                      const other = conv.members ? conv.members.find(m => m.user.id !== user.id) : null;
                      const name = other?.nickname || other?.user.displayName || 'Người dùng';
                      return name?.toLowerCase().includes(forwardSearchTerm.toLowerCase());
                    }
                  })
                  .map(conv => {
                    let name = 'Người dùng';
                    if (conv.isGroup) {
                      name = conv.name;
                    } else {
                      const other = conv.members ? conv.members.find(m => m.user.id !== user.id) : null;
                      name = other?.nickname || other?.user.displayName || 'Người dùng';
                    }
                    const isChecked = selectedForwardConvs.includes(conv.id);
                    return (
                      <div 
                        key={conv.id}
                        onClick={() => {
                          setSelectedForwardConvs(prev => 
                            prev.includes(conv.id) 
                              ? prev.filter(id => id !== conv.id) 
                              : [...prev, conv.id]
                          );
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: isChecked ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                          border: isChecked ? '1px solid var(--primary)' : '1px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        className="btn-interactive"
                      >
                        <span style={{ fontSize: '0.85rem', color: isChecked ? 'var(--primary)' : 'var(--text-primary)', fontWeight: isChecked ? '600' : 'normal' }}>
                          {name}
                        </span>
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          style={{ cursor: 'pointer' }}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button 
                onClick={() => { setShowForwardModal(false); setSelectedForwardConvs([]); }} 
                style={styles.btnSecondary}
                className="btn-interactive"
              >
                Hủy
              </button>
              <button 
                onClick={handleSendForward} 
                disabled={selectedForwardConvs.length === 0}
                style={{
                  ...styles.btnPrimary,
                  opacity: selectedForwardConvs.length === 0 ? 0.5 : 1,
                  cursor: selectedForwardConvs.length === 0 ? 'not-allowed' : 'pointer'
                }}
                className="btn-interactive"
              >
                Gửi ({selectedForwardConvs.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    background: 'var(--bg-chat-gradient)',
    overflow: 'hidden'
  },
  emptyContainer: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    padding: '40px'
  },
  emptyImg: {
    width: '120px',
    height: '120px',
    marginBottom: '20px',
    opacity: 0.6
  },
  header: {
    margin: '16px 16px 8px 16px',
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--bg-glass)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    boxShadow: 'var(--shadow-sm)',
    zIndex: 5,
    flexShrink: 0
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '8px',
    padding: '4px'
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-circle)',
    objectFit: 'cover'
  },
  title: {
    fontSize: '0.95rem',
    fontWeight: '600',
    letterSpacing: '-0.01em'
  },
  status: {
    fontSize: '0.72rem',
    color: 'var(--text-secondary)'
  },
  headerActions: {
    display: 'flex',
    gap: '8px'
  },
  headerBtn: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    width: '38px',
    height: '38px',
    borderRadius: 'var(--radius-circle)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.25s var(--transition-spring)'
  },
  pinBanner: {
    background: 'rgba(0, 122, 255, 0.08)',
    borderBottom: '1px solid var(--border-color)',
    padding: '8px 24px',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.8rem',
    color: 'var(--text-primary)'
  },
  pinText: {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginRight: '12px'
  },
  pinCount: {
    color: 'var(--text-secondary)',
    fontSize: '0.75rem'
  },
  chatFeed: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    WebkitOverflowScrolling: 'touch',
    willChange: 'scroll-position',
    transform: 'translate3d(0, 0, 0)'
  },
  dateSeparator: {
    display: 'flex',
    justifyContent: 'center',
    margin: '12px 0 6px 0',
    width: '100%'
  },
  dateSeparatorText: {
    background: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    padding: '6px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.75rem',
    fontWeight: '500',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-sm)'
  },
  startChat: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    color: 'var(--text-muted)',
    fontSize: '0.85rem'
  },
  messageRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
    maxWidth: '75%',
    width: 'fit-content',
    contentVisibility: 'auto',
    containIntrinsicSize: '0 80px'
  },
  messageAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-circle)',
    marginBottom: '0px'
  },
  messageContentWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px'
  },
  senderLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginLeft: '4px',
    fontWeight: '500'
  },
  messageBubble: {
    padding: '10px 14px',
    fontSize: '0.9rem',
    lineHeight: '1.4',
    position: 'relative',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-color)',
    groupHover: 'true', // Trạng thái hover để hiện nút ghim
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    userSelect: 'none'
  },
  messageTime: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    marginTop: '2px'
  },
  stickerImg: {
    width: '100px',
    height: '100px',
    objectFit: 'contain'
  },
  imageWrapper: {
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    maxWidth: '320px',
    maxHeight: '380px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  chatImage: {
    maxWidth: '100%',
    maxHeight: '380px',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    borderRadius: 'var(--radius-md)'
  },
  fileBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--bg-surface)',
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    width: '240px'
  },
  fileIcon: {
    fontSize: '1.5rem'
  },
  fileDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0
  },
  fileName: {
    fontSize: '0.8rem',
    fontWeight: '600',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  fileSize: {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)'
  },
  fileDownload: {
    color: 'var(--primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  voiceBox: {
    width: '240px',
    padding: '4px',
    boxSizing: 'border-box'
  },
  voiceAudio: {
    width: '100%',
    height: '32px'
  },
  locationBox: {
    width: '260px'
  },
  locationHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '6px',
    fontSize: '0.85rem'
  },
  reminderBox: {
    width: '240px',
    background: 'var(--bg-surface)',
    borderLeft: '3px solid var(--accent)',
    padding: '8px 12px',
    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
  },
  reminderHeader: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.8rem'
  },
  bubbleWrapper: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    gap: '8px'
  },
  actionPopover: {
    position: 'absolute',
    background: 'rgba(17, 21, 32, 0.85)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    boxShadow: '0 16px 40px -8px rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '240px',
    animation: 'slideUp 0.15s ease'
  },
  popoverEmojisRow: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingBottom: '6px',
    borderBottom: '1px solid rgba(255,255,255,0.08)'
  },
  popoverEmojiBtn: {
    border: 'none',
    fontSize: '1.25rem',
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s var(--transition-spring)'
  },
  popoverActionsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  popoverActionItem: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    textAlign: 'left',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '0.82rem',
    cursor: 'pointer',
    width: '100%',
    transition: 'background 0.2s ease',
    ':hover': {
      background: 'rgba(255,255,255,0.05)'
    }
  },
  replyContext: {
    borderRadius: '8px 8px 4px 4px',
    padding: '6px 10px',
    marginBottom: '6px',
    fontSize: '0.75rem',
    borderLeft: '2px solid var(--primary)',
    maxWidth: '100%',
    overflow: 'hidden'
  },
  replyContextTitle: {
    fontWeight: 'bold',
    marginBottom: '2px',
    color: 'var(--primary)'
  },
  replyContextBody: {
    opacity: 0.8,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap'
  },
  reactionsWrapper: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '2px'
  },
  reactionBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '2px 6px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    transition: 'background 0.15s ease'
  },
  reactionCount: {
    fontWeight: 'bold',
    color: 'var(--text-secondary)',
    fontSize: '0.7rem'
  },
  hoverMenuBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px 8px',
    fontSize: '1.1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-circle)',
    transition: 'all var(--transition-fast)'
  },
  callCardContainer: {
    width: '240px',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box'
  },
  callCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%'
  },
  callCardIconContainer: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  callCardText: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flex: 1
  },
  callCardTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden'
  },
  callCardSubtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden'
  },
  callCardBtn: {
    width: '100%',
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid rgba(99, 102, 241, 0.15)',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    color: 'var(--primary)',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer',
    textAlign: 'center',
    marginTop: '12px',
    transition: 'background-color 0.2s',
    display: 'block',
    boxSizing: 'border-box'
  },
  loadingOlder: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '4px',
    padding: '12px',
    color: 'var(--text-secondary)'
  },
  taskCardContainer: {
    width: '260px',
    padding: '12px 14px 12px 10px',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    gap: '8px'
  },
  taskCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
    width: '100%'
  },
  taskCardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
    minWidth: 0
  },
  taskCardTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  taskCardStatusBadge: {
    fontSize: '0.7rem',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '10px',
    whiteSpace: 'nowrap',
    flexShrink: 0
  },
  taskCardDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: '1.3',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: 'var(--bg-primary)',
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)'
  },
  taskCardMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '6px'
  },
  taskCardMetaItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem'
  },
  taskCardMetaLabel: {
    color: 'var(--text-muted)'
  },
  taskCardMetaVal: {
    color: 'var(--text-secondary)',
    fontWeight: '500'
  },
  taskCardActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '6px'
  },
  taskCardBtnPrimary: {
    flex: 1,
    padding: '6px 8px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    fontWeight: '600',
    fontSize: '0.75rem',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease'
  },
  taskCardBtnSuccess: {
    flex: 1,
    padding: '6px 8px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'var(--secondary)',
    color: '#ffffff',
    fontWeight: '600',
    fontSize: '0.75rem',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease'
  },
  taskCardBtnDanger: {
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--danger-light)',
    color: 'var(--danger)',
    fontWeight: '600',
    fontSize: '0.75rem',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease'
  },
  voicePlayerContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: '220px',
    maxWidth: '280px',
    padding: '6px 8px',
    boxSizing: 'border-box'
  },
  voicePlayBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0
  },
  voiceTimeline: {
    flex: 1,
    height: '24px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer'
  },
  voiceWaveContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    width: '100%',
    height: '100%'
  },
  voiceWaveBar: {
    flex: 1,
    borderRadius: '2px',
    transition: 'all 0.1s ease'
  },
  voiceDuration: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    fontWeight: '500',
    minWidth: '35px',
    textAlign: 'right',
    flexShrink: 0
  },
  searchBarContainer: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    background: 'var(--bg-glass-active)',
    borderBottom: '1px solid var(--border-color)',
    gap: '12px',
    position: 'relative',
    zIndex: 9
  },
  searchBarIcon: {
    color: 'var(--text-secondary)',
    flexShrink: 0
  },
  searchBarInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
    outline: 'none'
  },
  searchBarNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0
  },
  searchBarCount: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    minWidth: '50px',
    textAlign: 'center'
  },
  searchBarNavBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
    opacity: 0.8
  },
  searchBarCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '50%'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modalContent: {
    width: 'calc(100% - 32px)',
    maxWidth: '380px',
    padding: '24px',
    background: 'var(--bg-glass-active)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    boxShadow: 'var(--shadow-lg)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px'
  },
  modalBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  modalInput: {
    padding: '10px 12px',
    borderRadius: '12px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
    outline: 'none',
    transition: 'all 0.2s ease',
    width: '100%',
    boxSizing: 'border-box'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px'
  },
  btnPrimary: {
    padding: '10px 16px',
    borderRadius: '12px',
    background: 'var(--primary-gradient)',
    color: 'white',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.85rem'
  },
  btnSecondary: {
    padding: '10px 16px',
    borderRadius: '12px',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.85rem'
  },
  inlineActionBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '5px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease'
  }
};
