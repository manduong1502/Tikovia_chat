import React from 'react';
import { FiSmile, FiCopy, FiCornerUpLeft, FiShare2, FiEdit3, FiTrash2 } from 'react-icons/fi';
import { BsPinAngle } from 'react-icons/bs';
import Avatar from '../Avatar';
import MessageContent, { ReplyContext } from './MessageContent';
import { styles } from './chatWindowStyles';
import { spawnReactionBurst } from './chatWindowUtils';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😭', '😡'];

/**
 * Một dòng tin nhắn trong khung chat (dải phân cách ngày + bong bóng + menu thao tác + cảm xúc + giờ gửi).
 * Được bọc React.memo: mọi prop là giá trị nguyên thủy, chính đối tượng `msg` (chỉ đổi khi tin nhắn đó đổi)
 * hoặc đối tượng `actions` ổn định → dòng không liên quan sẽ không vẽ lại khi trạng thái của dòng khác thay đổi.
 */
function MessageItem({
  msg,
  isMe,
  userId,
  dateSeparatorText,
  isGroupStart,
  isGroupEnd,
  senderName,
  replySenderName,
  isPopoverOpen,
  popoverDirection,
  popoverStyle,
  isReactPickerOpen,
  isTimeShown,
  isSearchMatch,
  isActiveSearchMatch,
  actions
}) {
  const totalReactions = msg.reactions?.length || 0;
  const reactionCounts = msg.reactions?.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {}) || {};
  const reactionTypes = Object.keys(reactionCounts).sort((a, b) => reactionCounts[b] - reactionCounts[a]);

  const isSingle = isGroupStart && isGroupEnd;

  return (
    <React.Fragment>
      {dateSeparatorText != null && (
        <div style={styles.dateSeparator}>
          <span style={styles.dateSeparatorText}>
            {dateSeparatorText}
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
          {senderName != null && <span style={styles.senderLabel}>{senderName}</span>}
          
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
                if (isPopoverOpen) {
                  actions.closePopover();
                } else {
                  actions.openPopover(e, msg.id, isMe);
                }
              }}
              onTouchStart={(e) => {
                if (msg.status === 'sending' || msg.isRecalled) return;
                actions.startLongPress(e, msg.id, isMe);
              }}
              onTouchEnd={actions.cancelLongPress}
              onTouchMove={actions.cancelLongPress}
              onClick={(e) => {
                e.stopPropagation();
                if (!isGroupEnd) {
                  actions.toggleTime(msg.id);
                }
              }}
              style={{
                ...styles.messageBubble,
                background: msg.isRecalled ? 'rgba(255,255,255,0.02)' : (msg.type === 'image' || msg.type === 'sticker' || msg.type === 'file') ? 'transparent' : ['call', 'task'].includes(msg.type) ? 'var(--bg-glass-active)' : undefined,
                border: isSearchMatch
                  ? '1px solid #f59e0b'
                  : ((msg.type === 'image' || msg.type === 'sticker' || msg.type === 'file') && !msg.isRecalled ? 'none' : ['call', 'task'].includes(msg.type) ? '1px solid var(--border-color)' : undefined),
                boxShadow: isSearchMatch
                  ? (isActiveSearchMatch
                      ? '0 0 0 3px #f59e0b, 0 4px 14px rgba(245, 158, 11, 0.4)'
                      : '0 0 0 2px rgba(245, 158, 11, 0.4)')
                  : ((msg.type === 'image' || msg.type === 'sticker' || msg.type === 'file' || ['call', 'task'].includes(msg.type)) && !msg.isRecalled ? 'none' : undefined),
                padding: (msg.type === 'image' || msg.type === 'sticker' || msg.type === 'file' || ['call', 'task'].includes(msg.type)) && !msg.isRecalled ? '0' : '10px 14px',
                color: ['call', 'task'].includes(msg.type) ? 'var(--text-primary)' : isMe ? '#ffffff' : 'var(--text-primary)',
                borderRadius: ['call', 'task'].includes(msg.type) ? '16px' : !isSingle ? undefined : isMe ? 'var(--radius-md) var(--radius-md) 4px var(--radius-md)' : 'var(--radius-md) var(--radius-md) var(--radius-md) 4px',
                cursor: !isGroupEnd ? 'pointer' : 'default',
                opacity: msg.status === 'sending' ? 0.6 : 1,
                transform: isActiveSearchMatch ? 'scale(1.03)' : 'none',
                transition: 'all 0.25s ease'
              }}
            >
              {msg.replyTo && <ReplyContext replyTo={msg.replyTo} isMe={isMe} senderName={replySenderName} />}
              <MessageContent msg={msg} isMe={isMe} userId={userId} actions={actions} />
            </div>

            {/* Options Trigger Buttons next to bubble (Desktop hover only - zero layout footprint) */}
            {!msg.isRecalled && msg.status !== 'sending' && (
              <div 
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  ...(isMe
                    ? { right: 'calc(100% + 8px)', left: 'auto' }
                    : { left: 'calc(100% + 8px)', right: 'auto' }),
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
                  whiteSpace: 'nowrap',
                  zIndex: 15,
                  transition: 'opacity 0.05s linear'
                }}
                className="hover-menu-btn-desktop"
              >
                {/* 1. Emoji Reaction Button */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.setReactPicker(isReactPickerOpen ? null : msg.id);
                    }}
                    style={styles.inlineActionBtn}
                    className="btn-interactive"
                    title="Thả cảm xúc"
                  >
                    <FiSmile size={14} />
                  </button>
                  {/* Inline emoji picker popup */}
                  {isReactPickerOpen && (
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
                      {REACTION_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={(e) => {
                            e.stopPropagation();
                            spawnReactionBurst(emoji, e.clientX, e.clientY);
                            actions.toggleReaction(msg.id, emoji);
                            actions.setReactPicker(null);
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
                    actions.reply(msg);
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
                    actions.forward(msg);
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
                    actions.pin(msg.id);
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
                      actions.edit(msg);
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
                        actions.recall(msg.id);
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
            {isPopoverOpen && (
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
                  {REACTION_EMOJIS.map(emoji => {
                    const hasReacted = msg.reactions?.some(r => r.userId === userId && r.type === emoji);
                    return (
                      <button 
                        key={emoji} 
                        onClick={(e) => {
                          spawnReactionBurst(emoji, e.clientX, e.clientY);
                          actions.toggleReaction(msg.id, emoji);
                          actions.closePopover();
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
                        actions.closePopover();
                      }}
                      style={styles.popoverActionItem}
                      className="btn-interactive"
                    >
                      Sao chép
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      actions.reply(msg);
                      actions.closePopover();
                    }}
                    style={styles.popoverActionItem}
                    className="btn-interactive"
                  >
                    Trả lời
                  </button>
                  <button 
                    onClick={() => {
                      actions.pin(msg.id);
                      actions.closePopover();
                    }}
                    style={styles.popoverActionItem}
                    className="btn-interactive"
                  >
                    {msg.isPinned ? 'Bỏ ghim' : 'Ghim'}
                  </button>
                  <button 
                    onClick={() => {
                      actions.forward(msg);
                      actions.closePopover();
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
                          actions.recall(msg.id);
                        }
                        actions.closePopover();
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
                        actions.edit(msg);
                        actions.closePopover();
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
                          actions.deleteForMe(msg.id);
                        }
                        actions.closePopover();
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

          {(isGroupEnd || isTimeShown || msg.status === 'sending') && (
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
}

export default React.memo(MessageItem);
