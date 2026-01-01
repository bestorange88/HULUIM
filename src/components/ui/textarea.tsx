import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, onFocus, onBlur, ...props }, ref) => {
  // Handle Android keyboard focus
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      setTimeout(() => {
        e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 100);
    }
    onBlur?.(e);
  };

  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation md:text-sm",
        className,
      )}
      ref={ref}
      onFocus={handleFocus}
      onBlur={handleBlur}
      // Prevent zoom on iOS
      style={{ fontSize: '16px', ...props.style }}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
