import React from 'react';
import Avatar from './Avatar';

export default function DiaryView({ mobileActiveView, user }) {
  return (
    <div className={`glass mobile-only-view ${mobileActiveView === 'diary' ? 'mobile-show-list' : 'mobile-hide-list'}`} style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Nhật ký</h3>
        <span style={styles.subtitle}>Khoảnh khắc đáng nhớ</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }} className="mobile-list-padding scroll-optimized">
        {/* Post Box */}
        <div style={styles.postBox} className="glass-card">
          <Avatar url={user.avatarUrl} name={user.displayName} size={36} />
          <input
            type="text"
            placeholder="Hôm nay bạn thế nào?"
            style={styles.postInput}
            readOnly
          />
          <span style={{ fontSize: '1.2rem', cursor: 'pointer' }}>📷</span>
        </div>
  
        {/* Feeds */}
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            {
              author: 'Nguyễn Hoài Nam',
              avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=nam',
              time: '1 giờ trước',
              content: 'Vừa hoàn thành xong giao diện mới của Tikovia Chat! Trông mượt mà và xịn xò thực sự 😍',
              likes: 12,
              comments: 4
            },
            {
              author: 'Lê Thuỳ Trang',
              avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=trang',
              time: '5 giờ trước',
              content: 'Cuối tuần bình yên bên tách cà phê ☕ Chúc mọi người một ngày mới tràn đầy năng lượng nha!',
              likes: 24,
              comments: 8
            }
          ].map((post, i) => (
            <div key={i} style={styles.postCard} className="glass-card">
              <div style={styles.postHeader}>
                <Avatar url={post.avatar} name={post.author} size={36} />
                <div>
                  <div style={styles.postAuthor}>{post.author}</div>
                  <div style={styles.postTime}>{post.time}</div>
                </div>
              </div>
              <div style={styles.postContent}>{post.content}</div>
              <div style={styles.postFooter}>
                <button style={styles.actionBtn} className="btn-interactive" type="button">❤️ {post.likes}</button>
                <button style={styles.actionBtn} className="btn-interactive" type="button">💬 {post.comments}</button>
              </div>
            </div>
          ))}
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
  postBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-color)',
  },
  postInput: {
    flex: 1,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    padding: '8px 16px',
    fontSize: '0.82rem',
    color: 'var(--text-primary)',
    outline: 'none',
    cursor: 'pointer',
  },
  postCard: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  postHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  postAuthor: {
    fontSize: '0.88rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  postTime: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  postContent: {
    fontSize: '0.85rem',
    lineHeight: '1.25rem',
    color: 'var(--text-primary)',
  },
  postFooter: {
    display: 'flex',
    gap: '12px',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '10px',
    marginTop: '4px',
  },
  actionBtn: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-color)',
    borderRadius: '14px',
    padding: '4px 12px',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
};
