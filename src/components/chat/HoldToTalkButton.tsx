import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAndroid, getAndroidMediaConstraints, androidVibrate } from "@/utils/androidCompat";

interface HoldToTalkButtonProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onRecordingChange?: (isRecording: boolean) => void;
  className?: string;
}

export default function HoldToTalkButton({ onSend, onRecordingChange, className }: HoldToTalkButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef<number>(0);
  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const mimeTypeRef = useRef<string>('audio/webm');
  const isRecordingRef = useRef<boolean>(false);
  const hasSentRef = useRef<boolean>(false);

  // Cancel threshold in pixels
  const CANCEL_THRESHOLD_X = -80; // Swipe left to cancel
  const CANCEL_THRESHOLD_Y = -80; // Swipe up to cancel
  const MIN_DURATION_MS = 500; // Minimum recording duration
  const HOLD_DELAY_MS = 200; // Delay before starting recording to prevent accidental clicks
  
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef<boolean>(false);

  useEffect(() => {
    onRecordingChange?.(isRecording);
  }, [isRecording, onRecordingChange]);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    
    try {
      hasSentRef.current = false;
      
      const constraints = isAndroid() 
        ? getAndroidMediaConstraints('audio')
        : { audio: true };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      // Determine best supported MIME type
      const mimeTypePriority = [
        'audio/mp4',
        'audio/aac',
        'audio/mpeg',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/3gpp',
        'audio/3gpp2',
      ];
      
      let mimeType = '';
      for (const type of mimeTypePriority) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      
      const mediaRecorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions);
      mimeTypeRef.current = mediaRecorder.mimeType || mimeType || 'audio/webm';
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onerror = (e) => {
        console.error('[HoldToTalk] MediaRecorder error:', e);
        cleanupStream();
        stopTimer();
        setIsRecording(false);
        isRecordingRef.current = false;
      };

      const timeslice = isAndroid() ? 250 : 1000;
      mediaRecorder.start(timeslice);
      
      setIsRecording(true);
      isRecordingRef.current = true;
      setDuration(0);
      durationRef.current = 0;
      setIsCancelling(false);
      
      androidVibrate(50);

      timerRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          durationRef.current = newDuration;
          if (newDuration >= 60) {
            stopRecording(false);
          }
          return newDuration;
        });
      }, 1000);
      
    } catch (error: any) {
      console.error("[HoldToTalk] Error accessing microphone:", error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
      }
      cleanupStream();
    }
  }, [cleanupStream, stopTimer]);

  const stopRecording = useCallback((cancel: boolean = false): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!isRecordingRef.current || !mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      stopTimer();
      
      const mediaRecorder = mediaRecorderRef.current;
      
      if (cancel) {
        androidVibrate([30, 50, 30]);
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        cleanupStream();
        setIsRecording(false);
        isRecordingRef.current = false;
        setIsCancelling(false);
        resolve(null);
        return;
      }

      // Check minimum duration
      const recordingStartTime = Date.now() - (durationRef.current * 1000);
      const actualDuration = Date.now() - recordingStartTime;
      
      if (actualDuration < MIN_DURATION_MS) {
        androidVibrate(30);
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        cleanupStream();
        setIsRecording(false);
        isRecordingRef.current = false;
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        cleanupStream();
        setIsRecording(false);
        isRecordingRef.current = false;
        androidVibrate(30);
        resolve(blob);
      };

      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      } else {
        cleanupStream();
        setIsRecording(false);
        isRecordingRef.current = false;
        resolve(null);
      }
    });
  }, [cleanupStream, stopTimer]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    isHoldingRef.current = true;
    
    // Clear any existing hold timer
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
    
    // Delay starting recording to prevent accidental clicks
    holdTimerRef.current = setTimeout(() => {
      if (isHoldingRef.current) {
        startRecording();
      }
    }, HOLD_DELAY_MS);
  }, [startRecording]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isRecordingRef.current) return;
    
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    
    const shouldCancel = dx < CANCEL_THRESHOLD_X || dy < CANCEL_THRESHOLD_Y;
    
    if (shouldCancel !== isCancelling) {
      setIsCancelling(shouldCancel);
      if (shouldCancel) {
        androidVibrate(30);
      }
    }
  }, [isCancelling]);

  const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    // Clear hold timer if user released before delay
    isHoldingRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    
    // If recording hasn't started yet (quick click), just return
    if (!isRecordingRef.current) return;
    
    if (isCancelling) {
      await stopRecording(true);
      return;
    }
    
    if (hasSentRef.current) return;
    
    const blob = await stopRecording(false);
    
    if (blob && durationRef.current > 0) {
      hasSentRef.current = true;
      onSend(blob, durationRef.current);
    }
  }, [isCancelling, stopRecording, onSend]);

  const handlePointerCancel = useCallback(async () => {
    // Clear hold timer
    isHoldingRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    
    if (isRecordingRef.current) {
      await stopRecording(true);
    }
  }, [stopRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (permissionDenied) {
    return (
      <button
        type="button"
        className={cn(
          "h-9 w-9 flex items-center justify-center rounded-full bg-destructive/10 text-destructive",
          className
        )}
        onClick={() => setPermissionDenied(false)}
        title="麦克风权限被拒绝"
      >
        <Mic className="h-5 w-5" />
      </button>
    );
  }

  return (
    <>
      {/* Recording Overlay */}
      {isRecording && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            {/* Cancel indicator */}
            <div className={cn(
              "flex items-center justify-center w-20 h-20 rounded-full transition-all",
              isCancelling 
                ? "bg-destructive scale-110" 
                : "bg-transparent"
            )}>
              {isCancelling && <X className="h-10 w-10 text-white" />}
            </div>
            
            {/* Recording indicator */}
            <div className={cn(
              "flex items-center gap-3 px-6 py-3 rounded-full",
              isCancelling ? "bg-destructive/20" : "bg-white/10"
            )}>
              <div className="relative">
                <div className={cn(
                  "w-4 h-4 rounded-full animate-pulse",
                  isCancelling ? "bg-destructive" : "bg-red-500"
                )} />
                <div className={cn(
                  "absolute inset-0 w-4 h-4 rounded-full animate-ping opacity-75",
                  isCancelling ? "bg-destructive" : "bg-red-500"
                )} />
              </div>
              <span className="text-white text-xl font-mono tabular-nums">
                {formatDuration(duration)}
              </span>
            </div>
            
            {/* Wave animation */}
            <div className="flex items-center justify-center gap-1 h-12">
              {[...Array(24)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1 rounded-full animate-pulse",
                    isCancelling ? "bg-destructive/60" : "bg-white/60"
                  )}
                  style={{
                    height: `${Math.random() * 32 + 8}px`,
                    animationDelay: `${i * 0.05}s`,
                    animationDuration: '0.5s',
                  }}
                />
              ))}
            </div>
            
            {/* Hint text */}
            <p className={cn(
              "text-lg transition-colors",
              isCancelling ? "text-destructive font-medium" : "text-white/80"
            )}>
              {isCancelling ? "松开取消" : "松开发送，向左/上滑取消"}
            </p>
          </div>
        </div>
      )}
      
      {/* Hold to talk button */}
      <button
        type="button"
        className={cn(
          "h-9 w-9 flex items-center justify-center rounded-full transition-all touch-none select-none",
          isRecording 
            ? "bg-destructive text-white scale-110" 
            : "hover:bg-accent active:bg-accent",
          className
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{ touchAction: 'none' }}
      >
        <Mic className="h-5 w-5" />
      </button>
    </>
  );
}
