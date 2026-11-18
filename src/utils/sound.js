// Bộ phát âm thanh thông báo, nhạc chuông & quản lý phiên âm thanh cuộc gọi chuẩn Mobile (iOS Safari / Android Chrome) & Desktop.
// Kết hợp:
// 1. navigator.audioSession (iOS 16.4+) để vượt cần gạt im lặng khi đổ chuông ('playback') và định tuyến thu/phát chuẩn khi gọi thoại ('play-and-record').
// 2. Web Audio API + HTML5 Audio WAV PCM mở khóa sẵn ngay từ cú chạm đầu tiên.

let sharedAudioCtx = null;
let wavDataUri = null;
let silentWavUri = null;
let sharedChimeAudio = null;
let isUnlockListenerAttached = false;
let isHtmlAudioWarmedUp = false;
let callRingtoneInterval = null;
let isVoiceCallActive = false;

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function applyAudioSessionType(type) {
  try {
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator && navigator.audioSession) {
      navigator.audioSession.type = type;
    }
  } catch (e) {}
}

/**
 * Chuyển chế độ âm thanh phần cứng trên iOS khi bắt đầu / kết thúc cuộc gọi WebRTC
 */
export function setVoiceCallAudioMode(active) {
  isVoiceCallActive = Boolean(active);
  if (isVoiceCallActive) {
    applyAudioSessionType('play-and-record');
  } else {
    // Đổi về 'auto' rồi 'playback' để xóa sạch cache định tuyến loa thoại bị nghẹt trên iOS WebKit
    applyAudioSessionType('auto');
    setTimeout(() => {
      if (!isVoiceCallActive) {
        applyAudioSessionType('playback');
      }
    }, 60);
  }
}

/**
 * Tạo chuỗi WAV câm cực ngắn (46 bytes) dùng để mở khóa (unlock) thẻ <audio> cuộc gọi ngay trong cử chỉ chạm
 */
export function getSilentWavDataUri() {
  if (silentWavUri) return silentWavUri;
  silentWavUri = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  return silentWavUri;
}

/**
 * Mở khóa quyền tự động phát (autoplay) cho thẻ <audio>/<video> cuộc gọi ngay trong sự kiện click/tap của người dùng.
 * Bắt buộc trên iOS Safari/PWA và Chrome di động để luồng tiếng WebRTC đến sau vài giây không bị chặn (NotAllowedError).
 */
export function primeMediaElement(mediaEl) {
  if (!mediaEl) return;
  try {
    if (!mediaEl.srcObject) {
      const prevMuted = mediaEl.muted;
      mediaEl.muted = true;
      mediaEl.src = getSilentWavDataUri();
      const p = mediaEl.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          if (!mediaEl.srcObject) {
            mediaEl.pause();
            mediaEl.removeAttribute('src');
            mediaEl.load();
          }
          mediaEl.muted = prevMuted;
        }).catch(() => {
          mediaEl.muted = prevMuted;
        });
      } else {
        mediaEl.muted = prevMuted;
      }
    } else {
      mediaEl.play().catch(() => {});
    }
  } catch (e) {}
}

/**
 * Tạo chuỗi Data URI định dạng WAV (16-bit PCM, 44.1kHz) cho tiếng chuông thông báo 2 nốt rõ ràng ("Ding-Dong" hiện đại)
 */
function getNotificationWavDataUri() {
  if (wavDataUri) return wavDataUri;

  const sampleRate = 44100;
  const durationSeconds = 0.58;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // WAV Header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Tổng hợp âm thanh chuông đôi (Note 1: 783.99Hz G5 -> Note 2: 1174.66Hz D6)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (t < 0.16) {
      const env = Math.sin((Math.min(t, 0.012) / 0.012) * (Math.PI / 2)) * Math.exp(-t * 9.5);
      sample =
        (Math.sin(2 * Math.PI * 783.99 * t) * 0.72 +
          Math.sin(2 * Math.PI * 1567.98 * t) * 0.22 +
          Math.sin(2 * Math.PI * 2351.97 * t) * 0.06) *
        env;
    } else {
      const t2 = t - 0.16;
      const env2 = Math.sin((Math.min(t2, 0.012) / 0.012) * (Math.PI / 2)) * Math.exp(-t2 * 7.0);
      sample =
        (Math.sin(2 * Math.PI * 1174.66 * t2) * 0.74 +
          Math.sin(2 * Math.PI * 2349.32 * t2) * 0.2 +
          Math.sin(2 * Math.PI * 3523.98 * t2) * 0.06) *
        env2;
    }

    const clamped = Math.max(-1, Math.min(1, sample * 0.92));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  wavDataUri = 'data:audio/wav;base64,' + window.btoa(binary);
  return wavDataUri;
}

function getSharedChimeAudio() {
  if (typeof window === 'undefined') return null;
  if (!sharedChimeAudio) {
    try {
      sharedChimeAudio = new Audio(getNotificationWavDataUri());
      sharedChimeAudio.preload = 'auto';
      sharedChimeAudio.playsInline = true;
      sharedChimeAudio.volume = 0.95;
    } catch (e) {}
  }
  return sharedChimeAudio;
}

function getOrCreateAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended' || sharedAudioCtx.state === 'interrupted') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Luôn giữ trình lắng nghe cử chỉ người dùng (passive) để tự động đánh thức lại AudioContext
 * sau mỗi lần điện thoại khóa màn hình hoặc chuyển sang ứng dụng khác (iOS Safari 'interrupted' state).
 */
