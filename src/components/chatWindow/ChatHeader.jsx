import React from 'react';
import { FiPhone, FiVideo, FiSidebar, FiChevronLeft, FiSearch } from 'react-icons/fi';
import Avatar from '../Avatar';
import { styles } from './chatWindowStyles';

// Thanh tiêu đề phía trên khung chat (nút quay lại mobile, avatar, tên, trạng thái, các nút thao tác)
export default function ChatHeader({
  title,
  avatarUrl,
  isGroup,
  isOnline,
  memberCount,
  showSearch,
  onToggleSearch,
  onStartCall,
  toggleRightSidebar,
  setMobileActiveView
}) {
  return (
    <div style={styles.header} className="glass chat-header-bar">
      <div style={styles.headerInfo} className="chat-header-info">
        {/* Nút quay lại dành cho Mobile */}
        <button 
          onClick={() => setMobileActiveView('list')} 
          className="mobile-back-btn"
          style={styles.backBtn}
        >
          <FiChevronLeft size={22} />
        </button>
        <div style={{ flexShrink: 0, display: 'flex' }}>
          <Avatar url={avatarUrl} name={title} size={38} isOnline={!isGroup && isOnline} />
        </div>
        <div style={styles.headerTextCol}>
          <h3 style={styles.title} title={title}>{title}</h3>
          <span style={styles.status}>
            {isGroup 
              ? `${memberCount} thành viên`
              : (isOnline ? 'Đang hoạt động' : 'Ngoại tuyến')}
          </span>
        </div>
      </div>
      <div style={styles.headerActions} className="chat-header-actions">
        <button 
          title="Tìm kiếm tin nhắn" 
          onClick={onToggleSearch} 
          style={{
            ...styles.headerBtn,
            color: showSearch ? 'var(--primary)' : 'var(--text-primary)'
          }} 
          className="btn-interactive chat-header-btn"
        >
          <FiSearch size={17} />
        </button>
        {!isGroup && (
          <>
            <button title="Gọi thoại" onClick={() => onStartCall(false)} style={styles.headerBtn} className="btn-interactive chat-header-btn">
              <FiPhone size={17} />
            </button>
            <button title="Gọi Video" onClick={() => onStartCall(true)} style={styles.headerBtn} className="btn-interactive chat-header-btn">
              <FiVideo size={17} />
            </button>
          </>
        )}
        <button title="Tùy chọn cuộc trò chuyện" onClick={toggleRightSidebar} style={styles.headerBtn} className="btn-interactive chat-header-btn">
          <FiSidebar size={17} />
        </button>
      </div>
    </div>
  );
}
