import React, { useState, useEffect } from 'react';

const COLORS = [
  '#4f46e5', // Violet Indigo
  '#0284c7', // Sky Blue
  '#0d9488', // Tech Teal
  '#059669', // Emerald Green
  '#ca8a04', // Golden Yellow
  '#ea580c', // Bright Orange
  '#db2777', // Soft Pink
  '#7c3aed', // Royal Purple
  '#475569', // Slate Grey
];

const getColor = (name) => {
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
};

const getInitials = (name) => {
  if (!name) return 'U';
  const cleanName = name.trim();
  const parts = cleanName.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  // Lấy chữ cái đầu của từ đầu tiên và từ cuối cùng
  const first = parts[0][0] || '';
  const last = parts[parts.length - 1][0] || '';
  return (first + last).toUpperCase();
};

export default function Avatar({ url, name, size = 40, isOnline = false, style = {} }) {
  const [imageError, setImageError] = useState(false);

  // Reset image error status when the URL changes
  useEffect(() => {
    setImageError(false);
  }, [url]);

  const containerStyle = {
    position: 'relative',
    width: `${size}px`,
    height: `${size}px`,
    flexShrink: 0,
    ...style
  };

  const initialsStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    backgroundColor: getColor(name),
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${Math.max(size * 0.38, 11)}px`,
    fontWeight: '700',
    userSelect: 'none',
    border: '1px solid rgba(255, 255, 255, 0.08)'
  };

  const imgStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '1px solid rgba(255, 255, 255, 0.08)'
  };

  const onlineBadgeStyle = {
    position: 'absolute',
    bottom: '0px',
    right: '0px',
    width: `${Math.max(size * 0.28, 8)}px`,
    height: `${Math.max(size * 0.28, 8)}px`,
    borderRadius: '50%',
    backgroundColor: '#10b981', // green status
    border: '2px solid var(--bg-secondary)',
    boxShadow: '0 0 6px rgba(16, 185, 129, 0.4)'
  };

  return (
    <div style={containerStyle}>
      {url && !imageError ? (
        <img
          src={url}
          alt={name || 'Avatar'}
          style={imgStyle}
          onError={() => setImageError(true)}
        />
      ) : (
        <div style={initialsStyle}>
          {getInitials(name)}
        </div>
      )}
      {isOnline && <div style={onlineBadgeStyle} title="Đang hoạt động" />}
    </div>
  );
}
