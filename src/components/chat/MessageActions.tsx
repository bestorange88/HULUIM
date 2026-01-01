import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2, Languages, Forward, RotateCcw, EyeOff, Mic, Star, Copy, Quote, UserMinus, Download } from "lucide-react";
import { useTranslation } from "react-i18next";

interface MessageActionsProps {
  onEdit?: () => void;
  onDelete: () => void;           // Local delete (only I can't see)
  onRecall?: () => void;          // Recall (both parties can't see)
  onOwnerDelete?: () => void;     // Group owner delete (all members can't see)
  onTranslate?: () => void;       // Optional - hide for call records
  onTranscribe?: () => void;      // For audio messages
  onForward: () => void;
  onFavorite: () => void;         // Add to favorites
  onCopy: () => void;             // Copy to clipboard
  onQuote: () => void;            // Quote message
  onKickMember?: () => void;      // Kick member (group owner/admin only)
  onSaveToGallery?: () => void;   // Save image/video to gallery
  isOwnMessage?: boolean;
  canRecall?: boolean;            // Within recall time limit (e.g., 2 minutes)
  isGroupOwner?: boolean;         // Is current user group owner
  isGroupAdmin?: boolean;         // Is current user group admin
  messageType?: string;           // 'text', 'audio', 'image', etc.
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
  messageType = 'text'
}: MessageActionsProps) {
  const { t } = useTranslation();
  
  const isAudioMessage = messageType === 'audio';
  const isImageMessage = messageType === 'image';
  const isVideoMessage = messageType === 'video';
  const isMediaMessage = isImageMessage || isVideoMessage;
  const canManageMembers = (isGroupOwner || isGroupAdmin) && !isOwnMessage;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 bg-popover z-50 max-h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} sideOffset={4}>
        {/* Copy - available for text messages */}
        {!isAudioMessage && (
          <DropdownMenuItem onClick={onCopy}>
            <Copy className="h-3 w-3 mr-2" />
            复制
          </DropdownMenuItem>
        )}
        
        {/* Quote - available for all messages */}
        <DropdownMenuItem onClick={onQuote}>
          <Quote className="h-3 w-3 mr-2" />
          引用
        </DropdownMenuItem>
        
        {/* Translate for text / Transcribe for audio */}
        {isAudioMessage ? (
          onTranscribe && (
            <DropdownMenuItem onClick={onTranscribe}>
              <Mic className="h-3 w-3 mr-2" />
              转文字
            </DropdownMenuItem>
          )
        ) : (
          onTranslate && (
            <DropdownMenuItem onClick={onTranslate}>
              <Languages className="h-3 w-3 mr-2" />
              {t("messages.translate")}
            </DropdownMenuItem>
          )
        )}
        
        <DropdownMenuSeparator />
        
        {/* Forward - available for all messages */}
        <DropdownMenuItem onClick={onForward}>
          <Forward className="h-3 w-3 mr-2" />
          转发
        </DropdownMenuItem>
        
        {/* Favorite - available for all messages */}
        <DropdownMenuItem onClick={onFavorite}>
          <Star className="h-3 w-3 mr-2" />
          收藏
        </DropdownMenuItem>
        
        {/* Save to gallery - for image and video messages */}
        {isMediaMessage && onSaveToGallery && (
          <DropdownMenuItem onClick={onSaveToGallery}>
            <Download className="h-3 w-3 mr-2" />
            {isVideoMessage ? "保存视频" : "保存到相册"}
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        
        {isOwnMessage ? (
          <>
            {/* Edit - only for own text messages */}
            {onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-3 w-3 mr-2" />
                {t("common.edit")}
              </DropdownMenuItem>
            )}
            
            {/* Recall - only within time limit */}
            {canRecall && onRecall && (
              <DropdownMenuItem 
                onClick={onRecall}
                className="text-orange-600 focus:text-orange-600"
              >
                <RotateCcw className="h-3 w-3 mr-2" />
                撤回
              </DropdownMenuItem>
            )}
            
            {/* Delete for self - always available */}
            <DropdownMenuItem 
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <EyeOff className="h-3 w-3 mr-2" />
              删除（仅自己）
            </DropdownMenuItem>
          </>
        ) : (
          <>
            {/* Group owner can delete any message for everyone */}
            {isGroupOwner && onOwnerDelete && (
              <DropdownMenuItem 
                onClick={onOwnerDelete}
                className="text-orange-600 focus:text-orange-600"
              >
                <Trash2 className="h-3 w-3 mr-2" />
                删除（所有人）
              </DropdownMenuItem>
            )}
            {/* Delete for received messages - local only */}
            <DropdownMenuItem 
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <EyeOff className="h-3 w-3 mr-2" />
              删除（仅自己）
            </DropdownMenuItem>
            
            {/* Mute and Kick - only for group owner/admin on other members */}
            {canManageMembers && onKickMember && (
              <>
                <DropdownMenuSeparator />

                {onKickMember && (
                  <DropdownMenuItem 
                    onClick={onKickMember}
                    className="text-destructive focus:text-destructive"
                  >
                    <UserMinus className="h-3 w-3 mr-2" />
                    踢出
                  </DropdownMenuItem>
                )}
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
