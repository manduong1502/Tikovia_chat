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
  className
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
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const BASE_URL = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL;

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

  // Cuộn xuống đáy khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

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
              src={`${BASE_URL}${msg.content}`} 
              alt="Uploaded" 
              style={styles.chatImage} 
              onClick={() => window.open(`${BASE_URL}${msg.content}`, '_blank')}
            />
          </div>
        );

      case 'file':
        return (
          <div style={styles.fileBox}>
            <div style={styles.fileIcon}>📁</div>
            <div style={styles.fileDetails}>
              <span style={styles.fileName}>{msg.content.substring(msg.content.lastIndexOf('/') + 1)}</span>
              <span style={styles.fileSize}>{(metadata.fileSize / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <a href={`${BASE_URL}${msg.content}`} download style={styles.fileDownload}>
              <FiDownload size={18} />
            </a>
          </div>
        );

      case 'voice':
        return (
          <div style={styles.voiceBox}>
            <audio src={`${BASE_URL}${msg.content}`} controls style={styles.voiceAudio} />
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
      <div style={styles.chatFeed} ref={chatFeedRef} onClick={() => setActivePopoverMsgId(null)}>
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

            // Kiểm tra tin nhắn kế tiếp có cùng người gửi và gửi cách nhau dưới 5p không
            const nextMsg = messages[index + 1];
            const isNearNext = nextMsg && 
              nextMsg.senderId === msg.senderId && 
              (new Date(nextMsg.createdAt) - new Date(msg.createdAt)) < 5 * 60 * 1000;

            const prevMsg = messages[index - 1];
            const showDateSeparator = !prevMsg || 
              new Date(prevMsg.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

            const isGroupStart = !prevMsg || 
              prevMsg.senderId !== msg.senderId || 
              (new Date(msg.createdAt) - new Date(prevMsg.createdAt)) >= 5 * 60 * 1000;

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
                    marginBottom: totalReactions > 0 ? '16px' : '0px'
                  }}
                >
                  {!isMe && (
                    isNearNext ? (
                      <div style={{ width: '32px', height: '32px', marginBottom: '16px' }} />
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
                        className="chat-message-bubble"
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
                          if (isNearNext) {
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
                          background: msg.isRecalled ? 'rgba(255,255,255,0.02)' : (msg.type === 'image' || msg.type === 'sticker') ? 'transparent' : isMe ? 'var(--primary-gradient)' : 'var(--bg-glass-active)',
                          border: (msg.type === 'image' || msg.type === 'sticker') && !msg.isRecalled ? 'none' : '1px solid var(--border-color)',
                          boxShadow: (msg.type === 'image' || msg.type === 'sticker') && !msg.isRecalled ? 'none' : 'var(--shadow-sm)',
                          padding: (msg.type === 'image' || msg.type === 'sticker') && !msg.isRecalled ? '0' : '10px 14px',
                          color: isMe ? '#ffffff' : 'var(--text-primary)',
                          borderRadius: isMe ? 'var(--radius-md) var(--radius-md) 4px var(--radius-md)' : 'var(--radius-md) var(--radius-md) var(--radius-md) 4px',
                          cursor: isNearNext ? 'pointer' : 'default',
                          opacity: msg.status === 'sending' ? 0.6 : 1,
                          transition: 'opacity 0.25s ease'
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

                    {(!isNearNext || manuallyShownTimes.has(msg.id) || msg.status === 'sending') && (
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
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-color)',
    zIndex: 5
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
    width: '42px',
    height: '42px',
    borderRadius: 'var(--radius-circle)',
    objectFit: 'cover'
  },
  title: {
    fontSize: '1rem',
    fontWeight: '600'
  },
  status: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)'
  },
  headerActions: {
    display: 'flex',
    gap: '10px'
  },
  headerBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: 'none',
    color: 'var(--text-primary)',
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-circle)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all var(--transition-fast)'
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
    marginBottom: '16px'
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
    background: 'var(--bg-glass-active)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
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
    fontSize: '1.2rem',
    cursor: 'pointer',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.1s ease',
    ':hover': {
      transform: 'scale(1.2)'
    }
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
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    width: '100%',
    transition: 'background 0.15s ease',
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
  }
};
