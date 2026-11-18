import { FiX } from 'react-icons/fi';
import { styles } from './chatInputStyles';

export function EditPreviewBar({ editingMsg, setEditingMsg, setText }) {
  return (
    <div style={styles.replyPreviewBar}>
      <div style={styles.replyPreviewInfo}>
        <span style={styles.replyPreviewTitle}>Đang sửa tin nhắn</span>
        <span style={styles.replyPreviewContent}>
          {editingMsg.content}
        </span>
      </div>
      <button 
        onClick={() => {
          setEditingMsg(null);
          setText('');
        }} 
        style={styles.replyPreviewCloseBtn} 
        className="btn-interactive"
      >
        <FiX size={16} />
      </button>
    </div>
  );
}

export function ReplyPreviewBar({ replyingTo, setReplyingTo, user, conversation }) {
  return (
    <div style={styles.replyPreviewBar}>
      <div style={styles.replyPreviewInfo}>
        <span style={styles.replyPreviewTitle}>Đang trả lời <strong>{replyingTo.senderId === user?.id ? 'Bạn' : (conversation.members.find(m => m.user.id === replyingTo.senderId)?.nickname || replyingTo.sender?.displayName || 'Người dùng')}</strong></span>
        <span style={styles.replyPreviewContent}>
          {replyingTo.type === 'text' ? replyingTo.content : `[${replyingTo.type.toUpperCase()}]`}
        </span>
      </div>
      <button onClick={() => setReplyingTo(null)} style={styles.replyPreviewCloseBtn} className="btn-interactive">
        <FiX size={16} />
      </button>
    </div>
  );
}
