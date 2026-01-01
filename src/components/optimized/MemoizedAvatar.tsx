import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface MemoizedAvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  className?: string;
  onClick?: () => void;
}

export const MemoizedAvatar = React.memo<MemoizedAvatarProps>(({
  src,
  alt = "Avatar",
  fallback = "?",
  className,
  onClick,
}) => {
  return (
    <Avatar className={cn(className, onClick && "cursor-pointer")} onClick={onClick}>
      <AvatarImage src={src} alt={alt} loading="lazy" />
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
});

MemoizedAvatar.displayName = "MemoizedAvatar";
