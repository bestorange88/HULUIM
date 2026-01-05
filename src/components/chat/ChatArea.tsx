import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Phone, Video, MoreVertical, Smile, ArrowLeft, Plus, Gift, Banknote, Paperclip, Image as ImageIcon, UserCog, Eraser, Ban, Search, Check, CheckCheck, Mic, MessageSquarePlus as MessageSquarePlusIcon, Play, Pause, Users, X, Star, AtSign, Volume2, VolumeX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { playMessageNotification } from "@/utils/notificationSound";
import { z } from "zod";
import { AvatarWithFrame } from "@/components/avatar/AvatarWithFrame";

const messageSchema = z.object({
  content: z.string()
    .min(1, "消息不能为空")
    .max(5000, "消息内容过长，最多5000字")
    .trim(),
});
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RedEnvelopeDialog from "./RedEnvelopeDialog";
import TransferDialog from "./TransferDialog";
import RedEnvelopeMessage from "./RedEnvelopeMessage";
import TransferMessage from "./TransferMessage";
import ChatSettingsDialog from "./ChatSettingsDialog";
import ClearChatDialog from "./ClearChatDialog";
import BlockUserDialog from "./BlockUserDialog";
import SearchMessagesDialog from "./SearchMessagesDialog";
import ImageMessageViewer from "./ImageMessageViewer";
import EditMessageDialog from "./EditMessageDialog";
import MessageActions from "./MessageActions";
import VoiceRecorder from "./VoiceRecorder";
import HoldToTalkButton from "./HoldToTalkButton";
import ForwardMessageDialog from "./ForwardMessageDialog";
import OnlineStatus from "./OnlineStatus";
import TypingIndicator from "./TypingIndicator";
import { GroupSettingsDialog } from "@/components/groups/GroupSettingsDialog";
import { useCall } from "@/contexts/CallContext";
import { useTranslation } from "react-i18next";
import { usePresence } from "@/hooks/usePresence";
import { formatMessageTime } from "@/utils/formatMessageTime";
import { useWalletEnabled } from "@/hooks/useWalletEnabled";
import MentionSelector from "./MentionSelector";
import { copyToClipboard } from "@/utils/clipboard";
import { saveImageToGallery } from "@/utils/gallerySaver";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  type?: string;
  media_url?: string | null;
  status?: string;
  is_edited?: boolean;
  is_deleted?: boolean;
  edited_at?: string | null;
  sender?: {
    display_name: string;
    avatar_url: string | null;
    avatar_frame?: string | null;
  };
}

interface ChatAreaProps {
  conversationId: string | null;
}

