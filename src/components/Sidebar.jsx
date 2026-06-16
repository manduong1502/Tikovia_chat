import React, { useState, useEffect } from 'react';
import { FiLogOut, FiUsers, FiSearch, FiX, FiPlus, FiMessageSquare, FiCompass, FiBookOpen, FiUser, FiMaximize, FiSun, FiMoon } from 'react-icons/fi';

export default function Sidebar({
  user,
  token,
  conversations,
  activeConversation,
  setActiveConversation,
  onlineUsers,
  onLogout,
  onRefreshConversations,
  onShowProfile,
  mobileActiveView,
  setMobileActiveView,
  className,
  theme,
  toggleTheme,
  pushStatus,
  onEnablePush,
  dismissedPushBanner,
  onDismissPushBanner
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'direct', 'group'
  const [uncontactedUsers, setUncontactedUsers] = useState([]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Tìm kiếm người dùng mới từ ô tìm kiếm chính
  useEffect(() => {
    if (!searchTerm) {
      setUncontactedUsers([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetch(`${API_URL}/auth/search?query=${encodeURIComponent(searchTerm)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const existingChatUserIds = conversations
              .filter(c => !c.isGroup)
              .map(c => c.members.find(m => m.user.id !== user.id)?.user.id);
            
            const filtered = data.filter(u => !existingChatUserIds.includes(u.id));
            setUncontactedUsers(filtered);
          }
        })
        .catch(err => console.error('Lỗi tìm kiếm người dùng mới:', err));
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, conversations, token, user.id]);

  const handleStartDirectChat = async (targetUser) => {
    try {
      const payload = {
        isGroup: false,
        memberIds: [targetUser.id]
      };

      const res = await fetch(`${API_URL}/chat/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Không thể bắt đầu chat');

      const newConversation = await res.json();
      setActiveConversation(newConversation);
      onRefreshConversations();
      setSearchTerm('');
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  // Tìm kiếm người dùng để tạo nhóm/chat
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetch(`${API_URL}/auth/search?query=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setSearchResults(data))
        .catch(err => console.error('Lỗi tìm kiếm:', err));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, token]);

  const handleUserSelect = (targetUser) => {
    if (selectedUsers.some(u => u.id === targetUser.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== targetUser.id));
    } else {
      setSelectedUsers([...selectedUsers, targetUser]);
    }
  };

  const handleCreateChat = async (isGroupChat = false) => {
    if (isGroupChat && !groupName) {
      alert('Vui lòng nhập tên nhóm');
      return;
    }
    if (selectedUsers.length === 0) {
      alert('Vui lòng chọn ít nhất một người');
      return;
    }

    try {
      const payload = {
        name: isGroupChat ? groupName : null,
        isGroup: isGroupChat,
        memberIds: selectedUsers.map(u => u.id)
      };

      const res = await fetch(`${API_URL}/chat/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Không thể tạo cuộc trò chuyện');

      const newConversation = await res.json();
      setActiveConversation(newConversation);
      onRefreshConversations();

      // Reset
      setShowCreateGroup(false);
      setGroupName('');
      setSearchQuery('');
      setSelectedUsers([]);
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  // Lọc cuộc hội thoại
  const filteredConversations = conversations.filter(conv => {
    // Lọc theo từ khóa
    const nameToSearch = conv.isGroup 
      ? conv.name 
      : conv.members.find(m => m.user.id !== user.id)?.nickname || conv.members.find(m => m.user.id !== user.id)?.user.displayName;
    
    const matchesSearch = nameToSearch?.toLowerCase().includes(searchTerm.toLowerCase());

    // Lọc theo Tab
    if (!matchesSearch) return false;
    if (activeTab === 'direct') return !conv.isGroup;
    if (activeTab === 'group') return conv.isGroup;
    return true;
  });

  // Helper lấy tên hiển thị cuộc hội thoại
  const getConversationDetails = (conv) => {
    if (conv.isGroup) {
      return {
        name: conv.name,
        avatar: conv.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(conv.name)}`,
        isOnline: false
      };
    } else {
      const otherMember = conv.members.find(m => m.user.id !== user.id);
      const isOnline = onlineUsers.includes(otherMember?.user.id);
      return {
        name: otherMember?.nickname || otherMember?.user.displayName || 'Người dùng Zalo',
        avatar: otherMember?.user.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${otherMember?.user.username || otherMember?.user.id || 'user'}`,
        isOnline
      };
    }
  };

  return (
    <div style={styles.sidebar} className={`glass ${className || ''}`}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{...styles.userInfo, cursor: 'pointer'}} onClick={onShowProfile} title="Xem trang cá nhân">
          <img src={user.avatarUrl} alt="Avatar" style={styles.avatar} />
          <div>
            <h4 style={styles.userName}>{user.displayName}</h4>
            <span style={styles.userStatus}><span className="badge-status status-online" style={{display: 'inline-block', marginRight: '5px'}}></span>Trực tuyến</span>
          </div>
        </div>
        <div style={styles.headerActions}>
          <button 
            title="Tạo nhóm chat" 
            onClick={() => setShowCreateGroup(true)} 
            style={styles.actionBtn} 
            className="btn-interactive"
          >
            <FiPlus size={20} />
          </button>
          <button 
            title={theme === 'light' ? 'Chuyển sang Chế độ tối' : 'Chuyển sang Chế độ sáng'} 
            onClick={toggleTheme} 
            style={styles.actionBtn} 
            className="btn-interactive"
          >
            {theme === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />}
          </button>
          <button 
            title="Đăng xuất" 
            onClick={onLogout} 
            style={styles.actionBtn} 
            className="btn-interactive"
          >
            <FiLogOut size={18} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={styles.searchContainer}>
        <div style={styles.searchWrapper}>
          <FiSearch style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Tìm kiếm cuộc trò chuyện..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-premium"
            style={styles.searchInput}
          />
          <FiMaximize style={{position: 'absolute', right: '12px', color: 'var(--text-secondary)', cursor: 'pointer'}} title="Quét mã QR" />
        </div>
      </div>

      {/* Banner Đăng ký thông báo đẩy */}
      {pushStatus === 'prompt' && !dismissedPushBanner && (
        <div style={styles.pushBanner}>
          <div style={styles.pushBannerContent}>
            <span style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center' }}>🔔</span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Thông báo trên điện thoại</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: '0.9rem' }}>Nhận cuộc gọi & tin nhắn mới cả khi tắt app</div>
            </div>
            <button 
              onClick={onEnablePush} 
              style={styles.pushBannerBtn}
              className="btn-interactive"
            >
              Bật ngay
            </button>
            <button 
              onClick={onDismissPushBanner} 
              style={styles.pushBannerCloseBtn}
              title="Đóng thông báo"
            >
              <FiX size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabsContainer}>
        <button 
          onClick={() => setActiveTab('all')} 
          style={{...styles.tab, ...(activeTab === 'all' ? styles.activeTab : {})}}
        >
          Ưu tiên
        </button>
        <button 
          onClick={() => setActiveTab('direct')} 
          style={{...styles.tab, ...(activeTab === 'direct' ? styles.activeTab : {})}}
        >
          Cá nhân
        </button>
        <button 
          onClick={() => setActiveTab('group')} 
          style={{...styles.tab, ...(activeTab === 'group' ? styles.activeTab : {})}}
        >
          Nhóm
        </button>
      </div>

      {/* Conversation List */}
      <div style={styles.listContainer} className="mobile-list-padding">
        {filteredConversations.length === 0 && uncontactedUsers.length === 0 ? (
          <div style={styles.emptyState}>Không tìm thấy cuộc hội thoại nào</div>
        ) : (
          <>
            {/* 1. Hiện cuộc hội thoại đang có */}
            {filteredConversations.map(conv => {
              const { name, avatar, isOnline } = getConversationDetails(conv);
              const lastMsg = conv.messages[0];
              const isSelected = activeConversation?.id === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConversation(conv);
                    setMobileActiveView('chat');
                  }}
                  className={`sidebar-item-premium ${isSelected ? 'active' : ''}`}
                >
                  <div style={styles.avatarWrapper}>
                    <img src={avatar} alt="" style={styles.listAvatar} />
                    {isOnline && <span className="badge-status status-online" style={styles.onlineBadge}></span>}
                  </div>
                  <div style={styles.itemContent}>
                    <div style={styles.itemHeader}>
                      <span style={styles.itemTitle}>{name}</span>
                      <span style={styles.itemTime}>
                        {lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                      </span>
                    </div>
                    <div style={styles.itemMessage}>
                      {lastMsg ? (
                        <>
                          {lastMsg.sender?.id === user.id ? 'Bạn: ' : `${lastMsg.sender?.displayName}: `}
                          {lastMsg.type === 'text' && lastMsg.content}
                          {lastMsg.type === 'image' && '📷 [Hình ảnh]'}
                          {lastMsg.type === 'file' && '📁 [Tài liệu]'}
                          {lastMsg.type === 'voice' && '🎙️ [Tin nhắn thoại]'}
                          {lastMsg.type === 'location' && '📍 [Vị trí]'}
                          {lastMsg.type === 'sticker' && '✨ [Sticker]'}
                          {lastMsg.type === 'reminder' && '⏰ [Nhắc hẹn]'}
                        </>
                      ) : (
                        <span style={{fontStyle: 'italic', color: 'var(--text-muted)'}}>Bắt đầu cuộc trò chuyện</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 2. Hiện người dùng mới tìm thấy từ thanh tìm kiếm chính */}
            {uncontactedUsers.length > 0 && (
              <div style={{marginTop: '15px'}}>
                <div style={{fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', padding: '0 12px 8px 12px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px'}}>
                  NGƯỜI DÙNG MỚI (TÌM THẤY {uncontactedUsers.length})
                </div>
                {uncontactedUsers.map(u => (
                  <div
                    key={u.id}
                    onClick={() => handleStartDirectChat(u)}
                    className="sidebar-item-premium"
                  >
                    <div style={styles.avatarWrapper}>
                      <img src={u.avatarUrl} alt="" style={styles.listAvatar} />
                      {u.status === 'online' && <span className="badge-status status-online" style={styles.onlineBadge}></span>}
                    </div>
                    <div style={styles.itemContent}>
                      <div style={styles.itemHeader}>
                        <span style={styles.itemTitle}>{u.displayName}</span>
                      </div>
                      <div style={styles.itemMessage}>
                        @{u.username} • Nhấp để bắt đầu trò chuyện
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Nav Bar cho Mobile */}
      <div className="bottom-nav">
        <button className="bottom-nav-item active">
          <FiMessageSquare size={20} />
          <span>Tin nhắn</span>
        </button>
        <button className="bottom-nav-item">
          <FiUsers size={20} />
          <span>Danh bạ</span>
        </button>
        <button className="bottom-nav-item">
          <FiCompass size={20} />
          <span>Khám phá</span>
        </button>
        <button className="bottom-nav-item">
          <FiBookOpen size={20} />
          <span>Nhật ký</span>
        </button>
        <button className="bottom-nav-item" onClick={onShowProfile}>
          <FiUser size={20} />
          <span>Cá nhân</span>
        </button>
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} className="glass-card anim-scale-in create-group-modal">
            <div style={styles.modalHeader}>
              <h3>Tạo cuộc hội thoại mới</h3>
              <button onClick={() => setShowCreateGroup(false)} style={styles.closeBtn}><FiX size={20} /></button>
            </div>
            
            <div style={styles.modalBody}>
              <div style={styles.inputGroup}>
                <label style={styles.modalLabel}>Tên nhóm (chỉ dành cho chat nhóm)</label>
                <input
                  type="text"
                  placeholder="Nhập tên nhóm..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  style={styles.modalInput}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.modalLabel}>Tìm thành viên</label>
                <div style={styles.modalSearchWrapper}>
                  <FiSearch style={styles.modalSearchIcon} />
                  <input
                    type="text"
                    placeholder="Nhập tên, username hoặc số điện thoại..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={styles.modalSearchInput}
                  />
                </div>
              </div>

              {/* Selected Users Pill list */}
              {selectedUsers.length > 0 && (
                <div style={styles.pillContainer}>
                  {selectedUsers.map(u => (
                    <span key={u.id} style={styles.userPill}>
                      {u.displayName}
                      <FiX style={styles.pillRemove} onClick={() => handleUserSelect(u)} />
                    </span>
                  ))}
                </div>
              )}

              {/* Search Results */}
              <div style={styles.resultsList}>
                {searchResults.map(u => {
                  const isChecked = selectedUsers.some(su => su.id === u.id);
                  return (
                    <div key={u.id} style={styles.resultItem} onClick={() => handleUserSelect(u)}>
                      <img src={u.avatarUrl} alt="" style={styles.resultAvatar} />
                      <div style={styles.resultInfo}>
                        <span style={styles.resultName}>{u.displayName}</span>
                        <span style={styles.resultSub}>{u.username}</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={() => {}} // Handle on click div
                        style={styles.checkbox}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button 
                disabled={selectedUsers.length === 0}
                onClick={() => handleCreateChat(false)}
                style={{...styles.btnSecondary, opacity: selectedUsers.length === 1 ? 1 : 0.5}}
              >
                Chat 1v1
              </button>
              <button 
                disabled={selectedUsers.length === 0 || !groupName}
                onClick={() => handleCreateChat(true)}
                style={{...styles.btnPrimary, opacity: (selectedUsers.length > 0 && groupName) ? 1 : 0.5}}
              >
                Tạo Nhóm Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  sidebar: {
    width: '340px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid var(--border-color)',
    zIndex: 10
  },
  header: {
    padding: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-color)'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-circle)',
    objectFit: 'cover',
    border: '1.5px solid rgba(255,255,255,0.2)'
  },
  userName: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  userStatus: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center'
  },
  headerActions: {
    display: 'flex',
    gap: '8px'
  },
  actionBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: 'none',
    color: 'var(--text-primary)',
    width: '34px',
    height: '34px',
    borderRadius: 'var(--radius-circle)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all var(--transition-fast)',
    ':hover': {
      background: 'rgba(255, 255, 255, 0.1)'
    }
  },
  searchContainer: {
    padding: '12px 20px 8px 20px'
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)'
  },
  searchInput: {
    width: '100%',
    padding: '10px 12px 10px 36px',
    fontSize: '0.85rem'
  },
  tabsContainer: {
    display: 'flex',
    padding: '4px',
    margin: '8px 20px',
    gap: '4px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '24px',
    border: '1px solid var(--border-color)'
  },
  tab: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: '600',
    padding: '7px 12px',
    borderRadius: '20px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all var(--transition-spring)'
  },
  activeTab: {
    background: 'var(--primary-gradient)',
    color: '#ffffff',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
  },
  listContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 12px',
    WebkitOverflowScrolling: 'touch',
    willChange: 'scroll-position',
    transform: 'translate3d(0, 0, 0)'
  },
  emptyState: {
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    textAlign: 'center',
    padding: '40px 20px'
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    marginBottom: '4px',
    ':hover': {
      background: 'rgba(255, 255, 255, 0.03)'
    }
  },
  listActiveItem: {
    background: 'rgba(255, 255, 255, 0.06)',
    borderLeft: '3px solid var(--primary)',
    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
  },
  avatarWrapper: {
    position: 'relative'
  },
  listAvatar: {
    width: '46px',
    height: '46px',
    borderRadius: 'var(--radius-circle)',
    objectFit: 'cover'
  },
  onlineBadge: {
    position: 'absolute',
    bottom: '2px',
    right: '2px',
    border: '2px solid var(--bg-secondary)'
  },
  itemContent: {
    flex: 1,
    minWidth: 0 // Ngăn flex item tràn text
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px'
  },
  itemTitle: {
    fontWeight: '600',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  itemTime: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  itemMessage: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  // Modal Styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100
  },
  modalContent: {
    width: '450px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '80vh'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  modalBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
    flex: 1
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  modalLabel: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-secondary)'
  },
  modalInput: {
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none'
  },
  modalSearchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  modalSearchIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)'
  },
  modalSearchInput: {
    width: '100%',
    padding: '10px 12px 10px 36px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none'
  },
  pillContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '8px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 'var(--radius-sm)'
  },
  userPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(0,122,255,0.15)',
    color: 'var(--primary)',
    fontSize: '0.8rem',
    fontWeight: '600',
    padding: '4px 10px',
    borderRadius: '20px'
  },
  pillRemove: {
    cursor: 'pointer',
    color: 'var(--primary)',
    ':hover': { color: 'white' }
  },
  resultsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '200px',
    overflowY: 'auto'
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.02)',
    transition: 'all var(--transition-fast)',
    ':hover': {
      background: 'rgba(255,255,255,0.05)'
    }
  },
  resultAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-circle)'
  },
  resultInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  resultName: {
    fontSize: '0.85rem',
    fontWeight: '600'
  },
  resultSub: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px'
  },
  btnPrimary: {
    padding: '10px 18px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--primary-gradient)',
    color: 'white',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer'
  },
  btnSecondary: {
    padding: '10px 18px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    fontWeight: '600',
    cursor: 'pointer'
  },
  pushBanner: {
    padding: '4px 20px 12px 20px',
  },
  pushBannerContent: {
    background: 'rgba(7, 102, 255, 0.1)',
    border: '1px solid rgba(7, 102, 255, 0.2)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    position: 'relative'
  },
  pushBannerBtn: {
    background: 'var(--primary-gradient)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    padding: '4px 10px',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  pushBannerCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px',
    transition: 'color var(--transition-fast)'
  }
};
