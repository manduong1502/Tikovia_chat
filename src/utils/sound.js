// Bộ phát âm thanh thông báo chuẩn Mobile (iOS Safari / Android Chrome) & Desktop
// Kết hợp Web Audio API (Singleton được mở khóa qua cử chỉ chạm đầu tiên) + HTML5 Audio WAV PCM dự phòng

let sharedAudioCtx = null;
let wavDataUri = null;
let isAudioUnlocked = false;

/**
 * Tạo chuỗi Data URI định dạng WAV (16-bit PCM, 44.1kHz) cho tiếng chuông thông báo 2 nốt rõ ràng ("Ding-Dong" hiện đại)
 * Giúp phát được qua thẻ <audio> chuẩn kể cả khi Web Audio API bị giới hạn trên một số trình duyệt di động.
 */
function getNotificationWavDataUri() {
  if (wavDataUri) return wavDataUri;

  const sampleRate = 44100;
  const durationSeconds = 0.55;
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
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // Audio format 1 = PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Tổng hợp âm thanh chuông đôi (Note 1: 783.99Hz G5 -> Note 2: 1174.66Hz D6)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (t < 0.16) {
      // Nốt 1: G5 (784 Hz) kèm họa âm bậc 2
      const env = Math.sin((Math.min(t, 0.015) / 0.015) * (Math.PI / 2)) * Math.exp(-t * 10);
      sample = (Math.sin(2 * Math.PI * 783.99 * t) * 0.75 + Math.sin(2 * Math.PI * 1567.98 * t) * 0.25) * env;
    } else {
      // Nốt 2: D6 (1174.66 Hz) ngân vang rõ ràng
      const t2 = t - 0.16;
      const env2 = Math.sin((Math.min(t2, 0.015) / 0.015) * (Math.PI / 2)) * Math.exp(-t2 * 7.5);
      sample = (Math.sin(2 * Math.PI * 1174.66 * t2) * 0.75 + Math.sin(2 * Math.PI * 2349.32 * t2) * 0.25) * env2;
    }

    const clamped = Math.max(-1, Math.min(1, sample * 0.85));
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

/**
 * Mở khóa AudioContext & HTML5 Audio ngay ở cử chỉ chạm/click đầu tiên của người dùng trên điện thoại
 */
export function initAudioUnlock() {
  if (typeof window === 'undefined' || isAudioUnlocked) return;

  const unlock = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
          sharedAudioCtx = new AudioCtx();
        }
        if (sharedAudioCtx.state === 'suspended') {
          sharedAudioCtx.resume().catch(() => {});
        }
        // Phát 1 xung im lặng cực ngắn để iOS Safari mở khóa hoàn toàn kênh âm thanh
        const buffer = sharedAudioCtx.createBuffer(1, 1, 22050);
        const source = sharedAudioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(sharedAudioCtx.destination);
        source.start(0);
      }

      // Khởi tạo sẵn WAV data URI
      getNotificationWavDataUri();
      isAudioUnlocked = true;
    } catch (e) {}
  };

  const events = ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'];
  const handler = () => {
    unlock();
    if (sharedAudioCtx && sharedAudioCtx.state === 'running') {
      events.forEach((evt) => window.removeEventListener(evt, handler, true));
    }
  };

  events.forEach((evt) => window.addEventListener(evt, handler, { capture: true, passive: true }));
}

/**
 * Phát âm thanh thông báo rõ ràng + rung nhẹ trên điện thoại khi có tin nhắn / công việc / nhắc hẹn mới
 */
export function playNotificationChime() {
  if (typeof window === 'undefined') return;

  // Rung điện thoại (Android hỗ trợ navigator.vibrate)
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch (e) {}

  let playedViaWebAudio = false;

  // 1. Ưu tiên phát qua Web Audio API nếu AudioContext đang hoạt động
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
        sharedAudioCtx = new AudioCtx();
      }
      if (sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {});
      }

      if (sharedAudioCtx.state === 'running') {
        const now = sharedAudioCtx.currentTime;

        // Nốt 1 (G5 - 784Hz)
        const osc1 = sharedAudioCtx.createOscillator();
        const gain1 = sharedAudioCtx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(783.99, now);
        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.linearRampToValueAtTime(0.42, now + 0.015);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc1.connect(gain1);
        gain1.connect(sharedAudioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.18);

        // Nốt 2 (D6 - 1174.66Hz)
        const osc2 = sharedAudioCtx.createOscillator();
        const gain2 = sharedAudioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1174.66, now + 0.14);
        gain2.gain.setValueAtTime(0.001, now + 0.14);
        gain2.gain.linearRampToValueAtTime(0.48, now + 0.16);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
        osc2.connect(gain2);
        gain2.connect(sharedAudioCtx.destination);
        osc2.start(now + 0.14);
        osc2.stop(now + 0.52);

        playedViaWebAudio = true;
      }
    }
  } catch (e) {}

  // 2. Dự phòng phát qua HTML5 Audio (WAV PCM) nếu Web Audio chưa kịp resume
  if (!playedViaWebAudio) {
    try {
      const uri = getNotificationWavDataUri();
      const audio = new Audio(uri);
      audio.volume = 0.9;
      audio.play().catch(() => {});
    } catch (e) {}
  }
}
