import React, { useEffect, useRef, useState } from 'react';
import { styles } from './chatWindowStyles';

// Component Trình phát Tin nhắn thoại (Voice Message Player) thiết kế tùy chỉnh cao cấp
const VoiceMessagePlayer = React.memo(({ audioUrl }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    // Kiểm tra định kỳ thời lượng nếu metadata load chậm (nhất là trên Chrome di động)
    const durationInterval = setInterval(() => {
      if (audio.duration && isFinite(audio.duration) && duration === 0) {
        setDuration(audio.duration);
        clearInterval(durationInterval);
      }
    }, 500);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      clearInterval(durationInterval);
    };
  }, [duration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(e => console.error("Error playing audio:", e));
      setIsPlaying(true);
    }
  };

  const handleProgressBarClick = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    audio.currentTime = percent * duration;
    setCurrentTime(audio.currentTime);
  };

  const formatDuration = (secs) => {
    if (isNaN(secs) || !isFinite(secs)) return '00:00';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div style={styles.voicePlayerContainer}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <button 
        onClick={togglePlay} 
        style={styles.voicePlayBtn} 
        className="btn-interactive"
        type="button"
      >
        {isPlaying ? (
          // Pause Icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="4" width="4" height="16" rx="1" />
            <rect x="16" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          // Play Icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      
      <div style={styles.voiceTimeline} onClick={handleProgressBarClick}>
        <div style={styles.voiceWaveContainer}>
          {[10, 16, 12, 22, 14, 8, 18, 12, 20, 10, 16, 12, 14, 10, 18, 12].map((h, i, arr) => {
            const isPlayed = duration ? (currentTime / duration) > (i / arr.length) : false;
            return (
              <div 
                key={i} 
                style={{
                  ...styles.voiceWaveBar, 
                  height: `${h}px`,
                  backgroundColor: isPlayed ? 'var(--primary)' : 'var(--text-secondary)',
                  opacity: isPlayed ? 1 : 0.35
                }} 
              />
            );
          })}
        </div>
      </div>
      
      <span style={styles.voiceDuration}>
        {isPlaying ? formatDuration(currentTime) : formatDuration(duration || 0)}
      </span>
    </div>
  );
});

export default VoiceMessagePlayer;
