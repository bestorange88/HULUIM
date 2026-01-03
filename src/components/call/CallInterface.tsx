import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, X, Volume2, Phone, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CallQualityIndicator, { CallQuality } from './CallQualityIndicator';
import { trtcService } from '@/services/trtcService';
import { setupAndroidAudio } from '@/utils/androidCompat';

interface CallInterfaceProps {
  conversationId: string;
  callType: 'audio' | 'video';
  isInitiator: boolean;
  invitationId: string;
  onEndCall: (duration: number, wasConnected: boolean) => void;
  onCancelCall?: () => void;
  otherUser: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface QualityMetrics {
  quality: CallQuality;
  rtt?: number;
  packetLoss?: number;
  jitter?: number;
}

const CallInterface: React.FC<CallInterfaceProps> = ({
  callType,
  isInitiator,
  invitationId,
  onEndCall,
  onCancelCall,
  otherUser
}) => {
  const { toast } = useToast();
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(callType === 'audio');
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callStatus, setCallStatus] = useState<'connecting' | 'ringing' | 'connected' | 'reconnecting' | 'failed'>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [remoteVideoPlaying, setRemoteVideoPlaying] = useState(false);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics>({ quality: 'unknown' });
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [isLocalInMain, setIsLocalInMain] = useState(false); // false = remote in main, local in PIP

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isCleanedUpRef = useRef(false);
  const initializingRef = useRef(false);
  const initSeqRef = useRef(0); // For cancelling stale initialization
  const callTimerRef = useRef<number | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const wasConnectedRef = useRef(false);
  const finalDurationRef = useRef(0);
  const callTimeoutRef = useRef<number | null>(null);
  
  const ringbackCtxRef = useRef<AudioContext | null>(null);
  const ringbackTimerRef = useRef<number | null>(null);
  
  // Use refs to store callbacks to avoid useEffect dependency changes
  const onEndCallRef = useRef(onEndCall);
  const onCancelCallRef = useRef(onCancelCall);
  
  // Update refs when props change
  useEffect(() => {
    onEndCallRef.current = onEndCall;
    onCancelCallRef.current = onCancelCall;
  }, [onEndCall, onCancelCall]);
  
  const CALL_TIMEOUT_SECONDS = 30;

