import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiEdit3, FiSearch, FiImage, FiFileText, FiLink, FiDownload, FiChevronLeft, FiUser, FiBell, FiCheckSquare, FiClock } from 'react-icons/fi';
import Avatar from './Avatar';

// Hàm nhóm công việc theo ngày tạo
const groupTasksByDate = (tasksList) => {
  const groups = {};
  tasksList.forEach(task => {
    const date = new Date(task.createdAt);
    const dateStr = date.toDateString();
    if (!groups[dateStr]) {
      groups[dateStr] = {
        date,
        tasks: []
      };
    }
    groups[dateStr].tasks.push(task);
  });
  return Object.values(groups).sort((a, b) => b.date - a.date);
};

// Hàm chuyển đổi nhãn ngày tiếng Việt
const getDateLabel = (date) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Hôm nay';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Hôm qua';
  } else {
    return date.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
};

// Get stylized file icon for premium layout (like Zalo/Voz)
const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  
  let bg = '#64748b';
  let symbol = '📄';
  let fontSize = '14px';
  
  if (['doc', 'docx'].includes(ext)) {
    bg = '#1a5fbb';
    symbol = 'W';
  } else if (['xls', 'xlsx'].includes(ext)) {
    bg = '#107c41';
    symbol = 'X';
  } else if (ext === 'pdf') {
    bg = '#e01b22';
    symbol = 'PDF';
    fontSize = '9px';
  } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    bg = '#7c3aed';
    return (
      <div style={{
        width: '32px',
        height: '38px',
        borderRadius: '5px',
        background: bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontFamily: 'system-ui',
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
        flexShrink: 0,
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1px',
          width: '5px',
          margin: '2px 0 1px 0'
        }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ width: '5px', height: '1.5px', background: 'rgba(255,255,255,0.4)', borderRadius: '1px' }} />
          ))}
        </div>
        <span style={{ fontSize: '7px', fontWeight: '800', textTransform: 'uppercase' }}>{ext}</span>
      </div>
    );
  } else if (['ppt', 'pptx'].includes(ext)) {
    bg = '#c43e1c';
    symbol = 'P';
  }
  
  return (
    <div style={{
      width: '32px',
      height: '38px',
      borderRadius: '5px',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      fontFamily: 'system-ui',
      boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
      flexShrink: 0
    }}>
      <span style={{ fontSize, fontWeight: '800' }}>{symbol}</span>
    </div>
  );
};

