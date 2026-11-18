import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { styles } from './chatInputStyles';
import { API_URL } from './chatInputUtils';

export default function TaskModal({ open, setShowTaskModal, setShowMoreMenu, token, conversation }) {
  // Task Form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');

  // Xử lý Giao việc
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskTitle || !taskAssigneeId) {
      alert('Vui lòng nhập tiêu đề và chọn người thực hiện');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription,
          assigneeId: taskAssigneeId,
          dueDate: taskDueDate || null,
          conversationId: conversation.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Có lỗi xảy ra khi tạo công việc');
      }

      // Xóa sạch form và đóng modal
      setTaskTitle('');
      setTaskDescription('');
      setTaskAssigneeId('');
      setTaskDueDate('');
      setShowTaskModal(false);
      setShowMoreMenu(false);
    } catch (err) {
      alert(err.message);
    }
  };

  if (!open) return null;

  return (
    <div style={styles.modalOverlay}>
      <form onSubmit={handleCreateTask} style={styles.modalContent} className="glass-card anim-scale-in task-modal">
        <div style={styles.modalHeader}>
          <h3>Phân công công việc</h3>
          <button type="button" onClick={() => setShowTaskModal(false)} style={styles.modalCloseBtn}><FiX size={20} /></button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Tiêu đề công việc</label>
            <input
              type="text"
              required
              placeholder="Nhập tên công việc..."
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              style={styles.modalInput}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Mô tả chi tiết</label>
            <textarea
              placeholder="Nhập mô tả chi tiết công việc (không bắt buộc)..."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              style={{
                ...styles.modalInput,
                height: '80px',
                resize: 'none',
                fontFamily: 'inherit',
                padding: '8px 12px'
              }}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Người thực hiện</label>
            <select
              required
              value={taskAssigneeId}
              onChange={(e) => setTaskAssigneeId(e.target.value)}
              style={{
                ...styles.modalInput,
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <option value="">-- Chọn thành viên nhận việc --</option>
              {conversation.members?.map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.nickname || member.user.displayName} (@{member.user.username})
                </option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Hạn chót (Deadline)</label>
            <input
              type="datetime-local"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              style={styles.modalInput}
            />
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button type="button" onClick={() => setShowTaskModal(false)} style={styles.btnSecondary}>Hủy</button>
          <button type="submit" style={styles.btnPrimary}>Giao việc</button>
        </div>
      </form>
    </div>
  );
}
