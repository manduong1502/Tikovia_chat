import React from 'react';
import { FiX } from 'react-icons/fi';
import Avatar from '../Avatar';
import { styles } from './chatWindowStyles';
import { getFileUrl } from './chatWindowUtils';

// Hộp thoại chuyển tiếp tin nhắn sang các cuộc hội thoại khác
export default function ForwardModal({
  forwardingMsg,
  conversations,
  user,
  forwardSearchTerm,
  setForwardSearchTerm,
  forwardNote,
  setForwardNote,
  selectedForwardConvs,
  setSelectedForwardConvs,
  onClose,
  onSend
}) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()} className="glass-card anim-scale-in">
        <div style={styles.modalHeader}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Chuyển tiếp tin nhắn</h3>
          <button 
            onClick={onClose} 
            style={styles.modalCloseBtn} 
            className="btn-interactive"
          >
            <FiX size={18} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <div style={{
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '10px',
            border: '1px dashed var(--border-color)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {forwardingMsg.type === 'image' && (
              <img
                src={getFileUrl(forwardingMsg.content)}
                alt="Preview"
                style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
              />
            )}
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxHeight: '54px' }}>
              <strong>Nội dung: </strong>
              {forwardingMsg.type === 'text'
                ? forwardingMsg.content
                : forwardingMsg.type === 'image'
                ? '📷 Hình ảnh'
                : forwardingMsg.type === 'file'
                ? `📁 Tệp đính kèm`
                : forwardingMsg.type === 'voice'
                ? '🎙️ Tin nhắn thoại'
                : forwardingMsg.type === 'location'
                ? forwardingMsg.content
                : `[${forwardingMsg.type.toUpperCase()}]`}
            </div>
          </div>
          
          <input 
            type="text"
            placeholder="Tìm đồng nghiệp hoặc nhóm chat..."
            value={forwardSearchTerm}
            onChange={(e) => setForwardSearchTerm(e.target.value)}
            style={styles.modalInput}
          />

          <input
            type="text"
            placeholder="Nhập lời nhắn kèm theo khi chuyển tiếp (tùy chọn)..."
            value={forwardNote}
            onChange={(e) => setForwardNote(e.target.value)}
            style={{ ...styles.modalInput, marginTop: '6px' }}
          />
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxHeight: '220px',
            overflowY: 'auto',
            marginTop: '8px',
            paddingRight: '4px'
          }} className="scroll-optimized">
            {conversations
              .filter(conv => {
                if (conv.isGroup) {
                  return conv.name?.toLowerCase().includes(forwardSearchTerm.toLowerCase());
                } else {
                  const other = conv.members ? conv.members.find(m => m.user.id !== user.id) : null;
                  const name = other?.nickname || other?.user.displayName || 'Người dùng';
                  return name?.toLowerCase().includes(forwardSearchTerm.toLowerCase());
                }
              })
              .map(conv => {
                let name = 'Người dùng';
                let avatarUrl = conv.avatarUrl || null;
                if (conv.isGroup) {
                  name = conv.name;
                } else {
                  const other = conv.members ? conv.members.find(m => m.user.id !== user.id) : null;
                  name = other?.nickname || other?.user.displayName || 'Người dùng';
                  avatarUrl = other?.user.avatarUrl || null;
                }
                const isChecked = selectedForwardConvs.includes(conv.id);
                return (
                  <div 
                    key={conv.id}
                    onClick={() => {
                      setSelectedForwardConvs(prev => 
                        prev.includes(conv.id) 
                          ? prev.filter(id => id !== conv.id) 
                          : [...prev, conv.id]
                      );
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: isChecked ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                      border: isChecked ? '1px solid var(--primary)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    className="btn-interactive"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <Avatar url={avatarUrl} name={name} size={32} />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '0.85rem', color: isChecked ? 'var(--primary)' : 'var(--text-primary)', fontWeight: isChecked ? '600' : '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {name}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                          {conv.isGroup ? 'Nhóm chat' : 'Cá nhân'}
                        </span>
                      </div>
                    </div>
                    <input 
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                  </div>
                );
              })}
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button 
            onClick={onClose} 
            style={styles.btnSecondary}
            className="btn-interactive"
          >
            Hủy
          </button>
          <button 
            onClick={onSend} 
            disabled={selectedForwardConvs.length === 0}
            style={{
              ...styles.btnPrimary,
              opacity: selectedForwardConvs.length === 0 ? 0.5 : 1,
              cursor: selectedForwardConvs.length === 0 ? 'not-allowed' : 'pointer'
            }}
            className="btn-interactive"
          >
            Chuyển tiếp ({selectedForwardConvs.length})
          </button>
        </div>
      </div>
    </div>
  );
}
