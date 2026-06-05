import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { FiPhoneOff, FiVideo, FiVideoOff, FiMic, FiMicOff, FiVolume2, FiVolumeX, FiRefreshCw } from 'react-icons/fi';

export default function VideoCall({
  user,
  token,
  socket,
  callState, // 'idle', 'calling', 'incoming', 'connected'
  setCallState,
  callInfo, // { from, to, callerName, callerAvatar, isVideo }
  setCallInfo,
  localStream,
  setLocalStream,
  remoteStream,
  setRemoteStream,
  peerInstance,
  setPeerInstance,
  conversation
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const currentCallRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const callWasConnectedRef = useRef(false);

  // Lưu trữ các state vào refs để tránh stale closures trong các hàm callback sự kiện
  const conversationRef = useRef(conversation);
  const callInfoRef = useRef(callInfo);
  const localStreamRef = useRef(localStream);
  const callStateRef = useRef(callState);
  const cleanupCallRef = useRef(null);

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

  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [durationText, setDurationText] = useState('00:00');
  const [speakerOn, setSpeakerOn] = useState(true);

  // Hook tính toán thời gian cuộc gọi (timer)
  useEffect(() => {
    let interval;
    if (callState === 'connected' && callStartTimeRef.current) {
      interval = setInterval(() => {
        const sec = Math.round((Date.now() - callStartTimeRef.current) / 1000);
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        setDurationText(`${m}:${s}`);
      }, 1000);
    } else {
      setDurationText('00:00');
    }
    return () => clearInterval(interval);
  }, [callState]);

  // Hook tắt/bật loa (âm thanh đầu ra)
  const toggleSpeaker = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
      setSpeakerOn(!remoteVideoRef.current.muted);
    } else {
      setSpeakerOn(!speakerOn);
    }
  };

  // Gắn luồng stream cục bộ vào video element
  useEffect(() => {
    const video = localVideoRef.current;
    if (localStream && video) {
      video.srcObject = localStream;
      video.play().catch(err => {
        console.warn("Lỗi tự động phát video cục bộ:", err);
      });
    }
  }, [localStream, callState]);

  // Gắn luồng stream đối phương vào video element
  useEffect(() => {
    const video = remoteVideoRef.current;
    if (remoteStream && video) {
      video.srcObject = remoteStream;
      video.play().catch(err => {
        console.warn("Lỗi tự động phát video đối phương:", err);
      });
    }
  }, [remoteStream, callState]);

  // Tự động huỷ cuộc gọi nếu đổ chuông quá lâu mà không có phản hồi (15 giây)
  useEffect(() => {
    if (callState === 'calling' || callState === 'incoming') {
      const timer = setTimeout(() => {
        console.log('[VideoCall] Cuộc gọi quá thời gian chờ (timeout), tự động huỷ...');
        cleanupCallRef.current?.();
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [callState]);

  // Thiết lập log giám sát chất lượng/kết nối WebRTC
  const setupCallDiagnostics = (call) => {
    if (!call) return;
    console.log('[Diagnostics] Thiết lập giám sát cuộc gọi...');
    if (call.peerConnection) {
      const pc = call.peerConnection;
      console.log(`[Diagnostics] Trạng thái RTCPeerConnection ban đầu: ice=${pc.iceConnectionState}, connection=${pc.connectionState}`);
      pc.oniceconnectionstatechange = () => {
        console.log(`[Diagnostics] Thay đổi trạng thái ICE Connection: ${pc.iceConnectionState}`);
      };
      pc.onconnectionstatechange = () => {
        console.log(`[Diagnostics] Thay đổi trạng thái Connection: ${pc.connectionState}`);
      };
    }
  };

  // Trả lời cuộc gọi WebRTC (PeerJS) bằng Stream cục bộ
  const answerPeerCall = (call, stream) => {
    console.log('Answering PeerJS call with stream...');
    setupCallDiagnostics(call);
    call.answer(stream);
    call.on('stream', (userRemoteStream) => {
      console.log('Received remote stream, tracks:', userRemoteStream.getTracks().map(t => `${t.kind}: enabled=${t.enabled}, state=${t.readyState}`));
      setRemoteStream(userRemoteStream);
    });
    call.on('close', () => {
      console.log('PeerJS call closed.');
      cleanupCallRef.current?.();
    });
    call.on('error', (err) => {
      console.error('PeerJS call error:', err);
      cleanupCallRef.current?.();
    });
  };

  // Khởi tạo PeerJS khi có Socket
  useEffect(() => {
    if (!socket || !user) return;

    // Sử dụng PeerJS Cloud với STUN servers để vượt tường lửa/NAT của mạng di động/VPS
    const peer = new Peer(user.id, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ]
      }
    });

    peer.on('open', (id) => {
      console.log('Đã đăng ký Peer ID:', id);
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
    });

    // Lắng nghe cuộc gọi đến duy nhất một lần (Tránh rò rỉ listener)
    peer.on('call', (incomingCall) => {
      console.log('Có cuộc gọi WebRTC (PeerJS) đến!');
      currentCallRef.current = incomingCall;

      // Nếu chúng ta đã bấm trả lời và có stream cục bộ, tiến hành kết nối stream ngay lập tức
      if (localStreamRef.current) {
        answerPeerCall(incomingCall, localStreamRef.current);
      }
    });

    setPeerInstance(peer);

    return () => {
      peer.destroy();
    };
  }, [socket, user]);

  // Tự động kích hoạt gọi đi khi trạng thái chuyển sang 'calling' (Người gọi - Caller)
  useEffect(() => {
    if (callState === 'calling' && callInfo && callInfo.to && !localStream) {
      handleStartCall(callInfo.isVideo);
    }
  }, [callState, callInfo, localStream]);

  // Xử lý sự kiện cuộc gọi qua Socket.io
  useEffect(() => {
    if (!socket) return;

    // Cuộc gọi đến qua Socket signalling
    socket.on('incoming-call', (data) => {
      setCallInfo(data);
      setCallState('incoming');
      console.log('Incoming call via socket:', data);
    });

    // Đồng bộ trạng thái cuộc gọi từ server (Đảm bảo tự phục hồi trạng thái khi chạy nền và ngắt kết nối tạm thời)
    socket.on('call-status-sync', (data) => {
      const { hasActiveCall, callData } = data;
      console.log('[Socket.io] Đồng bộ trạng thái cuộc gọi từ server:', data);
      
      if (hasActiveCall && callData) {
        if (callStateRef.current === 'idle') {
          setCallInfo(callData);
          setCallState('incoming');
        }
      } else {
        if (callStateRef.current !== 'idle') {
          console.log('[Socket.io] Cuộc gọi không còn tồn tại trên server, tiến hành dọn dẹp...');
          cleanupCallRef.current?.();
        }
      }
    });

    // Đối phương đồng ý nghe cuộc gọi
    socket.on('call-accepted', () => {
      console.log('Đối phương đã chấp nhận cuộc gọi!');
      callWasConnectedRef.current = true;
      callStartTimeRef.current = Date.now();
      setCallState('connected');
    });

    // Đối phương cúp máy hoặc từ chối
    socket.on('call-ended-by-peer', () => {
      cleanupCallRef.current?.();
    });

    socket.on('call-failed', (data) => {
      alert(data.reason);
      cleanupCallRef.current?.();
    });

    return () => {
      socket.off('incoming-call');
      socket.off('call-status-sync');
      socket.off('call-accepted');
      socket.off('call-ended-by-peer');
      socket.off('call-failed');
    };
  }, [socket]);

  // Bắt đầu cuộc gọi (Người gọi - Caller)
  const handleStartCall = async (isVideoCall) => {
    try {
      // Bẻ khoá (Unlock) autoplay cho thẻ video đối phương ngay trong hành vi click chuột của người dùng
      if (remoteVideoRef.current) {
        remoteVideoRef.current.play().catch(() => {});
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoCall,
        audio: true
      });
      localStreamRef.current = stream; // Cập nhật ref ngay lập tức tránh độ trễ React state
      setLocalStream(stream);
      setVideoEnabled(isVideoCall);

      setCallState('calling');
      
      // Bắn tín hiệu socket báo cho đối phương
      socket.emit('call-user', {
        userToCall: callInfo.to,
        from: user.id,
        callerName: user.displayName,
        callerAvatar: user.avatarUrl,
        isVideo: isVideoCall,
        conversationId: conversationRef.current?.id
      });

      // Lắng nghe chấp nhận cuộc gọi
      socket.once('call-accepted', () => {
        // Thực hiện call qua PeerJS
        console.log('Caller side: call-accepted received, initiating PeerJS call...');
        const call = peerInstance.call(callInfo.to, stream);
        currentCallRef.current = call;
        setupCallDiagnostics(call);

        call.on('stream', (userRemoteStream) => {
          console.log('Caller side: Received remote stream, tracks:', userRemoteStream.getTracks().map(t => `${t.kind}: enabled=${t.enabled}, state=${t.readyState}`));
          setRemoteStream(userRemoteStream);
        });
        call.on('close', () => {
          console.log('PeerJS call closed (caller side).');
          cleanupCallRef.current?.();
        });
        call.on('error', (err) => {
          console.error('PeerJS call error (caller side):', err);
          cleanupCallRef.current?.();
        });
      });

    } catch (e) {
      console.error(e);
      alert('Không thể mở camera hoặc micro: ' + e.message);
      cleanupCallRef.current?.();
    }
  };

  // Trả lời cuộc gọi (Người nghe - Receiver)
  const handleAnswerCall = async () => {
    try {
      // Bẻ khoá (Unlock) autoplay cho thẻ video đối phương ngay trong hành vi click chuột của người dùng
      if (remoteVideoRef.current) {
        remoteVideoRef.current.play().catch(() => {});
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: callInfo.isVideo,
        audio: true
      });
      localStreamRef.current = stream; // Cập nhật ref ngay lập tức tránh độ trễ React state
      setLocalStream(stream);
      setVideoEnabled(callInfo.isVideo);

      callWasConnectedRef.current = true;
      callStartTimeRef.current = Date.now();
      setCallState('connected');

      // Báo socket đã đồng ý
      socket.emit('answer-call', { to: callInfo.from });

      // Nếu cuộc gọi PeerJS đã đến trước đó và được lưu trong Ref, trả lời ngay
      if (currentCallRef.current) {
        answerPeerCall(currentCallRef.current, stream);
      } else {
        console.log('Chờ cuộc gọi PeerJS từ đối phương kết nối tới...');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể mở camera hoặc micro: ' + e.message);
      handleDeclineCall();
    }
  };

  // Trợ giúp lấy User ID của đối phương một cách chính xác
  const getOtherUserId = () => {
    if (!callInfo) return null;
    if (callInfo.to && (!callInfo.from || callInfo.from === user.id)) {
      return callInfo.to;
    }
    return callInfo.from;
  };

  // Từ chối cuộc gọi
  const handleDeclineCall = () => {
    const receiverId = getOtherUserId();
    if (receiverId) {
      socket.emit('end-call', { to: receiverId });
    }
    cleanupCallRef.current?.();
  };

  // Cúp máy (Đang gọi hoặc đang kết nối)
  const handleEndCall = () => {
    const receiverId = getOtherUserId();
    if (receiverId) {
      socket.emit('end-call', { to: receiverId });
    }
    cleanupCallRef.current?.();
  };

  // Dọn dẹp luồng stream và reset state
  const cleanupCall = () => {
    const currentConversation = conversationRef.current;
    const currentCallInfo = callInfoRef.current;
    const currentLocalStream = localStreamRef.current;

    // 1. Lưu nhật ký cuộc gọi vào phòng chat
    if (currentConversation && socket && currentCallInfo) {
      const isCaller = currentCallInfo.from === user.id;
      // Chỉ để máy người gọi gửi tin nhắn lưu nhật ký cuộc gọi tránh bị trùng 2 lần
      if (isCaller) {
        let logText = '';
        let durationSec = 0;
        const callTypeLabel = currentCallInfo.isVideo ? 'video' : 'thoại';
        if (callWasConnectedRef.current && callStartTimeRef.current) {
          durationSec = Math.round((Date.now() - callStartTimeRef.current) / 1000);
          const formatTime = (sec) => {
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            return m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
          };
          logText = `Cuộc gọi ${callTypeLabel} kết thúc. Thời lượng: ${formatTime(durationSec)}`;
        } else {
          logText = `Cuộc gọi ${callTypeLabel} nhỡ`;
        }

        if (logText) {
          socket.emit('send-message', {
            conversationId: currentConversation.id,
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
      }
    }

    // 2. Dọn dẹp các luồng stream
    if (currentLocalStream) {
      currentLocalStream.getTracks().forEach(track => track.stop());
    }
    if (currentCallRef.current) {
      try {
        currentCallRef.current.close();
      } catch (err) {
        console.warn('Error closing current call ref:', err);
      }
      currentCallRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setCallInfo(null);
    callWasConnectedRef.current = false;
    callStartTimeRef.current = null;
  };

  useEffect(() => {
    cleanupCallRef.current = cleanupCall;
  });

  // Bật/tắt micro
  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  };

  // Bật/tắt camera
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  if (callState === 'idle') return null;

  return (
    <div style={styles.overlay}>
      {/* 1. Màn hình người nhận chuông gọi đến */}
      {callState === 'incoming' && (
        <div style={styles.callCard} className="glass-card anim-scale-in">
          <img src={callInfo.callerAvatar} alt="" style={styles.avatar} />
          <h3 style={styles.callerName}>{callInfo.callerName}</h3>
          <p style={styles.callStatus}>Cuộc gọi {callInfo.isVideo ? 'Video' : 'Thoại'} đến...</p>
          <div style={styles.actionButtons}>
            <button onClick={handleDeclineCall} style={{...styles.btn, backgroundColor: 'var(--danger)'}}>
              Từ chối
            </button>
            <button onClick={handleAnswerCall} style={{...styles.btn, backgroundColor: 'var(--secondary)'}}>
              Trả lời
            </button>
          </div>
        </div>
      )}

      {/* 2. Màn hình đổ chuông gọi đi */}
      {callState === 'calling' && (
        <div style={styles.callCard} className="glass-card anim-scale-in">
          <img 
            src={callInfo?.callerAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=user`} 
            alt="" 
            style={{...styles.avatar, animation: 'fadeIn 1s infinite alternate'}} 
          />
          <h3 style={styles.callerName}>Đang gọi cho {callInfo?.callerName || 'đối phương'}...</h3>
          <p style={styles.callStatus}>Vui lòng chờ đối phương bắt máy</p>
          <button onClick={handleEndCall} style={{...styles.roundBtn, backgroundColor: 'var(--danger)'}}>
            <FiPhoneOff size={22} />
          </button>
        </div>
      )}

      {/* 3. Màn hình Cuộc gọi kết nối thành công (Connected) */}
      <div style={{
        ...styles.connectedContainer,
        display: callState === 'connected' ? 'block' : 'none'
      }}>
        {/* Video đối phương (Toàn màn hình nếu là Video Call, ẩn đi nếu là Voice Call) */}
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          webkit-playsinline="true"
          style={callInfo?.isVideo ? styles.remoteVideo : { display: 'none' }} 
        />
        
        {/* Video bản thân (PiP góc phải nếu là Video Call, ẩn đi nếu là Voice Call) */}
        <video 
          ref={localVideoRef} 
          autoPlay 
          playsInline 
          webkit-playsinline="true"
          muted 
          style={callInfo?.isVideo && videoEnabled ? styles.localVideo : { display: 'none' }} 
        />

        {/* GIAO DIỆN GỌI THOẠI THƯỜNG (Voice Call UI) */}
        {!callInfo?.isVideo && (
          <div style={styles.voiceCallWrapper}>
            {/* Center Area (Avatar, Tên, Thời gian) */}
            <div style={styles.voiceCallCenter}>
              <img 
                src={callInfo?.callerAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=user`} 
                alt="" 
                style={styles.voiceCallAvatar} 
              />
              <h2 style={styles.voiceCallName}>{callInfo?.callerName || 'Người dùng'}</h2>
              <div style={styles.voiceCallDuration}>Đang gọi thoại... ({durationText})</div>
            </div>

            {/* Bottom Controls (Phím chức năng) */}
            <div style={styles.voiceControlBar}>
              <div style={styles.controlItem}>
                <button 
                  disabled
                  style={{...styles.roundBtn, backgroundColor: 'rgba(255,255,255,0.08)', cursor: 'not-allowed', opacity: 0.4}}
                >
                  <FiVideoOff size={20} />
                </button>
                <span style={styles.controlLabel}>Camera</span>
              </div>
              <div style={styles.controlItem}>
                <button 
                  onClick={toggleMic} 
                  style={{...styles.roundBtn, backgroundColor: micEnabled ? 'rgba(255,255,255,0.15)' : 'var(--danger)'}}
                >
                  {micEnabled ? <FiMic size={20} /> : <FiMicOff size={20} />}
                </button>
                <span style={styles.controlLabel}>{micEnabled ? 'Tắt tiếng' : 'Bật tiếng'}</span>
              </div>
              <div style={styles.controlItem}>
                <button 
                  onClick={toggleSpeaker} 
                  style={{...styles.roundBtn, backgroundColor: speakerOn ? 'rgba(255,255,255,0.15)' : 'var(--danger)'}}
                >
                  {speakerOn ? <FiVolume2 size={20} /> : <FiVolumeX size={20} />}
                </button>
                <span style={styles.controlLabel}>Loa</span>
              </div>
            </div>

            {/* Nút Kết thúc (Hang up) */}
            <div style={styles.voiceCallHangupContainer}>
              <button onClick={handleEndCall} style={{...styles.roundBtn, width: '60px', height: '60px', backgroundColor: 'var(--danger)'}}>
                <FiPhoneOff size={24} />
              </button>
              <span style={{...styles.controlLabel, marginTop: '8px'}}>Kết thúc</span>
            </div>
          </div>
        )}

        {/* GIAO DIỆN GỌI VIDEO (Video Call UI) */}
        {callInfo?.isVideo && (
          <div style={styles.videoCallWrapper}>
            {/* Header overlay hiển thị thông tin đối phương và thời gian */}
            <div style={styles.videoHeader}>
              <div style={styles.videoHeaderContent}>
                <img 
                  src={callInfo?.callerAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=user`} 
                  alt="" 
                  style={styles.videoHeaderAvatar} 
                />
                <div>
                  <div style={styles.videoHeaderName}>{callInfo?.callerName}</div>
                  <div style={styles.videoHeaderDuration}>{durationText}</div>
                </div>
              </div>
            </div>

            {/* Placeholder local video khi camera bị tắt */}
            {!videoEnabled && (
              <div style={styles.localVideoPlaceholder}>Camera tắt</div>
            )}

            {/* Thanh điều khiển video nổi phía dưới */}
            <div style={styles.controlBar} className="glass">
              <button onClick={toggleMic} style={{...styles.roundBtn, backgroundColor: micEnabled ? 'rgba(255,255,255,0.1)' : 'var(--danger)'}}>
                {micEnabled ? <FiMic size={20} /> : <FiMicOff size={20} />}
              </button>
              <button onClick={handleEndCall} style={{...styles.roundBtn, backgroundColor: 'var(--danger)'}}>
                <FiPhoneOff size={20} />
              </button>
              <button onClick={toggleVideo} style={{...styles.roundBtn, backgroundColor: videoEnabled ? 'rgba(255,255,255,0.1)' : 'var(--danger)'}}>
                {videoEnabled ? <FiVideo size={20} /> : <FiVideoOff size={20} />}
              </button>
            </div>
          </div>
        )}
      </div>
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
    background: 'rgba(9, 13, 22, 0.95)',
    zIndex: 999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  callCard: {
    width: '320px',
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
    marginBottom: '30px'
  },
  actionButtons: {
    display: 'flex',
    gap: '16px',
    width: '100%'
  },
  btn: {
    flex: 1,
    padding: '12px',
    borderRadius: 'var(--radius-sm)',
    color: 'white',
    border: 'none',
    fontWeight: '600',
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
    top: '30px',
    right: '30px',
    width: '120px',
    height: '160px',
    objectFit: 'cover',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid rgba(255,255,255,0.2)',
    boxShadow: 'var(--shadow-lg)'
  },
  localVideoPlaceholder: {
    position: 'absolute',
    top: '30px',
    right: '30px',
    width: '120px',
    height: '160px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 'var(--radius-sm)',
    border: '2px solid rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)'
  },
  controlBar: {
    position: 'absolute',
    bottom: '40px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '24px',
    padding: '12px 24px',
    borderRadius: '40px',
    pointerEvents: 'auto'
  },
  voiceCallWrapper: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '60px 24px 80px 24px',
    background: 'radial-gradient(circle, rgba(45, 55, 72, 0.95) 0%, rgba(10, 15, 30, 0.98) 100%)',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 2
  },
  voiceCallCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '60px'
  },
  voiceCallAvatar: {
    width: '130px',
    height: '130px',
    borderRadius: '50%',
    border: '4px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
    objectFit: 'cover',
    marginBottom: '20px'
  },
  voiceCallName: {
    fontSize: '1.6rem',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0 0 8px 0'
  },
  voiceCallDuration: {
    fontSize: '1rem',
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500'
  },
  voiceControlBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '30px',
    width: '100%',
    marginBottom: '20px'
  },
  controlItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
  },
  controlLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255, 255, 255, 0.7)',
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
    zIndex: 2
  },
  videoHeader: {
    position: 'absolute',
    top: '30px',
    left: '30px',
    zIndex: 10,
    background: 'rgba(9, 13, 22, 0.6)',
    backdropFilter: 'blur(8px)',
    padding: '10px 16px',
    borderRadius: '30px',
    border: '1px solid rgba(255,255,255,0.1)',
    pointerEvents: 'auto'
  },
  videoHeaderContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  videoHeaderAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover'
  },
  videoHeaderName: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: '#ffffff'
  },
  videoHeaderDuration: {
    fontSize: '0.75rem',
    color: 'rgba(255, 255, 255, 0.6)'
  }
};
