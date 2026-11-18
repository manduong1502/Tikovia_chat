export const styles = {
  uploadProgressOverlay: {
    padding: '12px 16px',
    background: 'var(--bg-glass-active)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    marginBottom: '10px',
    boxShadow: 'var(--shadow-md)',
    zIndex: 10
  },
  uploadProgressInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  uploadProgressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--primary)'
  },
  uploadProgressTitle: {
    fontSize: '0.85rem'
  },
  uploadProgressTime: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)'
  },
  uploadFileNameText: {
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: '500'
  },
  progressBarWrapper: {
    width: '100%',
    height: '6px',
    backgroundColor: 'var(--border-color)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginTop: '4px'
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'var(--primary)',
    borderRadius: '3px',
    transition: 'width 0.2s ease-out'
  },
  uploadProgressFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginTop: '2px'
  },
  container: {
    padding: '8px 16px 16px 16px',
    borderTop: 'none',
    position: 'relative',
    background: 'transparent',
    flexShrink: 0
  },
  inputBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'var(--bg-glass)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '28px',
    padding: '6px 12px 6px 16px',
    boxShadow: 'var(--shadow-md)',
    transition: 'border-color 0.2s, box-shadow 0.2s'
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color var(--transition-fast)',
    flexShrink: 0
  },
  smileBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color var(--transition-fast)',
    flexShrink: 0
  },
  imageBtn: {
    background: 'var(--btn-image-bg)',
    color: 'var(--btn-image-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: '0',
    flexShrink: 0,
    transition: 'all var(--transition-fast)'
  },
  stagingBar: {
    padding: '10px 14px',
    background: 'var(--bg-glass-active)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    marginBottom: '8px',
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  stagingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px'
  },
  stagingTitle: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  stagingClearBtn: {
    background: 'rgba(244, 63, 94, 0.12)',
    color: 'var(--danger)',
    border: 'none',
    borderRadius: '8px',
    padding: '3px 8px',
    fontSize: '0.72rem',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0
  },
  stagingList: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    overflowX: 'auto',
    paddingBottom: '4px',
    paddingTop: '4px'
  },
  stagingItem: {
    position: 'relative',
    flexShrink: 0
  },
  stagingThumb: {
    width: '62px',
    height: '62px',
    borderRadius: '10px',
    objectFit: 'cover',
    border: '1px solid var(--border-color)',
    display: 'block'
  },
  stagingFileBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '10px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-color)',
    maxWidth: '210px',
    height: '62px',
    boxSizing: 'border-box'
  },
  stagingFileInfo: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0
  },
  stagingFileName: {
    fontSize: '0.76rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  stagingFileSize: {
    fontSize: '0.68rem',
    color: 'var(--text-secondary)'
  },
  stagingRemoveBtn: {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'var(--danger)',
    color: '#ffffff',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
  },
  textInput: {
    flex: 1,
    padding: '6px 0',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    outline: 'none',
    width: '100%',
    resize: 'none',
    fontFamily: 'inherit',
    minHeight: '24px',
    height: '24px',
    maxHeight: '120px',
    lineHeight: '1.45',
    boxSizing: ' content-box'
  },
  sendBtn: {
    background: 'var(--primary-gradient)',
    color: 'white',
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-circle)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
    flexShrink: 0
  },
  // Sticker Popover
  stickerContainer: {
    position: 'absolute',
    bottom: '76px',
    left: '16px',
    width: '320px',
    padding: '16px',
    zIndex: 20,
    background: 'rgba(17, 21, 32, 0.85)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    boxShadow: 'var(--shadow-lg)'
  },
  stickerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
    fontWeight: '600',
    marginBottom: '10px',
    color: 'var(--text-secondary)'
  },
  stickerClose: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  stickerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '8px',
    maxHeight: '220px',
    overflowY: 'auto',
    padding: '4px'
  },
  stickerItem: {
    width: '45px',
    height: '45px',
    objectFit: 'contain',
    cursor: 'pointer',
    transition: 'transform 0.15s ease',
    ':hover': { transform: 'scale(1.15)' }
  },
  stickerTabBar: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
    paddingTop: '8px',
    borderTop: '1px solid var(--border-color)',
    overflowX: 'auto'
  },
  stickerTabBtn: {
    padding: '6px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease'
  },
  stickerTabIcon: {
    width: '24px',
    height: '24px',
    objectFit: 'contain'
  },
  // More options Popover
  moreMenuContainer: {
    position: 'absolute',
    bottom: '76px',
    left: '48px',
    padding: '16px',
    zIndex: 20,
    width: '260px',
    background: 'var(--bg-glass-active)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    boxShadow: 'var(--shadow-lg)'
  },
  moreGrid: {
    display: 'flex',
    justifyContent: 'space-around',
    gap: '10px'
  },
  moreItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer'
  },
  moreIconWrapper: {
    width: '46px',
    height: '46px',
    borderRadius: 'var(--radius-circle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s ease',
    ':hover': { transform: 'scale(1.1)' }
  },
  moreLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)'
  },
  // Mentions Popover
  mentionsContainer: {
    position: 'absolute',
    zIndex: 30,
    width: '220px',
    maxHeight: '180px',
    overflowY: 'auto',
    padding: '8px',
    background: 'rgba(17, 21, 32, 0.85)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-lg)'
  },
  mentionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'all 0.15s ease'
  },
  mentionAvatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%'
  },
  // Voice Recording Panel
  recordingOverlay: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(239, 68, 68, 0.08)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '28px',
    padding: '8px 16px',
    width: '100%',
    justifyContent: 'space-between',
    boxShadow: 'var(--shadow-sm)'
  },
  recordDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: 'var(--danger)',
    animation: 'fadeIn 1s infinite alternate'
  },
  recordTime: {
    color: 'var(--text-primary)',
    fontSize: '0.84rem',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  },
  recordActions: {
    display: 'flex',
    gap: '10px',
    flexShrink: 0
  },
  recordCancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  },
  recordSendBtn: {
    background: 'var(--danger)',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '16px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  },
  // Modals
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100
  },
  modalContent: {
    width: 'calc(100% - 32px)',
    maxWidth: '380px',
    padding: '24px',
    background: 'var(--bg-glass-active)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    boxShadow: 'var(--shadow-lg)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  modalBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  formLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    fontWeight: '600'
  },
  modalInput: {
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'all 0.2s ease'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px'
  },
  btnPrimary: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--primary-gradient)',
    color: 'white',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer'
  },
  btnSecondary: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    fontWeight: '600',
    cursor: 'pointer'
  },
  replyPreviewBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid var(--border-color)',
    borderLeft: '4px solid var(--primary)',
    padding: '8px 16px',
    borderRadius: '14px',
    marginBottom: '8px',
    animation: 'slideDown 0.2s ease'
  },
  replyPreviewInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontSize: '0.8rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1
  },
  replyPreviewTitle: {
    color: 'var(--primary)',
    fontWeight: '500'
  },
  replyPreviewContent: {
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  replyPreviewCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  }
};
