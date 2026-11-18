import Avatar from '../Avatar';
import { styles } from './chatInputStyles';

export default function MentionList({ mentionFilteredMembers, mentionCoords, mentionIndex, handleSelectMention }) {
  return (
    <div style={{...styles.mentionsContainer, bottom: mentionCoords.bottom, left: mentionCoords.left}} className="glass-card mentions-popover">
      {mentionFilteredMembers.map((m, idx) => (
        <div 
          key={m.user.id} 
          onClick={() => handleSelectMention(m)}
          style={{
            ...styles.mentionItem,
            background: idx === mentionIndex ? 'rgba(0,122,255,0.1)' : 'transparent'
          }}
        >
          <Avatar url={m.user.avatarUrl} name={m.user.displayName} size={24} />
          <span>{m.user.displayName}</span>
        </div>
      ))}
    </div>
  );
}
