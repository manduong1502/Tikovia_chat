import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  FiPhoneOff,
  FiVideo,
  FiVideoOff,
  FiMic,
  FiMicOff,
  FiVolume2,
  FiVolumeX,
  FiRefreshCw
} from 'react-icons/fi';
import Avatar from './Avatar';
import {
  startCallRingtone,
  stopCallRingtone,
  primeMediaElement,
  setVoiceCallAudioMode
} from '../utils/sound';

function getIceServers() {
  const defaults = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ];
  try {
    const raw = import.meta.env.VITE_ICE_SERVERS;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return [...parsed, ...defaults];
      }
    }
  } catch (e) {}
  return defaults;
}

async function acquireUserMedia(isVideo) {
  const preferredConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: isVideo
      ? {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      : false
  };

  try {
    return await navigator.mediaDevices.getUserMedia(preferredConstraints);
  } catch (firstErr) {
    // Dự phòng tối giản nếu thiết bị di động kén tham số ràng buộc camera/mic
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: Boolean(isVideo)
    });
  }
}

export default function VideoCall({
  user,
  socket,
  callState, // 'idle', 'calling', 'incoming', 'connected'
  setCallState,
  callInfo, // { from, to, callerName, callerAvatar, isVideo, conversationId, callerSocketId }
  setCallInfo,
  localStream,
  setLocalStream,
  remoteStream,
  setRemoteStream,
  remoteAudioRef: externalAudioRef,
  conversation
}) {
  const internalAudioRef = useRef(null);
  const remoteAudioRef = externalAudioRef || internalAudioRef;
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const pcRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const remoteMediaStreamRef = useRef(null);
  const remoteSocketIdRef = useRef(null);
  const iceRestartCountRef = useRef(0);
  const startingCallRef = useRef(false);
  const isCleaningUpRef = useRef(false);

  const callStartTimeRef = useRef(null);
  const callWasConnectedRef = useRef(false);

  // Lưu trữ các state vào refs để tránh stale closures trong callback WebRTC & Socket
  const conversationRef = useRef(conversation);
  const callInfoRef = useRef(callInfo);
  const localStreamRef = useRef(localStream);
  const callStateRef = useRef(callState);
  const speakerOnRef = useRef(true);
  const cleanupCallRef = useRef(null);

  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [durationText, setDurationText] = useState('00:00');
  const [speakerOn, setSpeakerOn] = useState(true);
  const [mediaLinkState, setMediaLinkState] = useState('connecting'); // 'connecting' | 'connected' | 'reconnecting' | 'failed'
  const [facingMode, setFacingMode] = useState('user');

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    callInfoRef.current = callInfo;
  }, [callInfo]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    speakerOnRef.current = speakerOn;
  }, [speakerOn]);

  const getOtherUserId = useCallback((infoOverride = null) => {
    const info = infoOverride || callInfoRef.current;
    if (!info) return null;
    if (info.to && (!info.from || info.from === user?.id)) {
      return info.to;
    }
    return info.from;
  }, [user?.id]);

  // Gắn luồng tiếng/hình của đối phương vào thẻ <audio> (luôn gắn sẵn trong DOM) và <video>
  const attachRemoteStream = useCallback((stream) => {
    if (!stream) return;

    const audioEl = remoteAudioRef.current;
    if (audioEl) {
      if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
      }
      audioEl.muted = !speakerOnRef.current;
      audioEl.volume = 1.0;
      audioEl.play().catch((err) => {
        console.warn('[WebRTC] Chờ tương tác để phát âm thanh cuộc gọi:', err?.message || err);
      });
    }

    const videoEl = remoteVideoRef.current;
    if (videoEl && callInfoRef.current?.isVideo) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      // Âm thanh đã phát qua remoteAudioRef đã mở khóa sẵn -> tắt tiếng thẻ video để không bao giờ bị chặn autoplay hay dội tiếng kép
      videoEl.muted = true;
      videoEl.play().catch(() => {});
    }
  }, [remoteAudioRef]);

  // Đồng bộ thời lượng cuộc gọi (00:00)
  useEffect(() => {
    let interval;
    if (callState === 'connected') {
      interval = setInterval(() => {
        if (!callStartTimeRef.current) return;
        const sec = Math.max(0, Math.round((Date.now() - callStartTimeRef.current) / 1000));
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        setDurationText(`${m}:${s}`);
      }, 1000);
    } else {
      setDurationText('00:00');
    }
    return () => clearInterval(interval);
  }, [callState]);

  // Gắn luồng camera cục bộ
  useEffect(() => {
    const video = localVideoRef.current;
    if (localStream && video && callInfo?.isVideo) {
      if (video.srcObject !== localStream) {
        video.srcObject = localStream;
      }
      video.muted = true;
      video.play().catch(() => {});
    }
  }, [localStream, callState, callInfo?.isVideo]);

  // Đảm bảo gắn lại stream đối phương khi UI chuyển trạng thái
  useEffect(() => {
    if (remoteStream && callState === 'connected') {
      attachRemoteStream(remoteStream);
    }
  }, [remoteStream, callState, attachRemoteStream]);

  // Nhạc chuông gọi đến / âm hồi chuông gọi đi
  useEffect(() => {
    if (callState === 'incoming') {
      startCallRingtone(true);
    } else if (callState === 'calling') {
      startCallRingtone(false);
    } else {
      stopCallRingtone();
    }
    return () => {
      stopCallRingtone();
    };
  }, [callState]);

  // Tự động hủy cuộc gọi nếu không bắt máy sau 45 giây
  useEffect(() => {
    if (callState === 'calling' || callState === 'incoming') {
      const timer = setTimeout(() => {
        const currentCallInfo = callInfoRef.current;
        if (callStateRef.current === 'calling' && currentCallInfo?.to && socket) {
          socket.emit('end-call', { to: currentCallInfo.to });
        }
        cleanupCallRef.current?.();
      }, 45000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [callState, socket]);

  const flushPendingIceCandidates = useCallback(async (pc) => {
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) return;
    const queued = pendingIceCandidatesRef.current.splice(0);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] Bỏ qua ICE candidate cũ:', err?.message || err);
      }
    }
  }, []);

  const triggerIceRestart = useCallback(async () => {
    const pc = pcRef.current;
    const targetUserId = getOtherUserId();
    if (!pc || !socket || !targetUserId || pc.signalingState === 'closed') return;
    try {
      setMediaLinkState('reconnecting');
      const offer = await pc.createOffer({
        iceRestart: true,
        offerToReceiveAudio: true,
        offerToReceiveVideo: Boolean(callInfoRef.current?.isVideo)
      });
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-signal', {
        to: targetUserId,
        targetSocketId: remoteSocketIdRef.current || null,
        signal: {
          type: 'offer',
          sdp: pc.localDescription
        }
      });
    } catch (err) {
      console.warn('[WebRTC] Lỗi thử kết nối lại ICE:', err);
    }
  }, [getOtherUserId, socket]);

  // Khởi tạo kết nối RTCPeerConnection thuần chuẩn trình duyệt (không qua máy chủ trung gian 0.peerjs.com)
  const createPeerConnection = useCallback(
    (targetUserId, stream, targetSocketId = null) => {
      if (pcRef.current) {
        try {
          pcRef.current.onicecandidate = null;
          pcRef.current.ontrack = null;
          pcRef.current.oniceconnectionstatechange = null;
          pcRef.current.onconnectionstatechange = null;
          pcRef.current.close();
        } catch (e) {}
        pcRef.current = null;
      }

      if (targetSocketId) {
        remoteSocketIdRef.current = targetSocketId;
      }

      const combinedRemoteStream = new MediaStream();
      remoteMediaStreamRef.current = combinedRemoteStream;
      setMediaLinkState('connecting');

      const pc = new RTCPeerConnection({
        iceServers: getIceServers(),
        iceCandidatePoolSize: 4
      });

      if (stream) {
        stream.getTracks().forEach((track) => {
          track.enabled = true;
          pc.addTrack(track, stream);
        });
      }

      pc.ontrack = (event) => {
        let outStream = remoteMediaStreamRef.current;
        if (!outStream) {
          outStream = new MediaStream();
          remoteMediaStreamRef.current = outStream;
        }
        if (event.track && !outStream.getTracks().some((t) => t.id === event.track.id)) {
          outStream.addTrack(event.track);
        }
        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach((t) => {
            if (!outStream.getTracks().some((existing) => existing.id === t.id)) {
              outStream.addTrack(t);
            }
          });
        }

        setRemoteStream(outStream);
        attachRemoteStream(outStream);

        if (!callStartTimeRef.current) {
          callStartTimeRef.current = Date.now();
        }
        callWasConnectedRef.current = true;
        setMediaLinkState('connected');
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket && targetUserId) {
          socket.emit('webrtc-signal', {
            to: targetUserId,
            targetSocketId: remoteSocketIdRef.current || null,
            signal: {
              type: 'candidate',
              candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate
            }
          });
        }
      };

      const handleStateCheck = () => {
        const iceState = pc.iceConnectionState;
        const connState = pc.connectionState;

        if (iceState === 'connected' || iceState === 'completed' || connState === 'connected') {
          iceRestartCountRef.current = 0;
          callWasConnectedRef.current = true;
          if (!callStartTimeRef.current) {
            callStartTimeRef.current = Date.now();
          }
          setMediaLinkState('connected');
          if (remoteAudioRef.current?.paused && remoteAudioRef.current?.srcObject) {
            remoteAudioRef.current.play().catch(() => {});
          }
        } else if (iceState === 'disconnected') {
          setMediaLinkState('reconnecting');
        } else if (iceState === 'failed' || connState === 'failed') {
          const isCaller = callInfoRef.current?.from === user?.id;
          if (isCaller && iceRestartCountRef.current < 2) {
            iceRestartCountRef.current += 1;
            triggerIceRestart();
          } else {
            setMediaLinkState('failed');
          }
        }
      };

      pc.oniceconnectionstatechange = handleStateCheck;
      pc.onconnectionstatechange = handleStateCheck;

      pcRef.current = pc;
      return pc;
    },
    [attachRemoteStream, remoteAudioRef, setRemoteStream, socket, triggerIceRestart, user?.id]
  );

  // Bắt đầu cuộc gọi đi (Caller)
  const startOutgoingCall = useCallback(
    async (isVideoCall) => {
      if (startingCallRef.current || !socket || !callInfoRef.current?.to) return;
      startingCallRef.current = true;

      try {
        const stream = await acquireUserMedia(isVideoCall);
        // Nếu người dùng đã bấm cúp máy trong lúc trình duyệt đang hỏi quyền mic/camera
        if (callStateRef.current !== 'calling') {
          stream.getTracks().forEach((t) => t.stop());
          startingCallRef.current = false;
          return;
        }

        setVoiceCallAudioMode(true);
        localStreamRef.current = stream;
        setLocalStream(stream);
        setMicEnabled(true);
        setVideoEnabled(Boolean(isVideoCall));

        const info = callInfoRef.current;
        const targetConversationId = info?.conversationId || conversationRef.current?.id;
        socket.emit('call-user', {
          userToCall: info.to,
          from: user.id,
          callerName: user.displayName,
          callerAvatar: user.avatarUrl,
          isVideo: Boolean(isVideoCall),
          conversationId: targetConversationId
        });
      } catch (e) {
        console.error('[WebRTC] Không thể mở micro/camera khi gọi đi:', e);
        alert('Không thể mở micro hoặc camera. Vui lòng kiểm tra quyền truy cập Micro trên điện thoại: ' + e.message);
        cleanupCallRef.current?.();
      } finally {
        startingCallRef.current = false;
      }
    },
    [setLocalStream, socket, user]
  );

  useEffect(() => {
    if (callState === 'calling' && callInfo?.to && !localStream && !startingCallRef.current) {
      startOutgoingCall(callInfo.isVideo);
    }
  }, [callState, callInfo, localStream, startOutgoingCall]);

  // Lắng nghe tín hiệu cuộc gọi & WebRTC SDP/ICE qua Socket.io
  useEffect(() => {
    if (!socket) return undefined;

    const onIncomingCall = (data) => {
      if (callStateRef.current !== 'idle') return;
      remoteSocketIdRef.current = data?.callerSocketId || null;
      pendingIceCandidatesRef.current = [];
      setCallInfo(data);
      setCallState('incoming');
    };

    const onCallStatusSync = (data) => {
      const { hasActiveCall, callData } = data || {};
      if (hasActiveCall && callData) {
        if (callStateRef.current === 'idle') {
          remoteSocketIdRef.current = callData?.callerSocketId || null;
          setCallInfo(callData);
          setCallState('incoming');
        }
      } else if (callStateRef.current !== 'idle') {
        cleanupCallRef.current?.();
      }
    };

    const onCallAccepted = async (acceptedSignal) => {
      stopCallRingtone();
      const responderSocketId =
        acceptedSignal && typeof acceptedSignal === 'object' ? acceptedSignal.responderSocketId : null;
      if (responderSocketId) {
        remoteSocketIdRef.current = responderSocketId;
      }

      callWasConnectedRef.current = true;
      callStartTimeRef.current = Date.now();
      setCallState('connected');

      const targetUserId = getOtherUserId();
      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await acquireUserMedia(callInfoRef.current?.isVideo);
          setVoiceCallAudioMode(true);
          localStreamRef.current = stream;
          setLocalStream(stream);
        } catch (err) {
          console.error('[WebRTC] Lỗi lấy micro phía người gọi:', err);
          cleanupCallRef.current?.();
          return;
        }
      }

      if (!targetUserId) return;

      try {
        const pc = createPeerConnection(targetUserId, stream, responderSocketId);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: Boolean(callInfoRef.current?.isVideo)
        });
        await pc.setLocalDescription(offer);

        socket.emit('webrtc-signal', {
          to: targetUserId,
          targetSocketId: responderSocketId || null,
          signal: {
            type: 'offer',
            sdp: pc.localDescription
          }
        });
      } catch (err) {
        console.error('[WebRTC] Lỗi tạo SDP Offer:', err);
      }
    };

    const onWebrtcSignal = async ({ from, fromSocketId, signal } = {}) => {
      if (!signal || !from) return;
      if (fromSocketId) {
        remoteSocketIdRef.current = fromSocketId;
      }

      try {
        if (signal.type === 'offer') {
          let pc = pcRef.current;
          if (!pc || pc.signalingState === 'closed') {
            pc = createPeerConnection(from, localStreamRef.current, fromSocketId);
          }

          // Xử lý va chạm gói Offer (glare) hoặc ICE restart mượt mà
          if (pc.signalingState !== 'stable') {
            await Promise.all([
              pc.setLocalDescription({ type: 'rollback' }).catch(() => {}),
              pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
            ]);
          } else {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          }

          await flushPendingIceCandidates(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('webrtc-signal', {
            to: from,
            targetSocketId: fromSocketId || null,
            signal: {
              type: 'answer',
              sdp: pc.localDescription
            }
          });
        } else if (signal.type === 'answer') {
          const pc = pcRef.current;
          if (!pc || pc.signalingState === 'closed') return;
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            await flushPendingIceCandidates(pc);
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          const pc = pcRef.current;
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            pendingIceCandidatesRef.current.push(signal.candidate);
          }
        }
      } catch (err) {
        console.warn('[WebRTC] Lỗi xử lý tín hiệu WebRTC:', err);
      }
    };

    const onCallEndedByPeer = () => {
      cleanupCallRef.current?.();
    };

    const onCallFailed = (data) => {
      alert(data?.reason || 'Không thể thực hiện cuộc gọi');
      cleanupCallRef.current?.();
    };

    socket.on('incoming-call', onIncomingCall);
    socket.on('call-status-sync', onCallStatusSync);
    socket.on('call-accepted', onCallAccepted);
    socket.on('webrtc-signal', onWebrtcSignal);
    socket.on('call-ended-by-peer', onCallEndedByPeer);
    socket.on('call-failed', onCallFailed);

    return () => {
      socket.off('incoming-call', onIncomingCall);
      socket.off('call-status-sync', onCallStatusSync);
      socket.off('call-accepted', onCallAccepted);
      socket.off('webrtc-signal', onWebrtcSignal);
      socket.off('call-ended-by-peer', onCallEndedByPeer);
      socket.off('call-failed', onCallFailed);
    };
  }, [createPeerConnection, flushPendingIceCandidates, getOtherUserId, setCallInfo, setCallState, setLocalStream, socket]);

  // Trả lời cuộc gọi đến (Receiver) — chạy trực tiếp trong cử chỉ chạm nút "Trả lời"
  const handleAnswerCall = async () => {
    try {
      stopCallRingtone();
      // Bẻ khóa thẻ <audio> đối phương ngay trong cú chạm "Trả lời" (bắt buộc trên iOS Safari & Chrome Mobile)
      primeMediaElement(remoteAudioRef.current);

      const info = callInfoRef.current;
      if (!info?.from || !socket) return;

      const stream = await acquireUserMedia(info.isVideo);
      setVoiceCallAudioMode(true);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicEnabled(true);
      setVideoEnabled(Boolean(info.isVideo));

      // Khởi tạo sẵn RTCPeerConnection + gắn track micro TRƯỚC khi báo 'answer-call' cho người gọi gửi Offer
      createPeerConnection(info.from, stream, info.callerSocketId || remoteSocketIdRef.current);

      callWasConnectedRef.current = true;
      callStartTimeRef.current = Date.now();
      setCallState('connected');

      socket.emit('answer-call', {
        to: info.from,
        signal: { ready: true }
      });
    } catch (e) {
      console.error('[WebRTC] Không thể mở micro/camera khi nghe máy:', e);
      alert('Không thể mở micro hoặc camera. Vui lòng cấp quyền Micro trên điện thoại: ' + e.message);
      handleDeclineCall();
    }
  };

  const handleDeclineCall = () => {
    const receiverId = getOtherUserId();
    if (receiverId && socket) {
      socket.emit('end-call', { to: receiverId });
    }
    cleanupCallRef.current?.();
  };

  const handleEndCall = () => {
    const receiverId = getOtherUserId();
    if (receiverId && socket) {
      socket.emit('end-call', { to: receiverId });
    }
    cleanupCallRef.current?.();
  };

  // Dọn dẹp toàn bộ kết nối WebRTC, micro/camera và trả lại phiên âm thanh bình thường
  const cleanupCall = () => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    try {
      stopCallRingtone();
      const currentConversation = conversationRef.current;
      const currentCallInfo = callInfoRef.current;
      const currentLocalStream = localStreamRef.current;

      // 1. Lưu nhật ký cuộc gọi (chỉ máy người gọi ghi để tránh trùng)
      const targetConvId = currentCallInfo?.conversationId || currentConversation?.id;
      if (targetConvId && socket && currentCallInfo && currentCallInfo.from === user?.id) {
        let logText = '';
        let durationSec = 0;
        const callTypeLabel = currentCallInfo.isVideo ? 'video' : 'thoại';
        if (callWasConnectedRef.current && callStartTimeRef.current) {
          durationSec = Math.max(1, Math.round((Date.now() - callStartTimeRef.current) / 1000));
          const m = Math.floor(durationSec / 60);
          const s = durationSec % 60;
          const formatted = m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
          logText = `Cuộc gọi ${callTypeLabel} kết thúc. Thời lượng: ${formatted}`;
        } else {
          logText = `Cuộc gọi ${callTypeLabel} nhỡ`;
        }

        socket.emit('send-message', {
          conversationId: targetConvId,
          senderId: user.id,
          type: 'call',
          content: logText,
          metadata: {
            callType: currentCallInfo.isVideo ? 'video' : 'voice',
            status: callWasConnectedRef.current ? 'connected' : 'missed',
            duration: durationSec
          }
        });
      }

      // 2. Dừng toàn bộ track micro & camera
      if (currentLocalStream) {
        currentLocalStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {}
        });
      }

      // 3. Đóng RTCPeerConnection
      if (pcRef.current) {
        try {
          pcRef.current.onicecandidate = null;
          pcRef.current.ontrack = null;
          pcRef.current.oniceconnectionstatechange = null;
          pcRef.current.onconnectionstatechange = null;
          pcRef.current.close();
        } catch (e) {}
        pcRef.current = null;
      }

      // 4. Ngắt nguồn phát trên thẻ audio/video
      if (remoteAudioRef.current) {
        try {
          remoteAudioRef.current.pause();
          remoteAudioRef.current.srcObject = null;
        } catch (e) {}
      }
      if (remoteVideoRef.current) {
        try {
          remoteVideoRef.current.pause();
          remoteVideoRef.current.srcObject = null;
        } catch (e) {}
      }
      if (localVideoRef.current) {
        try {
          localVideoRef.current.srcObject = null;
        } catch (e) {}
      }

      pendingIceCandidatesRef.current = [];
      remoteMediaStreamRef.current = null;
      remoteSocketIdRef.current = null;
      iceRestartCountRef.current = 0;
      startingCallRef.current = false;

      localStreamRef.current = null;
      setLocalStream(null);
      setRemoteStream(null);
      setCallState('idle');
      setCallInfo(null);
      setMicEnabled(true);
      setSpeakerOn(true);
      speakerOnRef.current = true;
      setMediaLinkState('connecting');
      callWasConnectedRef.current = false;
      callStartTimeRef.current = null;

      // Khôi phục định tuyến loa ngoài chất lượng cao trên iOS sau khi đóng mic
      setVoiceCallAudioMode(false);
    } finally {
      isCleaningUpRef.current = false;
    }
  };

  useEffect(() => {
    cleanupCallRef.current = cleanupCall;
  });

  const toggleMic = () => {
    const stream = localStreamRef.current || localStream;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current || localStream;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleSpeaker = () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    speakerOnRef.current = next;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !next;
      if (next && remoteAudioRef.current.paused && remoteAudioRef.current.srcObject) {
        remoteAudioRef.current.play().catch(() => {});
      }
    }
  };

  const switchCamera = async () => {
    const stream = localStreamRef.current || localStream;
    if (!stream || !callInfo?.isVideo) return;
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing } },
        audio: false
      });
      const newVideoTrack = camStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      const oldVideoTrack = stream.getVideoTracks()[0];
      if (oldVideoTrack) {
        stream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      stream.addTrack(newVideoTrack);

      const sender = pcRef.current?.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setFacingMode(nextFacing);
      setVideoEnabled(true);
    } catch (e) {
      console.warn('[WebRTC] Không thể đổi camera:', e);
    }
  };

  const renderConnectionLabel = () => {
    if (mediaLinkState === 'connecting') return 'Đang kết nối âm thanh...';
    if (mediaLinkState === 'reconnecting') return `Đang khôi phục mạng... (${durationText})`;
    if (mediaLinkState === 'failed') return 'Mạng chặn kết nối trực tiếp — Bấm thử lại';
    return `Đang gọi thoại • ${durationText}`;
  };

  return (
    <>
      {/* Thẻ <audio> LUÔN tồn tại trên DOM (không bao giờ display:none hay bị gỡ khi idle)
          để mở khóa quyền phát tiếng WebRTC ngay từ cú chạm trên iPhone Safari/PWA & Android */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={styles.persistentAudio}
      />

      {callState !== 'idle' && (
        <div style={styles.overlay}>
          {/* 1. Màn hình người nhận chuông gọi đến */}
          {callState === 'incoming' && callInfo && (
            <div style={styles.callCard} className="glass-card anim-scale-in">
              <Avatar
                url={callInfo.callerAvatar}
                name={callInfo.callerName}
                size={90}
                style={{ ...styles.avatar, margin: '0 auto 16px auto' }}
              />
              <h3 style={styles.callerName}>{callInfo.callerName}</h3>
              <p style={styles.callStatus}>Cuộc gọi {callInfo.isVideo ? 'Video' : 'Thoại'} đến...</p>
              <div style={styles.actionButtons}>
                <button onClick={handleDeclineCall} style={{ ...styles.btn, backgroundColor: 'var(--danger)' }}>
                  Từ chối
                </button>
                <button onClick={handleAnswerCall} style={{ ...styles.btn, backgroundColor: 'var(--secondary)' }}>
                  Trả lời
                </button>
              </div>
            </div>
          )}

          {/* 2. Màn hình đổ chuông gọi đi */}
          {callState === 'calling' && (
            <div style={styles.callCard} className="glass-card anim-scale-in">
              <Avatar
                url={callInfo?.callerAvatar}
                name={callInfo?.callerName || 'User'}
                size={90}
                style={{ ...styles.avatar, animation: 'fadeIn 1s infinite alternate', margin: '0 auto 16px auto' }}
              />
              <h3 style={styles.callerName}>Đang gọi cho {callInfo?.callerName || 'đối phương'}...</h3>
              <p style={styles.callStatus}>Đang đổ chuông, vui lòng chờ bắt máy</p>
              <button onClick={handleEndCall} style={{ ...styles.roundBtn, backgroundColor: 'var(--danger)' }}>
                <FiPhoneOff size={22} />
              </button>
            </div>
          )}

          {/* 3. Màn hình Cuộc gọi đã bắt máy (Connected) */}
          {callState === 'connected' && (
            <div style={styles.connectedContainer}>
              {callInfo?.isVideo && (
                <>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    webkit-playsinline="true"
                    muted
                    style={styles.remoteVideo}
                  />
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    webkit-playsinline="true"
                    muted
                    style={videoEnabled ? styles.localVideo : { ...styles.localVideo, opacity: 0 }}
                  />
                </>
              )}

              {/* GIAO DIỆN GỌI THOẠI (Voice Call UI) */}
              {!callInfo?.isVideo && (
                <div style={styles.voiceCallWrapper}>
                  <div style={styles.voiceCallCenter}>
                    <Avatar
                      url={callInfo?.callerAvatar}
                      name={callInfo?.callerName || 'User'}
                      size={126}
                      style={{ ...styles.voiceCallAvatar, margin: '0 auto 20px auto' }}
                    />
                    <h2 style={styles.voiceCallName}>{callInfo?.callerName || 'Người dùng'}</h2>
                    <div
                      style={{
                        ...styles.voiceCallDuration,
                        color:
                          mediaLinkState === 'failed'
                            ? '#fb7185'
                            : mediaLinkState === 'connected'
                              ? '#34d399'
                              : 'rgba(255, 255, 255, 0.7)'
                      }}
                    >
                      {renderConnectionLabel()}
                    </div>
                    {mediaLinkState === 'failed' && (
                      <button
                        type="button"
                        onClick={triggerIceRestart}
                        style={styles.retryBtn}
                      >
                        <FiRefreshCw size={14} /> Thử kết nối lại
                      </button>
                    )}
                  </div>

                  <div style={{ width: '100%' }}>
                    <div style={styles.voiceControlBar}>
                      <div style={styles.controlItem}>
                        <button
                          type="button"
                          onClick={toggleMic}
                          style={{
                            ...styles.roundBtn,
                            backgroundColor: micEnabled ? 'rgba(255,255,255,0.16)' : 'var(--danger)'
                          }}
                        >
                          {micEnabled ? <FiMic size={20} /> : <FiMicOff size={20} />}
                        </button>
                        <span style={styles.controlLabel}>{micEnabled ? 'Tắt mic' : 'Bật mic'}</span>
                      </div>
                      <div style={styles.controlItem}>
                        <button
                          type="button"
                          onClick={toggleSpeaker}
                          style={{
                            ...styles.roundBtn,
                            backgroundColor: speakerOn ? 'rgba(255,255,255,0.16)' : 'var(--danger)'
                          }}
                        >
                          {speakerOn ? <FiVolume2 size={20} /> : <FiVolumeX size={20} />}
                        </button>
                        <span style={styles.controlLabel}>{speakerOn ? 'Loa bật' : 'Tắt loa'}</span>
                      </div>
                    </div>

                    <div style={styles.voiceCallHangupContainer}>
                      <button
                        type="button"
                        onClick={handleEndCall}
                        style={{ ...styles.roundBtn, width: '62px', height: '62px', backgroundColor: 'var(--danger)' }}
                      >
                        <FiPhoneOff size={24} />
                      </button>
                      <span style={{ ...styles.controlLabel, marginTop: '8px' }}>Kết thúc</span>
                    </div>
                  </div>
                </div>
              )}

              {/* GIAO DIỆN GỌI VIDEO (Video Call UI) */}
              {callInfo?.isVideo && (
                <div style={styles.videoCallWrapper}>
                  <div style={styles.videoHeader}>
                    <div style={styles.videoHeaderContent}>
                      <Avatar
                        url={callInfo?.callerAvatar}
                        name={callInfo?.callerName || 'User'}
                        size={40}
                        style={styles.videoHeaderAvatar}
                      />
                      <div>
                        <div style={styles.videoHeaderName}>{callInfo?.callerName}</div>
                        <div style={styles.videoHeaderDuration}>
                          {mediaLinkState === 'connected' ? durationText : 'Đang kết nối...'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {!videoEnabled && <div style={styles.localVideoPlaceholder}>Camera tắt</div>}

                  <div style={styles.controlBar} className="glass">
                    <button
                      type="button"
                      onClick={toggleMic}
                      style={{
                        ...styles.roundBtn,
                        backgroundColor: micEnabled ? 'rgba(255,255,255,0.14)' : 'var(--danger)'
                      }}
                    >
                      {micEnabled ? <FiMic size={20} /> : <FiMicOff size={20} />}
                    </button>
                    <button
                      type="button"
                      onClick={toggleSpeaker}
                      style={{
                        ...styles.roundBtn,
                        backgroundColor: speakerOn ? 'rgba(255,255,255,0.14)' : 'var(--danger)'
                      }}
                    >
                      {speakerOn ? <FiVolume2 size={20} /> : <FiVolumeX size={20} />}
                    </button>
                    <button
                      type="button"
                      onClick={toggleVideo}
                      style={{
                        ...styles.roundBtn,
                        backgroundColor: videoEnabled ? 'rgba(255,255,255,0.14)' : 'var(--danger)'
                      }}
                    >
                      {videoEnabled ? <FiVideo size={20} /> : <FiVideoOff size={20} />}
                    </button>
                    <button
                      type="button"
                      onClick={switchCamera}
                      style={{ ...styles.roundBtn, backgroundColor: 'rgba(255,255,255,0.14)' }}
                      title="Đổi camera trước/sau"
                    >
                      <FiRefreshCw size={19} />
                    </button>
                    <button
                      type="button"
                      onClick={handleEndCall}
                      style={{ ...styles.roundBtn, backgroundColor: 'var(--danger)' }}
                    >
                      <FiPhoneOff size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

const styles = {
  persistentAudio: {
    position: 'fixed',
    width: '1px',
    height: '1px',
    opacity: 0,
    pointerEvents: 'none',
    left: '-9999px',
    top: 0
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: 'var(--app-height, 100dvh)',
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    background: 'rgba(9, 13, 22, 0.96)',
    zIndex: 1200,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  callCard: {
    width: 'min(90vw, 330px)',
    padding: '30px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center'
  },
  avatar: {
    width: '90px',
    height: '90px',
    borderRadius: '50%',
    marginBottom: '16px',
    border: '3px solid var(--primary)',
    objectFit: 'cover'
  },
  callerName: {
    fontSize: '1.2rem',
    fontWeight: '700',
    marginBottom: '6px'
  },
  callStatus: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginBottom: '28px'
  },
  actionButtons: {
    display: 'flex',
    gap: '16px',
    width: '100%'
  },
  btn: {
    flex: 1,
    padding: '13px 12px',
    borderRadius: 'var(--radius-sm)',
    color: 'white',
    border: 'none',
    fontWeight: '600',
    fontSize: '0.95rem',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-md)'
  },
  roundBtn: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease'
  },
  connectedContainer: {
    width: '100%',
    height: '100%',
    position: 'relative'
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    backgroundColor: '#000000'
  },
  localVideo: {
    position: 'absolute',
    top: 'calc(16px + env(safe-area-inset-top, 0px))',
    right: '16px',
    width: '112px',
    height: '154px',
    objectFit: 'cover',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid rgba(255,255,255,0.22)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 5
  },
  localVideoPlaceholder: {
    position: 'absolute',
    top: 'calc(16px + env(safe-area-inset-top, 0px))',
    right: '16px',
    width: '112px',
    height: '154px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    zIndex: 5
  },
  controlBar: {
    position: 'absolute',
    bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '14px',
    padding: '10px 18px',
    borderRadius: '40px',
    pointerEvents: 'auto',
    zIndex: 10
  },
  voiceCallWrapper: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding:
      'calc(36px + env(safe-area-inset-top, 0px)) 24px calc(40px + env(safe-area-inset-bottom, 0px)) 24px',
    background: 'radial-gradient(circle, rgba(38, 49, 71, 0.96) 0%, rgba(10, 14, 24, 0.99) 100%)',
    position: 'absolute',
    inset: 0,
    zIndex: 2
  },
  voiceCallCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '36px',
    textAlign: 'center'
  },
  voiceCallAvatar: {
    width: '126px',
    height: '126px',
    borderRadius: '50%',
    border: '4px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
    objectFit: 'cover',
    marginBottom: '20px'
  },
  voiceCallName: {
    fontSize: '1.55rem',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0 0 8px 0'
  },
  voiceCallDuration: {
    fontSize: '0.95rem',
    fontWeight: '600'
  },
  retryBtn: {
    marginTop: '14px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(99, 102, 241, 0.35)',
    color: '#ffffff',
    fontSize: '0.82rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  voiceControlBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '36px',
    width: '100%',
    marginBottom: '28px'
  },
  controlItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
  },
  controlLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255, 255, 255, 0.72)',
    fontWeight: '500'
  },
  voiceCallHangupContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%'
  },
  videoCallWrapper: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    zIndex: 6
  },
  videoHeader: {
    position: 'absolute',
    top: 'calc(16px + env(safe-area-inset-top, 0px))',
    left: '16px',
    zIndex: 10,
    background: 'rgba(9, 13, 22, 0.65)',
    padding: '8px 14px',
    borderRadius: '30px',
    border: '1px solid rgba(255,255,255,0.12)',
    pointerEvents: 'auto'
  },
  videoHeaderContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  videoHeaderAvatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    objectFit: 'cover'
  },
  videoHeaderName: {
    fontSize: '0.88rem',
    fontWeight: '700',
    color: '#ffffff'
  },
  videoHeaderDuration: {
    fontSize: '0.74rem',
    color: 'rgba(255, 255, 255, 0.7)'
  }
};
