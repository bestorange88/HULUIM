import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Send, X, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAndroid, getAndroidMediaConstraints, androidVibrate } from "@/utils/androidCompat";

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
  onRecordingChange?: (isRecording: boolean) => void;
}

export default function VoiceRecorder({ onSend, onCancel, onRecordingChange }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const hasSentRef = useRef<boolean>(false);

  useEffect(() => {
    // Auto-start recording when component mounts
    startRecording();
    hasSentRef.current = false;
    
    return () => {
      stopRecording(true);
      cleanupStream();
    };
  }, []);

  useEffect(() => {
    onRecordingChange?.(isRecording);
  }, [isRecording, onRecordingChange]);

  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      // Use Android-optimized constraints
      const constraints = isAndroid() 
        ? getAndroidMediaConstraints('audio')
        : { audio: true };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      // Determine best supported MIME type with extensive fallbacks for OPPO/ColorOS devices
      // Priority: mp4/aac (most compatible) > webm/opus > ogg > 3gpp > default
      const mimeTypePriority = [
        'audio/mp4',                    // Best for OPPO/Android compatibility
        'audio/aac',                    // Widely supported
        'audio/mpeg',                   // MP3 format
        'audio/webm;codecs=opus',       // Modern browsers
        'audio/webm',                   // Fallback webm
        'audio/ogg;codecs=opus',        // Firefox
        'audio/ogg',                    // Fallback ogg
        'audio/3gpp',                   // Old Android devices
        'audio/3gpp2',                  // Legacy support
      ];
      
      let mimeType = '';
      for (const type of mimeTypePriority) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log('[VoiceRecorder] Using MIME type:', type);
          break;
        }
      }
      
      // Log all supported types for debugging
      console.log('[VoiceRecorder] Supported MIME types:', mimeTypePriority.filter(t => MediaRecorder.isTypeSupported(t)));
      
      const mediaRecorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
      
      const mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions);
      // Store actual MIME type being used
      const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
      console.log('[VoiceRecorder] Actual MIME type:', actualMimeType);
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (!isCancelling) {
          const blob = new Blob(chunksRef.current, { type: actualMimeType });
          console.log('[VoiceRecorder] Created blob:', blob.type, blob.size, 'bytes');
          setAudioBlob(blob);
        }
        cleanupStream();
      };

      mediaRecorder.onerror = (e) => {
        console.error('[VoiceRecorder] MediaRecorder error:', e);
        cleanupStream();
        onCancel();
      };

      // For Android, request data more frequently for better compatibility
      const timeslice = isAndroid() ? 250 : 1000;
      mediaRecorder.start(timeslice);
      setIsRecording(true);
      setDuration(0);
      durationRef.current = 0;
      
      // Haptic feedback on Android
      androidVibrate(50);

      timerRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          durationRef.current = newDuration;
          // Auto stop at 60 seconds
          if (newDuration >= 60) {
            stopRecording(false);
          }
          return newDuration;
        });
      }, 1000);
    } catch (error: any) {
      console.error("[VoiceRecorder] Error accessing microphone:", error);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
      }
      
      onCancel();
    }
  };

  const stopRecording = useCallback((cancel: boolean = false) => {
    setIsCancelling(cancel);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('[VoiceRecorder] Error stopping recorder:', e);
      }
      setIsRecording(false);
    }
    
    // Haptic feedback on stop
    if (!cancel) {
      androidVibrate(30);
    }
  }, []);

  const handleSend = useCallback(() => {
    // Prevent double send
    if (isSending || hasSentRef.current) return;
    
    if (audioBlob && durationRef.current > 0) {
      setIsSending(true);
      hasSentRef.current = true;
      androidVibrate(50);
      onSend(audioBlob, durationRef.current);
    } else if (isRecording) {
      // Stop recording first, then wait for blob
      stopRecording(false);
    }
  }, [audioBlob, isRecording, isSending, onSend, stopRecording]);

  // Auto-send after recording stops and blob is ready
  useEffect(() => {
    if (audioBlob && !isRecording && !isCancelling && durationRef.current > 0 && !hasSentRef.current && !isSending) {
      // Audio is ready, user can click send
    }
  }, [audioBlob, isRecording, isCancelling, isSending]);

  const handleCancel = () => {
    androidVibrate([30, 50, 30]);
    stopRecording(true);
    cleanupStream();
    onCancel();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Touch handlers for swipe-to-cancel
  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const diff = startYRef.current - currentY;
    const newIsCancelling = diff > 50; // Swipe up more than 50px to cancel
    
    if (newIsCancelling !== isCancelling) {
      setIsCancelling(newIsCancelling);
      if (newIsCancelling) {
        androidVibrate(30);
      }
    }
  };

  const handleTouchEnd = () => {
    if (isCancelling) {
      handleCancel();
    }
  };

  if (permissionDenied) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-card border-t border-border safe-area-bottom">
        <p className="text-center text-sm text-destructive">
          麦克风权限被拒绝，请在设置中开启
        </p>
        <Button variant="outline" onClick={onCancel}>
          返回
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col gap-3 p-4 bg-card border-t border-border safe-area-bottom"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Recording indicator */}
      <div className="flex items-center justify-center gap-3">
        <div className={cn(
          "flex items-center gap-3 px-4 py-2 rounded-full",
          isRecording ? "bg-destructive/10" : "bg-muted"
        )}>
          {isRecording && (
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-destructive animate-ping opacity-75" />
            </div>
          )}
          <span className={cn(
            "text-lg font-mono font-medium tabular-nums",
            isRecording ? "text-destructive" : "text-muted-foreground"
          )}>
            {formatDuration(duration)}
          </span>
        </div>
      </div>

      {/* Wave animation */}
      {isRecording && (
        <div className="flex items-center justify-center gap-1 h-8">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-primary rounded-full animate-pulse"
              style={{
                height: `${Math.random() * 24 + 8}px`,
                animationDelay: `${i * 0.05}s`,
                animationDuration: '0.5s',
              }}
            />
          ))}
        </div>
      )}

      {/* Cancel hint when recording */}
      {isRecording && (
        <p className={cn(
          "text-center text-sm transition-colors",
          isCancelling ? "text-destructive font-medium" : "text-muted-foreground"
        )}>
          {isCancelling ? "松开取消" : "上滑取消发送"}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-4">
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={handleCancel}
          className="h-14 w-14 rounded-full border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-transform"
        >
          <X className="h-6 w-6" />
        </Button>

        {isRecording ? (
          <Button
            type="button"
            size="lg"
            onClick={() => stopRecording(false)}
            className="h-16 w-16 rounded-full bg-destructive hover:bg-destructive/90 active:scale-95 transition-transform"
          >
            <Square className="h-6 w-6 fill-current" />
          </Button>
        ) : audioBlob ? (
          <Button
            type="button"
            size="lg"
            onClick={handleSend}
            disabled={isSending}
            className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90 active:scale-95 transition-transform"
          >
            <Send className="h-6 w-6" />
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={startRecording}
            className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90 active:scale-95 transition-transform"
          >
            <Mic className="h-6 w-6" />
          </Button>
        )}
      </div>
    </div>
  );
}
