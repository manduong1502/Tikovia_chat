import { styles } from './chatInputStyles';
import { formatTime } from './chatInputUtils';

export default function RecordingPanel({ recordingDuration, stopRecording }) {
  return (
    <div style={styles.recordingOverlay} className="glass-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <span style={styles.recordDot} className="pulse-red-animation"></span>
        <span style={styles.recordTime}>Đang ghi âm: {formatTime(recordingDuration)}</span>
      </div>
      {/* Waveform animation */}
      <div style={{ display: 'flex', gap: '3px', alignItems: 'center', marginRight: 'auto', marginLeft: '10px', flexShrink: 0 }}>
        <div className="wave-bar" style={{ height: '14px', width: '3px', backgroundColor: 'var(--danger)', borderRadius: '2px' }} />
        <div className="wave-bar" style={{ height: '8px', width: '3px', backgroundColor: 'var(--danger)', borderRadius: '2px' }} />
        <div className="wave-bar" style={{ height: '18px', width: '3px', backgroundColor: 'var(--danger)', borderRadius: '2px' }} />
        <div className="wave-bar" style={{ height: '12px', width: '3px', backgroundColor: 'var(--danger)', borderRadius: '2px' }} />
        <div className="wave-bar" style={{ height: '6px', width: '3px', backgroundColor: 'var(--danger)', borderRadius: '2px' }} />
      </div>
      <div style={styles.recordActions}>
        <button onClick={() => stopRecording(false)} style={styles.recordCancelBtn} className="btn-interactive">Hủy</button>
        <button onClick={() => stopRecording(true)} style={styles.recordSendBtn} className="btn-interactive">Gửi</button>
      </div>
    </div>
  );
}