export default function RightSidebar({
  user,
  token,
  conversation,
  socket,
  onClose,
  onUpdateNickname,
  onUpdateWallpaper,
  mobileActiveView,
  setMobileActiveView,
  className,
  onImageClick
}) {
  const [activeTab, setActiveTab] = useState('images'); // 'images', 'files', 'links', 'tasks'
  const [mediaGallery, setMediaGallery] = useState({ images: [], files: [], links: [] });
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  
  // Nickname editing state
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [editingUserId, setEditingUserId] = useState('');
  const [newNickname, setNewNickname] = useState('');

  // Search messages within conversation state
  const [searchMsgQuery, setSearchMsgQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingMsg, setIsSearchingMsg] = useState(false);
  const [showWallpaperSelector, setShowWallpaperSelector] = useState(false);

  // Quản lý Nhóm
  const isGroupCreator = conversation.isGroup && conversation.createdById === user.id;

  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [editingGroupNameVal, setEditingGroupNameVal] = useState('');
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [selectedNewMemberIds, setSelectedNewMemberIds] = useState([]);
  const [isUploadingGroupAvatar, setIsUploadingGroupAvatar] = useState(false);

  const groupAvatarInputRef = useRef(null);

  // Cập nhật tên nhóm
  const handleUpdateGroupName = async () => {
    if (!editingGroupNameVal.trim() || editingGroupNameVal.trim() === conversation.name) {
      setIsEditingGroupName(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/chat/conversations/${conversation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: editingGroupNameVal.trim() })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Cập nhật tên nhóm thất bại');
      }
      setIsEditingGroupName(false);
    } catch (e) {
      alert(e.message);
    }
  };

  // Cập nhật ảnh nhóm
  const handleGroupAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingGroupAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch(`${API_URL}/chat/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (!uploadRes.ok) throw new Error('Không thể tải ảnh đại diện lên');
      const uploadData = await uploadRes.json();
      
      const updateRes = await fetch(`${API_URL}/chat/conversations/${conversation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ avatarUrl: uploadData.url })
      });
      if (!updateRes.ok) throw new Error('Không thể cập nhật ảnh nhóm');
    } catch (e) {
      alert(e.message);
    } finally {
      setIsUploadingGroupAvatar(false);
    }
  };

  // Tìm kiếm người dùng mới để thêm vào nhóm
  const handleSearchNewMembers = async () => {
    if (!memberSearchQuery.trim()) {
      setMemberSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/auth/search?query=${encodeURIComponent(memberSearchQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const users = await res.json();
        // Lọc những người đã là thành viên nhóm
        const currentMemberIds = conversation.members.map(m => m.user.id);
        const filtered = users.filter(u => !currentMemberIds.includes(u.id));
        setMemberSearchResults(filtered);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Xác nhận thêm thành viên
  const handleAddMembersSubmit = async () => {
    if (selectedNewMemberIds.length === 0) return;
    try {
      const res = await fetch(`${API_URL}/chat/conversations/${conversation.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userIds: selectedNewMemberIds })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Thêm thành viên thất bại');
      }
      setShowAddMembersModal(false);
      setMemberSearchQuery('');
      setMemberSearchResults([]);
      setSelectedNewMemberIds([]);
    } catch (e) {
      alert(e.message);
    }
  };

  // Mời thành viên ra khỏi nhóm (Kick)
  const handleKickMember = async (targetUserId, targetDisplayName) => {
    if (!confirm(`Bạn có chắc chắn muốn mời thành viên "${targetDisplayName}" ra khỏi nhóm?`)) return;
    try {
      const res = await fetch(`${API_URL}/chat/conversations/${conversation.id}/members/${targetUserId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Không thể mời thành viên ra khỏi nhóm');
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const BASE_URL = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL;

  // Quyết định URL tệp hiển thị (Cục bộ hay Proxy Google Drive)
  const getFileUrl = (urlPath) => {
    if (!urlPath) return '';
    if (urlPath.includes('drive.google.com')) {
      const match = urlPath.match(/[?&]id=([^&]+)/) || urlPath.match(/\/file\/d\/([^/]+)/);
      if (match && match[1]) {
        return `${API_URL}/chat/drive-file/${match[1]}`;
      }
    }
    if (urlPath.startsWith('http')) {
      return urlPath;
    }
    return `${BASE_URL}${urlPath}`;
  };

  // Load kho lưu trữ media khi mở sidebar hoặc đổi cuộc hội thoại
  useEffect(() => {
    if (!conversation) return;

    fetch(`${API_URL}/chat/conversations/${conversation.id}/media`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setMediaGallery(data))
      .catch(err => console.error('Lỗi load media:', err));
  }, [conversation, token]);

  // Load danh sách công việc của cuộc trò chuyện hiện tại
  useEffect(() => {
    if (!conversation || activeTab !== 'tasks') return;

    setLoadingTasks(true);
    setTasks([]); // Xóa dữ liệu cũ trước khi tải dữ liệu mới để tránh nháy giao diện
    fetch(`${API_URL}/tasks/conversation/${conversation.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setTasks(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error('Lỗi load công việc:', err))
      .finally(() => setLoadingTasks(false));
  }, [conversation, activeTab, token, API_URL]);

  // Lắng nghe cập nhật socket thời gian thực cho các công việc trong phòng chat này
  useEffect(() => {
    if (!socket || !conversation) return;

    const handleTaskStatusUpdated = ({ taskId, status, assigneeId, assigneeName }) => {
      setTasks(prev => prev.map(task => {
        if (task.id === taskId) {
          const updatedTask = { ...task, status };
          if (assigneeId) {
            updatedTask.assigneeId = assigneeId;
            updatedTask.assignee = {
              ...updatedTask.assignee,
              id: assigneeId,
              displayName: assigneeName || 'Thành viên'
            };
          }
          return updatedTask;
        }
        return task;
      }));
    };

    const handleReceiveMessage = (msg) => {
      if (msg.type === 'task' && msg.conversationId === conversation.id) {
        // Tải lại danh sách khi có công việc mới tạo thông qua tin nhắn
        fetch(`${API_URL}/tasks/conversation/${conversation.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            setTasks(Array.isArray(data) ? data : []);
          })
          .catch(err => console.error('Lỗi tải lại công việc qua socket:', err));
      }
    };

    socket.on('task-status-updated', handleTaskStatusUpdated);
    socket.on('receive-message', handleReceiveMessage);

    return () => {
      socket.off('task-status-updated', handleTaskStatusUpdated);
      socket.off('receive-message', handleReceiveMessage);
    };
  }, [socket, conversation, token, API_URL]);

  const handleUpdateSidebarTaskStatus = async (taskId, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      } else {
        const errData = await res.json();
        alert(errData.error || 'Cập nhật trạng thái thất bại');
      }
    } catch (e) {
      alert('Không thể kết nối đến máy chủ');
    }
  };

  // Tìm kiếm tin nhắn
  const handleSearchMessages = async () => {
    if (!searchMsgQuery.trim()) {
      setSearchResults([]);
      setIsSearchingMsg(false);
      return;
    }

    setIsSearchingMsg(true);
    try {
      // Gọi API tìm kiếm phía server (SQLite contains search) để bao quát toàn bộ lịch sử
      const res = await fetch(`${API_URL}/chat/conversations/${conversation.id}/messages?search=${encodeURIComponent(searchMsgQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const messages = await res.json();
        setSearchResults(messages);
      }
    } catch (e) {
      console.error('Lỗi tìm kiếm tin nhắn:', e);
    }
  };

  // Đổi biệt danh
  const handleSaveNickname = async (targetUserId) => {
    try {
      const res = await fetch(`${API_URL}/chat/conversations/${conversation.id}/nickname`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUserId,
          nickname: newNickname
        })
      });

      if (!res.ok) throw new Error('Không thể cập nhật biệt danh');

      const data = await res.json();
      
      onUpdateNickname(targetUserId, newNickname);
      setIsEditingNickname(false);
      setNewNickname('');
    } catch (e) {
      alert(e.message);
    }
  };

  const getChatTitle = () => {
    if (conversation.isGroup) return conversation.name;
    const otherMember = conversation.members.find(m => m.user.id !== user.id);
    return otherMember?.nickname || otherMember?.user.displayName;
  };

  const getChatAvatar = () => {
    if (conversation.isGroup) {
      return conversation.avatarUrl || null;
    }
    const otherMember = conversation.members.find(m => m.user.id !== user.id);
    return otherMember?.user.avatarUrl || null;
  };

  return (
    <div style={styles.sidebar} className={`glass anim-sidebar-enter ${className || ''}`}>
      {/* Header */}
      <div style={styles.header}>
        <button 
          onClick={onClose} 
          className="mobile-back-btn btn-interactive" 
          style={styles.backBtn}
        >
          <FiChevronLeft size={24} />
        </button>
        <span style={styles.headerTitle}>Tùy chọn</span>
        <button onClick={onClose} style={styles.closeBtn} className="btn-interactive sidebar-close-btn">
          <FiX size={18} />
        </button>
      </div>

      <div style={styles.content} className="mobile-list-padding">
        {/* Unified Hero Options Card (Avatar + Metadata + Actions Grid) */}
        <div className="glass-card anim-slide-up" style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', animationDelay: '0.05s', width: '100%' }}>
          <div style={styles.infoCard}>
            {conversation.isGroup && isGroupCreator ? (
              <div 
                style={{ position: 'relative', cursor: isUploadingGroupAvatar ? 'not-allowed' : 'pointer', margin: '0 auto 12px auto', width: '76px', height: '76px' }} 
                onClick={() => !isUploadingGroupAvatar && groupAvatarInputRef.current?.click()}
                title={isUploadingGroupAvatar ? 'Đang tải ảnh...' : 'Đổi ảnh đại diện nhóm'}
                className="btn-interactive avatar-pulsing-glow"
              >
                <Avatar url={getChatAvatar()} name={getChatTitle()} size={70} />
                {isUploadingGroupAvatar ? (
                  <div style={{ ...styles.avatarCameraOverlay, background: 'var(--text-secondary)' }}>
                    <span style={{ fontSize: '0.65rem', color: '#fff', fontWeight: 'bold' }}>...</span>
                  </div>
                ) : (
                  <div style={styles.avatarCameraOverlay}>
                    <FiImage size={14} style={{ color: '#fff' }} />
                  </div>
                )}
                <input 
                  type="file" 
                  ref={groupAvatarInputRef} 
                  onChange={handleGroupAvatarChange} 
                  style={{ display: 'none' }} 
                  accept="image/*"
                  disabled={isUploadingGroupAvatar}
                />
              </div>
            ) : (
              <div className="avatar-pulsing-glow" style={{ width: '76px', height: '76px', margin: '0 auto 12px auto' }}>
                <Avatar url={getChatAvatar()} name={getChatTitle()} size={70} />
              </div>
            )}

            {isEditingGroupName ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                <input
                  type="text"
                  value={editingGroupNameVal}
                  onChange={(e) => setEditingGroupNameVal(e.target.value)}
                  className="input-premium"
                  style={{ padding: '6px 10px', fontSize: '0.85rem', width: '150px' }}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateGroupName()}
                />
                <button 
                  onClick={handleUpdateGroupName} 
                  style={{ ...styles.saveNicknameBtn, padding: '6px 10px' }}
                  className="btn-interactive"
                >
                  Lưu
                </button>
                <button 
                  onClick={() => setIsEditingGroupName(false)} 
                  style={{ ...styles.cancelNicknameBtn, padding: '4px' }}
                  className="btn-interactive"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                <h4 style={styles.titleName}>{getChatTitle()}</h4>
                {conversation.isGroup && isGroupCreator && (
                  <button
                    onClick={() => {
                      setIsEditingGroupName(true);
                      setEditingGroupNameVal(conversation.name || '');
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                    title="Sửa tên nhóm"
                    className="btn-interactive"
                  >
                    <FiEdit3 size={14} />
                  </button>
                )}
              </div>
            )}
            <span style={styles.titleSub}>{conversation.isGroup ? 'Cuộc hội thoại nhóm' : 'Chat cá nhân'}</span>
          </div>

          {/* Horizontal Line separating Info and Actions */}
          <div style={{ width: '100%', height: '1px', background: 'var(--border-color)', opacity: 0.6 }} />

          {/* Action Row Grid */}
          <div style={styles.actionRow}>
            <div style={styles.actionItem} onClick={() => setIsSearchingMsg(true)} className="action-circle-hover">
              <div style={styles.actionCircle} className="action-circle-inner"><FiSearch size={18} /></div>
              <span style={styles.actionLabel}>Tìm tin nhắn</span>
            </div>
            <div style={styles.actionItem} className="action-circle-hover">
              <div style={styles.actionCircle} className="action-circle-inner"><FiUser size={18} /></div>
              <span style={styles.actionLabel}>Trang cá nhân</span>
            </div>
            <div style={styles.actionItem} onClick={() => setShowWallpaperSelector(prev => !prev)} className="action-circle-hover">
              <div style={styles.actionCircle} className="action-circle-inner"><FiImage size={18} /></div>
              <span style={styles.actionLabel}>Đổi hình nền</span>
            </div>
            <div style={styles.actionItem} className="action-circle-hover">
              <div style={styles.actionCircle} className="action-circle-inner"><FiBell size={18} /></div>
              <span style={styles.actionLabel}>Tắt thông báo</span>
            </div>
          </div>
        </div>

        {/* 1.0 Bộ chọn hình nền (Chat Wallpaper) */}
        {showWallpaperSelector && (
          <div style={styles.section} className="glass-card anim-scale-in">
            <div style={{ ...styles.sectionHeader, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiImage size={16} style={{ color: 'var(--primary)' }} />
                <span>Hình nền phòng chat</span>
              </div>
              <button 
                onClick={() => setShowWallpaperSelector(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem' }}
                className="btn-interactive"
              >
                Đóng
              </button>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              marginTop: '6px'
            }}>
              {[
                { name: 'Mặc định', value: '' },
                { name: 'Sunset', value: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)' },
                { name: 'Emerald', value: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)' },
                { name: 'Ocean', value: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)' },
                { name: 'Midnight', value: 'linear-gradient(135deg, #09090b 0%, #450a0a 100%)' },
                { name: 'Aurora', value: 'linear-gradient(135deg, #111827 0%, #1f2937 50%, #111827 100%)' }
              ].map(wp => (
                <div
                  key={wp.name}
                  onClick={() => onUpdateWallpaper && onUpdateWallpaper(wp.value)}
                  style={{
                    height: '50px',
                    borderRadius: '8px',
                    background: wp.value || 'var(--bg-chat-gradient)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: '600',
                    color: '#ffffff',
                    textAlign: 'center',
                    boxShadow: 'var(--shadow-sm)',
                    textShadow: '0 1px 4px rgba(0,0,0,0.6)'
                  }}
                  className="btn-interactive"
                  title={wp.name}
                >
                  {wp.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 1. Tìm kiếm tin nhắn */}
        <div className="glass-card anim-slide-up" style={{ ...styles.section, animationDelay: '0.1s' }}>
          <div style={styles.sectionHeader}>
            <FiSearch size={16} style={{ color: 'var(--primary)' }} />
            <span>Tìm tin nhắn trò chuyện</span>
          </div>
          <div style={styles.searchBox}>
            <input
              type="text"
              placeholder="Nhập nội dung..."
              value={searchMsgQuery}
              onChange={(e) => setSearchMsgQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchMessages()}
              className="input-premium"
              style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem' }}
            />
            <button onClick={handleSearchMessages} style={styles.searchBtn} className="btn-interactive">Tìm</button>
          </div>

          {isSearchingMsg && (
            <div style={styles.searchResultsContainer}>
              <div style={styles.searchResultHeader}>
                Kết quả: {searchResults.length} tin nhắn
                <button onClick={() => { setSearchMsgQuery(''); setSearchResults([]); setIsSearchingMsg(false); }} style={styles.clearSearchBtn} className="btn-interactive">Xóa</button>
              </div>
              <div style={styles.searchResultsList}>
                {searchResults.map(msg => (
                  <div key={msg.id} style={styles.searchResultItem}>
                    <div style={styles.searchResultInfo}>
                      <strong>{msg.sender?.displayName || 'Người dùng'}:</strong>
                      <p>{msg.content}</p>
                    </div>
                    <span style={styles.searchResultTime}>
                      {new Date(msg.createdAt).toLocaleDateString([], {month: 'numeric', day: 'numeric'})}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. Thành viên & Đổi biệt danh */}
        <div className="glass-card anim-slide-up" style={{ ...styles.section, animationDelay: '0.15s' }}>
          <div style={{ ...styles.sectionHeader, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiEdit3 size={16} style={{ color: 'var(--primary)' }} />
              <span>Thành viên ({conversation.members.length})</span>
            </div>
            {conversation.isGroup && (
              <button 
                onClick={() => setShowAddMembersModal(true)} 
                style={styles.addMemberHeaderBtn}
                className="btn-interactive"
              >
                + Thêm
              </button>
            )}
          </div>
          <div style={styles.memberList}>
            {conversation.members.map(member => (
              <div key={member.user.id} className="member-list-item btn-interactive" style={styles.memberItem}>
                <Avatar url={member.user.avatarUrl} name={member.user.displayName} size={36} />
                <div style={styles.memberInfo}>
                  <div style={styles.memberNameWrapper}>
                    <span style={styles.memberName}>{member.user.displayName}</span>
                    {member.nickname && <span style={styles.nicknameTag}>({member.nickname})</span>}
                    {member.user.id === conversation.createdById && (
                      <span style={styles.creatorBadge}>Trưởng nhóm</span>
                    )}
                  </div>
                  {isEditingNickname && editingUserId === member.user.id ? (
                    <div style={styles.editNicknameBox}>
                      <input
                        type="text"
                        placeholder="Đặt biệt danh..."
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                        className="input-premium"
                        style={{ flex: 1, padding: '4px 6px', fontSize: '0.75rem' }}
                      />
                      <button onClick={() => handleSaveNickname(member.user.id)} style={styles.saveNicknameBtn} className="btn-interactive">Lưu</button>
                      <button onClick={() => setIsEditingNickname(false)} style={styles.cancelNicknameBtn} className="btn-interactive">Hủy</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => {
                          setIsEditingNickname(true);
                          setEditingUserId(member.user.id);
                          setNewNickname(member.nickname || '');
                        }}
                        style={styles.editNicknameBtn}
                        className="btn-interactive"
                      >
                        Sửa biệt danh
                      </button>
                      {isGroupCreator && member.user.id !== user.id && (
                        <button
                          onClick={() => handleKickMember(member.user.id, member.user.displayName)}
                          style={{ ...styles.editNicknameBtn, color: 'var(--danger)', textDecoration: 'none' }}
                          className="btn-interactive"
                        >
                          • Mời ra khỏi nhóm
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Kho lưu trữ Media & Công việc (Ảnh, File, Link, Công việc) */}
        <div className="glass-card anim-slide-up" style={{ ...styles.section, flex: 1, display: 'flex', flexDirection: 'column', animationDelay: '0.2s' }}>
          <div style={styles.sectionHeader}>
            <FiImage size={16} style={{ color: 'var(--primary)' }} />
            <span>Kho dữ liệu & Công việc nhóm</span>
          </div>
          
          {/* Tabs */}
          <div style={styles.tabs}>
            <button
              onClick={() => setActiveTab('images')}
              style={{...styles.tabBtn, ...(activeTab === 'images' ? styles.activeTabBtn : {})}}
              className="btn-interactive"
            >
              Ảnh
            </button>
            <button
              onClick={() => setActiveTab('files')}
              style={{...styles.tabBtn, ...(activeTab === 'files' ? styles.activeTabBtn : {})}}
              className="btn-interactive"
            >
              Tài liệu
            </button>
            <button
              onClick={() => setActiveTab('links')}
              style={{...styles.tabBtn, ...(activeTab === 'links' ? styles.activeTabBtn : {})}}
              className="btn-interactive"
            >
              Liên kết
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              style={{...styles.tabBtn, ...(activeTab === 'tasks' ? styles.activeTabBtn : {})}}
              className="btn-interactive"
            >
              Công việc
            </button>
          </div>

          {/* Tab content */}
          <div style={styles.tabContent}>
            {activeTab === 'images' && (
              mediaGallery.images.length === 0 ? (
                <div style={styles.emptyGallery}>Không có hình ảnh nào</div>
              ) : (
                <div style={styles.imageGrid}>
                  {mediaGallery.images.map(img => (
                    <img
                      key={img.id}
                      src={getFileUrl(img.url)}
                      alt=""
                      onClick={() => onImageClick ? onImageClick(getFileUrl(img.url)) : window.open(getFileUrl(img.url), '_blank')}
                      style={styles.galleryImage}
                      className="btn-interactive"
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === 'files' && (
              mediaGallery.files.length === 0 ? (
                <div style={styles.emptyGallery}>Không có tài liệu nào</div>
              ) : (
                <div style={styles.fileList}>
                  {mediaGallery.files.map(file => (
                    <div key={file.id} style={styles.fileItem}>
                      {getFileIcon(file.name)}
                      <div style={styles.fileInfo}>
                        <span style={styles.fileName} title={file.name}>{file.name}</span>
                        <span style={styles.fileSub}>
                          {file.senderName} • {file.size 
                            ? (file.size < 1024 * 1024 
                                ? `${(file.size / 1024).toFixed(1)} KB` 
                                : `${(file.size / (1024 * 1024)).toFixed(2)} MB`)
                            : '0 KB'}
                        </span>
                      </div>
                      <a href={getFileUrl(file.url)} download style={styles.fileDownload} className="btn-interactive">
                        <FiDownload size={16} />
                      </a>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'links' && (
              mediaGallery.links.length === 0 ? (
                <div style={styles.emptyGallery}>Không có liên kết nào</div>
              ) : (
                <div style={styles.linkList}>
                  {mediaGallery.links.map(lnk => (
                    <div key={lnk.id} style={styles.linkItem}>
                      <FiLink size={16} style={{color: 'var(--accent)', flexShrink: 0}} />
                      <div style={styles.linkInfo}>
                        <a href={lnk.url} target="_blank" rel="noreferrer" style={styles.linkUrl}>{lnk.url}</a>
                        <span style={styles.linkSender}>{lnk.senderName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'tasks' && (
              loadingTasks ? (
                <div style={styles.emptyGallery}>Đang tải công việc...</div>
              ) : tasks.length === 0 ? (
                <div style={styles.emptyGallery}>Không có công việc nào</div>
              ) : (
                <div style={styles.taskList}>
                  {groupTasksByDate(tasks).map(group => (
                    <div key={group.date.toDateString()} style={styles.sidebarTaskGroup}>
                      <div style={styles.sidebarTaskGroupHeader}>
                        {getDateLabel(group.date)}
                      </div>
                      {group.tasks.map(task => {
                        let statusLabel = 'Chờ làm';
                        let statusColor = 'var(--accent)';
                        let statusBg = 'var(--accent-light)';
                        if (task.status === 'in_progress') {
                          statusLabel = 'Đang làm';
                          statusColor = 'var(--primary)';
                          statusBg = 'var(--primary-light)';
                        } else if (task.status === 'done') {
                          statusLabel = 'Hoàn thành';
                          statusColor = 'var(--secondary)';
                          statusBg = 'var(--secondary-light)';
                        } else if (task.status === 'cancelled') {
                          statusLabel = 'Đã hủy';
                          statusColor = 'var(--danger)';
                          statusBg = 'var(--danger-light)';
                        }

                        const isAssignee = task.assigneeId === user.id;
                        const isAssigner = task.assignerId === user.id;

                        return (
                          <div key={task.id} style={{ ...styles.sidebarTaskItem, borderLeft: `3px solid ${statusColor}` }}>
                            <div style={styles.sidebarTaskItemHeader}>
                              <span style={styles.sidebarTaskTitle}>{task.title}</span>
                              <span style={{ ...styles.sidebarTaskStatus, color: statusColor, backgroundColor: statusBg }}>
                                {statusLabel}
                              </span>
                            </div>
                            {task.description && (
                              <p style={styles.sidebarTaskDesc}>{task.description}</p>
                            )}
                            <div style={styles.sidebarTaskMeta}>
                              <div style={styles.sidebarTaskPeople}>
                                <span>Giao: {task.assigner?.displayName || 'Thành viên'}</span>
                                <span style={{ margin: '0 4px' }}>•</span>
                                <span>Nhận: {task.assignee?.displayName || 'Thành viên'}</span>
                              </div>
                              {task.dueDate && (
                                <div style={styles.sidebarTaskDueDate}>
                                  <FiClock size={10} />
                                  <span>{new Date(task.dueDate).toLocaleDateString('vi-VN')}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Nút hành động trực quan tại sidebar */}
                            {((isAssignee && (task.status === 'pending' || task.status === 'in_progress')) || 
                              ((task.status !== 'done' && task.status !== 'cancelled') && (isAssignee || isAssigner))) && (
                              <div style={styles.sidebarTaskActions}>
                                {isAssignee && task.status === 'pending' && (
                                  <button 
                                    onClick={() => handleUpdateSidebarTaskStatus(task.id, 'in_progress')}
                                    style={styles.sidebarBtnStart}
                                    className="btn-interactive"
                                  >
                                    Bắt đầu
                                  </button>
                                )}
                                {isAssignee && task.status === 'in_progress' && (
                                  <button 
                                    onClick={() => handleUpdateSidebarTaskStatus(task.id, 'done')}
                                    style={styles.sidebarBtnDone}
                                    className="btn-interactive"
                                  >
                                    Hoàn thành
                                  </button>
                                )}
                                {task.status !== 'done' && task.status !== 'cancelled' && (isAssignee || isAssigner) && (
                                  <button 
                                    onClick={() => handleUpdateSidebarTaskStatus(task.id, 'cancelled')}
                                    style={styles.sidebarBtnCancel}
                                    className="btn-interactive"
                                  >
                                    Hủy
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      {/* Modal Thêm thành viên */}
      {showAddMembersModal && (
        <div style={styles.modalOverlay} onClick={() => { setShowAddMembersModal(false); setMemberSearchResults([]); setSelectedNewMemberIds([]); }}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()} className="glass-card anim-scale-in">
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Thêm thành viên</h3>
              <button 
                onClick={() => { setShowAddMembersModal(false); setMemberSearchResults([]); setSelectedNewMemberIds([]); }} 
                style={styles.modalCloseBtn}
                className="btn-interactive"
              >
                <FiX size={18} />
              </button>
            </div>
            
            <div style={styles.modalBody}>
              <div style={styles.searchBox}>
                <input 
                  type="text"
                  placeholder="Tìm theo tên, tài khoản hoặc SĐT..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="input-premium"
                  style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchNewMembers()}
                />
                <button onClick={handleSearchNewMembers} style={styles.searchBtn} className="btn-interactive">Tìm</button>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '220px',
                overflowY: 'auto',
                marginTop: '10px',
                paddingRight: '4px'
              }} className="scroll-optimized">
                {memberSearchResults.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', padding: '12px 0' }}>
                    {memberSearchQuery ? 'Không tìm thấy kết quả phù hợp' : 'Hãy nhập từ khóa để tìm kiếm'}
                  </div>
                ) : (
                  memberSearchResults.map(u => {
                    const isChecked = selectedNewMemberIds.includes(u.id);
                    return (
                      <div 
                        key={u.id}
                        onClick={() => {
                          setSelectedNewMemberIds(prev => 
                            prev.includes(u.id) 
                              ? prev.filter(id => id !== u.id) 
                              : [...prev, u.id]
                          );
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: isChecked ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                          border: isChecked ? '1px solid var(--primary)' : '1px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        className="btn-interactive"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar url={u.avatarUrl} name={u.displayName} size={30} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                              {u.displayName}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                              @{u.username}
                            </span>
                          </div>
                        </div>
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          style={{ cursor: 'pointer' }}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button 
                onClick={() => { setShowAddMembersModal(false); setMemberSearchResults([]); setSelectedNewMemberIds([]); }} 
                style={styles.btnSecondary}
                className="btn-interactive"
              >
                Hủy
              </button>
              <button 
                onClick={handleAddMembersSubmit} 
                disabled={selectedNewMemberIds.length === 0}
                style={{
                  ...styles.btnPrimary,
                  opacity: selectedNewMemberIds.length === 0 ? 0.5 : 1,
                  cursor: selectedNewMemberIds.length === 0 ? 'not-allowed' : 'pointer'
                }}
                className="btn-interactive"
              >
                Xác nhận ({selectedNewMemberIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    width: '320px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '1px solid var(--border-color)',
    background: 'var(--bg-glass)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    zIndex: 10
  },
  header: {
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-color)'
  },
  headerTitle: {
    fontWeight: '600',
    fontSize: '0.95rem'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
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
  content: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
    flex: 1
  },
  infoCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '10px 0'
  },
  avatarWrapper: {
    position: 'relative',
    borderRadius: '50%',
    padding: '2px',
    background: 'var(--primary-gradient)',
    boxShadow: '0 0 12px var(--border-glow)',
    marginBottom: '10px'
  },
  avatar: {
    width: '64px',
    height: '64px',
    borderRadius: 'var(--radius-circle)',
    objectFit: 'cover',
    display: 'block',
    border: '2px solid var(--bg-secondary)'
  },
  titleName: {
    fontSize: '1.02rem',
    fontWeight: '600',
    letterSpacing: '-0.01em'
  },
  titleSub: {
    fontSize: '0.72rem',
    color: 'var(--text-secondary)',
    marginTop: '2px'
  },
  actionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    padding: '4px 0 0 0'
  },
  actionItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer'
  },
  actionCircle: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    background: 'var(--primary-light)',
    border: '1px solid var(--border-color)',
    color: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
    textAlign: 'center'
  },
  section: {
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid rgba(255, 255, 255, 0.03)',
    borderRadius: '16px'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: '600',
    fontSize: '0.82rem',
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '8px'
  },
  searchBox: {
    display: 'flex',
    gap: '6px'
  },
  searchBtn: {
    background: 'var(--primary-gradient)',
    color: 'white',
    border: 'none',
    padding: '8px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)'
  },
  searchResultsContainer: {
    marginTop: '10px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px',
    border: '1px solid var(--border-color)'
  },
  searchResultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
    borderBottom: '1px dashed var(--border-color)',
    paddingBottom: '4px'
  },
  clearSearchBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--danger)',
    cursor: 'pointer',
    fontSize: '0.75rem'
  },
  searchResultsList: {
    maxHeight: '150px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  searchResultItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
    padding: '4px 0'
  },
  searchResultInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: '8px'
  },
  searchResultTime: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)'
  },
  memberList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  memberItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    borderRadius: '10px',
    marginBottom: '6px'
  },
  memberAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-circle)'
  },
  memberInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0
  },
  memberNameWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'wrap'
  },
  memberName: {
    fontSize: '0.85rem',
    fontWeight: '600'
  },
  nicknameTag: {
    fontSize: '0.75rem',
    color: 'var(--primary)',
    fontWeight: '500'
  },
  editNicknameBtn: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline'
  },
  editNicknameBox: {
    display: 'flex',
    gap: '4px',
    marginTop: '4px'
  },
  saveNicknameBtn: {
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    cursor: 'pointer'
  },
  cancelNicknameBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '4px',
    fontSize: '0.75rem',
    cursor: 'pointer'
  },
  // Tabs Gallery
  tabs: {
    display: 'flex',
    background: 'var(--bg-surface)',
    borderRadius: '10px',
    padding: '4px',
    gap: '2px',
    marginBottom: '14px'
  },
  tabBtn: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '6px 0',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer',
    borderRadius: '8px',
    transition: 'all 0.2s ease'
  },
  activeTabBtn: {
    color: 'var(--text-primary)',
    background: 'var(--bg-secondary)',
    boxShadow: 'var(--shadow-sm)'
  },
  tabContent: {
    flex: 1,
    overflowY: 'auto',
    maxHeight: '350px'
  },
  emptyGallery: {
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    textAlign: 'center',
    padding: '20px 0'
  },
  imageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px'
  },
  galleryImage: {
    width: '100%',
    height: '70px',
    objectFit: 'cover',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '10px'
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column'
  },
  fileName: {
    fontSize: '0.75rem',
    fontWeight: '600',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  fileSub: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)'
  },
  fileDownload: {
    color: 'var(--primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  linkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  linkItem: {
    display: 'flex',
    gap: '8px',
    padding: '8px 10px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '10px'
  },
  linkInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  linkUrl: {
    fontSize: '0.75rem',
    color: '#60a5fa',
    textDecoration: 'underline',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  linkSender: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)'
  },
  taskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  sidebarTaskGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  sidebarTaskGroupHeader: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--primary)',
    padding: '4px 8px',
    backgroundColor: 'var(--bg-glass-active)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    width: 'fit-content',
    marginTop: '8px'
  },
  sidebarTaskItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '10px 12px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    transition: 'all 0.2s ease'
  },
  sidebarTaskItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px'
  },
  sidebarTaskTitle: {
    fontSize: '0.82rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    lineHeight: '1.3'
  },
  sidebarTaskStatus: {
    fontSize: '0.68rem',
    fontWeight: '600',
    padding: '2px 6px',
    borderRadius: '6px',
    whiteSpace: 'nowrap'
  },
  sidebarTaskDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: '1.3',
    whiteSpace: 'pre-wrap'
  },
  sidebarTaskMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
    flexWrap: 'wrap',
    gap: '4px'
  },
  sidebarTaskPeople: {
    display: 'flex',
    alignItems: 'center'
  },
  sidebarTaskDueDate: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    color: 'var(--accent)',
    fontWeight: '500'
  },
  sidebarTaskActions: {
    display: 'flex',
    gap: '6px',
    marginTop: '6px',
    justifyContent: 'flex-end'
  },
  sidebarBtnStart: {
    padding: '4px 8px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    fontSize: '0.7rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  sidebarBtnDone: {
    padding: '4px 8px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'var(--secondary)',
    color: '#ffffff',
    fontSize: '0.7rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  sidebarBtnCancel: {
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--danger-light)',
    color: 'var(--danger)',
    fontSize: '0.7rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  addMemberHeaderBtn: {
    background: 'var(--primary-gradient)',
    color: '#ffffff',
    border: 'none',
    padding: '4px 10px',
    borderRadius: '8px',
    fontSize: '0.72rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  avatarCameraOverlay: {
    position: 'absolute',
    bottom: '0px',
    right: '0px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    border: '2px solid var(--bg-secondary)'
  },
  creatorBadge: {
    fontSize: '0.65rem',
    color: 'var(--secondary)',
    background: 'var(--secondary-light)',
    padding: '2px 6px',
    borderRadius: '6px',
    fontWeight: '700',
    marginLeft: '6px'
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
    maxWidth: '350px',
    padding: '20px',
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
    marginBottom: '16px'
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
    gap: '10px'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '16px'
  },
  btnPrimary: {
    padding: '8px 14px',
    borderRadius: '10px',
    background: 'var(--primary-gradient)',
    color: 'white',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.8rem'
  },
  btnSecondary: {
    padding: '8px 14px',
    borderRadius: '10px',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.8rem'
  }
};
