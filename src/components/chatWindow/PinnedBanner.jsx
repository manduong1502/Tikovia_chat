import React from 'react';
import { BsPinAngle } from 'react-icons/bs';
import { styles } from './chatWindowStyles';

// Dải hiển thị tin nhắn được ghim mới nhất
export default function PinnedBanner({ pinnedMessages }) {
  if (!pinnedMessages || pinnedMessages.length === 0) return null;
  const lastPinned = pinnedMessages[pinnedMessages.length - 1];

  return (
    <div style={styles.pinBanner}>
      <BsPinAngle size={14} style={{color: 'var(--primary)', transform: 'rotate(45deg)', marginRight: '8px'}} />
      <div style={styles.pinText}>
        <strong>Tin ghim: </strong>
        {lastPinned.type === 'text' 
          ? lastPinned.content 
          : `[${lastPinned.type.toUpperCase()}]`}
      </div>
      <span style={styles.pinCount}>{pinnedMessages.length} tin</span>
    </div>
  );
}
