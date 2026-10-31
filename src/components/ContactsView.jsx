import React, { useState } from 'react';
import { FiSearch, FiUsers, FiMessageCircle } from 'react-icons/fi';
import Avatar from './Avatar';

export default function ContactsView({
  mobileActiveView,
  user,
  conversations,
  onSelectConversation,
  onlineUsers = []
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'friends' | 'groups'

  // Thu thập danh sách bạn bè (1v1) và nhóm từ các cuộc hội thoại
  const contacts = [];
  const groups = [];
  const seenIds = new Set();

  if (conversations && user) {
    conversations.forEach((conv) => {
      if (conv.isGroup) {
        groups.push(conv);
      } else if (conv.members) {
        conv.members.forEach((m) => {
          if (m.user && m.user.id !== user.id && !seenIds.has(m.user.id)) {
            seenIds.add(m.user.id);
            contacts.push({
              ...m.user,
              nickname: m.nickname,
              conversation: conv
            });
          }
        });
      }
    });
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredContacts = contacts.filter((c) => {
    if (!normalizedSearch) return true;
    const name = (c.nickname || c.displayName || '').toLowerCase();
    const uname = (c.username || '').toLowerCase();
    return name.includes(normalizedSearch) || uname.includes(normalizedSearch);
  });

  const filteredGroups = groups.filter((g) => {
    if (!normalizedSearch) return true;
    return (g.name || '').toLowerCase().includes(normalizedSearch);
  });

  return (
    <div
      className={`glass mobile-only-view ${mobileActiveView === 'contacts' ? 'mobile-show-list' : 'mobile-hide-list'}`}
      style={styles.container}
    >
      <div style={styles.header}>
        <h3 style={styles.title}>Danh bạ</h3>
        <span style={styles.subtitle}>Danh sách đồng nghiệp & nhóm làm việc</span>
      </div>
      <div style={{ padding: '0 20px 10px 20px' }}>
        <div style={styles.searchWrapper}>
          <FiSearch style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Tìm kiếm bạn bè, nhóm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-premium"
            style={styles.searchInput}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }} className="mobile-list-padding scroll-optimized">
        <div style={styles.category}>
          <div style={styles.categoryHeader}>🏷️ Bộ lọc nhanh</div>
          <div
            style={{
              ...styles.contactItem,
              borderColor: filterType === 'all' ? 'var(--primary)' : 'transparent'
            }}
            className="btn-interactive"
            onClick={() => setFilterType('all')}
          >
            <FiMessageCircle size={18} style={{ color: 'var(--primary)' }} />
            <div>
              <div style={styles.contactName}>Tất cả liên hệ</div>
              <div style={styles.contactStatus}>
                {contacts.length} đồng nghiệp • {groups.length} nhóm
              </div>
            </div>
          </div>
          <div
            style={{
              ...styles.contactItem,
              borderColor: filterType === 'groups' ? 'var(--primary)' : 'transparent'
            }}
            className="btn-interactive"
            onClick={() => setFilterType(filterType === 'groups' ? 'all' : 'groups')}
          >
            <FiUsers size={18} style={{ color: 'var(--secondary)' }} />
            <div>
              <div style={styles.contactName}>Danh sách nhóm ({groups.length})</div>
              <div style={styles.contactStatus}>Nhấn để lọc các nhóm chat</div>
            </div>
          </div>
        </div>

        {(filterType === 'all' || filterType === 'groups') && filteredGroups.length > 0 && (
          <div style={{ ...styles.category, marginTop: '20px' }}>
            <div style={styles.categoryHeader}>👥 Nhóm chat ({filteredGroups.length})</div>
            {filteredGroups.map((g) => (
              <div
                key={g.id}
                style={styles.contactItem}
                className="btn-interactive"
                onClick={() => onSelectConversation && onSelectConversation(g)}
              >
                <Avatar url={g.avatarUrl} name={g.name || 'Nhóm'} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.contactName}>{g.name}</div>
                  <div style={styles.contactStatus}>{g.members?.length || 0} thành viên</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(filterType === 'all' || filterType === 'friends') && (
          <div style={{ ...styles.category, marginTop: '20px' }}>
            <div style={styles.categoryHeader}>👤 Đồng nghiệp ({filteredContacts.length})</div>
            {filteredContacts.length > 0 ? (
              filteredContacts.map((c, i) => {
                const isOnline = onlineUsers.includes(c.id) || c.status === 'online';
                return (
                  <div
                    key={c.id || i}
                    style={styles.contactItem}
                    className="btn-interactive"
                    onClick={() => c.conversation && onSelectConversation && onSelectConversation(c.conversation)}
                  >
                    <Avatar url={c.avatarUrl} name={c.nickname || c.displayName} size={38} isOnline={isOnline} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.contactName}>{c.nickname || c.displayName}</div>
                      <div style={styles.contactStatus}>
                        @{c.username} • {isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Không tìm thấy liên hệ phù hợp.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '340px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid var(--border-color)',
    zIndex: 10
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid var(--border-color)',
    marginBottom: '15px'
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0
  },
  subtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)'
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)',
    fontSize: '14px',
    zIndex: 1
  },
  searchInput: {
    width: '100%',
    paddingLeft: '36px'
  },
  category: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  categoryHeader: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--primary)',
    marginBottom: '4px'
  },
  contactItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid transparent',
    cursor: 'pointer'
  },
  contactName: {
    fontSize: '0.88rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  contactStatus: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)'
  }
};
