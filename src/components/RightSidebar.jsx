import React, { useState, useEffect } from 'react';
import { FiX, FiEdit3, FiSearch, FiImage, FiFileText, FiLink, FiDownload, FiChevronLeft, FiUser, FiBell } from 'react-icons/fi';
import Avatar from './Avatar';

export default function RightSidebar({
  user,
  token,
  conversation,
  onClose,
  onUpdateNickname,
  mobileActiveView,
  setMobileActiveView,
  className,
  onImageClick
}) {
  const [activeTab, setActiveTab] = useState('images'); // 'images', 'files', 'links'
  const [mediaGallery, setMediaGallery] = useState({ images: [], files: [], links: [] });
  
  // Nickname editing state
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [editingUserId, setEditingUserId] = useState('');
  const [newNickname, setNewNickname] = useState('');

  // Search messages within conversation state
  const [searchMsgQuery, setSearchMsgQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingMsg, setIsSearchingMsg] = useState(false);

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
    <div style={styles.sidebar} className={`glass ${className || ''}`}>
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
        <button onClick={onClose} style={styles.closeBtn} className="btn-interactive">
          <FiX size={18} />
        </button>
      </div>

      <div style={styles.content}>
        {/* Info Card */}
        <div style={styles.infoCard}>
          <Avatar url={getChatAvatar()} name={getChatTitle()} size={70} style={{ margin: '0 auto 12px auto' }} />
          <h4 style={styles.titleName}>{getChatTitle()}</h4>
          <span style={styles.titleSub}>{conversation.isGroup ? 'Cuộc hội thoại nhóm' : 'Chat cá nhân'}</span>
        </div>

        {/* Hàng nút hành động kiểu Zalo (Image 3) */}
        <div style={styles.actionRow}>
          <div style={styles.actionItem} onClick={() => setIsSearchingMsg(true)} className="btn-interactive">
            <div style={styles.actionCircle}><FiSearch size={18} /></div>
            <span style={styles.actionLabel}>Tìm tin nhắn</span>
          </div>
          <div style={styles.actionItem} className="btn-interactive">
            <div style={styles.actionCircle}><FiUser size={18} /></div>
            <span style={styles.actionLabel}>Trang cá nhân</span>
          </div>
          <div style={styles.actionItem} className="btn-interactive">
            <div style={styles.actionCircle}><FiImage size={18} /></div>
            <span style={styles.actionLabel}>Đổi hình nền</span>
          </div>
          <div style={styles.actionItem} className="btn-interactive">
            <div style={styles.actionCircle}><FiBell size={18} /></div>
            <span style={styles.actionLabel}>Tắt thông báo</span>
          </div>
        </div>

        {/* 1. Tìm kiếm tin nhắn */}
        <div style={styles.section} className="glass-card">
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
        <div style={styles.section} className="glass-card">
          <div style={styles.sectionHeader}>
            <FiEdit3 size={16} style={{ color: 'var(--primary)' }} />
            <span>Thành viên & Biệt danh</span>
          </div>
          <div style={styles.memberList}>
            {conversation.members.map(member => (
              <div key={member.user.id} style={styles.memberItem}>
                <Avatar url={member.user.avatarUrl} name={member.user.displayName} size={36} />
                <div style={styles.memberInfo}>
                  <div style={styles.memberNameWrapper}>
                    <span style={styles.memberName}>{member.user.displayName}</span>
                    {member.nickname && <span style={styles.nicknameTag}>({member.nickname})</span>}
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
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Kho lưu trữ Media (Ảnh, File, Link) */}
        <div style={{...styles.section, flex: 1, display: 'flex', flexDirection: 'column'}} className="glass-card">
          <div style={styles.sectionHeader}>
            <FiImage size={16} style={{ color: 'var(--primary)' }} />
            <span>Kho dữ liệu cuộc trò chuyện</span>
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
                      <FiFileText size={20} style={{color: 'var(--primary)', flexShrink: 0}} />
                      <div style={styles.fileInfo}>
                        <span style={styles.fileName}>{file.name}</span>
                        <span style={styles.fileSub}>
                          {file.senderName} • {(file.size / 1024 / 1024).toFixed(2)} MB
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
          </div>
        </div>
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
    justifyContent: 'space-around',
    padding: '12px 0',
    borderBottom: '1px solid var(--border-color)',
    marginBottom: '10px'
  },
  actionItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer'
  },
  actionCircle: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    color: 'var(--text-primary)',
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
    gap: '10px'
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
    borderBottom: '1px solid var(--border-color)',
    marginBottom: '10px'
  },
  tabBtn: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '8px 0',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s ease'
  },
  activeTabBtn: {
    color: 'var(--primary)',
    borderBottomColor: 'var(--primary)'
  },
  tabContent: {
    flex: 1,
    overflowY: 'auto',
    maxHeight: '260px'
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
  }
};
