import React, { useState, useRef, useEffect } from 'react';
import { FiSmile, FiMoreHorizontal, FiMic, FiImage, FiSend, FiPaperclip, FiClock, FiMapPin, FiX, FiCheckSquare } from 'react-icons/fi';
import stickerPacks from '../stickers.json';
import Avatar from './Avatar';

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

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Reminders Form state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderTime, setReminderTime] = useState('');

  // Task Form state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');

  // Trạng thái Upload tiến trình & Hàng đợi Xem trước tệp đính kèm (Staging Preview)
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadTimeElapsed, setUploadTimeElapsed] = useState('00:00');
  const [uploadSpeed, setUploadSpeed] = useState('');
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

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

  // Upload file lên Backend với XMLHttpRequest để đo lường tiến trình, thời gian và tốc độ
  const handleFileUpload = (file, type) => {
    return new Promise((resolve, reject) => {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadFileName(file.displayLabel || file.name);
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

  // Hàm nén ảnh ở phía Client bằng HTML5 Canvas trước khi upload
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          // Kích thước tối đa FullHD 1920x1080
          const MAX_WIDTH = 1920;
          const MAX_HEIGHT = 1080;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Chuyển đổi sang Blob dạng JPEG với chất lượng nén 75%
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Tạo một File object mới giữ nguyên tên file gốc nhưng đổi đuôi sang .jpg
                const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                const compressedFile = new File([blob], `${cleanName}.jpg`, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                console.log(`[Image Compression] Dung lượng gốc: ${(file.size / 1024 / 1024).toFixed(2)}MB -> Dung lượng nén: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.75
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
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

  // Xử lý sự kiện nhấn phím Enter để gửi và Shift+Enter để xuống dòng
  const handleKeyDown = (e) => {
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

  // Dọn dẹp luồng Microphone an toàn khi hủy hoặc đóng component
  const releaseMicrophoneStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      releaseMicrophoneStream();
    };
  }, []);

  // --- GHI ÂM TIN NHẮN THOẠI (Hỗ trợ đa nền tảng Android/Desktop WebM & iOS Safari MP4/AAC) ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const candidateTypes = [
        { mime: 'audio/webm;codecs=opus', ext: 'webm', cleanMime: 'audio/webm' },
        { mime: 'audio/webm', ext: 'webm', cleanMime: 'audio/webm' },
        { mime: 'audio/mp4', ext: 'm4a', cleanMime: 'audio/mp4' },
        { mime: 'audio/ogg;codecs=opus', ext: 'ogg', cleanMime: 'audio/ogg' },
        { mime: 'audio/aac', ext: 'aac', cleanMime: 'audio/aac' }
      ];

      let chosen = { mime: '', ext: 'webm', cleanMime: 'audio/webm' };
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        const found = candidateTypes.find((c) => MediaRecorder.isTypeSupported(c.mime));
        if (found) chosen = found;
      }

      const recorderOptions = chosen.mime ? { mimeType: chosen.mime } : undefined;
      mediaRecorderRef.current = new MediaRecorder(stream, recorderOptions);
      
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        try {
          if (chunks.length > 0) {
            const audioBlob = new Blob(chunks, { type: chosen.cleanMime });
            const audioFile = new File([audioBlob], `voice-message.${chosen.ext}`, {
              type: chosen.cleanMime
            });
            await handleFileUpload(audioFile, 'voice');
          }
        } finally {
          releaseMicrophoneStream();
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (e) {
      releaseMicrophoneStream();
      alert('Không thể truy cập microphone: ' + e.message);
    }
  };

  const stopRecording = (shouldSend = true) => {
    if (!mediaRecorderRef.current || !isRecording) return;
    
    clearInterval(recordingTimerRef.current);
    
    if (shouldSend) {
      mediaRecorderRef.current.stop();
    } else {
      // Hủy ghi âm và giải phóng ngay phần cứng Microphone
      mediaRecorderRef.current.onstop = null;
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {}
      releaseMicrophoneStream();
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
    <div style={styles.container} className="glass chat-input-container">
      {/* 0. Edit Preview Bar */}
      {editingMsg && (
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
      )}

      {/* 0. Reply Preview Bar */}
      {replyingTo && (
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
      )}

      {/* 0.1 Upload Progress Overlay (Glassmorphism PWA styling) */}
      {isUploading && (
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
      )}

      {/* 0.2 Thanh Xem trước Tệp / Ảnh chờ gửi (Staging Preview Bar cho Ctrl+V, Chọn nhiều file & Kéo thả) */}
      {pendingFiles.length > 0 && !isUploading && (
        <div style={styles.stagingBar} className="glass-card anim-scale-in">
          <div style={styles.stagingHeader}>
            <span style={styles.stagingTitle}>
              📎 Đính kèm chờ gửi ({pendingFiles.length})
            </span>
            <button
              type="button"
              onClick={handleClearAllPendingFiles}
              style={styles.stagingClearBtn}
              className="btn-interactive"
            >
              Xóa hết
            </button>
          </div>
          <div style={styles.stagingList} className="scroll-optimized">
            {pendingFiles.map((item) => (
              <div key={item.id} style={styles.stagingItem}>
                {item.type === 'image' && item.previewUrl ? (
                  <img src={item.previewUrl} alt={item.file.name} style={styles.stagingThumb} />
                ) : (
                  <div style={styles.stagingFileBox}>
                    <FiPaperclip size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <div style={styles.stagingFileInfo}>
                      <span style={styles.stagingFileName} title={item.file.name}>{item.file.name}</span>
                      <span style={styles.stagingFileSize}>
                        {item.file.size < 1024 * 1024
                          ? `${(item.file.size / 1024).toFixed(1)} KB`
                          : `${(item.file.size / (1024 * 1024)).toFixed(2)} MB`}
                      </span>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemovePendingFile(item.id)}
                  style={styles.stagingRemoveBtn}
                  title="Bỏ tệp này"
                >
                  <FiX size={12} />
                </button>
              </div>
            ))}
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
              <Avatar url={m.user.avatarUrl} name={m.user.displayName} size={24} />
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

            <div style={styles.moreItem} onClick={() => { setShowTaskModal(true); setShowMoreMenu(false); }}>
              <div style={{...styles.moreIconWrapper, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399'}}>
                <FiCheckSquare size={22} />
              </div>
              <span style={styles.moreLabel}>Giao việc</span>
            </div>

          </div>
        </div>
      )}

      {/* 4. Khung Ghi âm đang hoạt động */}
      {isRecording ? (
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

      {/* Modal Giao việc */}
      {showTaskModal && (
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
      )}
    </div>
  );
}

const styles = {
  uploadProgressOverlay: {
    padding: '12px 16px',
    background: 'var(--bg-glass-active)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
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
    backgroundColor: 'var(--border-color)',
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
    padding: '8px 16px 16px 16px',
    borderTop: 'none',
    position: 'relative',
    background: 'transparent',
    flexShrink: 0
  },
  inputBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'var(--bg-glass)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '28px',
    padding: '6px 12px 6px 16px',
    boxShadow: 'var(--shadow-md)',
    transition: 'border-color 0.2s, box-shadow 0.2s'
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color var(--transition-fast)',
    flexShrink: 0
  },
  smileBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color var(--transition-fast)',
    flexShrink: 0
  },
  imageBtn: {
    background: 'var(--btn-image-bg)',
    color: 'var(--btn-image-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: '0',
    flexShrink: 0,
    transition: 'all var(--transition-fast)'
  },
  stagingBar: {
    padding: '10px 14px',
    background: 'var(--bg-glass-active)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    marginBottom: '8px',
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  stagingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px'
  },
  stagingTitle: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  stagingClearBtn: {
    background: 'rgba(244, 63, 94, 0.12)',
    color: 'var(--danger)',
    border: 'none',
    borderRadius: '8px',
    padding: '3px 8px',
    fontSize: '0.72rem',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0
  },
  stagingList: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    overflowX: 'auto',
    paddingBottom: '4px',
    paddingTop: '4px'
  },
  stagingItem: {
    position: 'relative',
    flexShrink: 0
  },
  stagingThumb: {
    width: '62px',
    height: '62px',
    borderRadius: '10px',
    objectFit: 'cover',
    border: '1px solid var(--border-color)',
    display: 'block'
  },
  stagingFileBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '10px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-color)',
    maxWidth: '210px',
    height: '62px',
    boxSizing: 'border-box'
  },
  stagingFileInfo: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0
  },
  stagingFileName: {
    fontSize: '0.76rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  stagingFileSize: {
    fontSize: '0.68rem',
    color: 'var(--text-secondary)'
  },
  stagingRemoveBtn: {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'var(--danger)',
    color: '#ffffff',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
  },
  textInput: {
    flex: 1,
    padding: '6px 0',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    outline: 'none',
    width: '100%',
    resize: 'none',
    fontFamily: 'inherit',
    minHeight: '24px',
    height: '24px',
    maxHeight: '120px',
    lineHeight: '1.45',
    boxSizing: ' content-box'
  },
  sendBtn: {
    background: 'var(--primary-gradient)',
    color: 'white',
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-circle)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
    flexShrink: 0
  },
  // Sticker Popover
  stickerContainer: {
    position: 'absolute',
    bottom: '76px',
    left: '16px',
    width: '320px',
    padding: '16px',
    zIndex: 20,
    background: 'rgba(17, 21, 32, 0.85)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    boxShadow: 'var(--shadow-lg)'
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
    bottom: '76px',
    left: '48px',
    padding: '16px',
    zIndex: 20,
    width: '260px',
    background: 'var(--bg-glass-active)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    boxShadow: 'var(--shadow-lg)'
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
    width: '220px',
    maxHeight: '180px',
    overflowY: 'auto',
    padding: '8px',
    background: 'rgba(17, 21, 32, 0.85)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-lg)'
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
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '28px',
    padding: '8px 16px',
    width: '100%',
    justifyContent: 'space-between',
    boxShadow: 'var(--shadow-sm)'
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
    fontSize: '0.84rem',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  },
  recordActions: {
    display: 'flex',
    gap: '10px',
    flexShrink: 0
  },
  recordCancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  },
  recordSendBtn: {
    background: 'var(--danger)',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '16px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  },
  // Modals
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100
  },
  modalContent: {
    width: 'calc(100% - 32px)',
    maxWidth: '380px',
    padding: '24px',
    background: 'var(--bg-glass-active)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    boxShadow: 'var(--shadow-lg)'
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
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'all 0.2s ease'
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
    background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid var(--border-color)',
    borderLeft: '4px solid var(--primary)',
    padding: '8px 16px',
    borderRadius: '14px',
    marginBottom: '8px',
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
