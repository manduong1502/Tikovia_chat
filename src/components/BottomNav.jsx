import React from 'react';
import { FiMessageSquare, FiUsers, FiCheckSquare, FiBookOpen, FiUser } from 'react-icons/fi';

const NAV_ITEMS = [
  { id: 'list', label: 'Tin nhắn', icon: FiMessageSquare },
  { id: 'contacts', label: 'Danh bạ', icon: FiUsers },
  { id: 'tasks', label: 'Công việc', icon: FiCheckSquare },
  { id: 'diary', label: 'Nhật ký', icon: FiBookOpen },
  { id: 'profile', label: 'Cá nhân', icon: FiUser },
];

export default function BottomNav({
  mobileActiveView,
  setMobileActiveView,
  showProfile,
  setShowProfile,
  totalUnreadChats,
  pendingTasksCount,
}) {
  const showBottomNav = ['list', 'contacts', 'tasks', 'diary', 'profile'].includes(mobileActiveView) || showProfile;
  if (!showBottomNav) return null;

  let activeTabId = showProfile ? 'profile' : mobileActiveView;
  if (activeTabId === 'chat' || activeTabId === 'options') {
    activeTabId = 'list';
  }
  const activeIndex = NAV_ITEMS.findIndex(item => item.id === activeTabId);
  const capsuleStyle = activeIndex !== -1 ? {
    width: 'calc(20% - 12px)',
    left: `calc(${activeIndex * 20}% + 6px)`,
  } : {};

  return (
    <div className="bottom-nav-floating">
      <div className="bottom-nav-capsule" style={capsuleStyle}></div>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTabId === item.id;

        // Tính số lượng thông báo / tin nhắn chưa đọc cho từng tab
        let badgeCount = 0;
        if (item.id === 'list') {
          badgeCount = totalUnreadChats;
        } else if (item.id === 'contacts') {
          badgeCount = 0;
        } else if (item.id === 'tasks') {
          badgeCount = pendingTasksCount;
        }

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.id === 'profile') {
                setShowProfile(true);
                setMobileActiveView('profile');
              } else {
                setShowProfile(false);
                setMobileActiveView(item.id);
              }
            }}
            className={`bottom-nav-item-floating ${isActive ? 'active' : ''}`}
          >
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Icon size={20} />
              {badgeCount > 0 && (
                <span style={styles.badge}>
                  {badgeCount}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.68rem', marginTop: '2px' }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  badge: {
    position: 'absolute',
    top: '-6px',
    right: '-10px',
    backgroundColor: 'var(--danger)',
    color: 'white',
    borderRadius: '10px',
    padding: '2px 5px',
    fontSize: '0.62rem',
    fontWeight: '700',
    lineHeight: '1',
    border: '2px solid var(--bg-secondary)',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '16px',
    height: '16px',
  },
};
