import { useState, useRef, useCallback, useEffect } from "react";
import { Edit, Trash2, Languages, Forward, RotateCcw, EyeOff, Mic, Star, Copy, Quote, UserMinus, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface MessageActionsProps {
  onEdit?: () => void;
  onDelete: () => void;
  onRecall?: () => void;
  onOwnerDelete?: () => void;
  onTranslate?: () => void;
  onTranscribe?: () => void;
  onForward: () => void;
  onFavorite: () => void;
  onCopy: () => void;
  onQuote: () => void;
  onKickMember?: () => void;
  onSaveToGallery?: () => void;
  isOwnMessage?: boolean;
  canRecall?: boolean;
  isGroupOwner?: boolean;
  isGroupAdmin?: boolean;
  messageType?: string;
  children: React.ReactNode;
}

interface MenuPosition {
  x: number;
  y: number;
}

export default function MessageActions({ 
  onEdit, 
  onDelete, 
  onRecall,
  onOwnerDelete,
  onTranslate,
  onTranscribe,
  onForward,
  onFavorite,
  onCopy,
  onQuote,
  onKickMember,
  onSaveToGallery,
  isOwnMessage = false,
  canRecall = false,
  isGroupOwner = false,
  isGroupAdmin = false,
  messageType = 'text',
  children
}: MessageActionsProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const isAudioMessage = messageType === 'audio';
  const isImageMessage = messageType === 'image';
  const isVideoMessage = messageType === 'video';
  const isMediaMessage = isImageMessage || isVideoMessage;
  const canManageMembers = (isGroupOwner || isGroupAdmin) && !isOwnMessage;

  const LONG_PRESS_DURATION = 500;

  const adjustMenuPosition = useCallback((x: number, y: number) => {
    const menuWidth = 160;
    const menuHeight = 300;
    const padding = 10;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let adjustedX = x;
    let adjustedY = y;
    
    if (x + menuWidth + padding > viewportWidth) {
      adjustedX = viewportWidth - menuWidth - padding;
    }
    if (x < padding) {
      adjustedX = padding;
    }
    
    if (y + menuHeight + padding > viewportHeight) {
      adjustedY = y - menuHeight;
      if (adjustedY < padding) {
        adjustedY = padding;
      }
    }
    
    return { x: adjustedX, y: adjustedY };
  }, []);

  const openMenu = useCallback((clientX: number, clientY: number) => {
    const position = adjustMenuPosition(clientX, clientY);
    setMenuPosition(position);
    setIsOpen(true);
  }, [adjustMenuPosition]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu(e.clientX, e.clientY);
  }, [openMenu]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimerRef.current = setTimeout(() => {
      openMenu(touch.clientX, touch.clientY);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, LONG_PRESS_DURATION);
  }, [openMenu]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeMenu]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleAction = useCallback((action: () => void) => {
    return () => {
      action();
      closeMenu();
    };
  }, [closeMenu]);

  const MenuItem = ({ icon: Icon, label, onClick, className }: { 
    icon: React.ElementType; 
    label: string; 
    onClick: () => void;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent rounded-md transition-colors",
        className
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className="select-none"
      >
        {children}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50" onClick={closeMenu}>
          <div
            ref={menuRef}
            className="fixed bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px] max-h-[60vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100"
            style={{ left: menuPosition.x, top: menuPosition.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {!isAudioMessage && (
              <MenuItem icon={Copy} label="复制" onClick={handleAction(onCopy)} />
            )}
            
            <MenuItem icon={Quote} label="引用" onClick={handleAction(onQuote)} />
            
            {isAudioMessage ? (
              onTranscribe && (
                <MenuItem icon={Mic} label="转文字" onClick={handleAction(onTranscribe)} />
              )
            ) : (
              onTranslate && (
                <MenuItem icon={Languages} label={t("messages.translate")} onClick={handleAction(onTranslate)} />
              )
            )}
            
            <div className="h-px bg-border my-1" />
            
            <MenuItem icon={Forward} label="转发" onClick={handleAction(onForward)} />
            <MenuItem icon={Star} label="收藏" onClick={handleAction(onFavorite)} />
            
            {isMediaMessage && onSaveToGallery && (
              <MenuItem 
                icon={Download} 
                label={isVideoMessage ? "保存视频" : "保存到相册"} 
                onClick={handleAction(onSaveToGallery)} 
              />
            )}
            
            <div className="h-px bg-border my-1" />
            
            {isOwnMessage ? (
              <>
                {onEdit && (
                  <MenuItem icon={Edit} label={t("common.edit")} onClick={handleAction(onEdit)} />
                )}
                
                {canRecall && onRecall && (
                  <MenuItem 
                    icon={RotateCcw} 
                    label="撤回" 
                    onClick={handleAction(onRecall)}
                    className="text-orange-600"
                  />
                )}
                
                <MenuItem 
                  icon={EyeOff} 
                  label="删除（仅自己）" 
                  onClick={handleAction(onDelete)}
                  className="text-destructive"
                />
              </>
            ) : (
              <>
                {isGroupOwner && onOwnerDelete && (
                  <MenuItem 
                    icon={Trash2} 
                    label="删除（所有人）" 
                    onClick={handleAction(onOwnerDelete)}
                    className="text-orange-600"
                  />
                )}
                
                <MenuItem 
                  icon={EyeOff} 
                  label="删除（仅自己）" 
                  onClick={handleAction(onDelete)}
                  className="text-destructive"
                />
                
                {canManageMembers && onKickMember && (
                  <>
                    <div className="h-px bg-border my-1" />
                    <MenuItem 
                      icon={UserMinus} 
                      label="踢出" 
                      onClick={handleAction(onKickMember)}
                      className="text-destructive"
                    />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
