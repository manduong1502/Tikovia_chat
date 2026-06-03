import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { FiPhoneOff, FiVideo, FiVideoOff, FiMic, FiMicOff } from 'react-icons/fi';

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

  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  // Gắn luồng stream cục bộ vào video element
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  // Gắn luồng stream đối phương vào video element
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  // Khởi tạo PeerJS khi có Socket
  useEffect(() => {
    if (!socket || !user) return;

    // Sử dụng PeerJS Cloud mặc định (bằng cách bỏ config host/port) để chạy ổn định cả local & cloud
    const peer = new Peer(user.id);

    peer.on('open', (id) => {
      console.log('Đã đăng ký Peer ID:', id);
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
    });

    // Lắng nghe cuộc gọi đến
    peer.on('call', async (incomingCall) => {
      console.log('Có cuộc gọi WebRTC đến!');
      currentCallRef.current = incomingCall;

      // Không tự động bắt máy, việc này sẽ kích hoạt sau khi người dùng bấm "Trả lời" ở UI
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

    // Đối phương đồng ý nghe cuộc gọi
    socket.on('call-accepted', () => {
      console.log('Đối phương đã chấp nhận cuộc gọi!');
      callWasConnectedRef.current = true;
      callStartTimeRef.current = Date.now();
      setCallState('connected');
    });

    // Đối phương cúp máy hoặc từ chối
    socket.on('call-ended-by-peer', () => {
      cleanupCall();
    });

    socket.on('call-failed', (data) => {
      alert(data.reason);
      cleanupCall();
    });

    return () => {
      socket.off('incoming-call');
      socket.off('call-accepted');
      socket.off('call-ended-by-peer');
      socket.off('call-failed');
    };
  }, [socket]);

  // Bắt đầu cuộc gọi (Người gọi - Caller)
  const handleStartCall = async (isVideoCall) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoCall,
        audio: true
      });
      setLocalStream(stream);
      setVideoEnabled(isVideoCall);

      setCallState('calling');
      
      // Bắn tín hiệu socket báo cho đối phương
      socket.emit('call-user', {
        userToCall: callInfo.to,
        from: user.id,
        callerName: user.displayName,
        callerAvatar: user.avatarUrl,
        isVideo: isVideoCall
      });

      // Lắng nghe chấp nhận cuộc gọi
      socket.once('call-accepted', () => {
        // Thực hiện call qua PeerJS
        const call = peerInstance.call(callInfo.to, stream);
        currentCallRef.current = call;

        call.on('stream', (userRemoteStream) => {
          setRemoteStream(userRemoteStream);
        });
      });

    } catch (e) {
      console.error(e);
      alert('Không thể mở camera hoặc micro: ' + e.message);
      cleanupCall();
    }
  };

  // Trả lời cuộc gọi (Người nghe - Receiver)
  const handleAnswerCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callInfo.isVideo,
        audio: true
      });
      setLocalStream(stream);
      setVideoEnabled(callInfo.isVideo);

      callWasConnectedRef.current = true;
      callStartTimeRef.current = Date.now();
      setCallState('connected');

      // Báo socket đã đồng ý
      socket.emit('answer-call', { to: callInfo.from });

      // Trả lời cuộc gọi PeerJS
      if (currentCallRef.current) {
        console.log('Đang trả lời cuộc gọi đã nhận trong Ref...');
        currentCallRef.current.answer(stream);
        currentCallRef.current.on('stream', (userRemoteStream) => {
          setRemoteStream(userRemoteStream);
        });
      } else if (peerInstance) {
        console.log('Chưa nhận tín hiệu cuộc gọi PeerJS, đang chờ nhận tín hiệu...');
        peerInstance.on('call', (call) => {
          call.answer(stream);
          currentCallRef.current = call;
          call.on('stream', (userRemoteStream) => {
            setRemoteStream(userRemoteStream);
          });
        });
      }
    } catch (e) {
      console.error(e);
      alert('Không thể mở camera hoặc micro: ' + e.message);
      handleDeclineCall();
    }
  };

  // Từ chối cuộc gọi
  const handleDeclineCall = () => {
    socket.emit('end-call', { to: callInfo.from });
    cleanupCall();
  };

  // Cúp máy (Đang gọi hoặc đang kết nối)
  const handleEndCall = () => {
    const receiverId = callState === 'calling' ? callInfo.to : (callInfo.from === user.id ? callInfo.to : callInfo.from);
    socket.emit('end-call', { to: receiverId });
    cleanupCall();
  };

  // Dọn dẹp luồng stream và reset state
  const cleanupCall = () => {
    // 1. Lưu nhật ký cuộc gọi vào phòng chat
    if (conversation && socket && callInfo) {
      const isCaller = callInfo.from === user.id;
      // Chỉ để máy người gọi gửi tin nhắn lưu nhật ký cuộc gọi tránh bị trùng 2 lần
      if (isCaller) {
        let logText = '';
        if (callWasConnectedRef.current && callStartTimeRef.current) {
          const durationSec = Math.round((Date.now() - callStartTimeRef.current) / 1000);
          const formatTime = (sec) => {
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            return m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
          };
          logText = `📞 Cuộc gọi ${callInfo.isVideo ? 'video' : 'thoại'} kết thúc. Thời lượng: ${formatTime(durationSec)}`;
        } else {
          logText = `📞 Cuộc gọi nhỡ`;
        }

        if (logText) {
          socket.emit('send-message', {
            conversationId: conversation.id,
            senderId: user.id,
            type: 'text',
            content: logText
          });
        }
      }
    }

    // 2. Dọn dẹp các luồng stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (currentCallRef.current) {
      currentCallRef.current.close();
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setCallInfo(null);
    callWasConnectedRef.current = false;
    callStartTimeRef.current = null;
  };

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
            src={`https://api.dicebear.com/7.x/adventurer/svg?seed=user`} 
            alt="" 
            style={{...styles.avatar, animation: 'fadeIn 1s infinite alternate'}} 
          />
          <h3 style={styles.callerName}>Đang gọi điện...</h3>
          <p style={styles.callStatus}>Vui lòng chờ đối phương bắt máy</p>
          <button onClick={handleEndCall} style={{...styles.roundBtn, backgroundColor: 'var(--danger)'}}>
            <FiPhoneOff size={22} />
          </button>
        </div>
      )}

      {/* 3. Màn hình Cuộc gọi kết nối thành công (Connected) */}
      {callState === 'connected' && (
        <div style={styles.connectedContainer}>
          {/* Video đối phương (Toàn màn hình) */}
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            style={styles.remoteVideo} 
          />
          
          {/* Video bản thân (Thu nhỏ PiP ở góc phải) */}
          {videoEnabled ? (
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              style={styles.localVideo} 
            />
          ) : (
            <div style={styles.localVideoPlaceholder}>Camera tắt</div>
          )}

          {/* Thanh điều khiển cuộc gọi bên dưới */}
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
    borderRadius: '40px'
  }
};
