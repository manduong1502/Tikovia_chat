import React, { useEffect, useRef, useState } from 'react';
import { FiPhone, FiVideo, FiSidebar, FiDownload, FiMapPin, FiClock, FiChevronLeft } from 'react-icons/fi';
import { BsPinAngle } from 'react-icons/bs';
import ChatInput from './ChatInput';

export default function ChatWindow({
  user,
  token,
  conversation,
  messages,
  typingUsers,
  onSendMessage,
  onPinMessage,
  onToggleReaction,
  onRecallMessage,
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
  const [replyingTo, setReplyingTo] = useState(null);
  const [popoverDirection, setPopoverDirection] = useState('up');
  const [manuallyShownTimes, setManuallyShownTimes] = useState(new Set());
  const [popoverStyle, setPopoverStyle] = useState({});
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
          src="https://api.dicebear.com/7.x/shapes/svg?seed=ChatTikovia" 
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
      return conversation.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(conversation.name)}`;
    }
    return otherMember?.user.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${otherMember?.user.username || otherMember?.user.id || 'user'}`;
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
            backgroundColor: isMissed ? 'var(--danger)' : 'rgba(255, 255, 255, 0.15)'
          }}>
            <IconComponent size={18} style={{ color: '#ffffff' }} />
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
        let renderedText = msg.content;
        
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
              if (!isUrl) {
                // Fallback nếu không có tệp sticker trên đĩa, lấy sticker online mẫu
                e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${metadata.stickerId || 'sticker'}`;
              }
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

      case 'file':
        return (
          <div style={styles.fileBox}>
            <div style={styles.fileIcon}>📁</div>
            <div style={styles.fileDetails}>
              <span style={styles.fileName}>{metadata.fileName || msg.content.substring(msg.content.lastIndexOf('/') + 1)}</span>
              <span style={styles.fileSize}>{(metadata.fileSize / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <a href={getFileUrl(msg.content)} download style={styles.fileDownload}>
              <FiDownload size={18} />
            </a>
          </div>
        );

      case 'voice':
        return (
          <div style={styles.voiceBox}>
            <audio src={getFileUrl(msg.content)} controls style={styles.voiceAudio} />
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

      case 'call':
        return renderCallCard(msg, metadata);

      default:
        return <div>{msg.content}</div>;
    }
  };

  return (
    <div style={styles.container} className={`anim-fade ${className || ''}`}>
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
          <img src={getChatAvatar()} alt="" style={styles.avatar} />
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
        onClick={() => setActivePopoverMsgId(null)}
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
                      <img 
                        src={msg.sender?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${msg.sender?.username || msg.sender?.id || 'user'}`} 
                        alt="" 
                        style={styles.messageAvatar} 
                      />
                    )
                  )}
                  <div style={styles.messageContentWrapper}>
                    {!isMe && isGroup && isGroupStart && <span style={styles.senderLabel}>{getSenderName(msg)}</span>}
                    
                    <div style={{
                      ...styles.bubbleWrapper,
                      flexDirection: isMe ? 'row-reverse' : 'row'
                    }}>
                      <div 
                        className={`chat-message-bubble ${
                          msg.isRecalled 
                            ? '' 
                            : (msg.type === 'image' || msg.type === 'sticker') 
                            ? 'bubble-media' 
                            : msg.type === 'call' 
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
                          background: msg.isRecalled ? 'rgba(255,255,255,0.02)' : (msg.type === 'image' || msg.type === 'sticker') ? 'transparent' : msg.type === 'call' ? 'rgba(255, 255, 255, 0.06)' : undefined,
                          border: (msg.type === 'image' || msg.type === 'sticker' || msg.type === 'call') && !msg.isRecalled ? 'none' : undefined,
                          boxShadow: (msg.type === 'image' || msg.type === 'sticker' || msg.type === 'call') && !msg.isRecalled ? 'none' : undefined,
                          padding: (msg.type === 'image' || msg.type === 'sticker' || msg.type === 'call') && !msg.isRecalled ? '0' : '10px 14px',
                          color: msg.type === 'call' ? '#ffffff' : isMe ? '#ffffff' : 'var(--text-primary)',
                          borderRadius: msg.type === 'call' ? '16px' : isMe ? 'var(--radius-md) var(--radius-md) 4px var(--radius-md)' : 'var(--radius-md) var(--radius-md) var(--radius-md) 4px',
                          cursor: !isGroupEnd ? 'pointer' : 'default',
                          opacity: msg.status === 'sending' ? 0.6 : 1,
                          transition: 'all 0.25s ease'
                        }}
                      >
                        {renderReplyContext(msg)}
                        {renderMessageContent(msg)}
                      </div>

                      {/* Options Trigger Button next to bubble */}
                      {!msg.isRecalled && msg.status !== 'sending' && (
                        <button 
                          onClick={(e) => {
                            if (activePopoverMsgId === msg.id) {
                              setActivePopoverMsgId(null);
                            } else {
                              handleOpenPopover(e, msg.id, isMe);
                            }
                          }}
                          style={styles.hoverMenuBtn}
                          className="hover-menu-btn-desktop btn-interactive"
                          title="Tùy chọn tin nhắn"
                        >
                          ⋮
                        </button>
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
                                  onClick={() => {
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
      />
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
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
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
    gap: '6px'
  },
  dateSeparator: {
    display: 'flex',
    justifyContent: 'center',
    margin: '12px 0 6px 0',
    width: '100%'
  },
  dateSeparatorText: {
    background: 'var(--bg-surface)',
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
    width: 'fit-content'
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
    width: '240px'
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
    color: '#ffffff',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden'
  },
  callCardSubtitle: {
    fontSize: '0.75rem',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: '2px',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden'
  },
  callCardBtn: {
    width: '100%',
    padding: '8px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
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
  }
};
