import React from 'react';
import { FiPhone, FiVideo, FiDownload, FiMapPin, FiClock, FiCheckSquare, FiFolder } from 'react-icons/fi';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import { styles } from './chatWindowStyles';
import {
  formatMessageTextHtml,
  getFileIcon,
  getFileUrl,
  getImageDisplaySize,
  parseMessageMetadata,
  rememberImageDims
} from './chatWindowUtils';

// Render reply preview inside the bubble
export function ReplyContext({ replyTo, isMe, senderName }) {
  if (!replyTo) return null;

  return (
    <div style={{
      ...styles.replyContext,
      backgroundColor: isMe ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.06)',
      color: isMe ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)'
    }}>
      <div style={styles.replyContextTitle}>{senderName}</div>
      <div style={styles.replyContextBody}>
        {replyTo.isRecalled ? 'Tin nhắn đã bị thu hồi' : replyTo.type === 'text' ? replyTo.content : `[${replyTo.type.toUpperCase()}]`}
      </div>
    </div>
  );
}

// Render cuộc gọi Zalo-style
function CallCard({ metadata, actions }) {
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
          actions.startCall(isVideo);
        }}
      >
        Gọi lại
      </button>
    </div>
  );
}

// Ảnh trong tin nhắn: giữ chỗ đúng tỉ lệ (nếu đã biết kích thước gốc) để khung chat không bị nhảy khi ảnh tải xong
function ChatImage({ msg, metadata, actions }) {
  const url = getFileUrl(msg.content);
  const displaySize = getImageDisplaySize(metadata, url);

  const imgStyle = displaySize
    ? {
        ...styles.chatImage,
        width: `${displaySize.width}px`,
        height: 'auto',
        aspectRatio: `${displaySize.width} / ${displaySize.height}`
      }
    : styles.chatImage;

  return (
    <div style={styles.imageWrapper}>
      <img 
        src={url} 
        alt="Uploaded" 
        style={imgStyle} 
        width={displaySize ? displaySize.width : undefined}
        height={displaySize ? displaySize.height : undefined}
        onClick={() => actions.imageClick(url)}
        onLoad={(e) => {
          const img = e.currentTarget;
          rememberImageDims(url, img.naturalWidth, img.naturalHeight);
          actions.mediaLoaded();
        }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

// Render nội dung tin nhắn dựa trên type
function MessageContent({ msg, isMe, userId, actions }) {
  if (msg.isRecalled) {
    return <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Tin nhắn đã bị thu hồi</span>;
  }

  const metadata = parseMessageMetadata(msg);

  switch (msg.type) {
    case 'text':
      return <div dangerouslySetInnerHTML={{ __html: formatMessageTextHtml(msg.content) }} />;

    case 'sticker': {
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
    }

    case 'image':
      return <ChatImage msg={msg} metadata={metadata} actions={actions} />;

    case 'file': {
      const cleanFileName = metadata.fileName || msg.content.substring(msg.content.lastIndexOf('/') + 1).replace(/^\d+-(?:[a-z0-9]+-)?/, '');
      const formattedSize = metadata.fileSize 
        ? (metadata.fileSize < 1024 * 1024 
            ? `${(metadata.fileSize / 1024).toFixed(1)} KB` 
            : `${(metadata.fileSize / (1024 * 1024)).toFixed(2)} MB`)
        : '';
      
      return (
        <div style={{
          width: 'min(265px, 72vw)',
          maxWidth: '100%',
          boxSizing: 'border-box',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--bg-glass-active)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-color)'
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
              fontSize: '0.84rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }} title={cleanFileName}>
              {cleanFileName}
            </span>
            <span style={{
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap'
            }}>
              {formattedSize}
            </span>
          </div>
          
          {/* 3. Action Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0
          }}>
            {typeof metadata.webViewLink === 'string' &&
              (metadata.webViewLink.startsWith('https://') || metadata.webViewLink.startsWith('http://')) && (
              <button 
                onClick={() => window.open(metadata.webViewLink, '_blank', 'noopener,noreferrer')}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                className="btn-interactive"
                title="Mở tài liệu"
              >
                <FiFolder size={12} />
              </button>
            )}
            <a 
              href={getFileUrl(msg.content)} 
              download={cleanFileName}
              target="_blank"
              rel="noreferrer"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.03)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              className="btn-interactive"
              title="Tải xuống"
            >
              <FiDownload size={12} />
            </a>
          </div>
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
            <FiMapPin style={{ color: isMe ? '#fecdd3' : 'var(--danger)', marginRight: '6px', flexShrink: 0 }} />
            <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Vị trí đã chia sẻ</strong>
          </div>
          <p style={{
            fontSize: '0.82rem',
            color: isMe ? 'rgba(255, 255, 255, 0.9)' : 'var(--text-secondary)',
            marginBottom: '8px',
            lineHeight: '1.35',
            wordBreak: 'break-word',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {metadata.address || 'Xem vị trí bản đồ'}
          </p>
          <iframe 
            title="Shared Location"
            width="100%" 
            height="145" 
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
            style={{ border: 0, borderRadius: '10px', display: 'block', width: '100%' }}
            src={`https://maps.google.com/maps?q=${Number(metadata.lat) || 0},${Number(metadata.lng) || 0}&z=15&output=embed`}
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

    case 'task': {
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

      const handleUpdateStatus = (newStatus) => actions.updateTaskStatus(taskId, newStatus);

      const isUserAssignee = userId === assigneeId;
      const isUserAssigner = userId === msg.senderId;
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
              {isUserAssigner && (
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
    }

    case 'call':
      return <CallCard metadata={metadata} actions={actions} />;

    default:
      return <div>{msg.content}</div>;
  }
}

export default React.memo(MessageContent);
