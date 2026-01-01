import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ForwardMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messageContent: string;
  messageType: string;
  mediaUrl?: string | null;
  navigateToChat?: boolean;
}

interface Conversation {
  id: string;
  name: string | null;
  type: string;
  avatar_url: string | null;
  otherUser?: {
    display_name: string;
    avatar_url: string | null;
  };
}

export default function ForwardMessageDialog({
  isOpen,
  onClose,
  messageContent,
  messageType,
  mediaUrl,
  navigateToChat = false
}: ForwardMessageDialogProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchConversations();
      setSelectedIds([]);
      setSearchTerm("");
    }
  }, [isOpen]);

  const fetchConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: participations } = await supabase
      .from("conversation_participants")
      .select(`
        conversation_id,
        conversations:conversation_id (
          id,
          name,
          type,
          avatar_url
        )
      `)
      .eq("user_id", user.id);

    if (!participations) return;

    const convList: Conversation[] = [];

    for (const p of participations) {
      const conv = p.conversations as any;
      if (!conv) continue;

      if (conv.type === "direct") {
        // Get other participant
        const { data: otherParticipants } = await supabase
          .from("conversation_participants")
          .select(`
            user_id,
            profiles:user_id (
              display_name,
              avatar_url
            )
          `)
          .eq("conversation_id", conv.id)
          .neq("user_id", user.id)
          .single();

        if (otherParticipants?.profiles) {
          convList.push({
            ...conv,
            otherUser: otherParticipants.profiles as any
          });
        }
      } else {
        convList.push(conv);
      }
    }

    setConversations(convList);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleForward = async () => {
    // Prevent duplicate submissions
    if (forwarding) return;
    if (selectedIds.length === 0 || !currentUserId) return;

    setForwarding(true);
    try {
      // Forward message to each selected conversation
      for (const conversationId of selectedIds) {
        const { error } = await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: messageContent.startsWith("[转发]") ? messageContent : `[转发] ${messageContent}`,
          type: messageType as any,
          media_url: mediaUrl
        });

        if (error) throw error;
      }

      toast({ title: `已转发到 ${selectedIds.length} 个会话` });
      onClose();
      
      // 如果启用了导航功能，转发成功后跳转到第一个目标会话
      if (navigateToChat && selectedIds.length > 0) {
        navigate(`/chat/${selectedIds[0]}`);
      }
    } catch (error: any) {
      toast({
        title: "转发失败",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setForwarding(false);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const name = conv.type === "direct" 
      ? conv.otherUser?.display_name || ""
      : conv.name || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getDisplayName = (conv: Conversation) => {
    if (conv.type === "direct") {
      return conv.otherUser?.display_name || "未知用户";
    }
    return conv.name || "群聊";
  };

  const getAvatar = (conv: Conversation) => {
    if (conv.type === "direct") {
      return conv.otherUser?.avatar_url;
    }
    return conv.avatar_url;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>转发消息</DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索会话..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => toggleSelection(conv.id)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedIds.includes(conv.id)
                    ? "bg-primary/10 border border-primary"
                    : "hover:bg-muted"
                }`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={getAvatar(conv) || undefined} />
                  <AvatarFallback>
                    {getDisplayName(conv).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{getDisplayName(conv)}</p>
                  <p className="text-xs text-muted-foreground">
                    {conv.type === "group" ? "群聊" : "私聊"}
                  </p>
                </div>
                {selectedIds.includes(conv.id) && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-muted-foreground">
            已选择 {selectedIds.length} 个会话
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button 
              onClick={handleForward} 
              disabled={selectedIds.length === 0 || forwarding}
            >
              {forwarding ? "转发中..." : "转发"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
