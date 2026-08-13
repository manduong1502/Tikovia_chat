import React from 'react';
import { FiSearch } from 'react-icons/fi';
import Avatar from './Avatar';

export default function ContactsView({ mobileActiveView, user, conversations }) {
  // Thu thập danh sách bạn bè từ các cuộc hội thoại 1v1
  const contacts = [];
  const seenIds = new Set();
  if (conversations && user) {
    conversations.forEach(conv => {
      if (!conv.isGroup) {
        conv.members.forEach(m => {
          if (m.user.id !== user.id && !seenIds.has(m.user.id)) {
            seenIds.add(m.user.id);
            contacts.push(m.user);
          }
        });
      }
    });
  }

  return (
    <div className={`glass mobile-only-view ${mobileActiveView === 'contacts' ? 'mobile-show-list' : 'mobile-hide-list'}`} style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Danh bạ</h3>
        <span style={styles.subtitle}>Danh sách bạn bè & nhóm</span>
      </div>
      <div style={{ padding: '0 20px 10px 20px' }}>
        <div style={styles.searchWrapper}>
          <FiSearch style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Tìm kiếm danh bạ..."
            className="input-premium"
            style={styles.searchInput}
            readOnly
          />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }} className="mobile-list-padding scroll-optimized">
        <div style={styles.category}>
          <div style={styles.categoryHeader}>🏷️ Danh mục</div>
          <div style={styles.contactItem} className="btn-interactive">
            <span style={{ fontSize: '1.2rem' }}>🤝</span>
            <div>
              <div style={styles.contactName}>Lời mời kết bạn</div>
              <div style={styles.contactStatus}>Không có lời mời nào</div>
            </div>
          </div>
          <div style={styles.contactItem} className="btn-interactive">
            <span style={{ fontSize: '1.2rem' }}>👥</span>
            <div>
              <div style={styles.contactName}>Danh sách nhóm</div>
              <div style={styles.contactStatus}>Quản lý các nhóm chat</div>
            </div>
          </div>
        </div>
        
        <div style={{ ...styles.category, marginTop: '20px' }}>
          <div style={styles.categoryHeader}>👤 Bạn bè ({contacts.length})</div>
          {contacts.length > 0 ? (
            contacts.map((c, i) => (
              <div key={c.id || i} style={styles.contactItem} className="btn-interactive">
                <Avatar url={c.avatarUrl} name={c.displayName} size={36} isOnline={c.status === 'online'} />
                <div>
                  <div style={styles.contactName}>{c.displayName}</div>
                  <div style={styles.contactStatus}>@{c.username} • {c.status === 'online' ? 'Trực tuyến' : 'Ngoại tuyến'}</div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Chưa có bạn bè trong danh bạ.
            </div>
          )}
        </div>
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
    zIndex: 10,
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid var(--border-color)',
    marginBottom: '15px',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)',
    fontSize: '14px',
    zIndex: 1,
  },
  searchInput: {
    width: '100%',
    paddingLeft: '36px',
  },
  category: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  categoryHeader: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--primary)',
    marginBottom: '4px',
  },
  contactItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid transparent',
    cursor: 'pointer',
  },
  contactName: {
    fontSize: '0.88rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  contactStatus: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
};
