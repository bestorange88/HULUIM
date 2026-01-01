import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, X, Volume2, Phone, SwitchCamera, MonitorUp, MonitorOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CallQualityIndicator, { CallQuality, calculateQuality } from './CallQualityIndicator';
import { 
  isAndroid, 
  isIOS, 
  isMobile, 
  unlockAndroidAudio, 
  getAndroidMediaConstraints,
  setupAndroidVideo,
  setupAndroidAudio,
  playMediaWithFallback
} from '@/utils/androidCompat';
import { setAudioOutput, AudioOutputDevice } from '@/utils/audioRouting';

interface CallInterfaceProps {
  conversationId: string;
  callType: 'audio' | 'video';
  isInitiator: boolean;
  invitationId: string; // Add unique invitation ID for channel isolation
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
  conversationId,
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
  const [isSpeakerOn, setIsSpeakerOn] = useState(false); // Default to earpiece mode for privacy
  const [callStatus, setCallStatus] = useState<'connecting' | 'ringing' | 'connected' | 'reconnecting' | 'failed'>('connecting');
  
  // DIAGNOSTIC: Track actual mount/unmount vs re-renders
  // This log runs on every render (including re-renders)
  console.log("[CallInterface] RENDER", { isInitiator, invitationId, callType });
  const [connectionState, setConnectionState] = useState<string>('new');
  const [callDuration, setCallDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [remoteVideoPlaying, setRemoteVideoPlaying] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics>({ quality: 'unknown' });
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const isCleanedUpRef = useRef(false);
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const initializingRef = useRef(false);
  const callTimerRef = useRef<number | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const statsIntervalRef = useRef<number | null>(null);
  const prevBytesReceivedRef = useRef<number>(0);
  const prevPacketsLostRef = useRef<number>(0);
  const prevPacketsReceivedRef = useRef<number>(0);
  const wasConnectedRef = useRef(false);
  const finalDurationRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const readySignalSentRef = useRef(false);
  const offerReceivedRef = useRef(false);
  const offerSentRef = useRef(false); // Track if offer was already sent
  const appliedIceCandidatesRef = useRef<number>(0); // Track how many ICE candidates we have applied from DB
  const audioContextRef = useRef<AudioContext | null>(null);
  const maxReconnectAttempts = 3;
  
  // Ringback tone while waiting for the callee to answer (outgoing calls)
  const ringbackCtxRef = useRef<AudioContext | null>(null);
  const ringbackTimerRef = useRef<number | null>(null);
  const callTimeoutRef = useRef<number | null>(null);
  
    const CALL_TIMEOUT_SECONDS = 30;

    // DIAGNOSTIC: Track actual mount/unmount (this only runs once on mount and cleanup on unmount)
    useEffect(() => {
      console.log('[CallInterface] *** MOUNT ***', { isInitiator, invitationId, callType });
      return () => {
        console.log('[CallInterface] *** UNMOUNT ***', { isInitiator, invitationId, callType });
      };
    }, []);

    // Unlock audio context for Android (must be called from user gesture)
  const unlockAudio = useCallback(async () => {
    if (audioUnlocked) return;
    
    console.log('[CallInterface] Attempting to unlock audio, isAndroid:', isAndroid());
    
    // Use a timeout to prevent hanging
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Audio unlock timeout')), 3000);
    });
    
    const unlockPromise = async () => {
      try {
        // Use Android compat utility for Android devices
        if (isAndroid()) {
          const ctx = await unlockAndroidAudio();
          if (ctx) {
            audioContextRef.current = ctx;
          }
        } else {
          // Create and resume AudioContext for other devices
          const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioCtx();
          }
          
          if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
            console.log('[CallInterface] AudioContext resumed');
          }
          
          // Play a silent buffer to unlock audio
          const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
          const source = audioContextRef.current.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContextRef.current.destination);
          source.start(0);
        }
        
        // Setup audio/video elements but DON'T try to play them yet (no stream attached)
        if (remoteAudioRef.current) {
          setupAndroidAudio(remoteAudioRef.current);
        }
        
        if (callType === 'video' && remoteVideoRef.current) {
          setupAndroidVideo(remoteVideoRef.current);
        }
        
