import { useState, useRef, useEffect } from 'react';

export default function useVoiceRecorder(handleFileUpload) {
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const recordingTimerRef = useRef(null);

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

  return { isRecording, recordingDuration, startRecording, stopRecording };
}
