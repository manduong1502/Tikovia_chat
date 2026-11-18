import { styles } from './chatInputStyles';

export default function UploadProgressOverlay({ uploadTimeElapsed, uploadFileName, uploadProgress, uploadSpeed }) {
  return (
    <div style={styles.uploadProgressOverlay} className="glass-card anim-scale-in">
      <div style={styles.uploadProgressInfo}>
        <div style={styles.uploadProgressHeader}>
          <span style={styles.uploadProgressTitle}>
            📂 Đang tải tệp lên ổ cứng máy chủ...
          </span>
          <span style={styles.uploadProgressTime}>
            ⏱️ {uploadTimeElapsed}
          </span>
        </div>
        <div style={styles.uploadFileNameText} title={uploadFileName}>
          {uploadFileName}
        </div>
        <div style={styles.progressBarWrapper}>
          <div style={{...styles.progressBar, width: `${uploadProgress}%`}} />
        </div>
        <div style={styles.uploadProgressFooter}>
          <span>Tiến độ: {uploadProgress}%</span>
          <span>{uploadSpeed && `🚀 Tốc độ: ${uploadSpeed}`}</span>
        </div>
      </div>
    </div>
  );
}
