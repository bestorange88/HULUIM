import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface OnlineStatusProps {
  isOnline: boolean;
  lastSeen?: string | null;
  isTyping?: boolean;
  isRecording?: boolean;
  className?: string;
}

export default function OnlineStatus({ 
  isOnline, 
  lastSeen, 
  isTyping, 
  isRecording,
  className 
}: OnlineStatusProps) {
  const getStatusText = () => {
    if (isRecording) return "正在录制语音...";
    if (isTyping) return "正在输入...";
    if (isOnline) return "在线";
    if (lastSeen) {
      try {
        return `${formatDistanceToNow(new Date(lastSeen), { 
          addSuffix: true, 
          locale: zhCN 
        })}在线`;
      } catch {
        return "离线";
      }
    }
    return "离线";
  };

  const isActive = isTyping || isRecording;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className={cn(
        "w-2 h-2 rounded-full transition-colors",
        isActive ? "bg-amber-500 animate-pulse" :
        isOnline ? "bg-green-500" : "bg-muted-foreground/40"
      )} />
      <span className={cn(
        "text-xs transition-colors",
        isActive ? "text-amber-600 dark:text-amber-400 font-medium" :
        isOnline ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
      )}>
        {getStatusText()}
      </span>
    </div>
  );
}
