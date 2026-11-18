import React from 'react';
import { FiSearch, FiChevronUp, FiChevronDown, FiX } from 'react-icons/fi';
import { styles } from './chatWindowStyles';

// Thanh tìm kiếm tin nhắn trong phòng chat
export default function ChatSearchBar({
  searchQuery,
  setSearchQuery,
  matchCount,
  activeSearchIndex,
  onPrev,
  onNext,
  onClose
}) {
  return (
    <div style={styles.searchBarContainer} className="glass-card anim-slide-down">
      <FiSearch size={16} style={styles.searchBarIcon} />
      <input 
        type="text"
        placeholder="Tìm từ khóa trong tin nhắn..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={styles.searchBarInput}
        autoFocus
      />
      {searchQuery.trim() && (
        <div style={styles.searchBarNav}>
          <span style={styles.searchBarCount}>
            {matchCount > 0 ? `${activeSearchIndex + 1}/${matchCount}` : '0 kết quả'}
          </span>
          <button 
            onClick={onPrev} 
            disabled={matchCount <= 1}
            style={styles.searchBarNavBtn}
            className="btn-interactive"
            title="Tin nhắn cũ hơn"
          >
            <FiChevronUp size={16} />
          </button>
          <button 
            onClick={onNext} 
            disabled={matchCount <= 1}
            style={styles.searchBarNavBtn}
            className="btn-interactive"
            title="Tin nhắn mới hơn"
          >
            <FiChevronDown size={16} />
          </button>
        </div>
      )}
      <button 
        onClick={onClose} 
        style={styles.searchBarCloseBtn}
        className="btn-interactive"
      >
        <FiX size={16} />
      </button>
    </div>
  );
}