export default function ChatArea({ conversationId }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  // canSend is now derived from newMessage to fix emoji/Chinese input issues
  const canSend = newMessage.trim().length > 0;
  const [lastSendTime, setLastSendTime] = useState<number>(0);
  const [sendCount, setSendCount] = useState<number>(0);
  const [sendCountResetTime, setSendCountResetTime] = useState<number>(0);
  const MIN_SEND_INTERVAL = 500; // 最小发送间隔500ms
  const MAX_SENDS_PER_MINUTE = 30; // 每分钟最多30条
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [conversationInfo, setConversationInfo] = useState<any>(null);
  const [showExtensions, setShowExtensions] = useState(false);
  const [redEnvelopeOpen, setRedEnvelopeOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearChatOpen, setClearChatOpen] = useState(false);
  const [blockUserOpen, setBlockUserOpen] = useState(false);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [transcriptionMode, setTranscriptionMode] = useState<'none' | 'text'>('none');
  const [messageTranslations, setMessageTranslations] = useState<Map<string, string>>(new Map());
  const [translatingMessages, setTranslatingMessages] = useState<Set<string>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [quotedMessage, setQuotedMessage] = useState<Message | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set());
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [memberCount, setMemberCount] = useState(0);
  const [currentUserRole, setCurrentUserRole] = useState<"owner" | "admin" | "member">("member");
  const [participantRoles, setParticipantRoles] = useState<Map<string, string>>(new Map());
  const [userJoinedAt, setUserJoinedAt] = useState<string | null>(null);
  const [showMentionSelector, setShowMentionSelector] = useState(false);
  const [mentionSearchText, setMentionSearchText] = useState("");
  const [muteMemberTarget, setMuteMemberTarget] = useState<{ id: string; name: string; isMuted?: boolean } | null>(null);
  const [kickMemberTarget, setKickMemberTarget] = useState<{ id: string; name: string } | null>(null);
  const [isKickingMember, setIsKickingMember] = useState(false);
  const [muteDuration, setMuteDuration] = useState("1h");
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isGroupMuteAll, setIsGroupMuteAll] = useState(false);
  const [muteMessage, setMuteMessage] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationMuteChannelRef = useRef<any>(null);
  const messageBufferRef = useRef<Message[]>([]);
  const messageBufferTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { initiateCall } = useCall();
  const { t } = useTranslation();
  const { walletEnabled } = useWalletEnabled();
  
  // Keyboard height hook for mobile keyboard handling
  const { keyboardHeight, isKeyboardVisible } = useKeyboardHeight();

  // Presence hook for online status and typing/recording indicators
  const { otherUserPresence, setTyping, setRecording, typingDisabled } = usePresence({
    conversationId,
    currentUserId: currentUser?.id || null,
    otherUserId,
  });

  // Auto-resize textarea
  const autoResizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = 120; // Maximum height in pixels (about 5 lines)
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  // Handle input change with typing indicator and @ mention detection
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    // 防抖优化：不在每次输入时都触发 typing 状态
    // setTyping 已在 usePresence 中做了节流处理
    if (value.length > 0 && !typingDisabled) {
      setTyping(true);
    }
    
    // Auto-resize textarea
    setTimeout(autoResizeTextarea, 0);
    
    // Detect @ mention in group chats
    if (conversationInfo?.type === "group") {
      const lastAtIndex = value.lastIndexOf("@");
      if (lastAtIndex !== -1) {
        const textAfterAt = value.slice(lastAtIndex + 1);
        // Check if @ is at the end or followed by text (no space after)
        if (!textAfterAt.includes(" ")) {
          setShowMentionSelector(true);
          setMentionSearchText(textAfterAt);
          return;
        }
      }
    }
    setShowMentionSelector(false);
    setMentionSearchText("");
  }, [setTyping, conversationInfo?.type, autoResizeTextarea]);

  // Handle mention selection
  const handleMentionSelect = useCallback((member: { user_id: string; profile: { display_name: string } }) => {
    const lastAtIndex = newMessage.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const beforeAt = newMessage.slice(0, lastAtIndex);
      setNewMessage(`${beforeAt}@${member.profile.display_name} `);
    }
    setShowMentionSelector(false);
    setMentionSearchText("");
  }, [newMessage]);

  // Handle recording state change
  const handleRecordingChange = useCallback((isRecording: boolean) => {
    setRecording(isRecording);
  }, [setRecording]);

  const toggleAudioPlayback = async (messageId: string, audioUrl: string) => {
    // Import Android compat utilities dynamically
    const { isAndroid, hasAudioCodecIssues, setupAndroidAudio, unlockAndroidAudio, playMediaWithFallback } = await import('@/utils/androidCompat');
    const { isProblematicOPPO, unlockOPPOAudio, playAudioOnOPPO, stopOPPOAudio } = await import('@/utils/oppoAudioFix');
    
    const isOPPODevice = isProblematicOPPO();
    console.log('[Audio] Device info - Android:', isAndroid(), 'HasCodecIssues:', hasAudioCodecIssues(), 'ProblematicOPPO:', isOPPODevice);
    
    if (playingAudio === messageId) {
      // Stop playback
      if (isOPPODevice) {
        stopOPPOAudio();
      }
      const audio = audioRefs.current.get(messageId);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setPlayingAudio(null);
      return;
    }

    // Stop any currently playing audio
    if (playingAudio) {
      if (isOPPODevice) {
        stopOPPOAudio();
      }
      const currentAudio = audioRefs.current.get(playingAudio);
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      setPlayingAudio(null);
    }

    // Get playable URL (signed URL for private files)
    let playableUrl = audioUrl;
    try {
      const urlMatch = audioUrl.match(/\/storage\/v1\/object\/public\/chat-files\/(.+)$/);
      if (urlMatch && urlMatch[1]) {
        const filePath = urlMatch[1];
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('chat-files')
          .createSignedUrl(filePath, 3600);
        
        if (!signedUrlError && signedUrlData?.signedUrl) {
          playableUrl = signedUrlData.signedUrl;
        }
      }
    } catch (urlError) {
      console.warn('Error parsing audio URL, using original:', urlError);
    }

    // For problematic OPPO devices, use specialized Web Audio API approach
    if (isOPPODevice) {
      console.log('[Audio] Using OPPO-specific playback for:', playableUrl);
      
      // Unlock audio context first
      await unlockOPPOAudio();
      
      setPlayingAudio(messageId);
      
      const result = await playAudioOnOPPO(
        playableUrl,
        () => {
          // onEnded
          setPlayingAudio(null);
        },
        (error) => {
          // onError
          console.error('[OPPO Audio] Playback error:', error);
          setPlayingAudio(null);
          toast({
            title: "播放失败",
            description: "音频格式不支持，请尝试重新录制",
            variant: "destructive"
          });
        }
      );
      
      if (!result.success) {
        setPlayingAudio(null);
      }
      return;
    }

    // Unlock audio context on Android/OPPO devices first
    if (isAndroid()) {
      await unlockAndroidAudio();
    }

    // Standard playback for other devices
    let audio = audioRefs.current.get(messageId);
    if (!audio) {
      // Create audio element
      audio = new Audio();
      
      // Apply Android/OPPO specific fixes
      setupAndroidAudio(audio);
      
      // Additional cross-browser attributes
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      (audio as any).playsInline = true;
      (audio as any).webkitPlaysInline = true;
      
      // OPPO/ColorOS specific: x5 kernel attributes
      audio.setAttribute('x5-playsinline', 'true');
      audio.setAttribute('x5-video-player-type', 'h5');
      
      // Set source after attributes
      audio.src = playableUrl;
      
      audioRefs.current.set(messageId, audio);
      
      audio.addEventListener('ended', () => {
        setPlayingAudio(null);
      });
      
      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e, audio?.error);
        setPlayingAudio(null);
        toast({
          title: "播放失败",
          description: "音频格式不支持或网络错误，请重试",
          variant: "destructive"
        });
      });

      // Handle loading issues with retry
      audio.addEventListener('stalled', () => {
        console.warn('Audio stalled, attempting to reload');
        setTimeout(() => audio?.load(), 500);
      });

      audio.addEventListener('waiting', () => {
        console.log('Audio waiting for data...');
      });
    }
    
    try {
      // Reset to beginning
      audio.currentTime = 0;
      audio.volume = 1.0;
      
      // Load the audio first with extended timeout for slow networks
      await new Promise<void>((resolve, reject) => {
        let resolved = false;
        
        const cleanup = () => {
          audio?.removeEventListener('canplaythrough', onCanPlay);
          audio?.removeEventListener('canplay', onCanPlay);
          audio?.removeEventListener('loadeddata', onLoadedData);
          audio?.removeEventListener('error', onError);
        };
        
        const onCanPlay = () => {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve();
          }
        };
        
        const onLoadedData = () => {
          // For OPPO devices, loadeddata might fire before canplay
          if (!resolved && audio && audio.readyState >= 2) {
            resolved = true;
            cleanup();
            resolve();
          }
        };
        
        const onError = () => {
          if (!resolved) {
            resolved = true;
            cleanup();
            reject(new Error('Failed to load audio'));
          }
        };
        
        // If already loaded, resolve immediately
        if (audio && audio.readyState >= 2) {
          resolve();
          return;
        }
        
        audio?.addEventListener('canplaythrough', onCanPlay);
        audio?.addEventListener('canplay', onCanPlay);
        audio?.addEventListener('loadeddata', onLoadedData);
        audio?.addEventListener('error', onError);
        audio?.load();
        
        // Extended timeout for slower devices
        setTimeout(() => {
          if (!resolved && audio && audio.readyState >= 1) {
            resolved = true;
            cleanup();
            resolve();
          } else if (!resolved) {
            resolved = true;
            cleanup();
            // Try to play anyway on timeout
            resolve();
          }
        }, 5000);
      });
      
      // Use Android-optimized playback with fallback
      if (isAndroid()) {
        const success = await playMediaWithFallback(audio);
        if (success) {
          setPlayingAudio(messageId);
        } else {
          throw new Error('Playback failed on Android');
        }
      } else {
        // Standard playback for non-Android
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        setPlayingAudio(messageId);
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
      
      // Fallback: try playing without preload
      try {
        audio.load();
        await audio.play();
        setPlayingAudio(messageId);
      } catch (fallbackError) {
        console.error('Fallback playback also failed:', fallbackError);
        toast({
          title: "播放失败",
          description: "无法播放语音消息，请检查网络连接",
          variant: "destructive"
        });
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (conversationId) {
      fetchMessages();
      fetchConversationInfo();

      const channel = supabase
        .channel(`messages-${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload) => {
            // Play notification sound if message is from another user
            if (currentUser && payload.new.sender_id !== currentUser.id) {
              playMessageNotification();
            }
            // Append new message instead of refetching all messages
            const newMessage = payload.new as Message;
            // Fetch sender info for the new message
            const { data: senderData } = await supabase
              .from("profiles")
              .select("display_name, avatar_url, avatar_frame")
              .eq("id", newMessage.sender_id)
              .single();
            
            const messageWithSender = {
              ...newMessage,
              sender: senderData
            };
            
            // Batch message updates with 50ms debounce for better performance
            messageBufferRef.current.push(messageWithSender);
            
            if (messageBufferTimeoutRef.current) {
              clearTimeout(messageBufferTimeoutRef.current);
            }
            
            messageBufferTimeoutRef.current = setTimeout(() => {
              const bufferedMessages = [...messageBufferRef.current];
              messageBufferRef.current = [];
              
              if (bufferedMessages.length > 0) {
                setMessages(prev => {
                  const newMessages = bufferedMessages.filter(
                    msg => !prev.some(m => m.id === msg.id)
                  );
                  return newMessages.length > 0 ? [...prev, ...newMessages] : prev;
                });
              }
            }, 50);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            // Handle message recall/delete
            const updatedMessage = payload.new as Message;
            console.log('[ChatArea] Message updated from realtime:', updatedMessage.id, 'is_recalled:', updatedMessage.is_recalled);
            setMessages(prev => prev.map(m => 
              m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m
            ));
          }
        )
        .subscribe();

      // Subscribe to mute status changes for current user
      const muteChannel = currentUser ? supabase
        .channel(`mute-status-${conversationId}-${currentUser.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "conversation_participants",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            // Only process updates for current user
            if (payload.new.user_id === currentUser.id) {
              console.log("[ChatArea] Mute status updated from realtime:", payload.new);
              const newMuted = payload.new.is_muted;
              const newMutedUntil = payload.new.muted_until ? new Date(payload.new.muted_until) : null;
              
              if (newMuted) {
                if (!newMutedUntil || newMutedUntil > new Date()) {
                  setIsMuted(true);
                  setMuteMessage(newMutedUntil ? `你已被禁言至 ${newMutedUntil.toLocaleString()}` : "你已被永久禁言");
                } else {
                  setIsMuted(false);
                  setMuteMessage(null);
                }
              } else {
                setIsMuted(false);
                setMuteMessage(null);
              }
            }
          }
        )
        .subscribe() : null;

      // Handler for mute_all changes (used by both postgres_changes and broadcast)
      const handleMuteAllChange = async (mute_all: boolean, created_by: string) => {
        console.log("[ChatArea] Processing mute_all change:", { mute_all, created_by });
        
        // Update local conversation info
        setConversationInfo((prev: any) => prev ? { ...prev, mute_all } : prev);
        
        // Recompute mute state for mute_all changes
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log("[ChatArea] No user found, skipping mute state update");
          return;
        }
        
        const { data: myParticipant } = await supabase
          .from("conversation_participants")
          .select("role, is_muted, muted_until")
          .eq("conversation_id", conversationId)
          .eq("user_id", user.id)
          .maybeSingle();
        
        // Check if user is owner (created_by) or admin
        const isOwner = user.id === created_by;
        const isAdmin = myParticipant?.role === "admin" || myParticipant?.role === "owner";
        const isOwnerOrAdmin = isOwner || isAdmin;
        
        console.log("[ChatArea] Mute state check:", { 
          userId: user.id, 
          createdBy: created_by, 
          role: myParticipant?.role, 
          isOwner,
          isAdmin,
          isOwnerOrAdmin,
          mute_all 
        });
        
        if (mute_all) {
          // Group mute_all is enabled
          if (!isOwnerOrAdmin) {
            console.log("[ChatArea] Setting group mute all for non-admin user");
            setIsGroupMuteAll(true);
            setIsMuted(false); // Clear individual mute state
            setMuteMessage("当前群已开启全员禁言");
          } else {
            console.log("[ChatArea] User is owner/admin, not affected by mute_all");
            setIsGroupMuteAll(false);
            setMuteMessage(null);
          }
        } else {
          // Group mute_all is disabled
          console.log("[ChatArea] Group mute_all disabled");
          setIsGroupMuteAll(false);
          
          // Check if user is individually muted
          if (myParticipant?.is_muted) {
            const mutedUntil = myParticipant.muted_until ? new Date(myParticipant.muted_until) : null;
            if (!mutedUntil || mutedUntil > new Date()) {
              setIsMuted(true);
              setMuteMessage(mutedUntil ? `你已被禁言至 ${mutedUntil.toLocaleString()}` : "你已被永久禁言");
            } else {
              setIsMuted(false);
              setMuteMessage(null);
            }
          } else {
            setIsMuted(false);
            setMuteMessage(null);
          }
        }
      };

      // Subscribe to conversation mute_all changes via both postgres_changes and broadcast
      const conversationMuteChannel = supabase
        .channel(`conversation-mute-${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "conversations",
            filter: `id=eq.${conversationId}`,
          },
          async (payload) => {
            const updated = payload.new as any;
            const oldData = payload.old as any;
            console.log("[ChatArea] Conversation updated from postgres_changes:", { 
              mute_all: updated.mute_all, 
              old_mute_all: oldData?.mute_all,
              conversationId: updated.id 
            });
            await handleMuteAllChange(updated.mute_all, updated.created_by);
          }
        )
        .on(
          "broadcast",
          { event: "mute-all-changed" },
          async (payload: any) => {
            console.log("[ChatArea] Received mute-all-changed broadcast:", payload);
            const { mute_all, created_by } = payload.payload;
            await handleMuteAllChange(mute_all, created_by);
          }
        )
        .on(
          "broadcast",
          { event: "message-deleted" },
          (payload: any) => {
            console.log("[ChatArea] Received message-deleted broadcast:", payload);
            const { message_id } = payload.payload;
            setMessages(prev => prev.filter(msg => msg.id !== message_id));
          }
        )
        .subscribe((status) => {
          console.log("[ChatArea] conversation-mute channel status:", status);
          if (status === 'SUBSCRIBED') {
            conversationMuteChannelRef.current = conversationMuteChannel;
          }
        });

      return () => {
        supabase.removeChannel(channel);
        if (muteChannel) supabase.removeChannel(muteChannel);
        supabase.removeChannel(conversationMuteChannel);
        if (conversationMuteChannelRef.current === conversationMuteChannel) {
          conversationMuteChannelRef.current = null;
        }
        // Clean up message buffer timeout
        if (messageBufferTimeoutRef.current) {
          clearTimeout(messageBufferTimeoutRef.current);
          messageBufferTimeoutRef.current = null;
        }
        messageBufferRef.current = [];
      };
    }
  }, [conversationId, currentUser]);

  // Re-fetch messages when userJoinedAt is set for group conversations
  useEffect(() => {
    if (conversationInfo?.type === "group" && userJoinedAt && conversationId) {
      fetchMessages();
    }
  }, [userJoinedAt, conversationInfo?.type]);

  // Network change and app visibility handling for message reliability
  useEffect(() => {
    if (!conversationId) return;
    
    // Import network utilities dynamically
    import('@/utils/androidCompat').then(({ onNetworkChange, onVisibilityChange }) => {
      // Handle network reconnection - refetch messages when coming back online
      const cleanupNetwork = onNetworkChange((online) => {
        if (online) {
          console.log('[ChatArea] Network restored, refetching messages');
          fetchMessages();
        }
      });
      
      // Handle app visibility - refetch messages when returning to foreground
      const cleanupVisibility = onVisibilityChange((visible) => {
        if (visible) {
          console.log('[ChatArea] App returned to foreground, refetching messages');
          fetchMessages();
        }
      });
      
      // Store cleanup functions
      (window as any).__chatAreaNetworkCleanup = cleanupNetwork;
      (window as any).__chatAreaVisibilityCleanup = cleanupVisibility;
    });
    
    return () => {
      // Cleanup network and visibility listeners
      if ((window as any).__chatAreaNetworkCleanup) {
        (window as any).__chatAreaNetworkCleanup();
        delete (window as any).__chatAreaNetworkCleanup;
      }
      if ((window as any).__chatAreaVisibilityCleanup) {
        (window as any).__chatAreaVisibilityCleanup();
        delete (window as any).__chatAreaVisibilityCleanup;
      }
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle mobile virtual keyboard - ensure input is visible when keyboard opens
  useEffect(() => {
    let lastViewportHeight = window.visualViewport?.height || window.innerHeight;
    
    const handleViewportResize = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDiff = lastViewportHeight - currentHeight;
      
      // Keyboard is likely open if viewport height decreased significantly (> 100px)
      if (heightDiff > 100 && document.activeElement === textareaRef.current) {
        // Scroll the input into view with a slight delay to ensure keyboard is fully open
        setTimeout(() => {
          textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Also scroll the messages area to show the latest messages
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 150);
      }
      
      lastViewportHeight = currentHeight;
    };

    // Handle focus on textarea - scroll into view when focused
    const handleFocus = () => {
      setTimeout(() => {
        textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    };

    // Use visualViewport API if available (more reliable for mobile keyboards)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      window.visualViewport.addEventListener('scroll', handleViewportResize);
    } else {
      // Fallback for browsers without visualViewport
      window.addEventListener('resize', handleViewportResize);
    }
    
    // Add focus listener to textarea
    textareaRef.current?.addEventListener('focus', handleFocus);
    
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
        window.visualViewport.removeEventListener('scroll', handleViewportResize);
      } else {
        window.removeEventListener('resize', handleViewportResize);
      }
      textareaRef.current?.removeEventListener('focus', handleFocus);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      setCurrentUser(profile);
    }
  };

  const fetchConversationInfo = async () => {
    if (!conversationId) return;
    
    const { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();
    
    if (conversation && conversation.type === "direct") {
      // 对于一对一对话，获取对方的信息
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: participants } = await supabase
          .from("conversation_participants")
          .select("user_id, profiles!inner(id, display_name, avatar_url, avatar_frame, username)")
          .eq("conversation_id", conversationId)
          .neq("user_id", user.id)
          .maybeSingle();
        
        if (participants) {
          setOtherUserId(participants.user_id);
          
          // Check if current user blocked the other user
          const { data: blockedByMe } = await supabase
            .from("friendships")
            .select("id")
            .eq("user_id", user.id)
            .eq("friend_id", participants.user_id)
            .eq("status", "blocked")
            .maybeSingle();
          
          // Check if current user is blocked by the other user
          const { data: blockedByOther } = await supabase
            .from("friendships")
            .select("id")
            .eq("user_id", participants.user_id)
            .eq("friend_id", user.id)
            .eq("status", "blocked")
            .maybeSingle();
          
          setIsBlocked(!!blockedByMe);
          setIsBlockedByOther(!!blockedByOther);
          
          // Load conversation settings to get remark/note
          const { data: settings } = await supabase
            .from("conversation_settings")
            .select("note")
            .eq("user_id", user.id)
            .eq("conversation_id", conversationId)
            .maybeSingle();
          
          // Use note as display name if it exists, otherwise use profile display_name
          const displayName = settings?.note || participants.profiles.display_name;
          
          setConversationInfo({
            ...conversation,
            name: displayName,
            note: settings?.note || "",
            avatar_url: participants.profiles.avatar_url,
            avatar_frame: participants.profiles.avatar_frame,
            otherUser: {
              id: participants.user_id,
              display_name: participants.profiles.display_name,
              avatar_url: participants.profiles.avatar_url,
              avatar_frame: participants.profiles.avatar_frame,
              username: participants.profiles.username
            }
          });
          return;
        }
      }
    } else if (conversation && conversation.type === "group") {
      // For group conversations, get member count and current user's role
      const { data: { user } } = await supabase.auth.getUser();
      
      const { count, data: allParticipants } = await supabase
        .from("conversation_participants")
        .select("user_id, role, joined_at", { count: "exact" })
        .eq("conversation_id", conversationId);
      
      if (count) {
        setMemberCount(count);
      }
      
      // Get current user's joined_at time for message filtering
      if (user && allParticipants) {
        const currentParticipant = allParticipants.find((p: any) => p.user_id === user.id);
        if (currentParticipant?.joined_at) {
          setUserJoinedAt(currentParticipant.joined_at);
        }
      }
      
      // Build participant roles map - use created_by to identify owner
      if (allParticipants) {
        const rolesMap = new Map<string, string>();
        allParticipants.forEach((p: any) => {
          // Owner is determined by created_by field
          if (p.user_id === conversation.created_by) {
            rolesMap.set(p.user_id, "owner");
          } else if (p.role === "admin") {
            rolesMap.set(p.user_id, "admin");
          }
          // Regular members don't need to be in the map
        });
        setParticipantRoles(rolesMap);
      }
      
      // Get current user's role in group - check created_by first
      if (user) {
        if (user.id === conversation.created_by) {
          setCurrentUserRole("owner");
        } else {
          const currentParticipant = allParticipants?.find((p: any) => p.user_id === user.id);
          if (currentParticipant?.role === "admin") {
            setCurrentUserRole("admin");
          } else {
            setCurrentUserRole("member");
          }
        }
      }

        // Fetch mute status for current user in group
        const { data: myParticipant } = await supabase
          .from("conversation_participants")
          .select("is_muted, muted_until")
          .eq("conversation_id", conversationId)
          .eq("user_id", user.id)
          .maybeSingle();
        
        // Check if user is individually muted
        if (myParticipant?.is_muted) {
          const mutedUntil = myParticipant.muted_until ? new Date(myParticipant.muted_until) : null;
          if (!mutedUntil || mutedUntil > new Date()) {
            setIsMuted(true);
            setMuteMessage(mutedUntil ? `你已被禁言至 ${mutedUntil.toLocaleString()}` : "你已被永久禁言");
          } else {
            setIsMuted(false);
            setMuteMessage(null);
          }
        } else {
          setIsMuted(false);
          setMuteMessage(null);
        }
        
        // Check if group has mute_all enabled
        if (conversation.mute_all) {
          // Only non-owner/admin are affected by mute_all
          const isOwnerOrAdmin = user.id === conversation.created_by || 
            allParticipants?.find((p: any) => p.user_id === user.id)?.role === "admin";
          if (!isOwnerOrAdmin) {
            setIsGroupMuteAll(true);
            setMuteMessage("当前群已开启全员禁言");
          } else {
            setIsGroupMuteAll(false);
          }
        } else {
          setIsGroupMuteAll(false);
        }
    }
    
    setConversationInfo(conversation);
  };

  // Memoize filtered messages to avoid recalculating on every render
  const visibleMessages = useMemo(
    () => messages.filter(m => !deletedMessageIds.has(m.id)),
    [messages, deletedMessageIds]
  );

  const fetchMessages = async () => {
    if (!conversationId || !currentUser) return;

    try {
      // Fetch user's deleted message IDs for this conversation
      const { data: deletedData } = await supabase
        .from("user_deleted_messages")
        .select("message_id")
        .eq("user_id", currentUser.id)
        .eq("conversation_id", conversationId);
      
      const userDeletedIds = new Set(deletedData?.map(d => d.message_id) || []);
      setDeletedMessageIds(userDeletedIds);

      let query = supabase
        .from("messages")
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey (
            display_name,
            avatar_url,
            avatar_frame
          )
        `)
        .eq("conversation_id", conversationId)
        .eq("is_deleted", false);
      
      // For group conversations, only show messages after user joined
      if (conversationInfo?.type === "group" && userJoinedAt) {
        query = query.gte("created_at", userJoinedAt);
      }
      
      // Limit messages to prevent performance issues with large groups (load most recent 500)
      const { data: rawData, error } = await query.order("created_at", { ascending: false }).limit(500);
      const data = rawData ? [...rawData].reverse() : [];

      if (error) {
        console.error('[ChatArea] Error fetching messages:', error);
        return;
      }

      if (data) {
        // Filter out user's locally deleted messages
        const filteredMessages = data.filter(msg => !userDeletedIds.has(msg.id));
        setMessages(filteredMessages);
        // 标记消息为已读
        try {
          await supabase.rpc("mark_messages_as_read", {
            p_conversation_id: conversationId,
            p_user_id: currentUser.id,
          });
        } catch (markErr) {
          console.warn('[ChatArea] mark_messages_as_read error:', markErr);
        }
      }
    } catch (err) {
      console.error('[ChatArea] fetchMessages error:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    // Use DOM value as fallback for Android IME composition issues
    const messageText = (textareaRef.current?.value ?? newMessage).trim();
    if (!messageText || !conversationId || !currentUser) return;
    
    // Sync state with DOM value if they differ (IME composition case)
    if (messageText !== newMessage.trim()) {
      setNewMessage(messageText);
    }


    // Rate limit check - frontend layer
    const now = Date.now();
    if (now - lastSendTime < MIN_SEND_INTERVAL) {
      toast({
        title: "发送太频繁",
        description: "请稍后再发送消息",
        variant: "destructive",
      });
      return;
    }
    
    // Reset send count every minute
    if (now - sendCountResetTime > 60000) {
      setSendCount(0);
      setSendCountResetTime(now);
    }
    
    // Check if exceeded per-minute limit
    if (sendCount >= MAX_SENDS_PER_MINUTE) {
      toast({
        title: "发送消息过多",
        description: "您发送消息太频繁，请稍后再试",
        variant: "destructive",
      });
      return;
    }
    // Check if blocked
    if (isBlocked || isBlockedByOther) {
      toast({
        title: t("chat.sendFailed"),
        description: isBlocked ? t("chat.youBlockedUser") : t("chat.blockedByUser"),
        variant: "destructive",
      });
      return;
    }

    // Check if muted (individual or group-wide)
    if (isMuted || isGroupMuteAll) {
      toast({
        title: "发送失败",
        description: muteMessage || "你已被禁言，无法发送消息",
        variant: "destructive",
      });
      return;
    }

    // Validate message content
    const validation = messageSchema.safeParse({ content: messageText });
    if (!validation.success) {
      toast({
        title: "发送失败",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    // Prepare message content with quote if exists
    let messageContent = validation.data.content;
    if (quotedMessage) {
      messageContent = `「${quotedMessage.sender?.display_name}: ${quotedMessage.content}」\n${messageContent}`;
    }


    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: currentUser.id,
      content: messageContent,
      type: "text",
    });

    if (error) {
      console.error('[ChatArea] Send message error:', error);
      
      // Check if this is an RLS permission denied error (likely due to mute)
      const isRlsDenied = 
        error.code === '42501' || 
        (error.message && (
          error.message.includes('row-level security') ||
          error.message.includes('permission denied') ||
          error.message.includes('new row violates')
        ));
      
      if (isRlsDenied) {
        // Update local state to reflect muted status
        setIsGroupMuteAll(true);
        if (!muteMessage) {
          setMuteMessage('你已被禁言，无法发送消息');
        }
        toast({
          title: "你已被禁言",
          description: "当前群已开启全员禁言或你被单独禁言，无法发送消息",
          variant: "destructive",
        });
      } else {
        toast({
          title: "发送失败",
          description: `${error.message}${error.code ? ` (${error.code})` : ''}`,
          variant: "destructive",
        });
      }
    } else {
      setNewMessage("");
      setLastSendTime(Date.now());
      setSendCount(prev => prev + 1);
      setQuotedMessage(null); // Clear quoted message after sending
      
      // Check if chatting with AI assistant, trigger AI response
      if (conversationInfo?.otherUser?.username === 'ai_assistant') {
        try {
          await supabase.functions.invoke('ai-chat', {
            body: { conversationId }
          });
        } catch (aiError) {
          console.error('AI response error:', aiError);
        }
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId || !currentUser) return;

    // 200MB file size limit
    const maxFileSize = 200 * 1024 * 1024;
    if (file.size > maxFileSize) {
      toast({
        title: "文件过大",
        description: "文件大小不能超过200MB",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-files")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("chat-files")
        .getPublicUrl(fileName);

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        content: `[文件]${file.name}`,
        type: "file",
        media_url: publicUrl,
      });

      toast({ title: t("chat.fileSentSuccess") });
    } catch (error: any) {
      toast({
        title: t("chat.fileUploadFailed"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId || !currentUser) return;

    setUploading(true);
    
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    
    if (!isVideo && !isImage) {
      toast({
        title: t("chat.unsupportedFormat"),
        description: t("chat.selectImageOrVideo"),
        variant: "destructive",
      });
      setUploading(false);
      return;
    }

    // 200MB file size limit for all media
    const maxFileSize = 200 * 1024 * 1024;
    
    if (file.size > maxFileSize) {
      toast({
        title: "文件过大",
        description: "文件大小不能超过200MB",
        variant: "destructive",
      });
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;

      // Use chat-images bucket for both images and videos
      const { error: uploadError } = await supabase.storage
        .from("chat-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("chat-images")
        .getPublicUrl(fileName);

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        content: isVideo ? "[视频]" : "[图片]",
        type: isVideo ? "video" : "image",
        media_url: publicUrl,
      });

      toast({ title: isVideo ? t("chat.videoSentSuccess") : t("chat.imageSentSuccess") });
    } catch (error: any) {
      toast({
        title: isVideo ? t("chat.videoUploadFailed") : t("chat.imageUploadFailed"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleSaveSettings = async (nickname: string, remark: string) => {
    if (!conversationId || !currentUser) return;
    
    // Use nickname as the display name, fallback to remark if nickname is empty
    const noteValue = nickname || remark || '';
    
    try {
      // Save remark/note to conversation_settings
      const { data: existing } = await supabase
        .from('conversation_settings')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('conversation_id', conversationId)
        .maybeSingle();
      
      if (existing) {
        await supabase
          .from('conversation_settings')
          .update({ note: noteValue, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('conversation_settings')
          .insert({
            user_id: currentUser.id,
            conversation_id: conversationId,
            note: noteValue,
            is_pinned: false,
            is_muted: false
          });
      }
      
      // 更新本地conversationInfo状态，使备注立即显示
      if (conversationInfo && noteValue) {
        setConversationInfo({
          ...conversationInfo,
          name: noteValue,
          note: noteValue
        });
      }
      
      toast({ title: t("chat.settingsSaved") });
    } catch (error: any) {
      console.error('Save settings error:', error);
      toast({
        title: t("chat.saveFailed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleClearChat = async (clearType: "local" | "both") => {
    if (!conversationId || !currentUser) return;

    try {
      if (clearType === "both") {
        // 双向清空：删除数据库中的所有消息
        const { error } = await supabase
          .from("messages")
          .delete()
          .eq("conversation_id", conversationId);

        if (error) throw error;
      } else {
        // 本地清空：将所有当前消息标记为已删除（持久化到数据库）
        // 获取当前会话的所有消息ID
        const messageIds = messages.map(m => m.id);
        
        if (messageIds.length > 0) {
          // 批量插入到user_deleted_messages表
          const deleteRecords = messageIds.map(messageId => ({
            user_id: currentUser.id,
            conversation_id: conversationId,
            message_id: messageId
          }));
          
          // 使用upsert避免重复插入
          const { error } = await supabase
            .from("user_deleted_messages")
            .upsert(deleteRecords, { 
              onConflict: 'user_id,message_id',
              ignoreDuplicates: true 
            });
          
          if (error) throw error;
          
          // 更新本地状态
          setDeletedMessageIds(new Set(messageIds));
        }
        
        setMessages([]);
      }

      toast({ title: clearType === "both" ? t("chat.clearedBoth") : t("chat.clearedLocal") });
    } catch (error: any) {
      toast({
        title: t("chat.clearFailed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleBlockUser = async () => {
    if (!otherUserId || !currentUser) return;

    try {
      // 更新好友关系状态为 blocked
      const { error } = await supabase
        .from("friendships")
        .update({ status: "blocked" })
        .eq("user_id", currentUser.id)
        .eq("friend_id", otherUserId);

      if (error) throw error;

      setIsBlocked(true);
      toast({ title: t("chat.userBlocked") });
    } catch (error: any) {
      toast({
        title: t("chat.blockFailed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUnblockUser = async () => {
    if (!otherUserId || !currentUser) return;

    try {
      // 删除拉黑记录
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("friend_id", otherUserId)
        .eq("status", "blocked");

      if (error) throw error;

      setIsBlocked(false);
      toast({ title: t("chat.userUnblocked") });
    } catch (error: any) {
      toast({
        title: t("common.operationFailed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      const { error } = await supabase
        .from("messages")
        .update({
          content: newContent,
          is_edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq("id", messageId);

      if (error) throw error;

      toast({ title: t("chat.messageEdited") });
      fetchMessages();
    } catch (error: any) {
      toast({
        title: t("chat.editFailed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTranslateMessage = async (messageId: string, content: string) => {
    if (translatingMessages.has(messageId)) return;

    setTranslatingMessages(prev => new Set(prev).add(messageId));

    try {
      const { data, error } = await supabase.functions.invoke('translate-message', {
        body: {
          text: content,
          autoDetect: true, // Auto-detect language and translate to opposite
        }
      });

      if (error) throw error;

      if (data?.translatedText) {
        setMessageTranslations(prev => new Map(prev).set(messageId, data.translatedText));
      }
    } catch (error: any) {
      toast({
        title: t("messages.translationFailed"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTranslatingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  };

  // Transcribe audio message
  const handleTranscribeAudio = async (messageId: string, mediaUrl: string) => {
    if (translatingMessages.has(messageId)) return;

    setTranslatingMessages(prev => new Set(prev).add(messageId));

    try {
      // Fetch the audio file
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      
      // Convert to base64
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { 
          audioBase64: base64Audio,
        }
      });

      if (error) throw error;

      if (data?.error === 'quota_exceeded') {
        toast({
          title: "转文字失败",
          description: data.message || "语音转文字功能暂不可用",
          variant: "destructive",
        });
        return;
      }

      if (data?.text) {
        setMessageTranslations(prev => new Map(prev).set(messageId, data.text));
      }
    } catch (error: any) {
      toast({
        title: "转文字失败",
        description: error.message || "无法转换语音消息",
        variant: "destructive",
      });
    } finally {
      setTranslatingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  };

  const handleCopyMessage = async (content: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      toast({ title: t("chat.copiedToClipboard") });
    } else {
      toast({
        title: t("chat.copyFailed"),
        description: t("common.operationFailed"),
        variant: "destructive",
      });
    }
  };

  // Quote message
  const handleQuoteMessage = (message: Message) => {
    setQuotedMessage(message);
    // Focus on input
    document.querySelector<HTMLInputElement>('input[placeholder*="消息"]')?.focus();
  };

  // Recall message - both parties can't see (only for own messages within time limit)
  const handleRecallMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("messages")
        .update({
          is_deleted: true,
          content: "此消息已被撤回",
        })
        .eq("id", messageId);

      if (error) throw error;

      toast({ title: t("chat.messageRecalled") });
      fetchMessages();
    } catch (error: any) {
      toast({
        title: t("chat.recallFailed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Local delete - only I can't see this message (persisted to database)
  const handleLocalDelete = async (messageId: string) => {
    if (!currentUser || !conversationId) return;
    
    try {
      // Insert into user_deleted_messages table
      const { error } = await supabase
        .from("user_deleted_messages")
        .insert({
          user_id: currentUser.id,
          message_id: messageId,
          conversation_id: conversationId,
        });

      if (error) {
        // If duplicate, just ignore (message already deleted)
        if (error.code !== '23505') throw error;
      }

      // Update local state immediately for responsive UI
      setDeletedMessageIds(prev => new Set([...prev, messageId]));
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast({ title: t("chat.messageDeleted") });
    } catch (error: any) {
      console.error("Delete message error:", error);
      toast({
        title: t("chat.deleteFailed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Group owner delete - all members can't see this message
  const handleOwnerDeleteMessage = async (messageId: string) => {
    try {
      const { error, data } = await supabase
        .from("messages")
        .update({
          is_deleted: true,
          content: "此消息已被群主删除",
        })
        .eq("id", messageId)
        .select();

      if (error) throw error;
      
      // Check if any rows were actually updated
      if (!data || data.length === 0) {
        throw new Error("无法删除此消息，请检查权限");
      }

      // Broadcast message deletion to all group members
      const ch = conversationMuteChannelRef.current;
      if (ch) {
        await ch.send({
          type: 'broadcast',
          event: 'message-deleted',
          payload: { message_id: messageId },
        });
        console.log("[ChatArea] Broadcast message-deleted sent", { messageId });
      }

      // Immediately remove from local state for responsive UI
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      toast({ title: t("chat.messageDeleted") });
    } catch (error: any) {
      console.error("[ChatArea] Owner delete failed:", error);
      toast({
        title: t("chat.deleteFailed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Check if message can be recalled (within 5 minutes)
  const canRecallMessage = (message: Message) => {
    if (!currentUser || message.sender_id !== currentUser.id) return false;
    if (message.is_deleted) return false; // Already recalled
    const createdAt = new Date(message.created_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
    return diffMinutes <= 5; // 5 minutes limit
  };

  // Forward message
  const handleForwardMessage = (message: Message) => {
    setForwardingMessage(message);
  };

  // Mute member in group
  const handleMuteMemberFromMessage = async (senderId: string, senderName: string) => {
    // Check if member is already muted
    const { data: participant } = await supabase
      .from("conversation_participants")
      .select("is_muted, muted_until")
      .eq("conversation_id", conversationId)
      .eq("user_id", senderId)
      .maybeSingle();
    
    const isMuted = participant?.is_muted && 
      (!participant?.muted_until || new Date(participant.muted_until) > new Date());
    
    setMuteMemberTarget({ id: senderId, name: senderName, isMuted });
  };

  const handleUnmuteMember = async () => {
    if (!muteMemberTarget) return;

    try {
      const { error } = await supabase
        .from("conversation_participants")
        .update({
          is_muted: false,
          muted_until: null,
        })
        .eq("conversation_id", conversationId)
        .eq("user_id", muteMemberTarget.id);

      if (error) throw error;

      toast({ title: `已解除 ${muteMemberTarget.name} 的禁言` });
      setMuteMemberTarget(null);
    } catch (error: any) {
      toast({
        title: "解禁失败",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMuteAll = async () => {
    if (!conversationId) return;

    try {
      const { error } = await supabase
        .from("conversations")
        .update({ mute_all: true })
        .eq("id", conversationId);

      if (error) throw error;

      // Broadcast mute_all change to all group members using the subscribed channel
      const ch = conversationMuteChannelRef.current;
      if (ch) {
        const sendResult = await ch.send({
          type: 'broadcast',
          event: 'mute-all-changed',
          payload: { 
            mute_all: true, 
            created_by: conversationInfo?.created_by,
            changed_by: currentUser?.id 
          },
        });
        console.log("[ChatArea] Broadcast mute_all=true sent", { sendResult });
      } else {
        console.warn("[ChatArea] No conversationMuteChannelRef when sending broadcast");
      }

      // Don't set isGroupMuteAll here - let handleMuteAllChange handle it
      // This ensures owner/admin are not marked as muted
      toast({ title: "已开启全体禁言" });
    } catch (error: any) {
      toast({
        title: "全体禁言失败",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUnmuteAll = async () => {
    if (!conversationId) return;

    try {
      const { error } = await supabase
        .from("conversations")
        .update({ mute_all: false })
        .eq("id", conversationId);

      if (error) throw error;

      // Broadcast mute_all change to all group members using the subscribed channel
      const ch = conversationMuteChannelRef.current;
      if (ch) {
        const sendResult = await ch.send({
          type: 'broadcast',
          event: 'mute-all-changed',
          payload: { 
            mute_all: false, 
            created_by: conversationInfo?.created_by,
            changed_by: currentUser?.id 
          },
        });
        console.log("[ChatArea] Broadcast mute_all=false sent", { sendResult });
      } else {
        console.warn("[ChatArea] No conversationMuteChannelRef when sending broadcast");
      }

      // Don't set isGroupMuteAll here - let handleMuteAllChange handle it
      setIsGroupMuteAll(false);
      setMuteMessage(null);
      toast({ title: "已关闭全体禁言" });
    } catch (error: any) {
      toast({
        title: "关闭全体禁言失败",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleConfirmMuteMember = async () => {
    if (!muteMemberTarget) return;

    try {
      let mutedUntil: string | null = null;
      if (muteDuration !== "forever") {
        const durations: Record<string, number> = {
          "10m": 10 * 60 * 1000,
          "1h": 60 * 60 * 1000,
          "12h": 12 * 60 * 60 * 1000,
          "1d": 24 * 60 * 60 * 1000,
          "7d": 7 * 24 * 60 * 60 * 1000,
        };
        mutedUntil = new Date(Date.now() + durations[muteDuration]).toISOString();
      }

      const { error } = await supabase
        .from("conversation_participants")
        .update({
          is_muted: true,
          muted_until: mutedUntil,
        })
        .eq("conversation_id", conversationId)
        .eq("user_id", muteMemberTarget.id);

      if (error) throw error;

      toast({ title: `已禁言 ${muteMemberTarget.name}` });
      setMuteMemberTarget(null);
    } catch (error: any) {
      toast({
        title: "禁言失败",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Kick member from group
  const handleKickMemberFromMessage = (senderId: string, senderName: string) => {
    setKickMemberTarget({ id: senderId, name: senderName });
  };

  const handleConfirmKickMember = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!kickMemberTarget || !conversationId || isKickingMember) return;

    const targetId = kickMemberTarget.id;
    const targetName = kickMemberTarget.name;
    
    setIsKickingMember(true);
    
    try {
      const { data, error } = await supabase.rpc("remove_group_member", {
        _conversation_id: conversationId,
        _target_user_id: targetId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || "踢出失败");
      }

      toast({ title: `已将 ${targetName} 踢出群聊` });
      setKickMemberTarget(null);
      fetchConversationInfo();
    } catch (error: any) {
      toast({
        title: "踢出失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsKickingMember(false);
    }
  };

  // Favorite message
  const handleFavoriteMessage = async (message: Message) => {
    if (!currentUser || !conversationId) return;

    try {
      const { error } = await supabase
        .from("message_favorites")
        .insert({
          user_id: currentUser.id,
          message_id: message.id,
          conversation_id: conversationId,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "该消息已收藏",
            description: "请勿重复收藏",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "收藏成功",
          description: "可在\"我的收藏\"中查看",
        });
      }
    } catch (error: any) {
      toast({
        title: "收藏失败",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleVoiceSend = async (audioBlob: Blob, duration: number) => {
    if (!conversationId || !currentUser) return;

    try {
      // Determine file extension based on actual MIME type for cross-device compatibility
      const mimeToExt: Record<string, string> = {
        'audio/mp4': 'mp4',
        'audio/aac': 'aac',
        'audio/mpeg': 'mp3',
        'audio/webm': 'webm',
        'audio/webm;codecs=opus': 'webm',
        'audio/ogg': 'ogg',
        'audio/ogg;codecs=opus': 'ogg',
        'audio/3gpp': '3gp',
        'audio/3gpp2': '3g2',
      };
      const ext = mimeToExt[audioBlob.type] || 'webm';
      const fileName = `${currentUser.id}/${Date.now()}.${ext}`;
      
      // Upload audio file with correct content type
      const { error: uploadError } = await supabase.storage
        .from("chat-files")
        .upload(fileName, audioBlob, {
          contentType: audioBlob.type || 'audio/webm',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("chat-files")
        .getPublicUrl(fileName);

      // If transcription mode is enabled, try to transcribe the audio
      let content = `[语音消息 ${duration}秒]`;
      const isTranscriptionEnabled = transcriptionMode === 'text';
      
      if (isTranscriptionEnabled) {
        try {
          const reader = new FileReader();
          const base64Audio = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });
          
          const { data, error } = await supabase.functions.invoke('transcribe-audio', {
            body: { 
              audioBase64: base64Audio,
            }
          });

          // Check for quota exceeded error
          if (error || data?.error === 'quota_exceeded') {
            console.error('Transcription failed:', error || data?.message);
            // Send as audio message instead
            const { error: insertError } = await supabase.from("messages").insert({
              conversation_id: conversationId,
              sender_id: currentUser.id,
              content,
              type: 'audio',
              media_url: publicUrl,
            });
            
            if (insertError) {
              console.error('Voice message insert error:', insertError);
              toast({
                title: t("chat.voiceSendFailed"),
                description: insertError.message,
                variant: "destructive",
              });
              return;
            }
            
            if (data?.error === 'quota_exceeded') {
              toast({ 
                title: t("chat.voiceMessageSent"),
                description: t("chat.voiceSendFailed"),
                variant: "default"
              });
            } else {
              toast({ title: t("chat.voiceMessageSent") });
            }
          } else if (data?.text) {
            // Transcription successful - send as text message
            const { error: insertError } = await supabase.from("messages").insert({
              conversation_id: conversationId,
              sender_id: currentUser.id,
              content: data.text,
              type: 'text',
              media_url: null,
            });
            
            if (insertError) {
              console.error('Voice message insert error:', insertError);
              toast({
                title: t("chat.voiceSendFailed"),
                description: insertError.message,
                variant: "destructive",
              });
              return;
            }
            
            toast({ title: t("chat.voiceMessageSentText") });
          } else {
            // Unknown error - send as audio message
            const { error: insertError } = await supabase.from("messages").insert({
              conversation_id: conversationId,
              sender_id: currentUser.id,
              content,
              type: 'audio',
              media_url: publicUrl,
            });
            
            if (insertError) {
              console.error('Voice message insert error:', insertError);
              toast({
                title: t("chat.voiceSendFailed"),
                description: insertError.message,
                variant: "destructive",
              });
              return;
            }
            
            toast({ title: t("chat.voiceMessageSent") });
          }
        } catch (transcriptionError) {
          // Any error during transcription - send as audio message
          console.error('Transcription error:', transcriptionError);
          const { error: insertError } = await supabase.from("messages").insert({
            conversation_id: conversationId,
            sender_id: currentUser.id,
            content,
            type: 'audio',
            media_url: publicUrl,
          });
          
          if (insertError) {
            console.error('Voice message insert error:', insertError);
            toast({
              title: t("chat.voiceSendFailed"),
              description: insertError.message,
              variant: "destructive",
            });
            return;
          }
          
          toast({ title: t("chat.voiceMessageSent") });
        }
      } else {
        // Send as audio message without transcription
        const { error: insertError } = await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: currentUser.id,
          content,
          type: 'audio',
          media_url: publicUrl,
        });

        if (insertError) {
          console.error('Voice message insert error:', insertError);
          toast({
            title: t("chat.voiceSendFailed"),
            description: insertError.message,
            variant: "destructive",
          });
          return;
        }

        toast({ title: t("chat.voiceMessageSent") });
      }

      setShowVoiceRecorder(false);
    } catch (error: any) {
      toast({
        title: t("chat.voiceSendFailed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-chat-bg">
        <div className="text-center">
          <MessageSquarePlusIcon className="h-20 w-20 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">选择一个对话</h3>
          <p className="text-muted-foreground">或创建一个新的对话开始聊天</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="chat-container bg-chat-bg w-full max-w-full overflow-x-hidden"
    >
      {/* Header - fixed position, does not scroll with messages */}
      <div className="px-3 py-2 border-b border-border bg-card flex items-center justify-between z-10 safe-area-top flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="flex-shrink-0 h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <AvatarWithFrame
            avatarUrl={conversationInfo?.avatar_url}
            displayName={conversationInfo?.name || "C"}
            size="sm"
            className="flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{conversationInfo?.name || "对话"}</p>
            {conversationInfo?.type === "direct" && (
              <OnlineStatus
                isOnline={otherUserPresence.isOnline}
                lastSeen={otherUserPresence.lastSeen}
                isTyping={otherUserPresence.isTyping}
                isRecording={otherUserPresence.isRecording}
              />
            )}
            {conversationInfo?.type === "group" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {memberCount} {t("groups.members")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} className="h-9 w-9">
            <Search className="h-4 w-4" />
          </Button>
          {conversationInfo?.type === "direct" && conversationInfo?.otherUser && (
            <>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-9 w-9"
                onClick={() => initiateCall(conversationId!, 'audio', {
                  id: conversationInfo.otherUser.id,
                  display_name: conversationInfo.otherUser.display_name,
                  avatar_url: conversationInfo.otherUser.avatar_url
                })}
              >
                <Phone className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-9 w-9"
                onClick={() => initiateCall(conversationId!, 'video', {
                  id: conversationInfo.otherUser.id,
                  display_name: conversationInfo.otherUser.display_name,
                  avatar_url: conversationInfo.otherUser.avatar_url
                })}
              >
                <Video className="h-4 w-4" />
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover z-50">
              {conversationInfo?.type === 'group' && (
                <>
                  <DropdownMenuItem onClick={() => setGroupSettingsOpen(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    {t("groups.groupSettings")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <UserCog className="h-4 w-4 mr-2" />
                设置备注和标签
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setClearChatOpen(true)}>
                <Eraser className="h-4 w-4 mr-2" />
                清空聊天记录
              </DropdownMenuItem>
              {conversationInfo?.type !== 'group' && (
                <>
                  <DropdownMenuSeparator />
                  {isBlocked ? (
                    <DropdownMenuItem 
                      onClick={handleUnblockUser}
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      {t("chat.unblock")}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem 
                      onClick={() => setBlockUserOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      {t("chat.blockUser")}
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0 p-4 overflow-y-auto w-full max-w-full overflow-x-hidden">
        {/* Group Announcement Banner */}
        {conversationInfo?.type === "group" && conversationInfo.announcement && showAnnouncement && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-primary">{t("groups.announcement")}</span>
                  {conversationInfo.announcement_updated_at && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(conversationInfo.announcement_updated_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {conversationInfo.announcement}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => setShowAnnouncement(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Typing/Recording indicator */}
        {conversationInfo?.type === "direct" && (otherUserPresence.isTyping || otherUserPresence.isRecording) && (
          <TypingIndicator
            isTyping={otherUserPresence.isTyping}
            isRecording={otherUserPresence.isRecording}
            userName={conversationInfo?.name}
          />
        )}
        <div className="space-y-4 pb-40 w-full max-w-full overflow-x-hidden">
          {visibleMessages.map((message) => {
            const isOwn = message.sender_id === currentUser?.id;
            const canEdit = isOwn && message.type === "text" && !message.content.startsWith("[");
            const canRecall = canRecallMessage(message);
            // For own messages, use currentUserRole; for others, use participantRoles map
            const senderRole = isOwn ? currentUserRole : participantRoles.get(message.sender_id);
            
            // Get role-based border style for group messages (applies to both own and other's messages)
            const getRoleBorderStyle = () => {
              if (conversationInfo?.type !== "group") return "";
              if (senderRole === "owner") return "ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]";
              if (senderRole === "admin") return "ring-2 ring-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.5)]";
              return "";
            };
            const roleBorderStyle = getRoleBorderStyle();
            
            return (
              <div
                key={message.id}
                className={`flex gap-3 group ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                onMouseEnter={() => setHoveredMessageId(message.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
              >
                <AvatarWithFrame
                  avatarUrl={message.sender?.avatar_url}
                  displayName={message.sender?.display_name || "U"}
                  size="sm"
                />
                                <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[70%] min-w-0`}>
                                  <div className={`flex items-center gap-1.5 mb-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                                    <p className="text-xs text-muted-foreground">
                                      {message.sender?.display_name}
                                    </p>
                                    {conversationInfo?.type === "group" && senderRole === "owner" && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                        群主
                                      </span>
                                    )}
                                    {conversationInfo?.type === "group" && senderRole === "admin" && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                                        管理员
                                      </span>
                                    )}
                                  </div>
                  
                                  <MessageActions
                                    onEdit={canEdit ? () => setEditingMessage(message) : undefined}
                                    onDelete={() => handleLocalDelete(message.id)}
                                    onRecall={canRecall ? () => handleRecallMessage(message.id) : undefined}
                                    onOwnerDelete={
                                      conversationInfo?.type === "group" && currentUserRole === "owner" && !isOwn
                                        ? () => handleOwnerDeleteMessage(message.id)
                                        : undefined
                                    }
                                    onTranslate={
                                      message.content.startsWith("[语音通话]") || message.content.startsWith("[视频通话]")
                                        ? undefined
                                        : () => handleTranslateMessage(message.id, message.content)
                                    }
                                    onTranscribe={message.type === 'audio' && message.media_url ? () => handleTranscribeAudio(message.id, message.media_url!) : undefined}
                                    onForward={() => handleForwardMessage(message)}
                                    onFavorite={() => handleFavoriteMessage(message)}
                                    onCopy={() => handleCopyMessage(message.content)}
                                    onQuote={() => handleQuoteMessage(message)}
                                    onKickMember={
                                      conversationInfo?.type === "group" && 
                                      (currentUserRole === "owner" || currentUserRole === "admin") && 
                                      !isOwn && 
                                      participantRoles.get(message.sender_id) !== "owner"
                                        ? () => handleKickMemberFromMessage(message.sender_id, message.sender?.display_name || "成员")
                                        : undefined
                                    }
                                    onSaveToGallery={
                                      message.type === "image" && message.media_url
                                        ? () => saveImageToGallery(message.media_url!)
                                        : undefined
                                    }
                                    isOwnMessage={isOwn}
                                    canRecall={canRecall}
                                    isGroupOwner={conversationInfo?.type === "group" && currentUserRole === "owner"}
                                    isGroupAdmin={conversationInfo?.type === "group" && currentUserRole === "admin"}
                                    messageType={message.type || 'text'}
                                  >
                                  {(message.content.startsWith("[红包]") || message.content.startsWith("[专属红包]")) && message.media_url ? (
                    <RedEnvelopeMessage
                      envelopeId={message.media_url}
                      message={message.content}
                      isOwn={isOwn}
                      conversationType={conversationInfo?.type}
                    />
                  ) : message.content.startsWith("[转账]") && message.media_url ? (
                    <TransferMessage
                      transferId={message.media_url}
                      isOwn={isOwn}
                    />
                  ) : message.type === "image" && message.media_url ? (
                    <div className={`rounded-2xl overflow-hidden ${roleBorderStyle}`}>
                      <ImageMessageViewer
                        src={message.media_url}
                        alt="图片"
                        className="max-w-[min(20rem,70vw)] max-h-96 object-cover cursor-pointer hover:opacity-90"
                      />
                    </div>
                  ) : message.type === "video" && message.media_url ? (
                    <div className={`rounded-2xl overflow-hidden ${roleBorderStyle}`}>
                      <video
                        src={message.media_url}
                        controls
                        playsInline
                        className="max-w-[min(20rem,70vw)] max-h-96 object-cover"
                        preload="metadata"
                      />
                    </div>
                  ) : message.type === "file" && message.media_url ? (
                    <a
                      href={message.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`rounded-2xl px-4 py-3 flex items-center gap-3 hover:opacity-90 transition-opacity ${roleBorderStyle} ${
                        isOwn
                          ? "bg-gradient-to-r from-primary to-accent text-white"
                          : "bg-card border border-border"
                      }`}
                    >
                      <Paperclip className="h-5 w-5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {message.content.replace("[文件]", "")}
                        </p>
                        <p className="text-xs opacity-70">点击下载</p>
                      </div>
                    </a>
                  ) : message.type === "audio" && message.media_url ? (
                    <div>
                      <div 
                        onClick={() => toggleAudioPlayback(message.id, message.media_url!)}
                        className={`rounded-2xl px-4 py-3 cursor-pointer hover:opacity-90 transition-opacity ${roleBorderStyle} ${
                          isOwn
                            ? "bg-gradient-to-r from-primary to-accent text-white"
                            : "bg-card border border-border"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {playingAudio === message.id ? (
                            <Pause className="h-5 w-5" />
                          ) : (
                            <Play className="h-5 w-5" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{message.content}</p>
                          </div>
                          <Mic className="h-4 w-4 opacity-70" />
                        </div>
                      </div>
                      {messageTranslations.has(message.id) && (
                        <div className={`mt-2 rounded-2xl px-4 py-2 ${
                          isOwn 
                            ? "bg-primary/20 text-foreground" 
                            : "bg-accent/20 text-foreground"
                        }`}>
                          <p className="text-xs opacity-70 mb-1">文字：</p>
                          <p className="text-sm">{messageTranslations.get(message.id)}</p>
                        </div>
                      )}
                      {translatingMessages.has(message.id) && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          转换中...
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div
                        className={`rounded-2xl px-4 py-2 ${roleBorderStyle} ${
                          isOwn
                            ? "bg-gradient-to-r from-primary to-accent text-white"
                            : "bg-card border border-border"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        {message.is_edited && (
                          <p className="text-xs opacity-70 mt-1">已编辑</p>
                        )}
                      </div>
                      {messageTranslations.has(message.id) && (
                        <div className={`mt-2 rounded-2xl px-4 py-2 ${
                          isOwn 
                            ? "bg-primary/20 text-foreground" 
                            : "bg-accent/20 text-foreground"
                        }`}>
                          <p className="text-xs opacity-70 mb-1">译文：</p>
                          <p className="text-sm">{messageTranslations.get(message.id)}</p>
                        </div>
                      )}
                      {translatingMessages.has(message.id) && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          翻译中...
                        </div>
                      )}
                    </div>
                  )}
                  </MessageActions>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">
                      {formatMessageTime(message.created_at)}
                    </p>
                    {isOwn && (
                      <span className="text-xs text-muted-foreground">
                        {message.status === "read" ? (
                          <CheckCheck className="h-3 w-3 text-primary" />
                        ) : message.status === "sent" ? (
                          <Check className="h-3 w-3" />
                        ) : null}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input area - not fixed, part of flex layout */}
      <div className="bg-background border-t border-border flex-shrink-0 relative">
        {/* Hidden file inputs for upload */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
          accept="*/*"
        />
        <input
          ref={imageInputRef}
          type="file"
          className="hidden"
          onChange={handleMediaUpload}
          accept="image/*,video/*,audio/*"
        />

        {/* Message input form */}
        {isBlocked || isBlockedByOther ? (
          <div className="px-3 py-4 safe-area-bottom bg-muted/50 border-t border-border">
            <div className="flex items-center justify-center gap-3">
              <Ban className="h-5 w-5 text-destructive" />
              <span className="text-sm text-muted-foreground">
                {isBlocked ? t("chat.youBlockedUser") : t("chat.blockedByUser")}
              </span>
              {isBlocked && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnblockUser}
                  className="ml-2"
                >
                  {t("chat.unblock")}
                </Button>
              )}
            </div>
          </div>
        ) : (isMuted || isGroupMuteAll) ? (
          <div className="px-3 py-4 safe-area-bottom bg-destructive/10 border-t border-border">
            <div className="flex items-center justify-center gap-3">
              <Ban className="h-5 w-5 text-destructive" />
              <span className="text-sm text-destructive">
                {muteMessage || "你已被禁言，无法发送消息"}
              </span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="w-full max-w-full px-2 py-2 safe-area-bottom relative overflow-x-hidden">
            {/* Mention selector for group chats */}
            {conversationInfo?.type === "group" && showMentionSelector && conversationId && (
              <MentionSelector
                conversationId={conversationId}
                searchText={mentionSearchText}
                onSelect={handleMentionSelect}
                onClose={() => {
                  setShowMentionSelector(false);
                  setMentionSearchText("");
                }}
              />
            )}
            
            {/* Quoted message display */}
            {quotedMessage && (
              <div className="mb-2 p-2 bg-accent/30 rounded-lg border-l-4 border-primary flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">
                    回复 {quotedMessage.sender?.display_name}
                  </p>
                  <p className="text-sm truncate">{quotedMessage.content}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => setQuotedMessage(null)}
                >
                  <span className="text-lg">×</span>
                </Button>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-9 w-9 flex-shrink-0"
                title="上传文件（限制200MB）"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
                    <Smile className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2 z-50">
                  <div className="grid grid-cols-8 gap-2 max-h-48 overflow-y-auto">
                    {['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setNewMessage(prev => prev + emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="text-xl hover:bg-accent rounded p-1 transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {/* @ mention button for group chats */}
              {conversationInfo?.type === "group" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  onClick={() => {
                    setNewMessage(prev => prev + "@");
                    setShowMentionSelector(true);
                    setMentionSearchText("");
                  }}
                >
                  <AtSign className="h-5 w-5" />
                </Button>
              )}
              <Textarea
                disableBlurScroll
                ref={textareaRef}
                placeholder={t("chat.typeMessage")}
                value={newMessage}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  // Submit on Enter (without Shift) - but not during IME composition
                  // Use nativeEvent.isComposing for more reliable IME detection
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isComposing) {
                    e.preventDefault();
                    // Use DOM value directly for more reliable check
                    const currentValue = (e.target as HTMLTextAreaElement).value.trim();
                    if (currentValue) {
                      (e.target as HTMLTextAreaElement).form?.requestSubmit();
                    }
                  }
                }}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={(e) => {
                  setIsComposing(false);
                  const value = e.currentTarget.value;
                  setNewMessage(value);
                }}
                rows={1}
                className="flex-1 min-h-[36px] max-h-[120px] py-2 text-sm min-w-0 resize-none overflow-y-auto"
                style={{ height: '36px' }}
              />
              <HoldToTalkButton
                onSend={handleVoiceSend}
                onRecordingChange={handleRecordingChange}
              />
              <Button
                type="submit"
                size="icon"
                className={`h-9 w-9 flex-shrink-0 ${canSend ? "bg-gradient-to-r from-primary to-accent hover:opacity-90" : "bg-muted text-muted-foreground"}`}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        )}
      </div>

      <RedEnvelopeDialog
        open={redEnvelopeOpen}
        onOpenChange={setRedEnvelopeOpen}
        conversationId={conversationId}
        onSent={fetchMessages}
      />

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        conversationId={conversationId}
        conversationType={conversationInfo?.type || "direct"}
        onSent={fetchMessages}
      />

      <ChatSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        currentNickname={conversationInfo?.otherUser?.display_name || conversationInfo?.name || ""}
        currentRemark={conversationInfo?.note || ""}
        onSave={handleSaveSettings}
      />

      <ClearChatDialog
        open={clearChatOpen}
        onOpenChange={setClearChatOpen}
        onConfirm={handleClearChat}
      />

      <BlockUserDialog
        open={blockUserOpen}
        onOpenChange={setBlockUserOpen}
        userName={conversationInfo?.name || ""}
        onConfirm={handleBlockUser}
      />

      <SearchMessagesDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        conversationId={conversationId}
      />

      <EditMessageDialog
        open={!!editingMessage}
        onOpenChange={(open) => !open && setEditingMessage(null)}
        originalContent={editingMessage?.content || ""}
        onSave={(newContent) => {
          if (editingMessage) {
            handleEditMessage(editingMessage.id, newContent);
            setEditingMessage(null);
          }
        }}
      />

      <ForwardMessageDialog
        isOpen={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        messageContent={forwardingMessage?.content || ""}
        messageType={forwardingMessage?.type || "text"}
        mediaUrl={forwardingMessage?.media_url}
      />

      {conversationInfo?.type === 'group' && conversationId && (
        <GroupSettingsDialog
          open={groupSettingsOpen}
          onOpenChange={setGroupSettingsOpen}
          conversationId={conversationId}
          onUpdate={fetchConversationInfo}
        />
      )}

      {/* Mute Member Dialog */}
      <AlertDialog open={!!muteMemberTarget} onOpenChange={(open) => !open && setMuteMemberTarget(null)}>
        <AlertDialogContent style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle>{muteMemberTarget?.isMuted ? "解除禁言" : "禁言成员"}</AlertDialogTitle>
            <AlertDialogDescription>
              {muteMemberTarget?.isMuted 
                ? <>确定要解除 <span className="font-medium text-foreground">{muteMemberTarget?.name}</span> 的禁言吗？</>
                : <>确定要禁言 <span className="font-medium text-foreground">{muteMemberTarget?.name}</span> 吗？禁言期间该成员无法在群内发送消息。</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!muteMemberTarget?.isMuted && (
            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">禁言时长</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "10m", label: "10分钟" },
                  { value: "1h", label: "1小时" },
                  { value: "12h", label: "12小时" },
                  { value: "1d", label: "1天" },
                  { value: "7d", label: "7天" },
                  { value: "forever", label: "永久" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMuteDuration(option.value)}
                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                      muteDuration === option.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-input hover:bg-accent"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            {muteMemberTarget?.isMuted ? (
              <AlertDialogAction onClick={handleUnmuteMember} className="bg-green-600 hover:bg-green-700">
                确认解禁
              </AlertDialogAction>
            ) : (
              <AlertDialogAction onClick={handleConfirmMuteMember} className="bg-orange-600 hover:bg-orange-700">
                确认禁言
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Kick Member Dialog */}
      <AlertDialog open={!!kickMemberTarget} onOpenChange={(open) => !open && !isKickingMember && setKickMemberTarget(null)}>
        <AlertDialogContent style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle>踢出成员</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将 <span className="font-medium text-foreground">{kickMemberTarget?.name}</span> 踢出群聊吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isKickingMember}>取消</AlertDialogCancel>
            <Button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleConfirmKickMember(e);
              }}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isKickingMember}
            >
              {isKickingMember ? "踢出中..." : "确认踢出"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