        setAudioUnlocked(true);
        console.log('[CallInterface] Audio unlocked successfully');
      } catch (e) {
        console.error('[CallInterface] Audio unlock error:', e);
        // Still mark as unlocked to continue initialization
        setAudioUnlocked(true);
      }
    };
    
    try {
      await Promise.race([unlockPromise(), timeoutPromise]);
    } catch (e) {
      console.warn('[CallInterface] Audio unlock timed out or failed, continuing anyway');
      setAudioUnlocked(true);
    }
  }, [audioUnlocked, callType]);

  // Format call duration as mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start call timer
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
  }, [invitationId]);

  // Stop call timer
  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, [invitationId]);

  // Monitor call quality stats
  const startStatsMonitoring = useCallback(() => {
    if (statsIntervalRef.current) return;
    
    statsIntervalRef.current = window.setInterval(async () => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        const stats = await pc.getStats();
        let rtt: number | undefined;
        let packetsLost = 0;
        let packetsReceived = 0;
        let jitter: number | undefined;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : undefined;
          }
          
          if (report.type === 'inbound-rtp' && (report.kind === 'audio' || report.kind === 'video')) {
            packetsLost += report.packetsLost || 0;
            packetsReceived += report.packetsReceived || 0;
            if (report.jitter !== undefined) {
              jitter = report.jitter * 1000; // Convert to ms
            }
          }
        });

        // Calculate packet loss rate
        const totalPackets = packetsReceived + packetsLost;
        const packetLoss = totalPackets > 0 
          ? ((packetsLost - prevPacketsLostRef.current) / 
             Math.max(1, (packetsReceived - prevPacketsReceivedRef.current) + (packetsLost - prevPacketsLostRef.current))) * 100
          : 0;

        prevPacketsLostRef.current = packetsLost;
        prevPacketsReceivedRef.current = packetsReceived;

        const quality = calculateQuality(rtt, Math.max(0, packetLoss), jitter);
        
        setQualityMetrics({
          quality,
          rtt,
          packetLoss: Math.max(0, packetLoss),
          jitter
        });
      } catch (error) {
        console.error('[CallInterface] Error getting stats:', error);
      }
    }, 2000); // Check every 2 seconds
  }, [invitationId]);

  // Stop stats monitoring
  const stopStatsMonitoring = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  }, [invitationId]);

  const startRingback = useCallback(async () => {
    try {
      if (!isInitiator) return;
      if (ringbackCtxRef.current && ringbackCtxRef.current.state === 'suspended') {
        await ringbackCtxRef.current.resume();
        return;
      }
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
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
        setTimeout(() => { try { o1.stop(); o2.stop(); } catch {} }, 2000);
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
      try { ringbackCtxRef.current.close(); } catch {}
      ringbackCtxRef.current = null;
    }
  }, [invitationId]);

  // Stop call timeout
  const stopCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
      console.log('[CallInterface] Call timeout cleared');
    }
  }, [invitationId]);

  const cleanup = useCallback(() => {
    if (isCleanedUpRef.current) {
      console.log('[CallInterface] Already cleaned up, skipping');
      return;
    }
    isCleanedUpRef.current = true;
    
    console.log('[CallInterface] Cleaning up call resources...');
    stopRingback();
    stopCallTimer();
    stopStatsMonitoring();
    stopCallTimeout();
    
    // Clear reconnect timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    // Stop screen sharing if active
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log('[CallInterface] Stopping track:', track.kind);
        track.stop();
      });
      localStreamRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      console.log('[CallInterface] Closing peer connection');
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (channelRef.current) {
      console.log('[CallInterface] Removing signaling channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setRemoteStream(null);
    setIsScreenSharing(false);
    setReconnectAttempts(0);
    
    // Reset ICE candidate tracking refs for next call
    appliedIceCandidatesRef.current = 0;
    pendingCandidatesRef.current = [];
    console.log('[CallInterface] Reset ICE candidate refs for next call');
  }, [stopRingback, stopCallTimer, stopStatsMonitoring, stopCallTimeout]);

  // Start call timeout for unanswered calls (must be after cleanup is defined)
  const startCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) return;
    
    console.log(`[CallInterface] Starting ${CALL_TIMEOUT_SECONDS}s call timeout`);
    callTimeoutRef.current = window.setTimeout(() => {
      console.log('[CallInterface] Call timeout - no answer');
      toast({
        title: '呼叫超时',
        description: '对方无应答',
      });
      // Mark as cleaned up and end call
      if (!isCleanedUpRef.current) {
        isCleanedUpRef.current = true;
        stopRingback();
        stopCallTimer();
        stopStatsMonitoring();
        stopCallTimeout();
        
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
          localStreamRef.current = null;
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
        setRemoteStream(null);
        // Reset ICE candidate tracking refs
        appliedIceCandidatesRef.current = 0;
        pendingCandidatesRef.current = [];
      }
      onEndCall(0, false);
    }, CALL_TIMEOUT_SECONDS * 1000);
  }, [onEndCall, toast, stopRingback, stopCallTimer, stopStatsMonitoring, stopCallTimeout]);

  const sendSignal = useCallback(async (signal: any): Promise<void> => {
    if (channelRef.current) {
      console.log('[CallInterface] Sending signal:', signal.type, 'invitationId:', invitationId, 'isInitiator:', isInitiator);
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
  }, [invitationId]);

  // Attempt ICE restart for reconnection (must be after sendSignal is defined)
  const attemptReconnect = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || isCleanedUpRef.current) {
      console.log('[CallInterface] Cannot reconnect - no peer connection or cleaned up');
      return;
    }

    setReconnectAttempts(prev => {
      const newAttempts = prev + 1;
      console.log(`[CallInterface] Reconnect attempt ${newAttempts}/${maxReconnectAttempts}`);
      
      if (newAttempts > maxReconnectAttempts) {
        console.log('[CallInterface] Max reconnect attempts reached, ending call');
        toast({
          title: '连接断开',
          description: '无法重新建立连接',
          variant: 'destructive'
        });
        // End the call
        if (!isCleanedUpRef.current) {
          isCleanedUpRef.current = true;
          stopRingback();
          stopCallTimer();
          stopStatsMonitoring();
          stopCallTimeout();
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
          }
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
          }
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }
          setRemoteStream(null);
        }
        onEndCall(finalDurationRef.current, wasConnectedRef.current);
        return newAttempts;
      }
      
      return newAttempts;
    });

    try {
      setCallStatus('reconnecting');
      console.log('[CallInterface] Attempting ICE restart...');
      
      // Create new offer with ICE restart
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      
      // Send the new offer
      sendSignal({ type: 'offer', sdp: offer.sdp, sdpType: offer.type });
      
      toast({
        title: '正在重连',
        description: '网络波动，正在尝试重新连接...',
      });
    } catch (error) {
      console.error('[CallInterface] Error during reconnect:', error);
    }
  }, [onEndCall, sendSignal, stopRingback, stopCallTimer, stopStatsMonitoring, stopCallTimeout, toast]);

  // Schedule reconnection with delay
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    
    // Wait 2 seconds before attempting reconnect
    reconnectTimerRef.current = window.setTimeout(() => {
      attemptReconnect();
    }, 2000);
  }, [attemptReconnect]);

  const handleSignal = useCallback(async (signal: any) => {
    const peerConnection = peerConnectionRef.current;
    
    console.log('[CallInterface] Handling signal:', signal.type, 'PC ready:', !!peerConnection);

    try {
      // Handle call-accepted signal - callee accepted, initiator should prepare offer
      if (signal.type === 'call-accepted') {
        console.log('[CallInterface] Received call-accepted signal, isInitiator:', isInitiator);
        if (isInitiator && peerConnection && !offerSentRef.current) {
          console.log('[CallInterface] Call accepted via broadcast, creating offer');
          // Small delay to let callee's CallInterface initialize
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          if (!offerSentRef.current && peerConnection.signalingState === 'stable') {
            offerSentRef.current = true;
            try {
              const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: callType === 'video'
              });
              await peerConnection.setLocalDescription(offer);
              sendSignal({ type: 'offer', sdp: offer.sdp, sdpType: offer.type });
              console.log('[CallInterface] Offer sent after call-accepted signal');
            } catch (err) {
              console.error('[CallInterface] Error creating offer after accepted:', err);
              offerSentRef.current = false;
            }
          }
        }
        return;
      }

      // Handle ready signal - callee is ready, initiator should send offer
      if (signal.type === 'ready') {
        console.log('[CallInterface] Received ready signal, isInitiator:', isInitiator, 'hasPeerConnection:', !!peerConnection);
        if (isInitiator && peerConnection) {
          // Only send offer if not already sent
          if (!offerSentRef.current && peerConnection.signalingState === 'stable') {
            console.log('[CallInterface] Callee is ready, creating and storing offer in DB');
            offerSentRef.current = true;
            try {
              const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: callType === 'video'
              });
              await peerConnection.setLocalDescription(offer);
              
              // Store offer in database instead of sending via Realtime
              const { error: updateError } = await supabase
                .from('call_invitations')
                .update({ offer_sdp: offer.sdp, offer_type: offer.type })
                .eq('id', invitationId);
              
              if (updateError) {
                console.error('[CallInterface] Error storing offer in DB:', updateError);
                offerSentRef.current = false;
                return;
              }
              
              // Send small notification signal
              sendSignal({ type: 'offer-ready' });
              console.log('[CallInterface] Offer stored in DB and notification sent');
            } catch (err) {
              console.error('[CallInterface] Error creating/storing offer:', err);
              offerSentRef.current = false; // Reset so it can be retried
            }
          } else {
            console.log('[CallInterface] Cannot send offer - alreadySent:', offerSentRef.current, 'signalingState:', peerConnection.signalingState);
          }
        } else if (isInitiator && !peerConnection) {
          console.warn('[CallInterface] Ready signal received but peerConnection not ready yet');
        }
        return;
      }
      
      // Handle caller-ready signal - caller confirmed they're ready, callee should resend ready
      if (signal.type === 'caller-ready') {
        console.log('[CallInterface] Received caller-ready signal, isInitiator:', isInitiator);
        if (!isInitiator && peerConnection && !offerReceivedRef.current) {
          console.log('[CallInterface] Caller is ready, resending ready signal');
          sendSignal({ type: 'ready' });
        }
        return;
      }

      // Handle offer-ready signal - fetch offer from database
      if (signal.type === 'offer-ready') {
        if (isInitiator) {
          console.log('[CallInterface] Ignoring offer-ready as initiator');
          return;
        }
        if (!peerConnection) {
          console.warn('[CallInterface] PeerConnection not ready for offer-ready signal');
          return;
        }
        
        offerReceivedRef.current = true; // Stop ready signal retries
        console.log('[CallInterface] Fetching offer from database...');
        
        const { data: invitation, error: fetchError } = await supabase
          .from('call_invitations')
          .select('offer_sdp, offer_type')
          .eq('id', invitationId)
          .single();
        
        if (fetchError || !invitation?.offer_sdp) {
          console.error('[CallInterface] Error fetching offer from DB:', fetchError);
          return;
        }
        
        console.log('[CallInterface] Setting remote description (offer from DB)');
        await peerConnection.setRemoteDescription(new RTCSessionDescription({ 
          type: invitation.offer_type as RTCSdpType, 
          sdp: invitation.offer_sdp 
        }));
        
        for (const candidate of pendingCandidatesRef.current) {
          await peerConnection.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current = [];
        
        console.log('[CallInterface] Creating answer');
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Store answer in database instead of sending via Realtime
        const { error: updateError } = await supabase
          .from('call_invitations')
          .update({ answer_sdp: answer.sdp, answer_type: answer.type })
          .eq('id', invitationId);
        
        if (updateError) {
          console.error('[CallInterface] Error storing answer in DB:', updateError);
          return;
        }
        
        // Send small notification signal
        sendSignal({ type: 'answer-ready' });
        console.log('[CallInterface] Answer stored in DB and notification sent');
        
        // Callee: mark as connected after sending answer
        console.log('[CallInterface] Callee marking call as connected');
        setCallStatus('connected');
        startCallTimer();
        startStatsMonitoring();
        return;
      }

      // Handle answer-ready signal - fetch answer from database
      if (signal.type === 'answer-ready') {
        if (!isInitiator) {
          console.log('[CallInterface] Ignoring answer-ready as non-initiator');
          return;
        }
        if (!peerConnection) {
          console.warn('[CallInterface] PeerConnection not ready for answer-ready signal');
          return;
        }
        
        // Only set remote description if we're in the right state (waiting for answer)
        if (peerConnection.signalingState !== 'have-local-offer') {
          console.log('[CallInterface] Ignoring answer-ready - PC state is:', peerConnection.signalingState);
          return;
        }
        
        console.log('[CallInterface] Fetching answer from database...');
        
        const { data: invitation, error: fetchError } = await supabase
          .from('call_invitations')
          .select('answer_sdp, answer_type')
          .eq('id', invitationId)
          .single();
        
        if (fetchError || !invitation?.answer_sdp) {
          console.error('[CallInterface] Error fetching answer from DB:', fetchError);
          return;
        }
        
        console.log('[CallInterface] Setting remote description (answer from DB)');
        await peerConnection.setRemoteDescription(new RTCSessionDescription({ 
          type: invitation.answer_type as RTCSdpType, 
          sdp: invitation.answer_sdp 
        }));
        
        for (const candidate of pendingCandidatesRef.current) {
          await peerConnection.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current = [];
        
        // Caller: mark as connected after receiving answer
        console.log('[CallInterface] Caller marking call as connected');
        setCallStatus('connected');
        stopRingback();
        stopCallTimeout(); // Cancel the timeout since call was answered
        startCallTimer();
        startStatsMonitoring();
        return;
      }

      if (!peerConnection) {
        console.warn('[CallInterface] PeerConnection not ready for signal:', signal.type);
        return;
      }

      console.log('[CallInterface] PC state:', peerConnection.signalingState);

      // Legacy offer handling (for backwards compatibility or ICE restart)
      if (signal.type === 'offer') {
        if (isInitiator) {
          console.log('[CallInterface] Ignoring offer as initiator');
          return;
        }
        
        offerReceivedRef.current = true; // Stop ready signal retries
        console.log('[CallInterface] Setting remote description (offer)');
        await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: signal.sdpType, sdp: signal.sdp }));
        
        for (const candidate of pendingCandidatesRef.current) {
          await peerConnection.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current = [];
        
        console.log('[CallInterface] Creating answer');
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        sendSignal({ type: 'answer', sdp: answer.sdp, sdpType: answer.type });
        
        // Callee: mark as connected after sending answer
        console.log('[CallInterface] Callee marking call as connected');
        setCallStatus('connected');
        startCallTimer();
        startStatsMonitoring();
        
      } else if (signal.type === 'answer') {
        // Legacy answer handling (for backwards compatibility or ICE restart)
        if (!isInitiator) {
          console.log('[CallInterface] Ignoring answer as non-initiator');
          return;
        }
        
        // Only set remote description if we're in the right state (waiting for answer)
        if (peerConnection.signalingState !== 'have-local-offer') {
          console.log('[CallInterface] Ignoring answer - PC state is:', peerConnection.signalingState);
          return;
        }
        
        console.log('[CallInterface] Setting remote description (answer)');
        await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: signal.sdpType, sdp: signal.sdp }));
        
        for (const candidate of pendingCandidatesRef.current) {
          await peerConnection.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current = [];
        
        // Caller: mark as connected after receiving answer
        console.log('[CallInterface] Caller marking call as connected');
        setCallStatus('connected');
        stopRingback();
        stopCallTimeout(); // Cancel the timeout since call was answered
        startCallTimer();
        startStatsMonitoring();
        
      } else if (signal.type === 'ice-candidate') {
        if (peerConnection.remoteDescription) {
          console.log('[CallInterface] Adding ICE candidate');
          await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          console.log('[CallInterface] Queueing ICE candidate');
          pendingCandidatesRef.current.push(new RTCIceCandidate(signal.candidate));
        }
        
      } else if (signal.type === 'end-call') {
        console.log('[CallInterface] Received end-call signal');
        cleanup();
        onEndCall(finalDurationRef.current, wasConnectedRef.current);
      }
    } catch (error) {
      console.error('[CallInterface] Error handling signal:', error);
    }
  }, [isInitiator, callType, sendSignal, cleanup, onEndCall, stopRingback, stopCallTimeout, startCallTimer, startStatsMonitoring]);

  const initializeCall = useCallback(async () => {
    // Get current user ID for diagnostic logging
    let currentUserId = 'unknown';
    try {
      const { data: userData } = await supabase.auth.getUser();
      currentUserId = userData?.user?.id || 'no-user';
    } catch (e) {
      currentUserId = 'auth-error';
    }
    
    console.log("[CallInterface] initializeCall START", { 
      isInitiator, 
      invitationId, 
      callType, 
      currentUserId,
      initializingRef: initializingRef.current,
      userAgent: navigator.userAgent.substring(0, 80)
    });
    
    if (isCleanedUpRef.current || initializingRef.current) {
      console.log('[CallInterface] Skip initialize - already cleaned up or initializing', { currentUserId });
      return;
    }
    initializingRef.current = true;
    
    // Reset refs for this call
    offerSentRef.current = false;
    offerReceivedRef.current = false;
    readySignalSentRef.current = false;
    
    try {
      console.log('[CallInterface] Initializing call', { 
        isInitiator, 
        isAndroid: isAndroid(), 
        isIOS: isIOS(),
        currentUserId
      });
      
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('您的设备不支持音视频通话功能，请确保应用有摄像头和麦克风权限');
      }
      
      // Pre-unlock audio on Android before getting media
      if (isAndroid()) {
        console.log('[CallInterface] Android: Pre-unlocking audio');
        await unlockAudio();
      }
      
      // Use Android compat utility for constraints
      let constraints: MediaStreamConstraints;
      if (isAndroid()) {
        if (callType === 'video') {
          constraints = getAndroidMediaConstraints('both');
        } else {
          constraints = getAndroidMediaConstraints('audio');
        }
        // Override facingMode if needed
        if (callType === 'video' && typeof constraints.video === 'object') {
          constraints.video.facingMode = facingMode;
        }
      } else {
        const audioConstraints: boolean | MediaTrackConstraints = true;
        const videoConstraints: boolean | MediaTrackConstraints = callType === 'video' ? { 
          width: 1280, 
          height: 720,
          facingMode: facingMode 
        } : false;
        constraints = { audio: audioConstraints, video: videoConstraints };
      }

      console.log('[CallInterface] Requesting media with constraints:', JSON.stringify(constraints));
      
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (mediaError: any) {
        console.error('[CallInterface] getUserMedia error:', mediaError.name, mediaError.message);
        
        if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
          throw new Error('请在系统设置中允许应用访问摄像头和麦克风');
        } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
          throw new Error('未找到摄像头或麦克风设备');
        } else if (mediaError.name === 'NotReadableError' || mediaError.name === 'TrackStartError') {
          throw new Error('摄像头或麦克风被其他应用占用');
        } else if (mediaError.name === 'OverconstrainedError') {
          // Try with simpler constraints
          console.log('[CallInterface] Retrying with basic constraints');
          try {
            stream = await navigator.mediaDevices.getUserMedia({ 
              audio: true, 
              video: callType === 'video' 
            });
          } catch (retryError) {
            throw new Error('设备不支持请求的媒体格式');
          }
        } else {
          throw new Error(`媒体访问失败: ${mediaError.message || mediaError.name}`);
        }
      }
      
      localStreamRef.current = stream;
      setLocalStream(stream); // Also set state to trigger re-renders
      console.log('[CallInterface] Got local stream with tracks:', stream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}:${t.label}`));

      // Set local video preview for video calls
      if (localVideoRef.current && callType === 'video') {
        const videoTracks = stream.getVideoTracks();
        console.log('[CallInterface] Setting local video preview, video tracks:', videoTracks.length, videoTracks.map(t => t.label));
        
        if (videoTracks.length === 0) {
          console.error('[CallInterface] NO VIDEO TRACKS - camera may not be accessible');
          toast({
            title: '摄像头无法访问',
            description: '请检查摄像头权限设置',
            variant: 'destructive'
          });
        }
        
        setupAndroidVideo(localVideoRef.current);
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true; // Muted to prevent echo
        
        // Force play with retry for Android
        const playLocalVideo = async () => {
          try {
            await localVideoRef.current?.play();
            console.log('[CallInterface] Local video playing successfully');
          } catch (e: any) {
            console.log('[CallInterface] Local video play error:', e.message);
            // Retry after a short delay
            setTimeout(() => {
              localVideoRef.current?.play().catch(() => {});
            }, 500);
          }
        };
        playLocalVideo();
      }

      // Fetch dynamic TURN credentials from edge function (paid TURN servers only, no free fallback)
      let iceServers: RTCIceServer[] = [];
      
      try {
        console.log('[CallInterface] Fetching paid TURN credentials...', { invitationId });
        const { data, error } = await supabase.functions.invoke('get-turn-credentials');
        
        // Log detailed TURN response for debugging
        console.log('[CallInterface] TURN credentials response:', {
          success: data?.success,
          hasIceServers: !!data?.iceServers,
          iceServersCount: data?.iceServers?.length,
          urls: (data?.iceServers || []).map((s: any) => s.urls),
          source: data?.source,
          error: error?.message || error
        });
        
        if (!error && data?.success && data?.iceServers) {
          // Use paid TURN servers from edge function
          iceServers = data.iceServers;
          console.log('[CallInterface] Got paid TURN credentials:', iceServers.length, 'servers');
          
          // DIAGNOSTIC: Add a public STUN server to verify ICE gathering works
          // This helps diagnose if the issue is TURN-specific or general ICE gathering
          iceServers.push({ urls: 'stun:stun.l.google.com:19302' });
          console.log('[CallInterface] Added diagnostic STUN server, total:', iceServers.length);
        } else {
          // Do NOT fallback to free TURN servers - connection stability is prioritized
          console.error('[CallInterface] Failed to get paid TURN credentials:', error);
          toast({
            title: '通话服务暂时不可用',
            description: '无法获取通话服务器凭证，请稍后重试',
            variant: 'destructive'
          });
          throw new Error('Failed to get paid TURN credentials');
        }
      } catch (err) {
        console.error('[CallInterface] Error fetching paid TURN credentials (exception):', err);
        // Do NOT fallback to free TURN servers - connection stability is prioritized
        if (!(err instanceof Error && err.message === 'Failed to get paid TURN credentials')) {
          toast({
            title: '通话服务暂时不可用',
            description: '无法获取通话服务器凭证，请稍后重试',
            variant: 'destructive'
          });
        }
        throw err;
      }

      const configuration: RTCConfiguration = {
        iceServers,
        iceCandidatePoolSize: 10,
        // DIAGNOSTIC: Temporarily using 'all' to verify if TURN is the issue
        // If this works, the problem is TURN connectivity; change back to 'relay' after fixing TURN
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      };

      console.log('[CallInterface] Creating RTCPeerConnection with', iceServers.length, 'ICE servers');
      console.log("[CallInterface] Creating RTCPeerConnection with config:", JSON.stringify(configuration));
      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach(track => {
        console.log('[CallInterface] Adding track to peer connection:', track.kind);
        peerConnection.addTrack(track, stream);
      });

      // Handle remote stream - store in state for proper rendering
      // Use a ref to accumulate tracks since they may arrive separately
      const remoteStreamRef = { current: null as MediaStream | null };
      
      peerConnection.ontrack = (event) => {
        console.log('[CallInterface] *** ONTRACK TRIGGERED *** invitationId:', invitationId, 'callType:', callType);
        console.log('[CallInterface] Received remote track:', event.track.kind, 
          'enabled:', event.track.enabled, 
          'readyState:', event.track.readyState,
          'streams:', event.streams?.length || 0,
          'track.id:', event.track.id);
        console.log('[CallInterface] Current ICE state:', peerConnection.iceConnectionState, 
          'connectionState:', peerConnection.connectionState,
          'signalingState:', peerConnection.signalingState);
        
        let stream: MediaStream;
        
        if (event.streams && event.streams[0]) {
          stream = event.streams[0];
          console.log('[CallInterface] Using stream from event, tracks:', 
            stream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`));
        } else {
          // Some browsers/devices don't provide streams array, create our own
          console.log('[CallInterface] No streams in event, creating/using manual stream');
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }
          stream = remoteStreamRef.current;
          
          // Add the track if not already present
          const existingTrack = stream.getTracks().find(t => t.id === event.track.id);
          if (!existingTrack) {
            stream.addTrack(event.track);
            console.log('[CallInterface] Added track to manual stream, now has:', 
              stream.getTracks().map(t => `${t.kind}:${t.enabled}`));
          }
        }
        
        // Check if we have video tracks
        if (event.track.kind === 'video') {
          console.log('[CallInterface] Video track received, updating hasRemoteVideo state');
          setHasRemoteVideo(true);
        }
        
        // Always update the state to trigger re-render
        console.log('[CallInterface] Setting remoteStream state, stream.id:', stream.id, 
          'audioTracks:', stream.getAudioTracks().length, 
          'videoTracks:', stream.getVideoTracks().length);
        setRemoteStream(stream);
        
        // Track ended handler
        event.track.onended = () => {
          console.log('[CallInterface] Remote track ended:', event.track.kind);
          if (event.track.kind === 'video') {
            setHasRemoteVideo(false);
            setRemoteVideoPlaying(false);
          }
        };
        
        event.track.onmute = () => {
          console.log('[CallInterface] Remote track muted:', event.track.kind);
          if (event.track.kind === 'video') {
            setRemoteVideoPlaying(false);
          }
        };
        
        event.track.onunmute = () => {
          console.log('[CallInterface] Remote track unmuted:', event.track.kind);
          if (event.track.kind === 'video') {
            // Try to play video again when unmuted
            if (remoteVideoRef.current && remoteVideoRef.current.paused) {
              remoteVideoRef.current.play().catch(e => console.log('[CallInterface] Video play on unmute failed:', e));
            }
          }
        };
      };

      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          // Log detailed ICE candidate info for debugging
          const candidateStr = event.candidate.candidate || '';
          const isRelay = candidateStr.includes('typ relay');
          const isSrflx = candidateStr.includes('typ srflx');
          const isHost = candidateStr.includes('typ host');
          console.log('[CallInterface] *** GOT ICE CANDIDATE ***', {
            type: event.candidate.type,
            protocol: event.candidate.protocol,
            address: event.candidate.address?.substring(0, 15),
            isRelay, isSrflx, isHost,
            candidatePreview: candidateStr.substring(0, 100),
            invitationId
          });
          
          // Store ICE candidate in database instead of unreliable broadcast
          const candidateData = { 
            candidate: event.candidate.candidate, 
            sdpMid: event.candidate.sdpMid, 
            sdpMLineIndex: event.candidate.sdpMLineIndex 
          };
          const columnName = isInitiator ? 'caller_ice_candidates' : 'callee_ice_candidates';
          
          try {
            // Get current candidates and append new one
            const { data, error: selectError } = await supabase
              .from('call_invitations')
              .select(columnName)
              .eq('id', invitationId)
              .single();
            
            if (selectError) {
              console.error('[CallInterface] Error fetching existing ICE candidates:', selectError);
              // Fallback to broadcast if DB fails
              sendSignal({ type: 'ice-candidate', candidate: candidateData });
              return;
            }
            
            const existingCandidates = Array.isArray((data as any)?.[columnName]) ? (data as any)[columnName] : [];
            const updatedCandidates = [...existingCandidates, candidateData];
            
            const { error: updateError } = await supabase
              .from('call_invitations')
              .update({ [columnName]: updatedCandidates })
              .eq('id', invitationId);
            
            if (updateError) {
              console.error('[CallInterface] Error storing ICE candidate:', updateError);
              // Fallback to broadcast if DB fails
              sendSignal({ type: 'ice-candidate', candidate: candidateData });
            } else {
              console.log('[CallInterface] ICE candidate stored in DB successfully, total:', updatedCandidates.length);
            }
          } catch (err) {
            console.error('[CallInterface] Exception storing ICE candidate:', err);
            // Fallback to broadcast if DB fails
            sendSignal({ type: 'ice-candidate', candidate: candidateData });
          }
        } else {
          console.log('[CallInterface] *** ICE GATHERING COMPLETE *** invitationId:', invitationId);
        }
      };

      // Log ICE gathering state changes
      peerConnection.onicegatheringstatechange = () => {
        console.log('[CallInterface] ICE gathering state:', peerConnection.iceGatheringState);
      };

      // Log ICE candidate errors
      peerConnection.onicecandidateerror = (event: any) => {
        console.warn('[CallInterface] ICE candidate error:', event.errorCode, event.errorText, event.url);
      };

      peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        const connState = peerConnection.connectionState;
        const sigState = peerConnection.signalingState;
        console.log('[CallInterface] *** ICE STATE CHANGE ***:', state, 
          'connectionState:', connState, 
          'signalingState:', sigState,
          'wasConnected:', wasConnectedRef.current);
        setConnectionState(state);
        
        if (state === 'connected' || state === 'completed') {
          setCallStatus('connected');
          setReconnectAttempts(0); // Reset reconnect attempts on successful connection
          stopRingback();
          stopCallTimeout(); // Stop timeout since connected
          startCallTimer();
          startStatsMonitoring();
          // Clear any pending reconnect timer
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
        } else if (state === 'failed') {
          console.error('[CallInterface] ICE connection failed, wasConnected:', wasConnectedRef.current);
          // Only try to reconnect if we were previously connected
          if (wasConnectedRef.current) {
            scheduleReconnect();
          } else {
            // First connection attempt failed - show error and end call
            setCallStatus('failed');
            toast({
              title: '连接失败',
              description: '无法建立通话连接，可能是网络问题或防火墙限制',
              variant: 'destructive'
            });
            // Auto-end after 3 seconds
            setTimeout(() => {
              if (!isCleanedUpRef.current) {
                cleanup();
                onEndCall(0, false);
              }
            }, 3000);
          }
        } else if (state === 'disconnected') {
          console.warn('[CallInterface] ICE disconnected, wasConnected:', wasConnectedRef.current);
          // Only try to reconnect if we were connected before
          // Add a delay to avoid premature reconnection attempts
          if (wasConnectedRef.current) {
            // Wait 3 seconds before attempting reconnect (connection might recover)
            setTimeout(() => {
              const currentState = peerConnectionRef.current?.iceConnectionState;
              if (currentState === 'disconnected' || currentState === 'failed') {
                scheduleReconnect();
              }
            }, 3000);
          }
        } else if (state === 'checking') {
          console.log('[CallInterface] ICE checking - gathering candidates...');
        }
      };

      peerConnection.onconnectionstatechange = () => {
        console.log('[CallInterface] Connection state:', peerConnection.connectionState);
      };

      // ========== DB-DRIVEN SIGNALING (replaces unreliable Realtime broadcast) ==========
      // Use postgres_changes to watch for changes to the call_invitations row
      // This is proven to work reliably (logs show "*** UPDATE as caller/callee ***" working)
      console.log('[CallInterface] DB-driven signaling ACTIVE - invitationId:', invitationId);
      
      const signalingChannelName = `call-db-signal:${invitationId}`;
      console.log('[CallInterface] Creating DB signaling channel:', signalingChannelName);
      
      // Remove previous channel if exists
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      // Create channel with postgres_changes subscription for the invitation row
      // Also keep broadcast for ICE candidates (they're small and frequent)
      const channel = supabase.channel(signalingChannelName, {
        config: {
          broadcast: { self: false }
        }
      });
      channelRef.current = channel;
      
      // Handler for database state changes - drives the signaling state machine
      const handleDbStateChange = async (row: any) => {
        const pc = peerConnectionRef.current;
        if (!pc || isCleanedUpRef.current) return;
        
        console.log('[CallInterface] DB state change:', {
          status: row.status,
          caller_ready: row.caller_ready,
          callee_ready: row.callee_ready,
          has_offer: !!row.offer_sdp,
          has_answer: !!row.answer_sdp,
          isInitiator,
          offerSent: offerSentRef.current,
          offerReceived: offerReceivedRef.current
        });
        
        // === CALLER LOGIC ===
        if (isInitiator) {
          // Step 1: When callee_ready becomes true and we haven't sent offer yet, create and store offer
          if (row.callee_ready && !offerSentRef.current && pc.signalingState === 'stable') {
            console.log('[CallInterface] Callee ready detected via DB, creating offer');
            offerSentRef.current = true;
            try {
              const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: callType === 'video'
              });
              await pc.setLocalDescription(offer);
              
              // Store offer in database
              const { error: updateError } = await supabase
                .from('call_invitations')
                .update({ 
                  offer_sdp: offer.sdp, 
                  offer_type: offer.type,
                  caller_ready: true 
                })
                .eq('id', invitationId);
              
              if (updateError) {
                console.error('[CallInterface] Error storing offer in DB:', updateError);
                offerSentRef.current = false;
                return;
              }
              console.log('[CallInterface] Offer stored in DB successfully');
            } catch (err) {
              console.error('[CallInterface] Error creating offer:', err);
              offerSentRef.current = false;
            }
          }
          
          // Step 2: When answer_sdp appears, set remote description and connect
          if (row.answer_sdp && !offerReceivedRef.current && pc.signalingState === 'have-local-offer') {
            console.log('[CallInterface] Answer detected in DB, setting remote description');
            offerReceivedRef.current = true;
            try {
              await pc.setRemoteDescription(new RTCSessionDescription({ 
                type: row.answer_type as RTCSdpType, 
                sdp: row.answer_sdp 
              }));
              
              // Add any pending ICE candidates
              for (const candidate of pendingCandidatesRef.current) {
                await pc.addIceCandidate(candidate);
              }
              pendingCandidatesRef.current = [];
              
              console.log('[CallInterface] Caller: Connection established via DB signaling');
              setCallStatus('connected');
              stopRingback();
              stopCallTimeout();
              startCallTimer();
              startStatsMonitoring();
            } catch (err) {
              console.error('[CallInterface] Error setting answer:', err);
            }
          }
        }
        
        // === CALLEE LOGIC ===
        if (!isInitiator) {
          // Step 1: When offer_sdp appears, set remote description and create answer
          if (row.offer_sdp && !offerReceivedRef.current && pc.signalingState === 'stable') {
            console.log('[CallInterface] Offer detected in DB, setting remote description');
            offerReceivedRef.current = true;
            try {
              await pc.setRemoteDescription(new RTCSessionDescription({ 
                type: row.offer_type as RTCSdpType, 
                sdp: row.offer_sdp 
              }));
              
              // Add any pending ICE candidates
              for (const candidate of pendingCandidatesRef.current) {
                await pc.addIceCandidate(candidate);
              }
              pendingCandidatesRef.current = [];
              
              console.log('[CallInterface] Creating answer');
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              
              // Store answer in database
              const { error: updateError } = await supabase
                .from('call_invitations')
                .update({ 
                  answer_sdp: answer.sdp, 
                  answer_type: answer.type 
                })
                .eq('id', invitationId);
              
              if (updateError) {
                console.error('[CallInterface] Error storing answer in DB:', updateError);
                return;
              }
              
              console.log('[CallInterface] Callee: Answer stored, connection established');
              setCallStatus('connected');
              startCallTimer();
              startStatsMonitoring();
            } catch (err) {
              console.error('[CallInterface] Error handling offer:', err);
            }
          }
        }
        
        // Handle terminal states
        if (row.status === 'cancelled' || row.status === 'expired' || row.status === 'rejected') {
          console.log('[CallInterface] Call ended via DB status:', row.status);
          if (!isCleanedUpRef.current) {
            cleanup();
            onEndCall(finalDurationRef.current, wasConnectedRef.current);
          }
        }
        
        // Apply ICE candidates from the other party (DB-driven)
        const otherPartyCandidates = isInitiator ? row.callee_ice_candidates : row.caller_ice_candidates;
        if (otherPartyCandidates && Array.isArray(otherPartyCandidates) && otherPartyCandidates.length > 0) {
          const appliedCount = appliedIceCandidatesRef.current;
          const newCandidates = otherPartyCandidates.slice(appliedCount);
          
          if (newCandidates.length > 0) {
            console.log('[CallInterface] Applying', newCandidates.length, 'new ICE candidates from DB, appliedCount was:', appliedCount);
            for (const candidateData of newCandidates) {
              try {
                // Skip if connection is already closed
                if (pc.signalingState === 'closed' || pc.connectionState === 'closed') {
                  console.debug('[CallInterface] Skip ICE: connection already closed');
                  break;
                }
                if (pc.remoteDescription) {
                  await pc.addIceCandidate(new RTCIceCandidate(candidateData));
                  console.log('[CallInterface] ICE candidate applied successfully');
                } else {
                  // Queue for later if remote description not set yet
                  pendingCandidatesRef.current.push(new RTCIceCandidate(candidateData));
                  console.log('[CallInterface] ICE candidate queued (no remote description yet)');
                }
              } catch (err) {
                // Ignore errors if connection is closed
                if (pc.signalingState === 'closed' || pc.connectionState === 'closed') {
                  console.debug('[CallInterface] ICE error for closed connection, ignoring');
                } else {
                  console.error('[CallInterface] Error applying ICE candidate:', err);
                }
              }
            }
            appliedIceCandidatesRef.current = otherPartyCandidates.length;
          }
        }
      };
      
      // Subscribe to postgres_changes for this invitation
      channel
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'call_invitations',
            filter: `id=eq.${invitationId}`
          },
          (payload) => {
console.log("[CallInterface] postgres_changes UPDATE received", { id: payload.new.id, status: payload.new.status, has_offer: !!payload.new.offer_sdp, has_answer: !!payload.new.answer_sdp, caller_ice_len: payload.new.caller_ice_candidates?.length, callee_ice_len: payload.new.callee_ice_candidates?.length });
            handleDbStateChange(payload.new);
          }
        )
        // Keep broadcast for ICE candidates only (they're small and frequent)
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          if (payload?.type === 'ice-candidate') {
            console.log('[CallInterface] ICE candidate received via broadcast');
            handleSignal(payload);
          } else if (payload?.type === 'end-call') {
            console.log('[CallInterface] End-call signal received');
            handleSignal(payload);
          }
        })
        .subscribe((status) => {
          console.log('[CallInterface] DB signaling channel status:', status);
        });
      
      // Fetch current state immediately (in case we missed earlier updates)
      const { data: currentInvitation } = await supabase
        .from('call_invitations')
        .select('*')
        .eq('id', invitationId)
        .single();
      
      if (currentInvitation) {
        console.log('[CallInterface] Initial DB state:', {
          status: currentInvitation.status,
          caller_ready: currentInvitation.caller_ready,
          callee_ready: currentInvitation.callee_ready,
          has_offer: !!currentInvitation.offer_sdp,
          has_answer: !!currentInvitation.answer_sdp
        });
        // Process current state
        await handleDbStateChange(currentInvitation);
      }

      if (isInitiator) {
        setCallStatus('ringing');
        startRingback();
        startCallTimeout(); // Start 30s timeout for unanswered calls
        console.log('[CallInterface] Initiator: waiting for callee_ready via DB');
        
        // Set caller_ready in DB (callee will see this via postgres_changes)
        await supabase
          .from('call_invitations')
          .update({ caller_ready: true })
          .eq('id', invitationId);
        console.log('[CallInterface] Caller: Set caller_ready=true in DB');
        
        // Polling fallback for caller - in case postgres_changes misses updates
        const pollForCalleeReady = async () => {
          let attempts = 0;
          const maxAttempts = 40; // 20 seconds at 500ms intervals
          
          while (attempts < maxAttempts && !isCleanedUpRef.current) {
            // Stop polling if offer was sent or answer was received (connected)
            if (offerSentRef.current && offerReceivedRef.current) {
              console.log('[CallInterface] Caller polling: Connected, stopping');
              break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
            
            if (isCleanedUpRef.current) break;
            
            try {
              const { data: row, error } = await supabase
                .from('call_invitations')
                .select('*')
                .eq('id', invitationId)
                .single();
              
              if (error || !row) continue;
              
              // Check for terminal states
              if (row.status === 'cancelled' || row.status === 'expired' || row.status === 'rejected') {
                console.log('[CallInterface] Caller polling: Terminal state detected:', row.status);
                break;
              }
              
              // Process state if we haven't completed the handshake yet
              if (!offerReceivedRef.current) {
                console.log('[CallInterface] Caller polling attempt', attempts, '- callee_ready:', row.callee_ready, 'has_answer:', !!row.answer_sdp);
                await handleDbStateChange(row);
              }
            } catch (err) {
              console.warn('[CallInterface] Caller polling error:', err);
            }
          }
        };
        
        // Start polling in background
        pollForCalleeReady();
        
      } else {
        setCallStatus('connecting');
        console.log('[CallInterface] Callee: setting callee_ready in DB');
        
        // Set callee_ready in DB (caller will see this via postgres_changes and create offer)
        await supabase
          .from('call_invitations')
          .update({ callee_ready: true })
          .eq('id', invitationId);
        console.log('[CallInterface] Callee: Set callee_ready=true in DB');
        
        // Polling fallback for callee - in case postgres_changes misses the offer
        const pollForOffer = async () => {
          let attempts = 0;
          const maxAttempts = 40; // 20 seconds at 500ms intervals
          
          while (attempts < maxAttempts && !isCleanedUpRef.current) {
            // Stop polling if we've received the offer and created answer
            if (offerReceivedRef.current) {
              console.log('[CallInterface] Callee polling: Offer received, stopping');
              break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
            
            if (isCleanedUpRef.current) break;
            
            try {
              const { data: row, error } = await supabase
                .from('call_invitations')
                .select('*')
                .eq('id', invitationId)
                .single();
              
              if (error || !row) continue;
              
              // Check for terminal states
              if (row.status === 'cancelled' || row.status === 'expired' || row.status === 'rejected') {
                console.log('[CallInterface] Callee polling: Terminal state detected:', row.status);
                break;
              }
              
              // Process state if we haven't received the offer yet
              if (!offerReceivedRef.current && row.offer_sdp) {
                console.log('[CallInterface] Callee polling attempt', attempts, '- found offer in DB!');
                await handleDbStateChange(row);
              }
            } catch (err) {
              console.warn('[CallInterface] Callee polling error:', err);
            }
          }
        };
        
        // Start polling in background
        pollForOffer();
      }

    } catch (error) {
      console.error('[CallInterface] Error initializing call:', error);
      toast({
        title: '通话初始化失败',
        description: error instanceof Error ? error.message : '请检查麦克风和摄像头权限',
        variant: 'destructive'
      });
      cleanup();
      onEndCall(0, false);
    } finally {
      initializingRef.current = false;
    }
  }, [callType, conversationId, invitationId, isInitiator, facingMode, handleSignal, sendSignal, startRingback, stopRingback, startCallTimer, cleanup, onEndCall, toast]);

  // Switch camera (front/back)
  const switchCamera = useCallback(async () => {
    if (callType !== 'video' || isSwitchingCamera) return;
    
    setIsSwitchingCamera(true);
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    
    try {
      // Get new video stream with different camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode, width: 1280, height: 720 },
        audio: false
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      
      if (localStreamRef.current && peerConnectionRef.current) {
        // Stop old video track
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) {
          oldVideoTrack.stop();
          localStreamRef.current.removeTrack(oldVideoTrack);
        }
        
        // Add new video track to local stream
        localStreamRef.current.addTrack(newVideoTrack);
        
        // Replace track in peer connection
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }
        
        // Update local video preview
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        
        setFacingMode(newFacingMode);
        console.log('[CallInterface] Camera switched to:', newFacingMode);
      }
    } catch (error) {
      console.error('[CallInterface] Error switching camera:', error);
      toast({
        title: '切换摄像头失败',
        description: '无法切换摄像头',
        variant: 'destructive'
      });
    } finally {
      setIsSwitchingCamera(false);
    }
  }, [callType, facingMode, isSwitchingCamera, toast]);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (!peerConnectionRef.current) return;

    try {
      if (isScreenSharing) {
        // Stop screen sharing, restore camera
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }

        // Get camera stream back
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: 1280, height: 720 }
        });
        const cameraTrack = cameraStream.getVideoTracks()[0];

        // Replace track in peer connection
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(cameraTrack);
        }

        // Update local stream
        if (localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            localStreamRef.current.removeTrack(oldVideoTrack);
          }
          localStreamRef.current.addTrack(cameraTrack);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setIsScreenSharing(false);
        console.log('[CallInterface] Screen sharing stopped, camera restored');
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' } as any,
          audio: false
        });
        screenStreamRef.current = screenStream;

        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Handle when user stops sharing via browser UI
        screenTrack.onended = () => {
          toggleScreenShare();
        };

        // Replace camera track with screen track
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }

        // Update local preview
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
        console.log('[CallInterface] Screen sharing started');
      }
    } catch (error) {
      console.error('[CallInterface] Error toggling screen share:', error);
      if (!isScreenSharing) {
        // User cancelled or error starting screen share
        toast({
          title: '屏幕共享失败',
          description: '无法启动屏幕共享',
          variant: 'destructive'
        });
      }
    }
  }, [isScreenSharing, facingMode, toast]);

  // Set remote stream to video/audio elements when available
  useEffect(() => {
    console.log('[CallInterface] Remote stream useEffect triggered, remoteStream:', !!remoteStream, 'callType:', callType);
    
    if (remoteStream) {
      const tracks = remoteStream.getTracks();
      const audioTracks = remoteStream.getAudioTracks();
      const videoTracks = remoteStream.getVideoTracks();
      
      console.log('[CallInterface] Remote stream available:', {
        streamId: remoteStream.id,
        totalTracks: tracks.length,
        audioTracks: audioTracks.map(t => `${t.label}:${t.enabled}:${t.readyState}`),
        videoTracks: videoTracks.map(t => `${t.label}:${t.enabled}:${t.readyState}`),
        isAndroid: isAndroid(),
        remoteVideoRef: !!remoteVideoRef.current,
        remoteAudioRef: !!remoteAudioRef.current
      });
      
      // Update hasRemoteVideo - more lenient check, just need video tracks to exist
      const hasVideoTrack = videoTracks.length > 0;
      if (hasVideoTrack && !hasRemoteVideo) {
        console.log('[CallInterface] Setting hasRemoteVideo to true, video tracks found');
        setHasRemoteVideo(true);
      }
      
      // Set remote video - for video calls, always try to set srcObject
      if (remoteVideoRef.current && callType === 'video') {
        const video = remoteVideoRef.current;
        console.log('[CallInterface] Setting remote stream to video element, current srcObject:', !!video.srcObject);
        
        // Always update srcObject
        video.srcObject = remoteStream;
        setupAndroidVideo(video);
        video.muted = false;
        video.volume = 1.0;
        
        // Use playMediaWithFallback for Android compatibility
        playMediaWithFallback(video).then((ok) => {
          console.log('[CallInterface] Remote video playMediaWithFallback result:', ok);
          if (ok) setRemoteVideoPlaying(true);
        });
      }
      
      // Set remote audio - ALWAYS set for both audio and video calls
      if (remoteAudioRef.current) {
        const audio = remoteAudioRef.current;
        console.log('[CallInterface] Setting remote stream to audio element');
        setupAndroidAudio(audio);
        audio.srcObject = remoteStream;
        audio.muted = false;
        audio.volume = 1.0;
        
        // Use playMediaWithFallback for Android compatibility - critical for audio in calls
        playMediaWithFallback(audio).then((ok) => {
          console.log('[CallInterface] Remote audio playMediaWithFallback result:', ok);
        });
      }
    }
  }, [remoteStream, callType, hasRemoteVideo]);

  // Keep local video preview in sync - critical for when component re-renders
  // This ensures the picture-in-picture stays visible after call connects
  useEffect(() => {
    if (callType === 'video' && localVideoRef.current && localStream) {
      const currentSrcObject = localVideoRef.current.srcObject;
      
      // Re-attach srcObject if it was lost during re-render
      if (currentSrcObject !== localStream) {
        console.log('[CallInterface] Re-attaching local video srcObject (was lost during re-render)');
        setupAndroidVideo(localVideoRef.current);
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch(e => {
          console.log('[CallInterface] Local video re-play error:', e.message);
        });
      }
    }
  }, [callType, localStream, remoteStream, callStatus]); // Re-check when these change as they trigger re-renders

  // Add document-level click handler to ensure audio/video plays after user interaction
  // This is critical for Android which has strict autoplay policies
  useEffect(() => {
    const ensureMediaPlays = async () => {
      console.log('[CallInterface] User interaction detected, ensuring media plays, isAndroid:', isAndroid());
      
      // First unlock audio context
      await unlockAudio();
      
      // Ensure audio plays
      if (remoteAudioRef.current && remoteStream) {
        const audio = remoteAudioRef.current;
        console.log('[CallInterface] Audio element state:', {
          paused: audio.paused,
          muted: audio.muted,
          volume: audio.volume,
          srcObject: !!audio.srcObject,
          readyState: audio.readyState,
          networkState: audio.networkState,
          currentTime: audio.currentTime
        });
        
        // Re-assign srcObject for Android
        if (isAndroid() && audio.srcObject !== remoteStream) {
          console.log('[CallInterface] Android: Re-assigning audio srcObject');
          audio.srcObject = remoteStream;
        }
        
        audio.muted = false;
        audio.volume = isSpeakerOn ? 1.0 : 0.6; // Respect current speaker/earpiece mode
        
        // Use playMediaWithFallback for better Android compatibility
        const audioOk = await playMediaWithFallback(audio);
        console.log('[CallInterface] Audio playMediaWithFallback after interaction:', audioOk);
      }
      
      // Ensure video plays and is unmuted (for video calls)
      if (remoteVideoRef.current && remoteStream && callType === 'video') {
        const video = remoteVideoRef.current;
        console.log('[CallInterface] Video element state:', {
          paused: video.paused,
          muted: video.muted,
          volume: video.volume,
          srcObject: !!video.srcObject,
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight
        });
        
        // Re-assign srcObject for Android
        if (isAndroid() && video.srcObject !== remoteStream) {
          console.log('[CallInterface] Android: Re-assigning video srcObject');
          video.srcObject = remoteStream;
        }
        
        video.muted = false;
        video.volume = isSpeakerOn ? 1.0 : 0.6; // Respect current speaker/earpiece mode
        
        // Use playMediaWithFallback for better Android compatibility
        const videoOk = await playMediaWithFallback(video);
        console.log('[CallInterface] Video playMediaWithFallback after interaction:', videoOk);
      }
    };

    // Listen for any user interaction - use capture phase for Android
    const handleInteraction = (e: Event) => {
      console.log('[CallInterface] Interaction event:', e.type);
      ensureMediaPlays();
    };
    
    // Add listeners with capture for better Android compatibility
    document.addEventListener('click', handleInteraction, { capture: true });
    document.addEventListener('touchstart', handleInteraction, { capture: true, passive: true });
    document.addEventListener('touchend', handleInteraction, { capture: true, passive: true });
    
    // Also try to play media periodically until it succeeds
    // More aggressive interval for Android (500ms vs 1000ms)
    const retryInterval = isAndroid() ? 500 : 1000;
    const mediaRetryInterval = setInterval(async () => {
      if (remoteAudioRef.current && remoteStream) {
        const audio = remoteAudioRef.current;
        if (audio.paused) {
          audio.muted = false;
          // Don't reset volume - respect current speaker/earpiece mode setting
          if (audio.volume === 0) {
            audio.volume = 0.6; // Default to earpiece mode volume
          }
          // Use playMediaWithFallback for better Android compatibility
          const ok = await playMediaWithFallback(audio);
          if (ok) {
            console.log('[CallInterface] Periodic retry: audio playing via playMediaWithFallback');
          }
        }
      }
      if (remoteVideoRef.current && remoteStream && callType === 'video') {
        const video = remoteVideoRef.current;
        
        // Check if video has valid dimensions - this means we have actual video data
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          if (!hasRemoteVideo) {
            console.log('[CallInterface] Periodic check: video has dimensions, updating hasRemoteVideo');
            setHasRemoteVideo(true);
          }
          if (!remoteVideoPlaying && !video.paused) {
            console.log('[CallInterface] Periodic check: video is playing, updating state');
            setRemoteVideoPlaying(true);
          }
        }
        
        if (video.paused) {
          video.muted = false;
          if (video.volume === 0) {
            video.volume = 0.6;
          }
          // Use playMediaWithFallback for better Android compatibility
          const ok = await playMediaWithFallback(video);
          if (ok) {
            console.log('[CallInterface] Periodic retry: video playing via playMediaWithFallback');
            setRemoteVideoPlaying(true);
            if (video.videoWidth > 0) {
              setHasRemoteVideo(true);
            }
          }
        } else if (!remoteVideoPlaying && video.readyState >= 2) {
          console.log('[CallInterface] Periodic check: video ready, updating state');
          setRemoteVideoPlaying(true);
        }
      }
    }, retryInterval);
    
    return () => {
      document.removeEventListener('click', handleInteraction, { capture: true });
      document.removeEventListener('touchstart', handleInteraction, { capture: true } as any);
      document.removeEventListener('touchend', handleInteraction, { capture: true } as any);
      clearInterval(mediaRetryInterval);
    };
  }, [remoteStream, callType, unlockAudio, hasRemoteVideo, remoteVideoPlaying, isSpeakerOn]);

  // Subscribe to database status changes as fallback for detecting call end
  useEffect(() => {
    if (!invitationId) return;

    console.log('[CallInterface] Setting up database status listener for invitation:', invitationId);
    
    const channel = supabase
      .channel(`call-status-${invitationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_invitations',
          filter: `id=eq.${invitationId}`
        },
        (payload) => {
          const newStatus = payload.new?.status;
          console.log('[CallInterface] Database status changed:', newStatus);
          
          // If status changed to cancelled/expired by the other party, end the call
          if (newStatus === 'cancelled' || newStatus === 'expired') {
            if (!isCleanedUpRef.current) {
              console.log('[CallInterface] Call ended by other party via database update');
              cleanup();
              onEndCall(finalDurationRef.current, wasConnectedRef.current);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [invitationId, cleanup, onEndCall]);

  useEffect(() => {
    isCleanedUpRef.current = false;
    initializingRef.current = false;
    readySignalSentRef.current = false;
    offerReceivedRef.current = false;
    initializeCall();
    
    return () => {
      cleanup();
    };
  }, [invitationId]);

  const toggleAudio = () => {
    console.log('[CallInterface] toggleAudio called, localStream:', !!localStream, 'localStreamRef:', !!localStreamRef.current);
    const stream = localStream || localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      console.log('[CallInterface] Audio track:', !!audioTrack, 'enabled:', audioTrack?.enabled);
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
        console.log('[CallInterface] Audio muted:', !audioTrack.enabled);
      }
    } else {
      console.error('[CallInterface] No local stream available for audio toggle');
    }
  };

  const toggleVideo = () => {
    console.log('[CallInterface] toggleVideo called, localStream:', !!localStream, 'localStreamRef:', !!localStreamRef.current);
    const stream = localStream || localStreamRef.current;
    if (stream && callType === 'video') {
      const videoTrack = stream.getVideoTracks()[0];
      console.log('[CallInterface] Video track:', !!videoTrack, 'enabled:', videoTrack?.enabled);
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
        console.log('[CallInterface] Video muted:', !videoTrack.enabled);
      }
    } else {
      console.error('[CallInterface] No local stream available for video toggle');
    }
  };

  const toggleSpeaker = useCallback(async () => {
    const newSpeakerState = !isSpeakerOn;
    const targetDevice: AudioOutputDevice = newSpeakerState ? 'speaker' : 'earpiece';
    console.log('[CallInterface] Toggle speaker mode:', isSpeakerOn ? '听筒' : '扬声器', '->', newSpeakerState ? '扬声器' : '听筒');
    
    const audioElement = remoteAudioRef.current;
    const videoElement = remoteVideoRef.current;
    
    // Try to use the audio routing utility (supports native + web API)
    const result = await setAudioOutput(targetDevice, audioElement || videoElement);
    
    if (result.success) {
      console.log('[CallInterface] Audio routing success via', result.method);
      toast({
        title: result.message,
        duration: 2000,
      });
    } else {
      // Show limitation message to user
      console.log('[CallInterface] Audio routing fallback:', result.message);
      toast({
        title: newSpeakerState ? '扬声器模式' : '听筒模式',
        description: result.message,
        variant: 'default',
        duration: 3000,
      });
      
      // Apply volume-based feedback as fallback
      if (audioElement) {
        audioElement.volume = newSpeakerState ? 1.0 : 0.6;
        audioElement.muted = false;
      }
      if (videoElement) {
        videoElement.volume = newSpeakerState ? 1.0 : 0.6;
        videoElement.muted = false;
      }
    }
    
    setIsSpeakerOn(newSpeakerState);
  }, [isSpeakerOn, toast]);

  const handleEndCall = async () => {
    // Prevent multiple clicks
    if (isEndingCall || isCleanedUpRef.current) {
      console.log('[CallInterface] End call already in progress, ignoring');
      return;
    }
    setIsEndingCall(true);
    
    console.log('[CallInterface] End call button clicked, duration:', finalDurationRef.current);
    
    // Update database status to 'expired' - this ensures other party knows via realtime subscription
    // Using 'expired' because it's a valid status in the database (valid: pending, accepted, rejected, cancelled, expired)
    if (invitationId) {
      try {
        const { error } = await supabase
          .from('call_invitations')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', invitationId);
        if (error) {
          console.warn('[CallInterface] Error updating database status:', error);
        } else {
          console.log('[CallInterface] Database status updated to expired');
        }
      } catch (e) {
        console.warn('[CallInterface] Error updating database status:', e);
      }
    }
    
    // Send end-call signal and wait briefly to ensure delivery
    try {
      await sendSignal({ type: 'end-call' });
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      console.warn('[CallInterface] Error sending end-call signal:', e);
    }
    
    cleanup();
    onEndCall(finalDurationRef.current, wasConnectedRef.current);
  };

  const handleCancelCall = async () => {
    // Prevent multiple clicks
    if (isEndingCall || isCleanedUpRef.current) {
      console.log('[CallInterface] Cancel call already in progress, ignoring');
      return;
    }
    setIsEndingCall(true);
    
    console.log('[CallInterface] Cancel call button clicked');
    
    // Update database status to 'cancelled'
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
    
    // Always send end-call signal so other party knows call is cancelled
    try {
      await sendSignal({ type: 'end-call' });
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      console.warn('[CallInterface] Error sending end-call signal:', e);
    }
    
    cleanup();
    if (onCancelCall) {
      onCancelCall();
    } else {
      onEndCall(0, false);
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
      {/* Close button in corner */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute z-10 fixed-top-safe"
        style={{ top: 'calc(var(--safe-area-inset-top, 0px) + 16px)', right: '16px' }}
        onClick={handleCancelCall}
      >
        <X className="h-6 w-6" />
      </Button>
      
      {/* Remote Video/Avatar */}
      <div className="flex-1 relative bg-muted flex items-center justify-center overflow-hidden">
        {/* Video element - always render for video calls, control visibility via CSS */}
        {callType === 'video' && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="w-full h-full object-cover absolute inset-0"
            style={{ 
              backgroundColor: 'black',
              opacity: (remoteStream && hasRemoteVideo) ? 1 : 0,
              zIndex: (remoteStream && hasRemoteVideo) ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out'
            }}
            {...{ 'webkit-playsinline': 'true', 'x-webkit-airplay': 'allow' } as any}
            onLoadedMetadata={() => {
              console.log('[CallInterface] Remote video metadata loaded');
              const video = remoteVideoRef.current;
              if (video) {
                console.log('[CallInterface] Video dimensions:', video.videoWidth, 'x', video.videoHeight);
                video.muted = false;
                video.volume = 1.0;
                video.play().then(() => {
                  console.log('[CallInterface] Video playing after metadata loaded');
                  setRemoteVideoPlaying(true);
                  setHasRemoteVideo(true);
                }).catch(e => console.log('[CallInterface] Video play on metadata failed:', e.message));
              }
            }}
            onCanPlay={() => {
              console.log('[CallInterface] Remote video can play');
              const video = remoteVideoRef.current;
              if (video) {
                video.play().then(() => {
                  console.log('[CallInterface] Video playing after canplay event');
                  setRemoteVideoPlaying(true);
                  setHasRemoteVideo(true);
                }).catch(() => {});
              }
            }}
            onPlaying={() => {
              console.log('[CallInterface] Remote video playing event fired');
              setRemoteVideoPlaying(true);
              setHasRemoteVideo(true);
            }}
            onLoadedData={() => {
              console.log('[CallInterface] Remote video loadeddata event');
              const video = remoteVideoRef.current;
              if (video && video.videoWidth > 0) {
                console.log('[CallInterface] Video has valid dimensions:', video.videoWidth, 'x', video.videoHeight);
                setHasRemoteVideo(true);
              }
            }}
            onPause={() => {
              console.log('[CallInterface] Remote video paused');
            }}
            onError={(e) => {
              console.error('[CallInterface] Remote video error:', e);
            }}
          />
        )}

        {/* Show avatar when: audio call, or video call without remote video */}
        {(callType === 'audio' || !remoteStream || !hasRemoteVideo) && (
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

        {/* Hidden audio element for audio playback - primary audio source */}
        {/* Critical: webkit-playsinline and x-webkit-airplay for Android/iOS */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          controls={false}
          className="hidden"
          style={{ display: 'none' }}
          {...{ 'webkit-playsinline': 'true', 'x-webkit-airplay': 'allow' } as any}
        />

        {/* Local Video (Picture in Picture) */}
        {callType === 'video' && (
          <div 
            className="absolute top-16 right-4 w-32 h-44 rounded-lg overflow-hidden shadow-lg bg-black border-2 border-white/30"
            style={{ zIndex: 10 }}
          >
            <video
              ref={(el) => {
                localVideoRef.current = el;
                // Android: Re-attach srcObject whenever the ref is set
                if (el && localStream && el.srcObject !== localStream) {
                  console.log('[CallInterface] Local video ref callback: re-attaching srcObject');
                  setupAndroidVideo(el);
                  el.srcObject = localStream;
                  el.muted = true;
                  el.play().catch(() => {});
                }
              }}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
              {...{ 'webkit-playsinline': 'true', 'x-webkit-airplay': 'allow' } as any}
              onLoadedMetadata={() => {
                console.log('[CallInterface] Local video metadata loaded');
                localVideoRef.current?.play().catch(() => {});
              }}
            />
          </div>
        )}

        {/* Call Status & Timer */}
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
                正在重连... ({reconnectAttempts}/{maxReconnectAttempts})
              </span>
            )}
            {callStatus === 'failed' && (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                连接失败
              </span>
            )}
          </p>
          {(callStatus === 'connected' || callStatus === 'reconnecting') && (
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

      {/* Controls - responsive sizing for Android/mobile with flex-wrap for small screens */}
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
              variant={isScreenSharing ? "default" : "secondary"}
              size="lg"
              className="rounded-full w-9 h-9 sm:w-11 sm:h-11"
              onClick={toggleScreenShare}
            >
              {isScreenSharing ? <MonitorOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <MonitorUp className="w-4 h-4 sm:w-5 sm:h-5" />}
            </Button>
            
            <Button
              variant="secondary"
              size="lg"
              className="rounded-full w-9 h-9 sm:w-11 sm:h-11"
              onClick={switchCamera}
              disabled={isSwitchingCamera || isScreenSharing}
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
