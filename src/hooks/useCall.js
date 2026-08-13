import { useState, useCallback } from 'react';

export default function useCall() {
  const [callState, setCallState] = useState('idle'); // 'idle', 'calling', 'incoming', 'connected'
  const [callInfo, setCallInfo] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerInstance, setPeerInstance] = useState(null);

  // Nhận tín hiệu gọi thoại/video từ nút đầu trang chat
  const handleStartCall = useCallback((isVideoCall, activeConversation, user) => {
    if (!activeConversation) return;
    const otherMember = activeConversation.members.find(m => m.user.id !== user.id);
    if (!otherMember) return;

    setCallInfo({
      to: otherMember.user.id,
      from: user.id,
      callerName: otherMember.user.displayName,
      callerAvatar: otherMember.user.avatarUrl,
      isVideo: isVideoCall
    });
    setCallState('calling');
  }, []);

  return {
    callState, setCallState,
    callInfo, setCallInfo,
    localStream, setLocalStream,
    remoteStream, setRemoteStream,
    peerInstance, setPeerInstance,
    handleStartCall,
  };
}
