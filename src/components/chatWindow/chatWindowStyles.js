// Bảng style inline của khung chat (tách từ ChatWindow.jsx)
export const styles = {
  container: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    background: 'var(--bg-chat-gradient)',
    overflow: 'hidden'
  },
  emptyContainer: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    padding: '40px'
  },
  emptyImg: {
    width: '120px',
    height: '120px',
    marginBottom: '20px',
    opacity: 0.6
  },
  header: {
    margin: '16px 16px 8px 16px',
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--bg-glass)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    boxShadow: 'var(--shadow-sm)',
    zIndex: 5,
    flexShrink: 0
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden'
  },
  headerTextCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden'
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '0px',
    padding: '4px',
    flexShrink: 0
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-circle)',
    objectFit: 'cover'
  },
  title: {
    fontSize: '0.95rem',
    fontWeight: '600',
    letterSpacing: '-0.01em',
    margin: 0,
    lineHeight: '1.25',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  status: {
    fontSize: '0.72rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.2',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'block'
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0
  },
  headerBtn: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    width: '38px',
    height: '38px',
    borderRadius: 'var(--radius-circle)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.25s var(--transition-spring)'
  },
  pinBanner: {
    background: 'rgba(0, 122, 255, 0.08)',
    borderBottom: '1px solid var(--border-color)',
    padding: '8px 24px',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.8rem',
    color: 'var(--text-primary)'
  },
  pinText: {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginRight: '12px'
  },
  pinCount: {
    color: 'var(--text-secondary)',
    fontSize: '0.75rem'
  },
  chatFeed: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    WebkitOverflowScrolling: 'touch',
    willChange: 'scroll-position',
    transform: 'translate3d(0, 0, 0)'
  },
  dateSeparator: {
    display: 'flex',
    justifyContent: 'center',
    margin: '12px 0 6px 0',
    width: '100%'
  },
  dateSeparatorText: {
    background: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    padding: '6px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.75rem',
    fontWeight: '500',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-sm)'
  },
  startChat: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    color: 'var(--text-muted)',
    fontSize: '0.85rem'
  },
  messageRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    maxWidth: '82%',
    width: 'fit-content'
  },
  messageAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-circle)',
    marginBottom: '0px',
    flexShrink: 0
  },
  messageContentWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    minWidth: 0,
    maxWidth: '100%'
  },
  senderLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginLeft: '4px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  messageBubble: {
    padding: '10px 14px',
    fontSize: '0.9rem',
    lineHeight: '1.4',
    position: 'relative',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-color)',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    userSelect: 'none'
  },
  messageTime: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    marginTop: '2px'
  },
  stickerImg: {
    width: '100px',
    height: '100px',
    objectFit: 'contain'
  },
  imageWrapper: {
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    maxWidth: 'min(300px, 72vw)',
    maxHeight: '360px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  chatImage: {
    maxWidth: '100%',
    maxHeight: '360px',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    borderRadius: 'var(--radius-md)'
  },
  fileBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--bg-surface)',
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    width: 'min(240px, 68vw)',
    maxWidth: '100%',
    boxSizing: 'border-box'
  },
  fileIcon: {
    fontSize: '1.5rem'
  },
  fileDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0
  },
  fileName: {
    fontSize: '0.8rem',
    fontWeight: '600',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  fileSize: {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)'
  },
  fileDownload: {
    color: 'var(--primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  voiceBox: {
    width: 'min(230px, 64vw)',
    maxWidth: '100%',
    padding: '2px',
    boxSizing: 'border-box'
  },
  voiceAudio: {
    width: '100%',
    height: '32px'
  },
  locationBox: {
    width: 'min(260px, 70vw)',
    maxWidth: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden'
  },
  locationHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '6px',
    fontSize: '0.85rem',
    whiteSpace: 'nowrap'
  },
  reminderBox: {
    width: 'min(240px, 68vw)',
    maxWidth: '100%',
    boxSizing: 'border-box',
    background: 'var(--bg-surface)',
    borderLeft: '3px solid var(--accent)',
    padding: '8px 12px',
    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
  },
  reminderHeader: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.8rem',
    whiteSpace: 'nowrap'
  },
  bubbleWrapper: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    gap: '8px',
    maxWidth: '100%',
    minWidth: 0
  },
  actionPopover: {
    position: 'absolute',
    background: 'rgba(17, 21, 32, 0.85)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    boxShadow: '0 16px 40px -8px rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '240px',
    animation: 'slideUp 0.15s ease'
  },
  popoverEmojisRow: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingBottom: '6px',
    borderBottom: '1px solid rgba(255,255,255,0.08)'
  },
  popoverEmojiBtn: {
    border: 'none',
    fontSize: '1.25rem',
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s var(--transition-spring)'
  },
  popoverActionsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  popoverActionItem: {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    textAlign: 'left',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '0.82rem',
    cursor: 'pointer',
    width: '100%',
    transition: 'background 0.2s ease',
    ':hover': {
      background: 'rgba(255,255,255,0.05)'
    }
  },
  replyContext: {
    borderRadius: '8px 8px 4px 4px',
    padding: '6px 10px',
    marginBottom: '6px',
    fontSize: '0.75rem',
    borderLeft: '2px solid var(--primary)',
    maxWidth: '100%',
    overflow: 'hidden'
  },
  replyContextTitle: {
    fontWeight: 'bold',
    marginBottom: '2px',
    color: 'var(--primary)'
  },
  replyContextBody: {
    opacity: 0.8,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap'
  },
  reactionsWrapper: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '2px'
  },
  reactionBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '2px 6px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    transition: 'background 0.15s ease'
  },
  reactionCount: {
    fontWeight: 'bold',
    color: 'var(--text-secondary)',
    fontSize: '0.7rem'
  },
  hoverMenuBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px 8px',
    fontSize: '1.1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-circle)',
    transition: 'all var(--transition-fast)'
  },
  callCardContainer: {
    width: 'min(235px, 68vw)',
    maxWidth: '100%',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box'
  },
  callCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%'
  },
  callCardIconContainer: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  callCardText: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flex: 1
  },
  callCardTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden'
  },
  callCardSubtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden'
  },
  callCardBtn: {
    width: '100%',
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid rgba(99, 102, 241, 0.15)',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    color: 'var(--primary)',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer',
    textAlign: 'center',
    marginTop: '12px',
    transition: 'background-color 0.2s',
    display: 'block',
    boxSizing: 'border-box'
  },
  loadingOlder: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '4px',
    padding: '12px',
    color: 'var(--text-secondary)'
  },
  taskCardContainer: {
    width: 'min(265px, 72vw)',
    maxWidth: '100%',
    padding: '12px 14px 12px 10px',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    gap: '8px'
  },
  taskCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
    width: '100%'
  },
  taskCardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
    minWidth: 0
  },
  taskCardTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  taskCardStatusBadge: {
    fontSize: '0.7rem',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '10px',
    whiteSpace: 'nowrap',
    flexShrink: 0
  },
  taskCardDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: '1.3',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: 'var(--bg-primary)',
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)'
  },
  taskCardMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '6px'
  },
  taskCardMetaItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem'
  },
  taskCardMetaLabel: {
    color: 'var(--text-muted)'
  },
  taskCardMetaVal: {
    color: 'var(--text-secondary)',
    fontWeight: '500'
  },
  taskCardActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '6px'
  },
  taskCardBtnPrimary: {
    flex: 1,
    padding: '6px 8px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    fontWeight: '600',
    fontSize: '0.75rem',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease'
  },
  taskCardBtnSuccess: {
    flex: 1,
    padding: '6px 8px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'var(--secondary)',
    color: '#ffffff',
    fontWeight: '600',
    fontSize: '0.75rem',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease'
  },
  taskCardBtnDanger: {
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--danger-light)',
    color: 'var(--danger)',
    fontWeight: '600',
    fontSize: '0.75rem',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease'
  },
  voicePlayerContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    padding: '2px 4px',
    boxSizing: 'border-box'
  },
  voicePlayBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0
  },
  voiceTimeline: {
    flex: 1,
    minWidth: 0,
    height: '24px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    overflow: 'hidden'
  },
  voiceWaveContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    width: '100%',
    minWidth: 0,
    height: '100%'
  },
  voiceWaveBar: {
    flex: 1,
    minWidth: '2px',
    borderRadius: '2px',
    transition: 'all 0.1s ease'
  },
  voiceDuration: {
    fontSize: '0.74rem',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    minWidth: '34px',
    textAlign: 'right',
    flexShrink: 0,
    whiteSpace: 'nowrap'
  },
  searchBarContainer: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    background: 'var(--bg-glass-active)',
    borderBottom: '1px solid var(--border-color)',
    gap: '12px',
    position: 'relative',
    zIndex: 9
  },
  searchBarIcon: {
    color: 'var(--text-secondary)',
    flexShrink: 0
  },
  searchBarInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
    outline: 'none'
  },
  searchBarNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0
  },
  searchBarCount: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    minWidth: '50px',
    textAlign: 'center'
  },
  searchBarNavBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
    opacity: 0.8
  },
  searchBarCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '50%'
  },
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
    zIndex: 1000
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
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px'
  },
  modalBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  modalInput: {
    padding: '10px 12px',
    borderRadius: '12px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
    outline: 'none',
    transition: 'all 0.2s ease',
    width: '100%',
    boxSizing: 'border-box'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px'
  },
  btnPrimary: {
    padding: '10px 16px',
    borderRadius: '12px',
    background: 'var(--primary-gradient)',
    color: 'white',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.85rem'
  },
  btnSecondary: {
    padding: '10px 16px',
    borderRadius: '12px',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.85rem'
  },
  inlineActionBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '5px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease'
  }
};
