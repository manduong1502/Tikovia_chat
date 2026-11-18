import { FiPaperclip, FiX } from 'react-icons/fi';
import { styles } from './chatInputStyles';

export default function StagingPreviewBar({ pendingFiles, handleClearAllPendingFiles, handleRemovePendingFile }) {
  return (
    <div style={styles.stagingBar} className="glass-card anim-scale-in">
      <div style={styles.stagingHeader}>
        <span style={styles.stagingTitle}>
          📎 Đính kèm chờ gửi ({pendingFiles.length})
        </span>
        <button
          type="button"
          onClick={handleClearAllPendingFiles}
          style={styles.stagingClearBtn}
          className="btn-interactive"
        >
          Xóa hết
        </button>
      </div>
      <div style={styles.stagingList} className="scroll-optimized">
        {pendingFiles.map((item) => (
          <div key={item.id} style={styles.stagingItem}>
            {item.type === 'image' && item.previewUrl ? (
              <img src={item.previewUrl} alt={item.file.name} style={styles.stagingThumb} />
            ) : (
              <div style={styles.stagingFileBox}>
                <FiPaperclip size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div style={styles.stagingFileInfo}>
                  <span style={styles.stagingFileName} title={item.file.name}>{item.file.name}</span>
                  <span style={styles.stagingFileSize}>
                    {item.file.size < 1024 * 1024
                      ? `${(item.file.size / 1024).toFixed(1)} KB`
                      : `${(item.file.size / (1024 * 1024)).toFixed(2)} MB`}
                  </span>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => handleRemovePendingFile(item.id)}
              style={styles.stagingRemoveBtn}
              title="Bỏ tệp này"
            >
              <FiX size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
