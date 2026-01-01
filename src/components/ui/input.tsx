import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, onBlur, onChange, value, ...props }, ref) => {
    const composingRef = React.useRef(false);
    const inputRef = React.useRef<HTMLInputElement>(null);
    
    const combinedRef = (node: HTMLInputElement) => {
      inputRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      const isAndroid = /Android/i.test(navigator.userAgent);
      if (isAndroid) {
        setTimeout(() => {
          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const currentDomValue = e.currentTarget.value;
      const controlledValue = String(value ?? "");
      
      if (onChange && currentDomValue !== controlledValue) {
        const syntheticEvent = {
          ...e,
          target: { ...e.target, value: currentDomValue },
          currentTarget: { ...e.currentTarget, value: currentDomValue },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
      
      composingRef.current = false;
      onBlur?.(e);
    };

    const handleCompositionStart = () => {
      composingRef.current = true;
    };

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false;
      if (onChange) {
        Promise.resolve().then(() => {
          if (inputRef.current) {
            const finalValue = inputRef.current.value;
            const controlledValue = String(value ?? "");
            if (finalValue !== controlledValue) {
              const syntheticEvent = {
                target: { value: finalValue },
                currentTarget: { value: finalValue },
              } as React.ChangeEvent<HTMLInputElement>;
              onChange(syntheticEvent);
            }
          }
        });
      }
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "min-h-[40px] touch-manipulation",
          className,
        )}
        ref={combinedRef}
        value={value}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={onChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        style={{ fontSize: '16px', ...props.style }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
