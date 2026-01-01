import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

interface Friend {
  id: string;
  friend_id: string;
  profiles: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    username?: string;
  };
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
}

export default function NewConversationDialog({
  open,
  onOpenChange,
  onConversationCreated,
}: NewConversationDialogProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [conversationName, setConversationName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      fetchFriends();
      setSelectedFriends(new Set());
      setConversationName("");
    }
  }, [open]);

  const fetchFriends = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("friendships")
      .select(`
        id,
        friend_id,
        profiles:profiles!friendships_friend_id_fkey (
          id,
          display_name,
          avatar_url,
          username
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "accepted");

    if (data) {
      const filteredData = (data as Friend[]).filter((friend) => {
        const username = (friend.profiles as any).username?.toLowerCase() || '';
        return username !== 'customer_service' && username !== 'ai_assistant';
      });
      
      setFriends(filteredData);
    }
  };

  const toggleFriend = (friendId: string) => {
    const newSelected = new Set(selectedFriends);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelectedFriends(newSelected);
  };

  const handleCreate = async () => {
    // Prevent duplicate submissions
    if (loading) return;
    
    if (selectedFriends.size === 0) {
      toast({
        title: "请选择至少一个好友",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // 始终创建群组对话
    const friendArray = Array.from(selectedFriends);
    const { data: convId, error: rpcError } = await (supabase as any)
      .rpc('create_group_conversation', {
        name: conversationName || '群组对话',
        participant_ids: friendArray,
      });

    if (rpcError || !convId) {
      toast({
        title: "创建失败",
        description: rpcError?.message || '无法创建群组',
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Set require_approval to true by default for new groups
    await supabase
      .from("conversations")
      .update({ require_approval: true } as any)
      .eq("id", convId);

    toast({ title: t("chat.groupCreatedSuccess") });
    onConversationCreated(convId as string);
    onOpenChange(false);
    
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("groups.createGroup")}</DialogTitle>
        </DialogHeader>
        
        <Input
          placeholder={t("groups.groupNamePlaceholder")}
          value={conversationName}
          onChange={(e) => setConversationName(e.target.value)}
          className="mb-2"
        />

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2">
            {friends.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                暂无好友，请先添加好友
              </p>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/5 cursor-pointer"
                  onClick={() => toggleFriend(friend.friend_id)}
                >
                  <Checkbox
                    checked={selectedFriends.has(friend.friend_id)}
                    onCheckedChange={() => toggleFriend(friend.friend_id)}
                  />
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={friend.profiles.avatar_url || ""} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                      {friend.profiles.display_name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-medium">{friend.profiles.display_name}</p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <Button
          onClick={handleCreate}
          disabled={loading || selectedFriends.size === 0}
          className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
        >
          创建对话
        </Button>
      </DialogContent>
    </Dialog>
  );
}
