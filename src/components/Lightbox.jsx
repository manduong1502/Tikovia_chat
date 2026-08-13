import React from 'react';

export default function Lightbox({ image, onClose }) {
  if (!image) return null;

  return (
    <div style={styles.overlay} onClick={onClose} className="anim-fade">
      <button 
        style={styles.closeBtn} 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        ✕
      </button>
      <img 
        src={image} 
        alt="Preview" 
        style={styles.img} 
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in"
      />
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'rgba(255, 255, 255, 0.15)',
    border: 'none',
    color: '#ffffff',
    fontSize: '24px',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
    zIndex: 100000,
  },
  img: {
    maxWidth: '90%',
    maxHeight: '90%',
    objectFit: 'contain',
    borderRadius: 'var(--radius-sm)',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
  },
};
