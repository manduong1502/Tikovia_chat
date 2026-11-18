import { useState } from 'react';
import { API_URL } from './chatInputUtils';

export default function useFileUpload({ token, conversation, onSendMessage, replyingTo, setReplyingTo }) {
  // Trạng thái Upload tiến trình & Hàng đợi Xem trước tệp đính kèm (Staging Preview)
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadTimeElapsed, setUploadTimeElapsed] = useState('00:00');
  const [uploadSpeed, setUploadSpeed] = useState('');

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

  return { isUploading, uploadProgress, uploadFileName, uploadTimeElapsed, uploadSpeed, handleFileUpload };
}
