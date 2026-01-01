import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AvatarWithFrameProps {
  avatarUrl?: string | null;
  displayName: string;
  frameStyle?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-14 w-14",
  xl: "h-24 w-24"
};

const textSizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-xl"
};

const frameClasses: Record<string, string> = {
  none: "",
  // 黄金会员 - Gold Member Frames
  "gold-classic": "ring-[3px] ring-amber-400 shadow-lg shadow-amber-400/40",
  "gold-shine": "ring-[3px] ring-amber-500 ring-offset-2 ring-offset-amber-200/30 shadow-xl shadow-amber-500/50",
  "gold-royal": "ring-4 ring-yellow-500 ring-offset-2 ring-offset-yellow-300/20 shadow-xl shadow-yellow-500/60",
  
  // 钻石会员 - Diamond Member Frames  
  "diamond-ice": "ring-[3px] ring-cyan-400 shadow-lg shadow-cyan-400/50",
  "diamond-crystal": "ring-4 ring-cyan-500 ring-offset-2 ring-offset-cyan-200/30 shadow-xl shadow-cyan-500/60",
  "diamond-aurora": "ring-4 ring-blue-400 ring-offset-2 ring-offset-purple-300/30 shadow-xl shadow-purple-400/50",
  
  // 至尊会员 - Elite Member Frames
  "elite-flame": "ring-4 ring-orange-500 ring-offset-2 ring-offset-red-300/30 shadow-xl shadow-orange-500/60",
  "elite-galaxy": "ring-[5px] ring-purple-500 ring-offset-2 ring-offset-indigo-300/30 shadow-2xl shadow-purple-600/70",
  "elite-supreme": "ring-[5px] ring-amber-500 ring-offset-3 ring-offset-amber-300/30 shadow-2xl shadow-amber-600/80",
  
  // Legacy frames for compatibility
  "basic-gold": "ring-4 ring-amber-400 ring-offset-2 ring-offset-background shadow-lg shadow-amber-400/50",
  "basic-silver": "ring-4 ring-gray-300 ring-offset-2 ring-offset-background shadow-lg shadow-gray-300/50",
  "gold-crown": "ring-4 ring-amber-500 ring-offset-2 ring-offset-background shadow-xl shadow-amber-500/60",
  "gold-luxury": "ring-[5px] ring-amber-500 ring-offset-4 ring-offset-amber-300/30 shadow-2xl shadow-amber-600/70",
  "diamond-shine": "ring-4 ring-cyan-400 ring-offset-2 ring-offset-background shadow-xl shadow-cyan-400/70",
  "diamond-star": "ring-[5px] ring-cyan-500 ring-offset-4 ring-offset-background shadow-2xl shadow-purple-500/60",
  "elite-phoenix": "ring-[6px] ring-orange-500 ring-offset-4 ring-offset-background shadow-2xl shadow-orange-600/80",
  "elite-dragon": "ring-[6px] ring-purple-600 ring-offset-4 ring-offset-purple-400/30 shadow-2xl shadow-purple-700/90",
};

export function AvatarWithFrame({
  avatarUrl,
  displayName,
  frameStyle = "none",
  size = "md",
  className
}: AvatarWithFrameProps) {
  const [resolvedFrameStyle, setResolvedFrameStyle] = useState<string>(frameStyle || "none");

  useEffect(() => {
    // If frameStyle looks like a UUID (contains hyphens and is 36 chars), fetch the style_class
    const isUUID = frameStyle && frameStyle.length === 36 && frameStyle.includes('-');
    
    if (isUUID) {
      const fetchFrameStyle = async () => {
        try {
          const { data, error } = await supabase
            .from('avatar_frames')
            .select('style_class')
            .eq('id', frameStyle)
            .maybeSingle();
          
          if (!error && data) {
            setResolvedFrameStyle(data.style_class);
          } else {
            setResolvedFrameStyle("none");
          }
        } catch (error) {
          console.error('Error fetching frame style:', error);
          setResolvedFrameStyle("none");
        }
      };
      
      fetchFrameStyle();
    } else {
      setResolvedFrameStyle(frameStyle || "none");
    }
  }, [frameStyle]);
  
  const frameClass = frameClasses[resolvedFrameStyle as keyof typeof frameClasses] || "";
  
  return (
    <div className={cn("relative inline-block", className)}>
      <Avatar className={cn(sizeClasses[size], frameClass, "transition-all duration-300")}>
        <AvatarImage src={avatarUrl || undefined} alt={displayName} className="object-cover" />
        <AvatarFallback className={cn(
          "bg-gradient-to-br from-primary to-accent text-primary-foreground font-semibold",
          textSizeClasses[size]
        )}>
          {displayName?.slice(0, 2).toUpperCase() || "??"}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
