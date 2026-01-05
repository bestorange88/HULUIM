import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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

export function AvatarWithFrame({
  avatarUrl,
  displayName,
  size = "md",
  className
}: AvatarWithFrameProps) {
  return (
    <div className={cn("relative inline-block", className)}>
      <Avatar className={cn(sizeClasses[size], "transition-all duration-300")}>
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
