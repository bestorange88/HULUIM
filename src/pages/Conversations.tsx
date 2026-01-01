import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FolderOpen, MoreVertical, Pin, Trash2, StickyNote, Bell } from "lucide-react";
import { playMessageNotification } from "@/utils/notificationSound";
import { useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/Header";
import ConversationGroupDialog from "@/components/groups/ConversationGroupDialog";
import { AvatarWithFrame } from "@/components/avatar/AvatarWithFrame";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface Conversation {
  id: string;
  type: string;
  name: string | null;
  avatar_url: string | null;
  avatar_frame?: string | null;
  updated_at: string;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageTime?: string;
  isPinned?: boolean;
  note?: string;
}

interface SystemMessage {
  id: string;
  title: string;
  content: string;
  type: string;
  created_at: string;
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [noteText, setNoteText] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchConversations();
    fetchSystemMessages();
    getCurrentUserId();

    // Listen for conversation changes
    const conversationsChannel = supabase
      .channel("conversations-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    // Listen for new messages to update unread counts
    const messagesChannel = supabase
      .channel("messages-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          // Play notification if user is not in the chat page where message was sent
          const isInSameChat = location.pathname.includes(payload.new.conversation_id);
          if (!isInSameChat && currentUserId && payload.new.sender_id !== currentUserId) {
            playMessageNotification();
          }
          fetchConversations();
        }
      )
      .subscribe();

    // Listen for participant updates (e.g., last_read_at changes)
    const participantsChannel = supabase
      .channel("participants-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [currentUserId, location.pathname]);

  const getCurrentUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchSystemMessages = async () => {
    const { data } = await supabase
      .from("system_messages")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3);

    if (data) {
      setSystemMessages(data);
    }
  };

  const fetchConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch blocked user IDs
    const { data: blockedData } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", user.id)
      .eq("status", "blocked");
    
    const blockedUserIds = new Set(blockedData?.map(b => b.friend_id) || []);

    const { data: participations } = await supabase
      .from("conversation_participants")
      .select(`
        conversation_id,
        last_read_at,
        conversations (
          id,
          type,
          name,
          avatar_url,
          updated_at
        )
      `)
      .eq("user_id", user.id);

    if (participations) {
      // Get conversation settings (pinned, notes)
      const { data: settings } = await supabase
        .from("conversation_settings")
        .select("*")
        .eq("user_id", user.id);

      const settingsMap = new Map(
        settings?.map(s => [s.conversation_id, s]) || []
      );

      const convos = await Promise.all(
        participations
          .map(async (p: any) => {
            const conv = p.conversations;
            if (!conv) return null;
            
            const convSettings = settingsMap.get(conv.id);
            
            // Get last message
            const { data: lastMsgArr } = await supabase
              .from("messages")
              .select("content, created_at")
              .eq("conversation_id", conv.id)
              .eq("is_deleted", false)
              .order("created_at", { ascending: false })
              .limit(1);
            
            const lastMsg = lastMsgArr?.[0] || null;

            // Calculate unread count
            let unreadCount = 0;
            const lastReadAt = p.last_read_at;
            
            if (lastReadAt) {
              const { count } = await supabase
                .from("messages")
                .select("*", { count: 'exact', head: true })
                .eq("conversation_id", conv.id)
                .neq("sender_id", user.id)
                .gt("created_at", lastReadAt);
              
              unreadCount = count || 0;
            } else {
              // If never read, count all messages from others
              const { count } = await supabase
                .from("messages")
                .select("*", { count: 'exact', head: true })
                .eq("conversation_id", conv.id)
                .neq("sender_id", user.id);
              
              unreadCount = count || 0;
            }
            
            // 对于一对一对话，获取对方的信息
            if (conv.type === "direct") {
              const { data: otherParticipant } = await supabase
                .from("conversation_participants")
                .select("user_id, profiles!inner(display_name, avatar_url, avatar_frame)")
                .eq("conversation_id", conv.id)
                .neq("user_id", user.id)
                .maybeSingle();
              
              if (otherParticipant) {
                // Skip blocked users' conversations
                if (blockedUserIds.has(otherParticipant.user_id)) {
                  return null;
                }
                
                return {
                  ...conv,
                  name: otherParticipant.profiles.display_name,
                  avatar_url: otherParticipant.profiles.avatar_url,
                  avatar_frame: otherParticipant.profiles.avatar_frame,
                  unreadCount,
                  lastMessage: lastMsg?.content,
                  lastMessageTime: lastMsg?.created_at,
                  isPinned: convSettings?.is_pinned || false,
                  note: convSettings?.note || undefined
                };
              }
            }
            
            return {
              ...conv,
              unreadCount,
              lastMessage: lastMsg?.content,
              lastMessageTime: lastMsg?.created_at,
              isPinned: convSettings?.is_pinned || false,
              note: convSettings?.note || undefined
            };
          })
      );
      
      const sortedConvos = convos
        .filter(Boolean)
        .sort((a: any, b: any) => {
          // Pinned conversations first
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          // Then by last message time (most recent first)
          const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
          const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
          return bTime - aTime;
        });
      
      setConversations(sortedConvos);
    }
  };

  const handlePinConversation = async (conversationId: string, isPinned: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("conversation_settings")
      .upsert({
        user_id: user.id,
        conversation_id: conversationId,
        is_pinned: !isPinned,
      });

    if (error) {
      toast({
        title: "操作失败",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: isPinned ? "已取消置顶" : "已置顶",
      });
      fetchConversations();
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Delete participation (leaves the conversation)
    const { error } = await supabase
      .from("conversation_participants")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "删除失败",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "已删除对话",
      });
      fetchConversations();
    }
  };

  const openNoteDialog = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setNoteText(conversation.note || "");
    setNoteDialogOpen(true);
  };

  const handleSaveNote = async () => {
    if (!selectedConversation || !currentUserId) return;

    const { error } = await supabase
      .from("conversation_settings")
      .upsert({
        user_id: currentUserId,
        conversation_id: selectedConversation.id,
        note: noteText.trim() || null,
      });

    if (error) {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "备注已保存",
      });
      setNoteDialogOpen(false);
      fetchConversations();
    }
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-purple-50/30 to-white">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 bg-white/80 backdrop-blur-sm border-b border-purple-100">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold bg-gradient-to-r from-purple-600 to-emerald-600 bg-clip-text text-transparent">消息</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setGroupDialogOpen(true)}
            className="w-9 h-9 rounded-full hover:bg-purple-50 active:bg-purple-100"
          >
            <FolderOpen className="w-5 h-5 text-purple-700" />
          </Button>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-purple-400" />
          <Input
            type="text"
            placeholder={t("chat.searchMessages")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-11 pr-4 bg-purple-50 rounded-full text-[15px] focus:outline-none focus:bg-purple-50 focus:ring-2 focus:ring-purple-200 transition-all placeholder:text-purple-400 border-0"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-border pb-20">
          {/* System Messages */}
          {systemMessages.length > 0 && (
            <div className="p-4 bg-accent/5 border-b-2 border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">系统消息</span>
              </div>
              <div className="space-y-2">
                {systemMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3 rounded-lg bg-card border border-border hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-1">{msg.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {msg.content}
                        </p>
                      </div>
                      <Badge variant={msg.type === 'warning' ? 'destructive' : 'default'} className="text-xs">
                        {msg.type === 'info' && '通知'}
                        {msg.type === 'warning' && '警告'}
                        {msg.type === 'announcement' && '公告'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversations */}
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className="relative group"
            >
              <button
                onClick={() => navigate(`/chat/${conversation.id}`)}
                className="w-full px-5 py-3.5 flex items-center gap-3 active:bg-purple-50/50 transition-all text-left"
              >
                {/* Avatar with online indicator */}
                <div className="relative flex-shrink-0">
                  <AvatarWithFrame
                    avatarUrl={conversation.avatar_url}
                    displayName={conversation.name || "G"}
                    frameStyle={conversation.avatar_frame || "none"}
                    size="lg"
                    className="ring-2 ring-purple-100 rounded-full"
                  />
                  {(conversation.unreadCount ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-[11px] rounded-full flex items-center justify-center shadow-sm z-10">
                      {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                    </span>
                  )}
                </div>
                
                <div className="flex-1 min-w-0 pr-8">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {conversation.isPinned && (
                        <Pin className="h-3 w-3 text-purple-500" />
                      )}
                      <h3 className="text-[15px] font-medium text-gray-900 truncate">
                        {conversation.name || "未命名对话"}
                      </h3>
                    </div>
                    {conversation.lastMessageTime && (
                      <span className="text-xs text-purple-400 flex-shrink-0 ml-2">
                        {formatDistanceToNow(new Date(conversation.lastMessageTime), {
                          addSuffix: false,
                          locale: zhCN,
                        })}
                      </span>
                    )}
                  </div>
                  {conversation.note && (
                    <p className="text-xs text-purple-500 mb-1 truncate">
                      备注: {conversation.note}
                    </p>
                  )}
                  <p className="text-[13px] text-gray-500 truncate">
                    {conversation.lastMessage || (conversation.type === "group" ? "群组对话" : "私聊")}
                  </p>
                </div>
              </button>

              {/* Three-dot menu */}
              <div className="absolute right-4 top-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePinConversation(conversation.id, conversation.isPinned || false);
                      }}
                    >
                      <Pin className="h-4 w-4 mr-2" />
                      {conversation.isPinned ? '取消置顶' : '置顶'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        openNoteDialog(conversation);
                      }}
                    >
                      <StickyNote className="h-4 w-4 mr-2" />
                      备注
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('确定要删除这个对话吗？')) {
                          handleDeleteConversation(conversation.id);
                        }
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>设置备注</DialogTitle>
            <DialogDescription>
              为此对话添加备注，方便快速识别
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="note">备注内容</Label>
            <Textarea
              id="note"
              placeholder="输入备注..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveNote}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConversationGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        onSuccess={() => {
          toast({
            title: t("common.success"),
            description: t("groups.groupCreated"),
          });
        }}
      />
    </div>
  );
}
