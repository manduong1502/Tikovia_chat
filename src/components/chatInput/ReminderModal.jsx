import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { styles } from './chatInputStyles';
import { API_URL } from './chatInputUtils';

export default function ReminderModal({ open, setShowReminderModal, setShowMoreMenu, token, conversation, replyingTo, setReplyingTo }) {
  // Reminders Form state
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderTime, setReminderTime] = useState('');

  // Thiết lập nhắc hẹn (Tạo đồng bộ cả Message & Reminder trong 1 Transaction trên Backend)
  const handleCreateReminder = async (e) => {
    e.preventDefault();
    if (!reminderTitle.trim() || !reminderTime) {
      alert('Vui lòng chọn tiêu đề và thời gian hẹn');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/chat/reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId: conversation.id,
          title: reminderTitle.trim(),
          remindAt: new Date(reminderTime).toISOString(),
          replyToId: replyingTo?.id || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể đăng ký nhắc hẹn');
      }

      if (setReplyingTo) setReplyingTo(null);
      setShowReminderModal(false);
      setShowMoreMenu(false);
      setReminderTitle('');
      setReminderTime('');
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  if (!open) return null;

  return (
    <div style={styles.modalOverlay}>
      <form onSubmit={handleCreateReminder} style={styles.modalContent} className="glass-card anim-scale-in reminder-modal">
        <div style={styles.modalHeader}>
          <h3>Tạo nhắc hẹn cuộc trò chuyện</h3>
          <button type="button" onClick={() => setShowReminderModal(false)} style={styles.modalCloseBtn}><FiX size={20} /></button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Tiêu đề nhắc hẹn</label>
            <input
              type="text"
              required
              placeholder="Nhắc họp, nhắc công việc..."
              value={reminderTitle}
              onChange={(e) => setReminderTitle(e.target.value)}
              style={styles.modalInput}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Thời gian nhắc</label>
            <input
              type="datetime-local"
              required
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              style={styles.modalInput}
            />
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button type="button" onClick={() => setShowReminderModal(false)} style={styles.btnSecondary}>Hủy</button>
          <button type="submit" style={styles.btnPrimary}>Đăng ký Nhắc hẹn</button>
        </div>
      </form>
    </div>
  );
}