export function initAudioUnlock() {
  if (typeof window === 'undefined' || isUnlockListenerAttached) return;
  isUnlockListenerAttached = true;

  const unlockAndResume = () => {
    try {
      if (!isVoiceCallActive) {
        applyAudioSessionType('playback');
      }

      const ctx = getOrCreateAudioContext();
      if (ctx && ctx.state !== 'running') {
        ctx.resume().catch(() => {});
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }

      // Mở khóa đối tượng HTMLAudioElement dùng chung trên iOS Safari ngay ở cú chạm đầu tiên
      if (!isHtmlAudioWarmedUp) {
        const audio = getSharedChimeAudio();
        if (audio) {
          isHtmlAudioWarmedUp = true;
          audio.muted = true;
          const playPromise = audio.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise
              .then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.muted = false;
              })
              .catch(() => {
                audio.muted = false;
                isHtmlAudioWarmedUp = false;
              });
          } else {
            audio.muted = false;
          }
        }
      }
    } catch (e) {}
  };

  const events = ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'];
  events.forEach((evt) => window.addEventListener(evt, unlockAndResume, { capture: true, passive: true }));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (!isVoiceCallActive) {
        applyAudioSessionType('playback');
      }
      getOrCreateAudioContext();
    }
  });
}

function playWebAudioNotes(ctx) {
  const now = ctx.currentTime;

  // Nốt 1 (G5 - 783.99Hz)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(783.99, now);
  gain1.gain.setValueAtTime(0.001, now);
  gain1.gain.linearRampToValueAtTime(0.48, now + 0.015);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.18);

  // Nốt 2 (D6 - 1174.66Hz)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1174.66, now + 0.14);
  gain2.gain.setValueAtTime(0.001, now + 0.14);
  gain2.gain.linearRampToValueAtTime(0.55, now + 0.16);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.14);
  osc2.stop(now + 0.55);
}

function playFallbackHtmlAudio() {
  try {
    const audio = getSharedChimeAudio();
    if (audio) {
      audio.muted = false;
      audio.volume = 0.95;
      audio.currentTime = 0;
      audio.play().catch(() => {
        const freshAudio = new Audio(getNotificationWavDataUri());
        freshAudio.playsInline = true;
        freshAudio.volume = 0.95;
        freshAudio.play().catch(() => {});
      });
    }
  } catch (e) {}
}

/**
 * Phát âm thanh thông báo rõ ràng + rung nhẹ trên điện thoại khi có tin nhắn / công việc / nhắc hẹn mới
 */
export function playNotificationChime() {
  if (typeof window === 'undefined') return;

  if (!isVoiceCallActive) {
    applyAudioSessionType('playback');
  }

  // Rung điện thoại (chỉ gọi sau khi người dùng đã chạm màn hình ít nhất 1 lần để tránh cảnh báo chặn của Chrome)
  try {
    if ('vibrate' in navigator && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch (e) {}

  try {
    const ctx = getOrCreateAudioContext();
    if (ctx) {
      if (ctx.state === 'running') {
        playWebAudioNotes(ctx);
        if (isIOS() && !isVoiceCallActive) {
          // Bổ trợ kênh Media của iOS phòng trường hợp cần gạt rung bên hông iPhone đang bật
          playFallbackHtmlAudio();
        }
        return;
      }
      ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running') {
            playWebAudioNotes(ctx);
          } else {
            playFallbackHtmlAudio();
          }
        })
        .catch(() => {
          playFallbackHtmlAudio();
        });
      return;
    }
  } catch (e) {}

  playFallbackHtmlAudio();
}

/**
 * Phát nhạc chuông lặp lại khi có cuộc gọi đến (isIncoming = true) hoặc âm chờ khi đang gọi đi (isIncoming = false)
 */
export function startCallRingtone(isIncoming = true) {
  stopCallRingtone();
  if (typeof window === 'undefined') return;

  if (isIncoming && !isVoiceCallActive) {
    applyAudioSessionType('playback');
  }

  const playPulse = () => {
    if (isIncoming) {
      try {
        if ('vibrate' in navigator && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) {
          navigator.vibrate([400, 200, 400]);
        }
      } catch (e) {}
    }

    let playedWebAudio = false;
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx && ctx.state === 'running') {
        const now = ctx.currentTime;
        if (isIncoming) {
          const notes = [783.99, 987.77, 1174.66];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = now + idx * 0.18;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.001, start);
            gain.gain.linearRampToValueAtTime(0.45, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.25);
          });
        } else {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(425, now);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.15, now + 0.03);
          gain.gain.setValueAtTime(0.15, now + 0.7);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.8);
        }
        playedWebAudio = true;
      }
    } catch (e) {}

    // Trên iPhone hoặc khi AudioContext chưa chuyển sang 'running': phát thêm HTML5 Audio WAV cho chuông gọi đến
    if (isIncoming && (!playedWebAudio || isIOS())) {
      playFallbackHtmlAudio();
    }
  };

  playPulse();
  callRingtoneInterval = setInterval(playPulse, isIncoming ? 1800 : 3000);
}

export function stopCallRingtone() {
  if (callRingtoneInterval) {
    clearInterval(callRingtoneInterval);
    callRingtoneInterval = null;
  }
  try {
    if (
      typeof navigator !== 'undefined' &&
      'vibrate' in navigator &&
      (!navigator.userActivation || navigator.userActivation.hasBeenActive)
    ) {
      navigator.vibrate(0);
    }
  } catch (e) {}
}
