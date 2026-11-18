import React from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL;

export { API_URL, BASE_URL };

// Quyết định URL tệp hiển thị trực tiếp từ ổ cứng SSD máy chủ (Có kiểm tra chống javascript:/data: XSS)
export const getFileUrl = (content) => {
  if (!content || typeof content !== 'string') return '';
  const trimmed = content.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `${BASE_URL}${trimmed}`;
  }
  return '';
};

// Hàm tạo hiệu ứng bùng nổ tim/like (Particle reaction burst)
export const spawnReactionBurst = (emoji, x, y) => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
  container.style.pointerEvents = 'none';
  container.style.zIndex = '99999';
  document.body.appendChild(container);

  const particleCount = 10;
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('span');
    particle.innerText = emoji;
    particle.style.position = 'absolute';
    particle.style.fontSize = `${16 + Math.random() * 12}px`;
    particle.style.transition = 'all 0.8s cubic-bezier(0.25, 1, 0.5, 1)';
    particle.style.transform = 'translate(-50%, -50%)';
    particle.style.opacity = '1';
    
    container.appendChild(particle);

    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 60;
    const destX = Math.cos(angle) * distance;
    const destY = Math.sin(angle) * distance;

    requestAnimationFrame(() => {
      particle.style.transform = `translate(calc(-50% + ${destX}px), calc(-50% + ${destY}px)) scale(0.3)`;
      particle.style.opacity = '0';
    });
  }

  setTimeout(() => {
    document.body.removeChild(container);
  }, 900);
};

// Bộ nhớ đệm HTML đã định dạng của tin nhắn văn bản (escape + link + @tag) → không phải chạy lại regex mỗi lần vẽ lại danh sách
const formattedTextCache = new Map();
const FORMATTED_TEXT_CACHE_LIMIT = 800;

export function formatMessageTextHtml(content) {
  const key = content || '';
  const cached = formattedTextCache.get(key);
  if (cached !== undefined) return cached;

  const escaped = key
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Đánh dấu đậm các tag @mention trước (chỉ khớp khi đứng đầu câu hoặc sau khoảng trắng để không làm hỏng URL có ký tự @)
  const withMentions = escaped.replace(
    /(^|\s)(@[a-zA-Z0-9À-ỹ_]+(?:\s+[a-zA-Z0-9À-ỹ_]+)?)/g,
    (fullMatch, prefix, mentionPart) =>
      `${prefix}<span style="color: #fca5a5; font-weight: bold; background: rgba(239, 68, 68, 0.1); padding: 2px 4px; border-radius: 4px;">${mentionPart}</span>`
  );

  // Sau đó định dạng liên kết URL an toàn
  const html = withMentions.replace(
    /(https?:\/\/[^\s]+)/g,
    (url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; text-decoration: underline; word-break: break-all;">${url}</a>`
  );

  if (formattedTextCache.size >= FORMATTED_TEXT_CACHE_LIMIT) {
    formattedTextCache.delete(formattedTextCache.keys().next().value);
  }
  formattedTextCache.set(key, html);
  return html;
}

// Helper định dạng ngày phân tách dạng Voz
export const getRelativeDateString = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  
  const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const diffTime = dToday - dDate;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dayName = days[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const dateStr = `${dayName} ${dd}/${mm}/${yyyy}`;
  
  if (diffDays === 0) {
    return `Hôm nay, ${dateStr}`;
  } else if (diffDays === 1) {
    return `Hôm qua, ${dateStr}`;
  } else if (diffDays > 1) {
    return `${dateStr} (${diffDays} ngày trước)`;
  }
  return dateStr;
};

// Get stylized file icon for premium layout (like Zalo/Voz)
export const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  
  let bg = '#64748b';
  let symbol = '📄';
  let fontSize = '16px';
  
  if (['doc', 'docx'].includes(ext)) {
    bg = '#1a5fbb';
    symbol = 'W';
  } else if (['xls', 'xlsx'].includes(ext)) {
    bg = '#107c41';
    symbol = 'X';
  } else if (ext === 'pdf') {
    bg = '#e01b22';
    symbol = 'PDF';
    fontSize = '10px';
  } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    bg = '#7c3aed';
    return (
      <div style={{
        width: '38px',
        height: '46px',
        borderRadius: '6px',
        background: bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontFamily: 'system-ui',
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        flexShrink: 0,
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1px',
          width: '6px',
          margin: '2px 0 1px 0'
        }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ width: '6px', height: '1.5px', background: 'rgba(255,255,255,0.4)', borderRadius: '1px' }} />
          ))}
        </div>
        <span style={{ fontSize: '8px', fontWeight: '800', textTransform: 'uppercase' }}>{ext}</span>
      </div>
    );
  } else if (['ppt', 'pptx'].includes(ext)) {
    bg = '#c43e1c';
    symbol = 'P';
  }
  
  return (
    <div style={{
      width: '38px',
      height: '46px',
      borderRadius: '6px',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      fontFamily: 'system-ui',
      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      flexShrink: 0
    }}>
      <span style={{ fontSize, fontWeight: '800' }}>{symbol}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Bộ nhớ đệm kích thước ảnh (width/height gốc) theo URL → giữ chỗ đúng kích thước trước khi ảnh tải xong,
// tránh khung chat bị "nhảy" trên iPhone (Safari không có scroll anchoring) khi đang đọc tin cũ.
// ---------------------------------------------------------------------------
const IMAGE_DIMS_STORAGE_KEY = 'chat_image_dims_v1';
const IMAGE_DIMS_CACHE_LIMIT = 500;
const IMAGE_MAX_WIDTH_PX = 300;
const IMAGE_MAX_HEIGHT_PX = 360;

const imageDimsCache = (() => {
  const map = new Map();
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(IMAGE_DIMS_STORAGE_KEY) : null;
    if (raw) {
      const entries = JSON.parse(raw);
      if (Array.isArray(entries)) {
        entries.forEach((entry) => {
          if (Array.isArray(entry) && typeof entry[0] === 'string' && entry[1] > 0 && entry[2] > 0) {
            map.set(entry[0], { width: entry[1], height: entry[2] });
          }
        });
      }
    }
  } catch (e) {
    // localStorage không khả dụng (chế độ riêng tư...) hoặc dữ liệu hỏng → bỏ qua
  }
  return map;
})();

