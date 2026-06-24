import React, { useState, useEffect } from 'react';
import { FiCheckSquare, FiMessageSquare, FiClock, FiUser, FiChevronLeft, FiAlertCircle, FiTrash2, FiPlay, FiCheck, FiX } from 'react-icons/fi';
import Avatar from './Avatar';

export default function TasksView({
  user,
  token,
  onClose,
  onSelectConversation,
  socket,
  mobileActiveView,
  setMobileActiveView,
  className
}) {
  const [activeTab, setActiveTab] = useState('received'); // 'received' (được giao), 'assigned' (tôi giao)
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'in_progress', 'done', 'overdue'
  const [tasks, setTasks] = useState({ assignedToMe: [], assignedByMe: [] });
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const fetchTasksList = async () => {
    try {
      const res = await fetch(`${API_URL}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (e) {
      console.error('Lỗi tải danh sách công việc:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksList();
  }, [token]);

  // Lắng nghe cập nhật socket thời gian thực
  useEffect(() => {
    if (!socket) return;

    const handleTaskStatusUpdated = ({ taskId, status }) => {
      setTasks(prev => {
        const updateItem = (item) => item.id === taskId ? { ...item, status } : item;
        return {
          assignedToMe: prev.assignedToMe.map(updateItem),
          assignedByMe: prev.assignedByMe.map(updateItem)
        };
      });
    };

    socket.on('task-status-updated', handleTaskStatusUpdated);

    // Bất cứ khi nào có tin nhắn mới loại 'task' phát ra từ người khác
    const handleReceiveMessage = (msg) => {
      if (msg.type === 'task') {
        fetchTasksList();
      }
    };
    socket.on('receive-message', handleReceiveMessage);

    return () => {
      socket.off('task-status-updated', handleTaskStatusUpdated);
      socket.off('receive-message', handleReceiveMessage);
    };
  }, [socket]);

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        // Cập nhật state cục bộ
        setTasks(prev => {
          const updateItem = (item) => item.id === taskId ? { ...item, status: newStatus } : item;
          return {
            assignedToMe: prev.assignedToMe.map(updateItem),
            assignedByMe: prev.assignedByMe.map(updateItem)
          };
        });
      } else {
        const errData = await res.json();
        alert(errData.error || 'Cập nhật trạng thái thất bại');
      }
    } catch (e) {
      alert('Không thể kết nối đến máy chủ');
    }
  };

  const getDueTimeInfo = (dueDate, status) => {
    if (!dueDate) return { text: 'Không có hạn chót', color: 'var(--text-secondary)' };
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due - now;

    if (status === 'done') {
      return { text: `Hạn chót: ${due.toLocaleString('vi-VN')}`, color: '#10b981' };
    }
    if (status === 'cancelled') {
      return { text: `Hạn chót: ${due.toLocaleString('vi-VN')}`, color: 'var(--text-secondary)' };
    }

    if (diffMs < 0) {
      const diffHrs = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHrs / 24);
      let text = '';
      if (diffDays > 0) {
        text = `Quá hạn ${diffDays} ngày`;
      } else if (diffHrs > 0) {
        text = `Quá hạn ${diffHrs} giờ`;
      } else {
        text = `Quá hạn ít phút`;
      }
      return { text, color: '#f43f5e', isOverdue: true };
    } else {
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHrs / 24);
      let text = '';
      if (diffDays > 0) {
        text = `Còn ${diffDays} ngày`;
      } else if (diffHrs > 0) {
        text = `Còn ${diffHrs} giờ`;
      } else {
        text = `Còn ít phút`;
      }
      return { text: `Hạn: ${due.toLocaleString('vi-VN')} (${text})`, color: '#f59e0b' };
    }
  };

  // Lấy danh sách nhiệm vụ của tab đang hoạt động
  const currentTabTasks = activeTab === 'received' ? tasks.assignedToMe : tasks.assignedByMe;

  // Lọc danh sách theo trạng thái
  const filteredTasks = currentTabTasks.filter(task => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return task.status === 'pending';
    if (statusFilter === 'in_progress') return task.status === 'in_progress';
    if (statusFilter === 'done') return task.status === 'done';
    if (statusFilter === 'overdue') {
      if (task.status === 'done' || task.status === 'cancelled' || !task.dueDate) return false;
      return new Date(task.dueDate) < new Date();
    }
    return true;
  });

  // Tính toán số lượng thống kê của tab đang hoạt động
  const stats = currentTabTasks.reduce((acc, t) => {
    acc.total += 1;
    if (t.status === 'pending') acc.pending += 1;
    if (t.status === 'in_progress') acc.in_progress += 1;
    if (t.status === 'done') acc.done += 1;
    if (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done' && t.status !== 'cancelled') {
      acc.overdue += 1;
    }
    return acc;
  }, { total: 0, pending: 0, in_progress: 0, done: 0, overdue: 0 });

  return (
    <div style={styles.container} className={`anim-fade ${className || ''}`}>
      {/* Header */}
      <div style={styles.header} className="glass">
        <div style={styles.headerInfo}>
          {setMobileActiveView && (
            <button 
              onClick={() => setMobileActiveView('list')} 
              className="mobile-back-btn"
              style={styles.backBtn}
            >
              <FiChevronLeft size={24} />
            </button>
          )}
          <div style={styles.headerTitleContainer}>
            <FiCheckSquare size={24} style={{ color: 'var(--primary)' }} />
            <h3 style={styles.title}>Quản lý Công việc</h3>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={styles.closeBtn} className="btn-interactive desktop-only">
            Đóng
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={styles.tabsWrapper}>
        <button 
          style={{ ...styles.tabBtn, ...(activeTab === 'received' ? styles.activeTabBtn : {}) }}
          onClick={() => { setActiveTab('received'); setStatusFilter('all'); }}
          className="btn-interactive"
        >
          Được giao cho tôi ({tasks.assignedToMe.length})
        </button>
        <button 
          style={{ ...styles.tabBtn, ...(activeTab === 'assigned' ? styles.activeTabBtn : {}) }}
          onClick={() => { setActiveTab('assigned'); setStatusFilter('all'); }}
          className="btn-interactive"
        >
          Tôi giao cho người khác ({tasks.assignedByMe.length})
        </button>
      </div>

      {/* Statistics dashboard */}
      <div style={styles.statsContainer}>
        {[
          { id: 'all', label: 'Tổng số', count: stats.total, color: 'var(--text-primary)', bg: 'rgba(255,255,255,0.03)' },
          { id: 'pending', label: 'Cần làm', count: stats.pending, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
          { id: 'in_progress', label: 'Đang làm', count: stats.in_progress, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
          { id: 'done', label: 'Hoàn thành', count: stats.done, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
          { id: 'overdue', label: 'Quá hạn', count: stats.overdue, color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)' }
        ].map(stat => (
          <div 
            key={stat.id}
            onClick={() => setStatusFilter(stat.id)}
            style={{ 
              ...styles.statCard, 
              backgroundColor: stat.bg,
              borderColor: statusFilter === stat.id ? stat.color : 'var(--border-color)',
              cursor: 'pointer'
            }}
            className="btn-interactive"
          >
            <span style={{ ...styles.statCount, color: stat.color }}>{stat.count}</span>
            <span style={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Tasks Feed List */}
      <div style={styles.taskListContainer} className="scroll-optimized">
        {loading ? (
          <div style={styles.emptyState}>
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
            <p style={{ marginTop: '10px' }}>Đang tải công việc...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div style={styles.emptyState}>
            <FiAlertCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Không tìm thấy công việc nào phù hợp.</p>
          </div>
        ) : (
          filteredTasks.map(task => {
            const isReceived = activeTab === 'received';
            const partner = isReceived ? task.assigner : task.assignee;
            const dueInfo = getDueTimeInfo(task.dueDate, task.status);

            // Format Status text
            let statusLabel = 'Chờ làm';
            let statusColor = '#f59e0b';
            let statusBg = 'rgba(245, 158, 11, 0.15)';
            if (task.status === 'in_progress') {
              statusLabel = 'Đang làm';
              statusColor = '#3b82f6';
              statusBg = 'rgba(59, 130, 246, 0.15)';
            } else if (task.status === 'done') {
              statusLabel = 'Hoàn thành';
              statusColor = '#10b981';
              statusBg = 'rgba(16, 185, 129, 0.15)';
            } else if (task.status === 'cancelled') {
              statusLabel = 'Đã hủy';
              statusColor = '#f43f5e';
              statusBg = 'rgba(244, 63, 94, 0.15)';
            }

            return (
              <div key={task.id} style={styles.taskItemCard} className="glass-card anim-scale-in">
                <div style={styles.taskItemHeader}>
                  <div style={styles.taskItemPartner}>
                    <Avatar url={partner?.avatarUrl} name={partner?.displayName} size={36} />
                    <div>
                      <div style={styles.taskItemPartnerRole}>
                        {isReceived ? 'Giao bởi:' : 'Giao cho:'}
                      </div>
                      <div style={styles.taskItemPartnerName}>
                        {partner?.displayName || 'Thành viên'}
                      </div>
                    </div>
                  </div>
                  <span style={{ ...styles.statusBadge, color: statusColor, backgroundColor: statusBg }}>
                    {statusLabel}
                  </span>
                </div>

                <div style={styles.taskItemBody}>
                  <h4 style={styles.taskItemTitle}>{task.title}</h4>
                  {task.description && <p style={styles.taskItemDesc}>{task.description}</p>}
                </div>

                <div style={styles.taskItemMeta}>
                  <div style={{ ...styles.taskItemMetaItem, color: dueInfo.color }}>
                    <FiClock size={14} />
                    <span>{dueInfo.text}</span>
                  </div>
                  <div style={styles.taskItemMetaItem}>
                    <FiMessageSquare size={14} />
                    <span>Hội thoại: {task.conversation?.name || (task.conversation?.isGroup ? 'Nhóm chat' : 'Chat cá nhân')}</span>
                  </div>
                </div>

                <div style={styles.taskItemFooter}>
                  <button 
                    onClick={() => onSelectConversation(task.conversationId)}
                    style={styles.actionLinkBtn}
                    className="btn-interactive"
                    title="Đi tới cuộc trò chuyện"
                  >
                    <FiMessageSquare size={16} />
                    <span>Đi tới chat</span>
                  </button>

                  <div style={styles.taskItemActions}>
                    {isReceived && task.status === 'pending' && (
                      <button 
                        onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                        style={styles.btnStart}
                        className="btn-interactive"
                      >
                        <FiPlay size={14} />
                        Bắt đầu
                      </button>
                    )}
                    {isReceived && task.status === 'in_progress' && (
                      <button 
                        onClick={() => handleUpdateTaskStatus(task.id, 'done')}
                        style={styles.btnDone}
                        className="btn-interactive"
                      >
                        <FiCheck size={14} />
                        Hoàn thành
                      </button>
                    )}
                    {(task.status !== 'done' && task.status !== 'cancelled') && (
                      <button 
                        onClick={() => handleUpdateTaskStatus(task.id, 'cancelled')}
                        style={styles.btnCancel}
                        className="btn-interactive"
                      >
                        <FiX size={14} />
                        Hủy
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    background: 'var(--bg-chat-gradient)',
    overflow: 'hidden'
  },
  header: {
    margin: '16px 16px 8px 16px',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--bg-glass)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    boxShadow: 'var(--shadow-sm)',
    zIndex: 5,
    flexShrink: 0
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '8px',
    padding: '4px'
  },
  headerTitleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: '700',
    letterSpacing: '-0.01em',
    color: 'var(--text-primary)'
  },
  closeBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    padding: '6px 14px',
    borderRadius: '14px',
    fontSize: '0.82rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  tabsWrapper: {
    display: 'flex',
    padding: '4px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '16px',
    margin: '0 16px 12px 16px',
    border: '1px solid var(--border-color)'
  },
  tabBtn: {
    flex: 1,
    padding: '10px',
    background: 'none',
    border: 'none',
    borderRadius: '12px',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.25s ease'
  },
  activeTabBtn: {
    background: 'var(--primary-gradient)',
    color: '#ffffff',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
  },
  statsContainer: {
    display: 'flex',
    gap: '8px',
    margin: '0 16px 16px 16px',
    overflowX: 'auto',
    paddingBottom: '4px'
  },
  statCard: {
    flex: 1,
    minWidth: '76px',
    padding: '10px 8px',
    borderRadius: '14px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    transition: 'all 0.25s ease'
  },
  statCount: {
    fontSize: '1.15rem',
    fontWeight: '800'
  },
  statLabel: {
    fontSize: '0.65rem',
    color: 'var(--text-secondary)',
    fontWeight: '500'
  },
  taskListContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 16px 96px 16px', // chừa khoảng cách cho bottom nav di động
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px 20px',
    textAlign: 'center',
    color: 'var(--text-secondary)'
  },
  taskItemCard: {
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-color)',
    borderRadius: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  taskItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%'
  },
  taskItemPartner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  taskItemPartnerRole: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)'
  },
  taskItemPartnerName: {
    fontSize: '0.82rem',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  statusBadge: {
    fontSize: '0.7rem',
    fontWeight: '700',
    padding: '3px 10px',
    borderRadius: '12px'
  },
  taskItemBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  taskItemTitle: {
    fontSize: '0.92rem',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  taskItemDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.3',
    background: 'rgba(255,255,255,0.01)',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.02)'
  },
  taskItemMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
    paddingTop: '10px'
  },
  taskItemMetaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)'
  },
  taskItemFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
    paddingTop: '10px',
    marginTop: '4px'
  },
  actionLinkBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: '8px',
    transition: 'all 0.2s ease'
  },
  taskItemActions: {
    display: 'flex',
    gap: '8px'
  },
  btnStart: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  btnDone: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  btnCancel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(244, 63, 94, 0.2)',
    backgroundColor: 'rgba(244, 63, 94, 0.05)',
    color: '#f87171',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer'
  }
};
