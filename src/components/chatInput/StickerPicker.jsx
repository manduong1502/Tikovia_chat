import { FiX } from 'react-icons/fi';
import stickerPacks from '../../stickers.json';
import { styles } from './chatInputStyles';

export default function StickerPicker({ activePackId, setActivePackId, setShowStickers, handleSendSticker }) {
  return (
    <div style={styles.stickerContainer} className="glass-card anim-scale-in sticker-popover">
      <div style={styles.stickerHeader}>
        <span>Sticker đáng yêu</span>
        <button onClick={() => setShowStickers(false)} style={styles.stickerClose}><FiX /></button>
      </div>
      <div style={styles.stickerGrid}>
        {(stickerPacks.find(p => p.id === activePackId)?.stickers || []).map((url, idx) => (
          <img
            key={idx}
            src={url}
            alt="sticker"
            onClick={() => handleSendSticker(url)}
            style={styles.stickerItem}
          />
        ))}
      </div>
      <div style={styles.stickerTabBar}>
        {stickerPacks.map(pack => (
          <button
            key={pack.id}
            type="button"
            onClick={() => setActivePackId(pack.id)}
            title={pack.name}
            style={{
              ...styles.stickerTabBtn,
              background: activePackId === pack.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              border: activePackId === pack.id ? '1px solid var(--border-color)' : 'none'
            }}
          >
            <img src={pack.icon} alt={pack.name} style={styles.stickerTabIcon} />
          </button>
        ))}
      </div>
    </div>
  );
}
