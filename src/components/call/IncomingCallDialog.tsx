import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { isAndroid, unlockAndroidAudio, androidVibrate } from '@/utils/androidCompat';

interface IncomingCallDialogProps {
  isOpen: boolean;
  caller: {
    display_name: string;
    avatar_url: string | null;
  };
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCallDialog: React.FC<IncomingCallDialogProps> = ({
  isOpen,
  caller,
  callType,
  onAccept,
  onReject
}) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringTimerRef = useRef<number | null>(null);
  const vibrateIntervalRef = useRef<number | null>(null);

  const startRingtone = async () => {
    try {
      console.log('[IncomingCallDialog] Starting ringtone, isAndroid:', isAndroid());
      
      // For Android, unlock audio first
      if (isAndroid()) {
        const ctx = await unlockAndroidAudio();
        if (ctx) {
          audioCtxRef.current = ctx;
        }
      }
      
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = audioCtxRef.current ?? new AudioCtx();
      audioCtxRef.current = ctx;

      // Resume if suspended
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const gain = ctx.createGain();
      gain.gain.value = 0.2; // Increased volume for better audibility on Android
      gain.connect(ctx.destination);

      const playRingPattern = () => {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
        
        // Play two short bursts like a phone ring
        const playBurst = (delay: number) => {
          setTimeout(() => {
            if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
            try {
              const o1 = ctx.createOscillator();
              const o2 = ctx.createOscillator();
              const burstGain = ctx.createGain();
              
              o1.type = 'sine';
              o2.type = 'sine';
              o1.frequency.value = 440;
              o2.frequency.value = 480;
              
              // Fade in/out for smoother sound
              const now = ctx.currentTime;
              burstGain.gain.setValueAtTime(0, now);
              burstGain.gain.linearRampToValueAtTime(0.2, now + 0.05);
              burstGain.gain.setValueAtTime(0.2, now + 0.35);
              burstGain.gain.linearRampToValueAtTime(0, now + 0.4);
              
              o1.connect(burstGain);
              o2.connect(burstGain);
              burstGain.connect(ctx.destination);
              
              o1.start();
              o2.start();
              o1.stop(now + 0.4);
              o2.stop(now + 0.4);
            } catch (e) {
              console.log('[IncomingCallDialog] Ring burst error:', e);
            }
          }, delay);
        };

        // Ring pattern: beep-beep, pause, beep-beep
        playBurst(0);
        playBurst(500);
      };

      playRingPattern();
      ringTimerRef.current = window.setInterval(playRingPattern, 2500);
      
      // Start vibration - use androidVibrate for Android, standard API otherwise
      const startVibration = () => {
        if (isAndroid()) {
          androidVibrate([200, 100, 200, 100, 200]);
        } else if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 200]);
        }
      };
      
      startVibration();
      vibrateIntervalRef.current = window.setInterval(startVibration, 2500);
      
    } catch (err) {
      console.error('[IncomingCallDialog] Error starting ringtone:', err);
    }
  };

  const stopRingtone = () => {
    console.log('[IncomingCallDialog] Stopping ringtone');
    if (ringTimerRef.current) {
      clearInterval(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    if (vibrateIntervalRef.current) {
      clearInterval(vibrateIntervalRef.current);
      vibrateIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    // Stop vibration
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startRingtone();
    } else {
      stopRingtone();
    }

    return () => {
      stopRingtone();
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onReject()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">来电</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-6 py-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-green-500/30 animate-ping" />
            <div className="absolute inset-0 rounded-full bg-green-500/20 animate-pulse" />
            <Avatar className="w-24 h-24 relative z-10 ring-4 ring-green-500/50">
              <AvatarImage src={caller.avatar_url || undefined} />
              <AvatarFallback className="text-3xl">
                {caller.display_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="text-center">
            <h3 className="text-xl font-semibold">{caller.display_name}</h3>
            <p className="text-muted-foreground mt-2">
              {callType === 'video' ? '视频通话' : '语音通话'}
            </p>
          </div>

          <div className="flex gap-8 mt-4">
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full w-16 h-16"
              onClick={onReject}
            >
              <PhoneOff className="w-8 h-8" />
            </Button>

            <Button
              variant="default"
              size="lg"
              className="rounded-full w-16 h-16 bg-green-600 hover:bg-green-700"
              onClick={onAccept}
            >
              {callType === 'video' ? (
                <Video className="w-8 h-8" />
              ) : (
                <Phone className="w-8 h-8" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IncomingCallDialog;
