import { useState, useCallback, useRef } from 'react';
import { primeMediaElement } from '../utils/sound';

export default function useCall() {
  const [callState, setCallState] = useState('idle'); // 'idle', 'calling', 'incoming', 'connected'
  const [callInfo, setCallInfo] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerInstance, setPeerInstance] = useState(null);
  const remoteAudioRef = useRef(null);

  // Nhận tín hiệu gọi thoại/video trực tiếp từ cử chỉ bấm nút của người dùng
  const handleStartCall = useCallback((isVideoCall, activeConversation, user) => {
    if (!activeConversation || !user) return;
    const otherMember = activeConversation.members?.find((m) => m.user?.id !== user.id);
    if (!otherMember?.user) return;

    // Mở khóa quyền phát âm thanh của thẻ <audio> cuộc gọi NGAY TRONG CỬ CHỈ CHẠM (bắt buộc trên iOS Safari/PWA)
    primeMediaElement(remoteAudioRef.current);

    setCallInfo({
      to: otherMember.user.id,
      from: user.id,
      callerName: otherMember.nickname || otherMember.user.displayName,
      callerAvatar: otherMember.user.avatarUrl,
      isVideo: Boolean(isVideoCall),
      conversationId: activeConversation.id
    });
    setCallState('calling');
  }, []);

  return {
    callState,
    setCallState,
    callInfo,
    setCallInfo,
    localStream,
    setLocalStream,
    remoteStream,
    setRemoteStream,
    peerInstance,
    setPeerInstance,
    remoteAudioRef,
    handleStartCall
  };
}