let imageDimsPersistTimer = null;

const persistImageDims = () => {
  if (imageDimsPersistTimer) return;
  imageDimsPersistTimer = setTimeout(() => {
    imageDimsPersistTimer = null;
    try {
      const entries = [];
      imageDimsCache.forEach((dims, url) => entries.push([url, dims.width, dims.height]));
      localStorage.setItem(IMAGE_DIMS_STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      // Hết dung lượng / không khả dụng → bỏ qua
    }
  }, 1000);
};

export const rememberImageDims = (url, width, height) => {
  if (!url || !(width > 0) || !(height > 0)) return;
  try {
    const existing = imageDimsCache.get(url);
    if (existing && existing.width === width && existing.height === height) {
      // Đưa lên cuối (mới dùng gần nhất) để LRU giữ lại
      imageDimsCache.delete(url);
      imageDimsCache.set(url, existing);
      return;
    }
    imageDimsCache.delete(url);
    imageDimsCache.set(url, { width, height });
    while (imageDimsCache.size > IMAGE_DIMS_CACHE_LIMIT) {
      imageDimsCache.delete(imageDimsCache.keys().next().value);
    }
    persistImageDims();
  } catch (e) {
    // Bỏ qua lỗi bộ nhớ đệm, không ảnh hưởng hiển thị
  }
};

/**
 * Kích thước hiển thị của ảnh trong bong bóng chat (khớp giới hạn CSS hiện tại: rộng tối đa min(300px, 72vw),
 * cao tối đa 360px, không phóng to ảnh nhỏ). Trả về null nếu chưa biết kích thước gốc.
 */
export const getImageDisplaySize = (metadata, url) => {
  let width = Number(metadata?.width);
  let height = Number(metadata?.height);
  if (!(width > 0) || !(height > 0)) {
    const cached = url ? imageDimsCache.get(url) : null;
    if (!cached) return null;
    width = cached.width;
    height = cached.height;
  }
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : IMAGE_MAX_WIDTH_PX / 0.72;
  const maxWidth = Math.min(IMAGE_MAX_WIDTH_PX, viewportWidth * 0.72);
  const scale = Math.min(1, maxWidth / width, IMAGE_MAX_HEIGHT_PX / height);
  const displayWidth = Math.max(1, Math.round(width * scale));
  const displayHeight = Math.max(1, Math.round(height * scale));
  return { width: displayWidth, height: displayHeight };
};

// Đọc metadata tin nhắn (chuỗi JSON hoặc object)
export const parseMessageMetadata = (msg) => {
  let metadata = {};
  if (msg.metadata) {
    try {
      metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
    } catch (e) {
      console.error('Lỗi parse metadata tin nhắn:', e);
    }
  }
  return metadata;
};
