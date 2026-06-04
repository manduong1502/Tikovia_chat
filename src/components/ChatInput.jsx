import React, { useState, useRef, useEffect } from 'react';
import { FiSmile, FiMoreHorizontal, FiMic, FiImage, FiSend, FiPaperclip, FiClock, FiMapPin, FiX } from 'react-icons/fi';
import stickerPacks from '../stickers.json';

export default function ChatInput({ token, conversation, onSendMessage, replyingTo, setReplyingTo }) {
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

  // Trạng thái Upload tiến trình
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadTimeElapsed, setUploadTimeElapsed] = useState('00:00');
  const [uploadSpeed, setUploadSpeed] = useState('');

  // Refs
  const inputRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Tự động co giãn chiều cao của ô nhập chat (Textarea)
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [text]);

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

  // Upload file lên Backend với XMLHttpRequest để đo lường tiến trình, thời gian và tốc độ
  const handleFileUpload = (file, type) => {
    return new Promise((resolve, reject) => {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadFileName(file.name);
      setUploadSpeed('');
      setUploadTimeElapsed('00:00');
      
      const startTime = Date.now();
      let lastTime = startTime;
      let lastLoaded = 0;

      // Timer đếm giây chạy qua
      const elapsedTimer = setInterval(() => {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        setUploadTimeElapsed(`${m}:${s}`);
      }, 1000);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/chat/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      // Lắng nghe tiến trình
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);

          // Tính toán tốc độ
          const currentTime = Date.now();
          const timeDiff = (currentTime - lastTime) / 1000; // đổi ra giây
          if (timeDiff >= 0.5) { // Cập nhật tốc độ mỗi 0.5s để mượt mà
            const bytesSent = event.loaded - lastLoaded;
            const speedBytesPerSec = bytesSent / timeDiff;
            
            // Định dạng tốc độ
            if (speedBytesPerSec > 1024 * 1024) {
              setUploadSpeed(`${(speedBytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`);
            } else if (speedBytesPerSec > 1024) {
              setUploadSpeed(`${(speedBytesPerSec / 1024).toFixed(1)} KB/s`);
            } else {
              setUploadSpeed(`${Math.round(speedBytesPerSec)} B/s`);
            }

            lastTime = currentTime;
            lastLoaded = event.loaded;
          }
        }
      };

      xhr.onload = () => {
        clearInterval(elapsedTimer);
        setIsUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            // Gửi tin nhắn chứa file vừa upload
            onSendMessage({
              conversationId: conversation.id,
              type: type,
              content: data.url,
              replyToId: replyingTo?.id || null,
              metadata: {
                fileSize: data.fileSize,
                mimeType: data.mimeType,
                fileName: data.fileName,
                storageType: data.storageType || 'local',
                driveId: data.driveId || null,
                webViewLink: data.webViewLink || null
              }
            });
            if (setReplyingTo) setReplyingTo(null);
            resolve(data);
          } catch (e) {
            reject(new Error('Lỗi giải mã dữ liệu phản hồi từ máy chủ.'));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.error || 'Tải tệp lên thất bại.'));
          } catch (e) {
            reject(new Error(`Tải tệp lên thất bại với mã lỗi ${xhr.status}.`));
          }
        }
      };

      xhr.onerror = () => {
        clearInterval(elapsedTimer);
        setIsUploading(false);
        reject(new Error('Mất kết nối hoặc lỗi đường truyền mạng.'));
      };

      xhr.onabort = () => {
        clearInterval(elapsedTimer);
        setIsUploading(false);
        reject(new Error('Tải lên đã bị hủy bởi người dùng.'));
      };

      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    }).catch(e => {
      console.error(e);
      alert(`[Tải lên lỗi] ${e.message}`);
    });
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
      replyToId: replyingTo?.id || null,
      metadata: { stickerId }
    });
    setShowStickers(false);
    if (setReplyingTo) setReplyingTo(null);
  };

  // Xử lý sự kiện nhấn phím Enter để gửi và Shift+Enter để xuống dòng
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault();
        handleSendText();
      }
    }
  };

  // Gửi tin nhắn văn bản
  const handleSendText = () => {
    if (!text.trim()) return;
    onSendMessage({
      conversationId: conversation.id,
      type: 'text',
      content: text,
      replyToId: replyingTo?.id || null
    });
    setText('');
    setShowMentions(false);
    if (setReplyingTo) setReplyingTo(null);
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
        replyToId: replyingTo?.id || null,
        metadata: {
          lat: latitude,
          lng: longitude,
          address: address
        }
      });
      setShowMoreMenu(false);
      if (setReplyingTo) setReplyingTo(null);
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
        replyToId: replyingTo?.id || null,
        metadata: {
          remindAt: new Date(reminderTime).toISOString()
        }
      });
      if (setReplyingTo) setReplyingTo(null);

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
      {/* 0. Reply Preview Bar */}
      {replyingTo && (
        <div style={styles.replyPreviewBar}>
          <div style={styles.replyPreviewInfo}>
            <span style={styles.replyPreviewTitle}>Đang trả lời <strong>{replyingTo.senderId === conversation.members.find(m => m.user.id === replyingTo.senderId)?.user.id ? 'Bạn' : (conversation.members.find(m => m.user.id === replyingTo.senderId)?.nickname || replyingTo.sender?.displayName || 'Người dùng')}</strong></span>
            <span style={styles.replyPreviewContent}>
              {replyingTo.type === 'text' ? replyingTo.content : `[${replyingTo.type.toUpperCase()}]`}
            </span>
          </div>
          <button onClick={() => setReplyingTo(null)} style={styles.replyPreviewCloseBtn} className="btn-interactive">
            <FiX size={16} />
          </button>
        </div>
      )}

      {/* 0.1 Upload Progress Overlay (Glassmorphism PWA styling) */}
      {isUploading && (
        <div style={styles.uploadProgressOverlay} className="glass-card anim-scale-in">
          <div style={styles.uploadProgressInfo}>
            <div style={styles.uploadProgressHeader}>
              <span style={styles.uploadProgressTitle}>
                📂 Đang tải tài liệu lên Google Drive...
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
      )}

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
            style={styles.smileBtn} 
            className="btn-interactive"
          >
            <FiSmile size={28} />
          </button>

          {/* Ô nhập nhắn tin (Textarea hỗ trợ xuống dòng Shift+Enter) */}
          <textarea
            ref={inputRef}
            placeholder="Tin nhắn"
            value={text}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            style={styles.textInput}
            rows={1}
          />

          {/* Nút 3 chấm */}
          <button 
            onClick={() => { setShowMoreMenu(!showMoreMenu); setShowStickers(false); }} 
            style={{...styles.iconBtn, color: showMoreMenu ? 'var(--primary)' : '#e2e8f0'}} 
            className="btn-interactive"
          >
            <FiMoreHorizontal size={26} />
          </button>

          {/* Nút Ghi âm */}
          <button onClick={startRecording} style={styles.iconBtn} className="btn-interactive input-mic-btn">
            <FiMic size={26} />
          </button>

          {/* Nút Gửi Ảnh */}
          <button 
            onClick={() => imageInputRef.current.click()} 
            style={styles.imageBtn} 
            className="btn-interactive input-image-btn"
            title="Gửi hình ảnh"
          >
            <FiImage size={18} />
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
  uploadProgressOverlay: {
    padding: '12px 16px',
    background: 'var(--bg-glass-active)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '10px',
    boxShadow: 'var(--shadow-md)',
    zIndex: 10
  },
  uploadProgressInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  uploadProgressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--primary)'
  },
  uploadProgressTitle: {
    fontSize: '0.85rem'
  },
  uploadProgressTime: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)'
  },
  uploadFileNameText: {
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: '500'
  },
  progressBarWrapper: {
    width: '100%',
    height: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginTop: '4px'
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'var(--primary)',
    borderRadius: '3px',
    transition: 'width 0.2s ease-out'
  },
  uploadProgressFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginTop: '2px'
  },
  container: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border-color)',
    position: 'relative',
    background: 'var(--bg-secondary)',
    flexShrink: 0
  },
  inputBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'none'
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: '#e2e8f0',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color var(--transition-fast)',
    flexShrink: 0
  },
  smileBtn: {
    background: 'none',
    border: 'none',
    color: '#cbd5e1',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color var(--transition-fast)',
    flexShrink: 0
  },
  imageBtn: {
    background: 'var(--btn-image-bg)',
    color: 'var(--btn-image-color)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: '0',
    flexShrink: 0,
    transition: 'background var(--transition-fast), transform var(--transition-fast)'
  },
  textInput: {
    flex: 1,
    padding: '10px 4px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    outline: 'none',
    width: '100%',
    resize: 'none',
    fontFamily: 'inherit',
    height: '40px',
    maxHeight: '120px',
    lineHeight: '1.4'
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
    background: 'var(--bg-surface)',
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
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    fontWeight: '600',
    cursor: 'pointer'
  },
  replyPreviewBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--bg-surface)',
    borderLeft: '3px solid var(--primary)',
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '10px',
    animation: 'slideDown 0.2s ease'
  },
  replyPreviewInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontSize: '0.8rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1
  },
  replyPreviewTitle: {
    color: 'var(--primary)',
    fontWeight: '500'
  },
  replyPreviewContent: {
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  replyPreviewCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  }
};