  useEffect(() => {
    console.log('[CallInterface] *** MOUNT ***', { isInitiator, invitationId, callType });
    return () => {
      console.log('[CallInterface] *** UNMOUNT ***', { isInitiator, invitationId, callType });
    };
  }, [isInitiator, invitationId, callType]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startCallTimer = useCallback(() => {
    if (callTimerRef.current) return;
    connectedAtRef.current = Date.now();
    wasConnectedRef.current = true;
    callTimerRef.current = window.setInterval(() => {
      if (connectedAtRef.current) {
        const elapsed = Math.floor((Date.now() - connectedAtRef.current) / 1000);
        setCallDuration(elapsed);
        finalDurationRef.current = elapsed;
      }
    }, 1000);
  }, []);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  const startRingback = useCallback(async () => {
    try {
      if (!isInitiator) return;
      if (ringbackCtxRef.current && ringbackCtxRef.current.state === 'suspended') {
        await ringbackCtxRef.current.resume();
        return;
      }
      const AudioCtx = (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext: typeof AudioContext }).AudioContext || 
                       (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx: AudioContext = ringbackCtxRef.current ?? new AudioCtx();
      ringbackCtxRef.current = ctx;

      const gain = ctx.createGain();
      gain.gain.value = 0.025;
      gain.connect(ctx.destination);

      const playBurst = () => {
        if (!ringbackCtxRef.current) return;
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        o1.type = 'sine';
        o2.type = 'sine';
        o1.frequency.value = 440;
        o2.frequency.value = 480;
        o1.connect(gain);
        o2.connect(gain);
        o1.start();
        o2.start();
        setTimeout(() => { try { o1.stop(); o2.stop(); } catch { /* ignore */ } }, 2000);
      };

      playBurst();
      ringbackTimerRef.current = window.setInterval(playBurst, 4000);
    } catch (err) {
      console.error('[CallInterface] Error starting ringback', err);
    }
  }, [isInitiator]);

  const stopRingback = useCallback(() => {
    if (ringbackTimerRef.current) {
      clearInterval(ringbackTimerRef.current);
      ringbackTimerRef.current = null;
    }
    if (ringbackCtxRef.current) {
      try { ringbackCtxRef.current.close(); } catch { /* ignore */ }
      ringbackCtxRef.current = null;
    }
  }, []);

  const stopCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
      console.log('[CallInterface] Call timeout cleared');
    }
  }, []);

  const cleanup = useCallback(async () => {
    if (isCleanedUpRef.current) {
      console.log('[CallInterface] Already cleaned up, skipping');
      return;
    }
    isCleanedUpRef.current = true;
    
    // Invalidate any ongoing initialization
    initSeqRef.current++;
    
    console.log('[CallInterface] Cleaning up call resources...');
    stopRingback();
    stopCallTimer();
    stopCallTimeout();
    
    // Add timeout protection for trtcService.leave()
    const leavePromise = trtcService.leave();
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log('[CallInterface] TRTC leave timeout, continuing cleanup');
        resolve();
      }, 3000);
    });
    await Promise.race([leavePromise, timeoutPromise]);
    
    if (channelRef.current) {
      console.log('[CallInterface] Removing signaling channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setHasRemoteVideo(false);
    setRemoteVideoPlaying(false);
    setRemoteUserId(null);
    
    console.log('[CallInterface] Cleanup complete');
  }, [stopRingback, stopCallTimer, stopCallTimeout]);

  const startCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) return;
    
    console.log(`[CallInterface] Starting ${CALL_TIMEOUT_SECONDS}s call timeout`);
    callTimeoutRef.current = window.setTimeout(async () => {
      console.log('[CallInterface] Call timeout - no answer');
      toast({
        title: '呼叫超时',
        description: '对方无应答',
      });
      
      if (!isCleanedUpRef.current) {
        await cleanup();
      }
      onEndCallRef.current(0, false);
    }, CALL_TIMEOUT_SECONDS * 1000);
  }, [toast, cleanup]);

  const sendSignal = useCallback(async (signal: { type: string }): Promise<void> => {
    if (channelRef.current) {
      console.log('[CallInterface] Sending signal:', signal.type);
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: signal
        });
        console.log('[CallInterface] Signal sent successfully:', signal.type);
      } catch (error) {
        console.error('[CallInterface] Error sending signal:', signal.type, error);
        throw error;
      }
    } else {
      console.warn('[CallInterface] Cannot send signal - channel not ready');
    }
  }, []);

  const initializeCall = useCallback(async () => {
    if (initializingRef.current || isCleanedUpRef.current) {
      console.log('[CallInterface] Already initializing or cleaned up, skipping');
      return;
    }
    initializingRef.current = true;
    
    // Record current sequence for cancellation check
    const currentSeq = ++initSeqRef.current;
    const isCancelled = () => initSeqRef.current !== currentSeq || isCleanedUpRef.current;

    console.log('[CallInterface] Initializing TRTC call...', { isInitiator, invitationId, callType, seq: currentSeq });

    try {
      const initialized = await trtcService.initialize(invitationId, callType, {
        onRemoteUserJoin: (userId) => {
          console.log('[CallInterface] Remote user joined:', userId);
          setRemoteUserId(userId);
          stopRingback();
          stopCallTimeout();
        },
        onRemoteUserLeave: (userId) => {
          console.log('[CallInterface] Remote user left:', userId);
          setRemoteUserId(null);
          if (!isCleanedUpRef.current) {
            toast({
              title: '通话结束',
              description: '对方已挂断',
            });
            cleanup().then(() => {
              onEndCallRef.current(finalDurationRef.current, wasConnectedRef.current);
            });
          }
        },
        onRemoteStreamAdd: (stream) => {
          console.log('[CallInterface] Remote stream added');
          // Stop timeout and ringback when stream is received (call is truly connected)
          stopCallTimeout();
          stopRingback();
          setCallStatus('connected');
          startCallTimer();
          
          // TRTC SDK play() requires container ID string or HTMLDivElement, not video/audio element
          // Play to the container div, SDK will create its own video/audio elements inside
          if (callType === 'video') {
            stream.play('remote-video-container', { muted: false }).then(() => {
              console.log('[CallInterface] Remote video playing');
              setHasRemoteVideo(true);
              setRemoteVideoPlaying(true);
            }).catch((e: Error) => {
              console.error('[CallInterface] Remote video play error:', e);
            });
          } else {
            // For audio-only calls, play to a container
            stream.play('remote-audio-container', { muted: false }).catch((e: Error) => {
              console.log('[CallInterface] Remote audio play error (may be normal):', e);
            });
          }
        },
        onRemoteStreamRemove: () => {
          console.log('[CallInterface] Remote stream removed');
          setHasRemoteVideo(false);
          setRemoteVideoPlaying(false);
        },
        onConnectionStateChange: (state) => {
          console.log('[CallInterface] Connection state changed:', state);
          
          if (state === 'CONNECTED') {
            setCallStatus('connected');
          } else if (state === 'DISCONNECTED') {
            setCallStatus('reconnecting');
          }
        },
        onError: (error) => {
          console.error('[CallInterface] TRTC error:', error);
          toast({
            title: '通话错误',
            description: error.message || '发生未知错误',
            variant: 'destructive'
          });
        }
      });

      if (!initialized) {
        throw new Error('Failed to initialize TRTC');
      }
      
      // Check if cancelled after initialization
      if (isCancelled()) {
        console.log('[CallInterface] Initialization cancelled after TRTC init');
        return;
      }

      const channel = supabase.channel(`call:${invitationId}`, {
        config: {
          broadcast: { self: false }
        }
      });

      channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        console.log('[CallInterface] Received signal:', payload?.type);
        
        if (payload?.type === 'end-call') {
          console.log('[CallInterface] Received end-call signal');
          if (!isCleanedUpRef.current) {
            toast({
              title: '通话结束',
              description: '对方已挂断',
            });
            await cleanup();
            onEndCallRef.current(finalDurationRef.current, wasConnectedRef.current);
          }
        }else if (payload?.type === 'callee-ready') {
          console.log('[CallInterface] Callee ready signal received');
          stopRingback();
          stopCallTimeout();
        }
      });

      await channel.subscribe();
      channelRef.current = channel;
      console.log('[CallInterface] Signaling channel subscribed');
      
      // Check if cancelled after channel subscribe
      if (isCancelled()) {
        console.log('[CallInterface] Initialization cancelled after channel subscribe');
        return;
      }

      const joined = await trtcService.joinRoom();
      if (!joined) {
        throw new Error('Failed to join TRTC room');
      }
      
      // Check if cancelled after joining room
      if (isCancelled()) {
        console.log('[CallInterface] Initialization cancelled after join room');
        return;
      }

      const localStream = await trtcService.publishLocalStream(callType);
      if (!localStream) {
        throw new Error('Failed to publish local stream');
      }
      
      // Check if cancelled after publishing stream
      if (isCancelled()) {
        console.log('[CallInterface] Initialization cancelled after publish stream');
        return;
      }

      if (callType === 'video') {
        trtcService.playLocalStream('local-video-container');
        console.log('[CallInterface] Local video preview started');
      }

      if (isInitiator) {
        setCallStatus('ringing');
        startRingback();
        startCallTimeout();
      } else {
        await sendSignal({ type: 'callee-ready' });
        setCallStatus('connecting');
      }

      console.log('[CallInterface] TRTC call initialized successfully, seq:', currentSeq);

    } catch (error) {
      console.error('[CallInterface] Error initializing call:', error);
      toast({
        title: '通话初始化失败',
        description: (error as Error).message || '请检查网络连接和设备权限',
        variant: 'destructive'
      });
      
      if (!isCleanedUpRef.current) {
        await cleanup();
        onEndCallRef.current(0, false);
      }
    }
  }, [isInitiator, invitationId, callType, toast, cleanup, sendSignal, startRingback, stopRingback, startCallTimeout, stopCallTimeout, startCallTimer]);

  useEffect(() => {
    initializeCall();
    
    return () => {
      cleanup();
    };
  }, [initializeCall, cleanup]);

  const switchCamera = async () => {
    if (isSwitchingCamera) return;
    
    setIsSwitchingCamera(true);
    try {
      const success = await trtcService.switchCamera();
      if (!success) {
        toast({
          title: '切换失败',
          description: '只有一个摄像头可用',
        });
      }
    } catch (error) {
      console.error('[CallInterface] Switch camera error:', error);
      toast({
        title: '切换摄像头失败',
        description: '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  const toggleAudio = () => {
    const newMuted = !isAudioMuted;
    trtcService.muteLocalAudio(newMuted);
    setIsAudioMuted(newMuted);
    console.log('[CallInterface] Audio muted:', newMuted);
  };

  const toggleVideo = () => {
    const newMuted = !isVideoMuted;
    trtcService.muteLocalVideo(newMuted);
    setIsVideoMuted(newMuted);
    console.log('[CallInterface] Video muted:', newMuted);
  };

  const toggleSpeaker = () => {
    const newSpeakerOn = !isSpeakerOn;
    setIsSpeakerOn(newSpeakerOn);
    console.log('[CallInterface] Speaker mode:', newSpeakerOn ? 'speaker' : 'earpiece');
  };

  // 切换画中画和主画面
  const toggleVideoLayout = useCallback(() => {
    if (!hasRemoteVideo) return;
    
    const newIsLocalInMain = !isLocalInMain;
    setIsLocalInMain(newIsLocalInMain);
    console.log('[CallInterface] Toggling video layout, newIsLocalInMain:', newIsLocalInMain);
    
    // 重新播放视频流到新的容器
    const localStream = trtcService.getLocalStream();
    const remoteStream = remoteUserId ? trtcService.getRemoteStream(remoteUserId) : null;
    
    if (localStream && remoteStream) {
      // 停止当前播放
      try {
        localStream.stop();
        remoteStream.stop();
      } catch (e) {
        console.log('[CallInterface] Stop stream error (may be normal):', e);
      }
      
      // 根据新的布局重新播放
      // remote-video-container = 主画面（全屏）
      // local-video-container = 画中画（右上角小窗）
      setTimeout(() => {
        if (newIsLocalInMain) {
          // 切换后：本地在主画面，远端在画中画
          localStream.play('remote-video-container', { muted: true }).catch((e: Error) => {
            console.error('[CallInterface] Local video play error:', e);
          });
          remoteStream.play('local-video-container', { muted: false }).catch((e: Error) => {
            console.error('[CallInterface] Remote video play error:', e);
          });
        } else {
          // 切换后：远端在主画面，本地在画中画（默认状态）
          remoteStream.play('remote-video-container', { muted: false }).catch((e: Error) => {
            console.error('[CallInterface] Remote video play error:', e);
          });
          localStream.play('local-video-container', { muted: true }).catch((e: Error) => {
            console.error('[CallInterface] Local video play error:', e);
          });
        }
      }, 100);
    }
  }, [hasRemoteVideo, isLocalInMain, remoteUserId]);

  const handleEndCall = async () => {
    if (isEndingCall || isCleanedUpRef.current) {
      console.log('[CallInterface] End call already in progress, ignoring');
      return;
    }
    setIsEndingCall(true);
    
    console.log('[CallInterface] End call button clicked');
    
    if (invitationId) {
      try {
        const newStatus = wasConnectedRef.current ? 'completed' : 'expired';
        await supabase
          .from('call_invitations')
          .update({ 
            status: newStatus, 
            updated_at: new Date().toISOString(),
            duration: finalDurationRef.current
          })
          .eq('id', invitationId);
        console.log('[CallInterface] Database status updated to', newStatus);
      } catch (e) {
        console.warn('[CallInterface] Error updating database status:', e);
      }
    }
    
    try {
      await sendSignal({ type: 'end-call' });
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      console.warn('[CallInterface] Error sending end-call signal:', e);
    }
    
    await cleanup();
    onEndCallRef.current(finalDurationRef.current, wasConnectedRef.current);
  };

  const handleCancelCall = async () => {
    if (isEndingCall || isCleanedUpRef.current) {
      console.log('[CallInterface] Cancel call already in progress, ignoring');
      return;
    }
    setIsEndingCall(true);
    
    console.log('[CallInterface] Cancel call button clicked');
    
    if (invitationId) {
      try {
        await supabase
          .from('call_invitations')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', invitationId);
        console.log('[CallInterface] Database status updated to cancelled');
      } catch (e) {
        console.warn('[CallInterface] Error updating database status:', e);
      }
    }
    
    try {
      await sendSignal({ type: 'end-call' });
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      console.warn('[CallInterface] Error sending end-call signal:', e);
    }
    
    await cleanup();
    if (onCancelCallRef.current) {
      onCancelCallRef.current();
    } else {
      onEndCallRef.current(0, false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[90] bg-background flex flex-col safe-area-all"
      style={{ 
        height: '100dvh',
        maxHeight: '-webkit-fill-available'
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute z-10 fixed-top-safe"
        style={{ top: 'calc(var(--safe-area-inset-top, 0px) + 16px)', right: '16px' }}
        onClick={handleCancelCall}
      >
        <X className="h-6 w-6" />
      </Button>
      
      <div className="flex-1 relative bg-muted flex items-center justify-center overflow-hidden">
        {/* Main video container - shows remote by default, or local when swapped */}
        {callType === 'video' && (
          <div
            id="remote-video-container"
            className="w-full h-full absolute inset-0"
            style={{ 
              backgroundColor: 'black',
              opacity: hasRemoteVideo ? 1 : 0,
              zIndex: hasRemoteVideo ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out'
            }}
          />
        )}

        {(callType === 'audio' || !hasRemoteVideo) && (
          <div className="flex flex-col items-center gap-4 z-10">
            <Avatar className="w-32 h-32">
              <AvatarImage src={otherUser.avatar_url || undefined} />
              <AvatarFallback className="text-4xl">
                {otherUser.display_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h2 className="text-2xl font-semibold">{otherUser.display_name}</h2>
              <p className="text-muted-foreground mt-2">
                {callStatus === 'connecting' && '正在连接...'}
                {callStatus === 'ringing' && '呼叫中...'}
                {callStatus === 'connected' && (callType === 'video' && !hasRemoteVideo ? '等待视频...' : '通话中')}
                {callStatus === 'reconnecting' && '正在重连...'}
                {callStatus === 'failed' && '连接失败'}
              </p>
            </div>
          </div>
        )}

        {/* Hidden container for remote audio stream - TRTC SDK will create audio element inside */}
        <div 
          id="remote-audio-container"
          className="hidden"
          style={{ display: 'none', position: 'absolute', width: 0, height: 0 }}
        />

        {/* Local video container (PIP) - Click to swap with main view */}
        {callType === 'video' && (
          <div 
            id="local-video-container"
            className="absolute top-16 right-4 w-32 h-44 rounded-lg overflow-hidden shadow-lg bg-black border-2 border-white/30 cursor-pointer hover:border-white/60 transition-colors"
            style={{ zIndex: 10 }}
            onClick={toggleVideoLayout}
            title="点击切换画面"
          />
        )}
        
        {/* CSS for TRTC SDK generated video elements */}
        <style>{`
          #remote-video-container video {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          #local-video-container video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: scaleX(-1);
          }
        `}</style>

        <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-lg">
          <p className="text-sm font-medium">
            {callStatus === 'connecting' && '正在连接...'}
            {callStatus === 'ringing' && '呼叫中...'}
            {callStatus === 'connected' && (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                通话中
              </span>
            )}
            {callStatus === 'reconnecting' && (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />
                正在重连...
              </span>
            )}
            {callStatus === 'failed' && (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                连接失败
              </span>
            )}
          </p>
          {callStatus === 'connected' && (
            <>
              <p className="text-lg font-mono text-center mt-1">{formatDuration(callDuration)}</p>
              <div className="mt-2 flex justify-center">
                <CallQualityIndicator
                  quality={qualityMetrics.quality}
                  rtt={qualityMetrics.rtt}
                  packetLoss={qualityMetrics.packetLoss}
                  jitter={qualityMetrics.jitter}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div 
        className="w-full max-w-screen-sm mx-auto px-2 py-3 bg-background border-t flex flex-wrap justify-center items-center gap-2 safe-area-bottom flex-shrink-0"
        style={{ 
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
          minHeight: '60px'
        }}
      >
        <Button
          variant={isAudioMuted ? "destructive" : "secondary"}
          size="lg"
          className="rounded-full w-9 h-9 sm:w-11 sm:h-11"
          onClick={toggleAudio}
        >
          {isAudioMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
        </Button>

        <Button
          variant="secondary"
          size="lg"
          className={`rounded-full w-9 h-9 sm:w-11 sm:h-11 ${isSpeakerOn ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
          onClick={toggleSpeaker}
          title={isSpeakerOn ? '切换到听筒' : '切换到扬声器'}
        >
          {isSpeakerOn ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Phone className="w-4 h-4 sm:w-5 sm:h-5" />}
        </Button>

        {callType === 'video' && (
          <>
            <Button
              variant={isVideoMuted ? "destructive" : "secondary"}
              size="lg"
              className="rounded-full w-9 h-9 sm:w-11 sm:h-11"
              onClick={toggleVideo}
            >
              {isVideoMuted ? <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Video className="w-4 h-4 sm:w-5 sm:h-5" />}
            </Button>
            
            <Button
              variant="secondary"
              size="lg"
              className="rounded-full w-9 h-9 sm:w-11 sm:h-11"
              onClick={switchCamera}
              disabled={isSwitchingCamera}
            >
              <SwitchCamera className={`w-4 h-4 sm:w-5 sm:h-5 ${isSwitchingCamera ? 'animate-spin' : ''}`} />
            </Button>
          </>
        )}

        <Button
          variant="destructive"
          size="lg"
          className="rounded-full w-9 h-9 sm:w-11 sm:h-11"
          onClick={callStatus === 'ringing' || callStatus === 'connecting' ? handleCancelCall : handleEndCall}
          disabled={isEndingCall}
        >
          <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
      </div>
    </div>
  );
};

export default CallInterface;
