import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  isTyping: boolean;
  isRecording: boolean;
  userName?: string;
}

export default function TypingIndicator({ isTyping, isRecording, userName }: TypingIndicatorProps) {
  if (!isTyping && !isRecording) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex gap-1">
        {isRecording ? (
          // Recording wave animation
          <>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-1 h-3 bg-destructive/60 rounded-full animate-pulse"
                style={{
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </>
        ) : (
          // Typing dots animation
          <>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 bg-muted-foreground/60 rounded-full",
                  "animate-bounce"
                )}
                style={{
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '0.6s',
                }}
              />
            ))}
          </>
        )}
      </div>
      <span>
        {isRecording ? "对方正在录制语音..." : "对方正在输入..."}
      </span>
    </div>
  );
}
