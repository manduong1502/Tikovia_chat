import React, { useState, useRef, useEffect } from 'react';
import { FiSmile, FiMoreHorizontal, FiMic, FiImage, FiSend, FiPaperclip, FiClock, FiMapPin, FiX } from 'react-icons/fi';
import stickerPacks from '../stickers.json';

export default function ChatInput({ token, conversation, onSendMessage }) {
  const [text, setText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [activePackId, setActivePackId] = useState(stickerPacks[0]?.id || '');
  
  // Tag Mentions state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCoords, setMentionCoords] = useState({ top: 0, left: 0 });

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioChunks, setAudioChunks] = useState([]);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);

  // Reminders Form state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderTime, setReminderTime] = useState('');

  // Refs
  const inputRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Sử dụng stickerPacks được import từ file json

  // Quản lý gõ phím và kích hoạt Mentions
  const handleInputChange = (e) => {
    const val = e.target.value;
    setText(val);

    // Phát hiện ký tự '@' để tag trong nhóm chat
    if (conversation.isGroup) {
      const cursorPosition = e.target.selectionStart;
      const textBeforeCursor = val.slice(0, cursorPosition);
      const lastAtOffset = textBeforeCursor.lastIndexOf('@');

      if (lastAtOffset !== -1 && lastAtOffset >= textBeforeCursor.lastIndexOf(' ')) {
        const query = textBeforeCursor.slice(lastAtOffset + 1);
        setMentionSearch(query);
        setShowMentions(true);
        setMentionIndex(0);
        
        // Vị trí hiển thị của menu popover nhắc nhở
        setMentionCoords({
          bottom: 56, // Cao hơn thanh input
          left: Math.min(lastAtOffset * 7 + 60, window.innerWidth - 200)
        });
      } else {
        setShowMentions(false);
      }
    }
  };

  const handleSelectMention = (member) => {
    const cursorPosition = inputRef.current.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPosition);
    const lastAtOffset = textBeforeCursor.lastIndexOf('@');
    
    const textAfterCursor = text.slice(cursorPosition);
    
    const newText = textBeforeCursor.slice(0, lastAtOffset) + `@${member.user.displayName} ` + textAfterCursor;
    setText(newText);
    setShowMentions(false);
    inputRef.current.focus();
  };

  // Upload file lên Backend
  const handleFileUpload = async (file, type) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/chat/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) throw new Error('Không thể tải tệp lên');

      const data = await res.json();
      
      // Gửi tin nhắn chứa file vừa upload
      onSendMessage({
        conversationId: conversation.id,
        type: type,
        content: data.url,
        metadata: {
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          fileName: data.fileName
        }
      });
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  // Chọn hình ảnh
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file, 'image');
    }
  };

  // Chọn tài liệu
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file, 'file');
    }
  };

  // Gửi sticker
  const handleSendSticker = (stickerId) => {
    onSendMessage({
      conversationId: conversation.id,
      type: 'sticker',
      content: stickerId,
      metadata: { stickerId }
    });
    setShowStickers(false);
  };

  // Gửi tin nhắn văn bản
  const handleSendText = () => {
    if (!text.trim()) return;
    onSendMessage({
      conversationId: conversation.id,
      type: 'text',
      content: text
    });
    setText('');
    setShowMentions(false);
  };

  // Chia sẻ vị trí hiện tại
  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt của bạn không hỗ trợ định vị vị trí');
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      
      // Thử dùng API Reverse Geocode miễn phí để dịch tọa độ sang địa chỉ
      let address = 'Vị trí hiện tại';
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await res.json();
        if (data.display_name) address = data.display_name;
      } catch (e) {}

      onSendMessage({
        conversationId: conversation.id,
        type: 'location',
        content: `📍 ${address}`,
        metadata: {
          lat: latitude,
          lng: longitude,
          address: address
        }
      });
      setShowMoreMenu(false);
    }, (err) => {
      alert('Không thể truy cập vị trí của bạn: ' + err.message);
    });
  };

  // Thiết lập nhắc hẹn
  const handleCreateReminder = async (e) => {
    e.preventDefault();
    if (!reminderTitle || !reminderTime) {
      alert('Vui lòng chọn tiêu đề và thời gian hẹn');
      return;
    }

    try {
      // 1. Tạo tin nhắn nhắc hẹn trước
      const msgRes = onSendMessage({
        conversationId: conversation.id,
        type: 'reminder',
        content: `⏰ Nhắc hẹn: "${reminderTitle}"`,
        metadata: {
          remindAt: new Date(reminderTime).toISOString()
        }
      });

      // 2. Gọi API tạo nhắc hẹn trên server để thiết lập cron trigger (bên socket.on('send-message') sẽ tự động chạy hoặc gọi API)
      const res = await fetch(`${API_URL}/chat/reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: reminderTitle,
          remindAt: new Date(reminderTime).toISOString(),
          messageId: 'reminder_mock_id' // Sẽ map bên backend
        })
      });

      if (!res.ok) throw new Error('Không thể đăng ký nhắc hẹn');

      setShowReminderModal(false);
      setShowMoreMenu(false);
      setReminderTitle('');
      setReminderTime('');
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  // --- GHI ÂM TIN NHẮN THOẠI (VOICE MESSAGE) ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
        await handleFileUpload(audioFile, 'voice');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (e) {
      alert('Không thể truy cập microphone: ' + e.message);
    }
  };

  const stopRecording = (shouldSend = true) => {
    if (!mediaRecorderRef.current || !isRecording) return;
    
    clearInterval(recordingTimerRef.current);
    
    if (shouldSend) {
      mediaRecorderRef.current.stop();
    } else {
      // Hủy ghi âm
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    setIsRecording(false);
  };

  // Định dạng thời gian giây sang mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Lọc thành viên để nhắc tag tên @
  const mentionFilteredMembers = conversation.members.filter(m => 
    m.user.displayName.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  return (
    <div style={styles.container} className="glass">
      {/* 1. Popover Tag tên (@mention) */}
      {showMentions && mentionFilteredMembers.length > 0 && (
        <div style={{...styles.mentionsContainer, bottom: mentionCoords.bottom, left: mentionCoords.left}} className="glass-card mentions-popover">
          {mentionFilteredMembers.map((m, idx) => (
            <div 
              key={m.user.id} 
              onClick={() => handleSelectMention(m)}
              style={{
                ...styles.mentionItem,
                background: idx === mentionIndex ? 'rgba(0,122,255,0.1)' : 'transparent'
              }}
            >
              <img src={m.user.avatarUrl} alt="" style={styles.mentionAvatar} />
              <span>{m.user.displayName}</span>
            </div>
          ))}
        </div>
      )}

      {/* 2. Popover Sticker */}
      {showStickers && (
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
      )}

      {/* 3. Popover Menu dấu 3 chấm (Vị trí, tài liệu, nhắc hẹn) */}
      {showMoreMenu && (
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

            {/* HÌNH ẢNH (Chỉ hiển thị trên di động trong Menu) */}
            <div className="more-item-mobile-only" style={styles.moreItem} onClick={() => { imageInputRef.current.click(); setShowMoreMenu(false); }}>
              <div style={{...styles.moreIconWrapper, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399'}}>
                <FiImage size={22} />
              </div>
              <span style={styles.moreLabel}>Hình ảnh</span>
            </div>

            {/* GHI ÂM (Chỉ hiển thị trên di động trong Menu) */}
            <div className="more-item-mobile-only" style={styles.moreItem} onClick={() => { startRecording(); setShowMoreMenu(false); }}>
              <div style={{...styles.moreIconWrapper, backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#f472b6'}}>
                <FiMic size={22} />
              </div>
              <span style={styles.moreLabel}>Ghi âm</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Khung Ghi âm đang hoạt động */}
      {isRecording ? (
        <div style={styles.recordingOverlay}>
          <span style={styles.recordDot}></span>
          <span style={styles.recordTime}>Đang ghi âm: {formatTime(recordingDuration)}</span>
          <div style={styles.recordActions}>
            <button onClick={() => stopRecording(false)} style={styles.recordCancelBtn}>Hủy</button>
            <button onClick={() => stopRecording(true)} style={styles.recordSendBtn}>Gửi</button>
          </div>
        </div>
      ) : (
        /* Giao diện input chat chính */
        <div style={styles.inputBar}>
          {/* Nút Sticker */}
          <button 
            onClick={() => { setShowStickers(!showStickers); setShowMoreMenu(false); }} 
            style={styles.iconBtn} 
            className="btn-interactive"
          >
            <FiSmile size={22} />
          </button>

          {/* Ô nhập nhắn tin */}
          <input
            type="text"
            ref={inputRef}
            placeholder="Nhập tin nhắn..."
            value={text}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            style={styles.textInput}
          />

          {/* Nút 3 chấm */}
          <button 
            onClick={() => { setShowMoreMenu(!showMoreMenu); setShowStickers(false); }} 
            style={{...styles.iconBtn, color: showMoreMenu ? 'var(--primary)' : 'inherit'}} 
            className="btn-interactive"
          >
            <FiMoreHorizontal size={22} />
          </button>

          {/* Nút Ghi âm */}
          <button onClick={startRecording} style={styles.iconBtn} className="btn-interactive input-mic-btn">
            <FiMic size={22} />
          </button>

          {/* Nút Gửi Ảnh */}
          <button onClick={() => imageInputRef.current.click()} style={styles.iconBtn} className="btn-interactive input-image-btn">
            <FiImage size={22} />
          </button>

          {/* Nút gửi tin nhắn nhanh */}
          {text.trim() && (
            <button onClick={handleSendText} style={styles.sendBtn} className="btn-interactive anim-scale-in">
              <FiSend size={18} />
            </button>
          )}
        </div>
      )}

      {/* Inputs ẩn để chọn File/Ảnh */}
      <input 
        type="file" 
        ref={imageInputRef} 
        onChange={handleImageChange} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        style={{ display: 'none' }} 
      />

      {/* Modal Nhắc Hẹn */}
      {showReminderModal && (
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
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '12px 20px',
    borderTop: '1px solid var(--border-color)',
    position: 'relative'
  },
  inputBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-circle)',
    transition: 'all var(--transition-fast)',
    ':hover': {
      color: 'var(--text-primary)',
      background: 'rgba(255,255,255,0.05)'
    }
  },
  textInput: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: '24px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'all var(--transition-fast)',
    ':focus': {
      border: '1px solid var(--primary)',
      background: 'rgba(255,255,255,0.08)'
    }
  },
  sendBtn: {
    background: 'var(--primary-gradient)',
    color: 'white',
    border: 'none',
    width: '38px',
    height: '38px',
    borderRadius: 'var(--radius-circle)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(0, 122, 255, 0.3)'
  },
  // Sticker Popover
  stickerContainer: {
    position: 'absolute',
    bottom: '72px',
    left: '20px',
    width: '320px',
    padding: '12px',
    zIndex: 20
  },
  stickerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
    fontWeight: '600',
    marginBottom: '10px',
    color: 'var(--text-secondary)'
  },
  stickerClose: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  stickerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '8px',
    maxHeight: '220px',
    overflowY: 'auto',
    padding: '4px'
  },
  stickerItem: {
    width: '45px',
    height: '45px',
    objectFit: 'contain',
    cursor: 'pointer',
    transition: 'transform 0.15s ease',
    ':hover': { transform: 'scale(1.15)' }
  },
  stickerTabBar: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
    paddingTop: '8px',
    borderTop: '1px solid var(--border-color)',
    overflowX: 'auto'
  },
  stickerTabBtn: {
    padding: '6px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease'
  },
  stickerTabIcon: {
    width: '24px',
    height: '24px',
    objectFit: 'contain'
  },
  // More options Popover
  moreMenuContainer: {
    position: 'absolute',
    bottom: '72px',
    left: '60px',
    padding: '16px',
    zIndex: 20,
    width: '240px'
  },
  moreGrid: {
    display: 'flex',
    justifyContent: 'space-around',
    gap: '10px'
  },
  moreItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer'
  },
  moreIconWrapper: {
    width: '46px',
    height: '46px',
    borderRadius: 'var(--radius-circle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s ease',
    ':hover': { transform: 'scale(1.1)' }
  },
  moreLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)'
  },
  // Mentions Popover
  mentionsContainer: {
    position: 'absolute',
    zIndex: 30,
    width: '200px',
    maxHeight: '160px',
    overflowY: 'auto',
    padding: '6px'
  },
  mentionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'all 0.15s ease'
  },
  mentionAvatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%'
  },
  // Voice Recording Panel
  recordingOverlay: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px dashed rgba(239, 68, 68, 0.3)',
    borderRadius: '24px',
    padding: '6px 16px',
    width: '100%',
    justifyContent: 'space-between'
  },
  recordDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: 'var(--danger)',
    animation: 'fadeIn 1s infinite alternate'
  },
  recordTime: {
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    fontWeight: '600'
  },
  recordActions: {
    display: 'flex',
    gap: '10px'
  },
  recordCancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600'
  },
  recordSendBtn: {
    background: 'var(--danger)',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '16px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600'
  },
  // Modals
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100
  },
  modalContent: {
    width: '380px',
    padding: '24px'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  modalBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  formLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    fontWeight: '600'
  },
  modalInput: {
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px'
  },
  btnPrimary: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--primary-gradient)',
    color: 'white',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer'
  },
  btnSecondary: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    fontWeight: '600',
    cursor: 'pointer'
  }
};
