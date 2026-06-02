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
  const messagesEndRef = useRef(null);
  const chatFeedRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const BASE_URL = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL;

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
          messages.map(msg => {
            const isMe = msg.senderId === user.id;
            const totalReactions = msg.reactions?.length || 0;
            const reactionCounts = msg.reactions?.reduce((acc, r) => {
              acc[r.type] = (acc[r.type] || 0) + 1;
              return acc;
            }, {}) || {};
            const reactionTypes = Object.keys(reactionCounts).sort((a, b) => reactionCounts[b] - reactionCounts[a]);

            return (
              <div 
                key={msg.id} 
                style={{
                  ...styles.messageRow,
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  justifyContent: isMe ? 'flex-end' : 'flex-start',
                  marginBottom: totalReactions > 0 ? '16px' : '0px'
                }}
              >
                {!isMe && (
                  <img 
                    src={msg.sender?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${msg.sender?.username || msg.sender?.id || 'user'}`} 
                    alt="" 
                    style={styles.messageAvatar} 
                  />
                )}
                <div style={styles.messageContentWrapper}>
                  {!isMe && isGroup && <span style={styles.senderLabel}>{getSenderName(msg)}</span>}
                  
                  <div style={{
                    ...styles.bubbleWrapper,
                    flexDirection: isMe ? 'row-reverse' : 'row'
                  }}>
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!msg.isRecalled) {
                          setActivePopoverMsgId(activePopoverMsgId === msg.id ? null : msg.id);
                        }
                      }}
                      style={{
                        ...styles.messageBubble,
                        background: msg.isRecalled ? 'rgba(255,255,255,0.02)' : isMe ? 'var(--primary-gradient)' : 'var(--bg-glass-active)',
                        color: isMe ? '#ffffff' : 'var(--text-primary)',
                        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        cursor: 'pointer'
                      }}
                    >
                      {renderReplyContext(msg)}
                      {renderMessageContent(msg)}
                      
                      {/* Action buttons (Pin) on Hover */}
                      {!msg.isRecalled && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePinClick(msg.id);
                          }} 
                          style={styles.bubblePinBtn}
                          title={msg.isPinned ? "Bỏ ghim tin" : "Ghim tin"}
                        >
                          <BsPinAngle size={10} style={{transform: msg.isPinned ? 'none' : 'rotate(45deg)', color: msg.isPinned ? 'var(--accent)' : 'inherit'}} />
                        </button>
                      )}
                    </div>

                    {/* Popover Action Menu */}
                    {activePopoverMsgId === msg.id && (
                      <div 
                        style={{
                          ...styles.actionPopover,
                          right: isMe ? '0px' : 'auto',
                          left: !isMe ? '0px' : 'auto',
                          bottom: '100%'
                        }}
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

                  <span style={{
                    ...styles.messageTime,
                    textAlign: isMe ? 'right' : 'left'
                  }}>
                    {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>
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
    background: 'radial-gradient(circle at center, rgba(30, 41, 66, 0.2) 0%, rgba(11, 15, 25, 0.95) 100%)',
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
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
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
  },
  bubblePinBtn: {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    transition: 'all 0.15s ease'
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
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    maxWidth: '280px',
    maxHeight: '200px',
    cursor: 'pointer'
  },
  chatImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  fileBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(255,255,255,0.05)',
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
    background: 'rgba(255, 255, 255, 0.03)',
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
    background: 'rgba(30, 41, 66, 0.95)',
    backdropFilter: 'blur(10px)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '2px 6px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
    ':hover': {
      backgroundColor: 'rgba(255,255,255,0.15)'
    }
  },
  reactionCount: {
    fontWeight: 'bold',
    color: 'var(--text-secondary)',
    fontSize: '0.7rem'
  }
};
