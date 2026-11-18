import { FiPaperclip, FiClock, FiMapPin, FiCheckSquare } from 'react-icons/fi';
import { styles } from './chatInputStyles';

export default function MoreMenu({ handleShareLocation, fileInputRef, setShowReminderModal, setShowTaskModal, setShowMoreMenu }) {
  return (
    <div style={styles.moreMenuContainer} className="glass-card anim-scale-in more-menu-popover">
      <div style={styles.moreGrid} className="more-grid-container">
        <div style={styles.moreItem} onClick={handleShareLocation}>
          <div style={{...styles.moreIconWrapper, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171'}}>
            <FiMapPin size={22} />
          </div>
          <span style={styles.moreLabel}>Vị trí</span>
        </div>

        <div style={styles.moreItem} onClick={() => fileInputRef.current.click()}>
          <div style={{...styles.moreIconWrapper, backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa'}}>
            <FiPaperclip size={22} />
          </div>
          <span style={styles.moreLabel}>Tài liệu</span>
        </div>

        <div style={styles.moreItem} onClick={() => setShowReminderModal(true)}>
          <div style={{...styles.moreIconWrapper, backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24'}}>
            <FiClock size={22} />
          </div>
          <span style={styles.moreLabel}>Nhắc hẹn</span>
        </div>

        <div style={styles.moreItem} onClick={() => { setShowTaskModal(true); setShowMoreMenu(false); }}>
          <div style={{...styles.moreIconWrapper, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399'}}>
            <FiCheckSquare size={22} />
          </div>
          <span style={styles.moreLabel}>Giao việc</span>
        </div>

      </div>
    </div>
  );
}
