import React, { useState, useRef, useEffect } from 'react';
import { FiSmile, FiMoreHorizontal, FiMic, FiImage, FiSend } from 'react-icons/fi';
import stickerPacks from '../stickers.json';
import { styles } from './chatInput/chatInputStyles';
import { compressImage } from './chatInput/chatInputUtils';
import useFileUpload from './chatInput/useFileUpload';
import useVoiceRecorder from './chatInput/useVoiceRecorder';
import { EditPreviewBar, ReplyPreviewBar } from './chatInput/PreviewBars';
import UploadProgressOverlay from './chatInput/UploadProgressOverlay';
import StagingPreviewBar from './chatInput/StagingPreviewBar';
import MentionList from './chatInput/MentionList';
import StickerPicker from './chatInput/StickerPicker';
import MoreMenu from './chatInput/MoreMenu';
import RecordingPanel from './chatInput/RecordingPanel';
import ReminderModal from './chatInput/ReminderModal';
import TaskModal from './chatInput/TaskModal';

export default function ChatInput({ 
  token, 
  user = null,
  socket = null,
  conversation, 
  onSendMessage, 
  replyingTo, 
  setReplyingTo,
  editingMsg = null,
  setEditingMsg = null,
  onEditMessage = null,
  droppedFiles = null,
  onConsumeDroppedFiles = null
}) {
  const [text, setText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [activePackId, setActivePackId] = useState(stickerPacks[0]?.id || '');
  
  // Tag Mentions state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCoords, setMentionCoords] = useState({ top: 0, left: 0 });

  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Reminders Form state
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Task Form state
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Trạng thái Upload tiến trình & Hàng đợi Xem trước tệp đính kèm (Staging Preview)
  const { isUploading, uploadProgress, uploadFileName, uploadTimeElapsed, uploadSpeed, handleFileUpload } = useFileUpload({ token, conversation, onSendMessage, replyingTo, setReplyingTo });
  const { isRecording, recordingDuration, startRecording, stopRecording } = useVoiceRecorder(handleFileUpload);
  const [pendingFiles, setPendingFiles] = useState([]);

  // Refs
  const inputRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const pendingFilesRef = useRef([]);

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  // Giải phóng ObjectURL khi unmount hoặc đổi phòng chat
  useEffect(() => {
    return () => {
      pendingFilesRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    setPendingFiles((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  }, [conversation?.id]);

  // Tự động co giãn chiều cao của ô nhập chat (Textarea từ 1 đến 5 dòng)
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const nextHeight = text ? Math.min(Math.max(textarea.scrollHeight, 24), 120) : 24;
      textarea.style.height = `${nextHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > 120 ? 'auto' : 'hidden';
    }
  }, [text]);

  // Đồng bộ nội dung tin nhắn khi chuẩn bị sửa đổi
  useEffect(() => {
    if (editingMsg) {
      setText(editingMsg.content || '');
      inputRef.current?.focus();
    }
  }, [editingMsg]);

  // Sử dụng stickerPacks được import từ file json

  // Quản lý gõ phím, phát tín hiệu typing qua Socket và kích hoạt Mentions
  const handleInputChange = (e) => {
    const val = e.target.value;
    setText(val);

    if (socket && typeof socket.emit === 'function' && conversation?.id) {
      if (!isTypingRef.current && val.trim().length > 0) {
        isTypingRef.current = true;
        socket.emit('typing', {
          conversationId: conversation.id,
          displayName: user?.displayName || 'Thành viên',
          isTyping: true
        });
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          socket.emit('typing', {
            conversationId: conversation.id,
            displayName: user?.displayName || 'Thành viên',
            isTyping: false
          });
        }
      }, 2500);
    }

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

  // Đưa danh sách file (từ nút chọn nhiều file, Ctrl+V dán ảnh chụp màn hình, hoặc Kéo-Thả) vào thanh Xem trước
  const stageFiles = (rawFileList) => {
    if (!rawFileList || rawFileList.length === 0) return;
    const filesArray = Array.from(rawFileList);
    const nowTag = new Date().toTimeString().slice(0, 8).replace(/:/g, '');

    const newStaged = filesArray.map((file, idx) => {
      let normalizedFile = file;
      // Nếu là ảnh chụp màn hình dán từ Clipboard (thường có tên mặc định là image.png) thì đặt tên rõ ràng
      if (file.type.startsWith('image/') && (!file.name || file.name === 'image.png' || file.name === 'blob')) {
        const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
        normalizedFile = new File([file], `Anh-chup-man-hinh-${nowTag}-${idx + 1}.${ext}`, {
          type: file.type,
          lastModified: Date.now()
        });
      }
      const isImg = normalizedFile.type.startsWith('image/');
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
        file: normalizedFile,
        type: isImg ? 'image' : 'file',
        previewUrl: isImg ? URL.createObjectURL(normalizedFile) : null
      };
    });

    setPendingFiles((prev) => [...prev, ...newStaged]);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  // Nhận các file được Kéo-Thả từ cửa sổ ChatWindow
  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      stageFiles(droppedFiles);
      if (onConsumeDroppedFiles) onConsumeDroppedFiles();
    }
  }, [droppedFiles]);

  const handleRemovePendingFile = (idToRemove) => {
    setPendingFiles((prev) => {
      const target = prev.find((item) => item.id === idToRemove);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== idToRemove);
    });
  };

  const handleClearAllPendingFiles = () => {
    setPendingFiles((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  };

  // Xử lý dán ảnh chụp màn hình hoặc tệp từ Clipboard (Ctrl + V)
  const handlePaste = (e) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const extractedFiles = [];
    if (clipboardData.items && clipboardData.items.length > 0) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) extractedFiles.push(file);
        }
      }
    } else if (clipboardData.files && clipboardData.files.length > 0) {
      extractedFiles.push(...Array.from(clipboardData.files));
    }

    if (extractedFiles.length > 0) {
      e.preventDefault();
      stageFiles(extractedFiles);
    }
  };

  // Chọn một hoặc nhiều hình ảnh
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      stageFiles(e.target.files);
      e.target.value = '';
    }
  };

  // Chọn một hoặc nhiều tài liệu
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      stageFiles(e.target.files);
      e.target.value = '';
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

  // Lọc thành viên để nhắc tag tên @ (ưu tiên các thành viên khác lên đầu danh sách)
  const mentionFilteredMembers = (conversation.members || []).filter(
    (m) => m.user?.id !== user?.id && (m.user?.displayName || '').toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Xử lý phím điều hướng menu @mention (Lên/Xuống/Enter/Tab/Esc) và phím Enter gửi tin nhắn
  const handleKeyDown = (e) => {
    if (showMentions && mentionFilteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionFilteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionFilteredMembers.length) % mentionFilteredMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (e.isComposing) return;
        e.preventDefault();
        const picked = mentionFilteredMembers[mentionIndex] || mentionFilteredMembers[0];
        if (picked) handleSelectMention(picked);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      if (e.isComposing) return; // Bỏ qua nếu đang gõ tiếng Việt (IME composition)
      if (!e.shiftKey) {
        e.preventDefault();
        handleSendText();
      }
    }
  };

  // Gửi tin nhắn văn bản + toàn bộ ảnh/file đang chờ trong thanh Xem trước
  const handleSendText = async () => {
    const hasText = Boolean(text.trim());
    const hasStagedFiles = pendingFiles.length > 0;
    if (!hasText && !hasStagedFiles) return;
    if (isUploading) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current && socket && typeof socket.emit === 'function' && conversation?.id) {
      isTypingRef.current = false;
      socket.emit('typing', {
        conversationId: conversation.id,
        displayName: user?.displayName || 'Thành viên',
        isTyping: false
      });
    }

    const currentText = text;
    const filesToUpload = [...pendingFiles];

    setText('');
    setPendingFiles([]);
    setShowMentions(false);

    // 1. Nếu có các file/ảnh đang chờ trong thanh Preview -> Nén ảnh & tải lên lần lượt
    if (filesToUpload.length > 0) {
      for (let i = 0; i < filesToUpload.length; i++) {
        const item = filesToUpload[i];
        let fileToSend = item.file;
        if (item.type === 'image' && fileToSend.type.startsWith('image/') && fileToSend.type !== 'image/gif') {
          fileToSend = await compressImage(fileToSend);
        }
        const batchLabel = filesToUpload.length > 1 ? `(${i + 1}/${filesToUpload.length}) ${fileToSend.name}` : fileToSend.name;
        const fileWithLabel = new File([fileToSend], fileToSend.name, { type: fileToSend.type });
        fileWithLabel.displayLabel = batchLabel;
        await handleFileUpload(fileWithLabel, item.type);
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    }

    // 2. Nếu có kèm chữ văn bản -> Gửi tin nhắn văn bản
    if (hasText) {
      if (editingMsg) {
        if (onEditMessage) {
          onEditMessage(editingMsg.id, currentText);
        }
        if (setEditingMsg) setEditingMsg(null);
      } else {
        onSendMessage({
          conversationId: conversation.id,
          type: 'text',
          content: currentText,
          replyToId: replyingTo?.id || null
        });
      }
      if (setReplyingTo) setReplyingTo(null);
    }
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

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  return (
    <div style={styles.container} className="glass chat-input-container">
      {/* 0. Edit Preview Bar */}
      {editingMsg && (
        <EditPreviewBar editingMsg={editingMsg} setEditingMsg={setEditingMsg} setText={setText} />
      )}

      {/* 0. Reply Preview Bar */}
      {replyingTo && (
        <ReplyPreviewBar replyingTo={replyingTo} setReplyingTo={setReplyingTo} user={user} conversation={conversation} />
      )}

      {/* 0.1 Upload Progress Overlay (Glassmorphism PWA styling) */}
      {isUploading && (
        <UploadProgressOverlay
          uploadTimeElapsed={uploadTimeElapsed}
          uploadFileName={uploadFileName}
          uploadProgress={uploadProgress}
          uploadSpeed={uploadSpeed}
        />
      )}

      {/* 0.2 Thanh Xem trước Tệp / Ảnh chờ gửi (Staging Preview Bar cho Ctrl+V, Chọn nhiều file & Kéo thả) */}
      {pendingFiles.length > 0 && !isUploading && (
        <StagingPreviewBar
          pendingFiles={pendingFiles}
          handleClearAllPendingFiles={handleClearAllPendingFiles}
          handleRemovePendingFile={handleRemovePendingFile}
        />
      )}

      {/* 1. Popover Tag tên (@mention) */}
      {showMentions && mentionFilteredMembers.length > 0 && (
        <MentionList
          mentionFilteredMembers={mentionFilteredMembers}
          mentionCoords={mentionCoords}
          mentionIndex={mentionIndex}
          handleSelectMention={handleSelectMention}
        />
      )}

      {/* 2. Popover Sticker */}
      {showStickers && (
        <StickerPicker
          activePackId={activePackId}
          setActivePackId={setActivePackId}
          setShowStickers={setShowStickers}
          handleSendSticker={handleSendSticker}
        />
      )}

      {/* 3. Popover Menu dấu 3 chấm (Vị trí, tài liệu, nhắc hẹn) */}
      {showMoreMenu && (
        <MoreMenu
          handleShareLocation={handleShareLocation}
          fileInputRef={fileInputRef}
          setShowReminderModal={setShowReminderModal}
          setShowTaskModal={setShowTaskModal}
          setShowMoreMenu={setShowMoreMenu}
        />
      )}

      {/* 4. Khung Ghi âm đang hoạt động */}
      {isRecording ? (
        <RecordingPanel recordingDuration={recordingDuration} stopRecording={stopRecording} />
      ) : (
        /* Giao diện input chat chính */
        <div style={styles.inputBar} className="chat-input-bar">
          {/* Nút Sticker */}
          <button 
            onClick={() => { setShowStickers(!showStickers); setShowMoreMenu(false); }} 
            style={styles.smileBtn} 
            className="btn-interactive chat-input-icon-btn"
          >
            <FiSmile size={24} />
          </button>

          {/* Ô nhập nhắn tin (Textarea hỗ trợ xuống dòng Shift+Enter & dán ảnh/file Ctrl+V) */}
          <textarea
            ref={inputRef}
            placeholder={pendingFiles.length > 0 ? "Nhập lời nhắn kèm theo..." : "Tin nhắn"}
            value={text}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            style={styles.textInput}
            rows={1}
          />

          {/* Nút 3 chấm */}
          <button 
            onClick={() => { setShowMoreMenu(!showMoreMenu); setShowStickers(false); }} 
            style={{...styles.iconBtn, color: showMoreMenu ? 'var(--primary)' : 'var(--text-secondary)'}} 
            className="btn-interactive chat-input-icon-btn"
          >
            <FiMoreHorizontal size={23} />
          </button>

          {/* Nút Ghi âm (Ẩn trên mobile khi đang gõ chữ để nhường chỗ cho nút Gửi) */}
          <button
            onClick={startRecording}
            style={styles.iconBtn}
            className={`btn-interactive input-mic-btn chat-input-icon-btn ${(text.trim() || pendingFiles.length > 0) ? 'mobile-hide-when-typing' : ''}`}
          >
            <FiMic size={22} />
          </button>

          {/* Nút Gửi Ảnh */}
          <button 
            onClick={() => imageInputRef.current.click()} 
            style={styles.imageBtn} 
            className="btn-interactive input-image-btn"
            title="Gửi hình ảnh (Có thể chọn nhiều ảnh)"
          >
            <FiImage size={17} />
          </button>

          {/* Nút gửi tin nhắn nhanh */}
          {(text.trim() || pendingFiles.length > 0) && (
            <button onClick={handleSendText} style={styles.sendBtn} className="btn-interactive anim-scale-in">
              <FiSend size={17} />
            </button>
          )}
        </div>
      )}

      {/* Inputs ẩn để chọn File/Ảnh (Hỗ trợ chọn nhiều tệp cùng lúc với multiple) */}
      <input 
        type="file" 
        ref={imageInputRef} 
        onChange={handleImageChange} 
        accept="image/*" 
        multiple
        style={{ display: 'none' }} 
      />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        multiple
        style={{ display: 'none' }} 
      />

      {/* Modal Nhắc Hẹn */}
      <ReminderModal
        open={showReminderModal}
        setShowReminderModal={setShowReminderModal}
        setShowMoreMenu={setShowMoreMenu}
        token={token}
        conversation={conversation}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
      />

      {/* Modal Giao việc */}
      <TaskModal
        open={showTaskModal}
        setShowTaskModal={setShowTaskModal}
        setShowMoreMenu={setShowMoreMenu}
        token={token}
        conversation={conversation}
      />
    </div>
  );
}
