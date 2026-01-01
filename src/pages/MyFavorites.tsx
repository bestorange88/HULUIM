import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Star, Trash2, MessageSquare, Image as ImageIcon, Video, Music, Forward } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
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
import ForwardMessageDialog from "@/components/chat/ForwardMessageDialog";

interface FavoriteMessage {
  id: string;
  message_id: string;
  conversation_id: string;
  created_at: string;
  message?: {
    id: string;
    content: string;
    type: string;
    media_url: string | null;
    created_at: string;
    sender_id: string;
  };
  sender?: {
    display_name: string;
    avatar_url: string | null;
  };
  conversation?: {
    name: string | null;
    type: string;
  };
}

export default function MyFavorites() {
  const [favorites, setFavorites] = useState<FavoriteMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFavorite, setSelectedFavorite] = useState<string | null>(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<{content: string; type: string; mediaUrl?: string | null} | null>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: favoritesData, error } = await supabase
        .from("message_favorites")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // 加载消息详情
      const messageIds = favoritesData?.map(f => f.message_id) || [];
      const { data: messagesData } = await supabase
        .from("messages")
        .select("id, content, type, media_url, created_at, sender_id")
        .in("id", messageIds);

      // 加载发送者信息
      const senderIds = [...new Set(messagesData?.map(m => m.sender_id) || [])];
      const { data: sendersData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", senderIds);

      // 加载会话信息
      const conversationIds = [...new Set(favoritesData?.map(f => f.conversation_id) || [])];
      const { data: conversationsData } = await supabase
        .from("conversations")
        .select("id, name, type")
        .in("id", conversationIds);

      const enrichedFavorites = favoritesData?.map(favorite => ({
        ...favorite,
        message: messagesData?.find(m => m.id === favorite.message_id),
        sender: sendersData?.find(s => s.id === messagesData?.find(m => m.id === favorite.message_id)?.sender_id),
        conversation: conversationsData?.find(c => c.id === favorite.conversation_id)
      })) || [];

      setFavorites(enrichedFavorites);
    } catch (error) {
      console.error("加载收藏失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFavorite) return;

    try {
      const { error } = await supabase
        .from("message_favorites")
        .delete()
        .eq("id", selectedFavorite);

      if (error) throw error;

      setFavorites(favorites.filter(f => f.id !== selectedFavorite));
      toast({
        description: "已取消收藏",
      });
    } catch (error) {
      toast({
        title: "取消失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedFavorite(null);
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "image":
        return <ImageIcon className="h-4 w-4" />;
      case "video":
        return <Video className="h-4 w-4" />;
      case "audio":
        return <Music className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const goToConversation = (conversationId: string) => {
    navigate(`/chat/${conversationId}`);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card flex items-center gap-3 flex-shrink-0">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold">我的收藏</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Star className="h-16 w-16 mb-4 opacity-20" />
            <p>暂无收藏</p>
            <p className="text-sm mt-2">长按消息可以添加收藏</p>
          </div>
        ) : (
          favorites.map((favorite) => (
            <Card 
              key={favorite.id} 
              className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => goToConversation(favorite.conversation_id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Sender Avatar */}
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={favorite.sender?.avatar_url || ""} />
                    <AvatarFallback>{favorite.sender?.display_name?.slice(0, 2) || "?"}</AvatarFallback>
                  </Avatar>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{favorite.sender?.display_name}</span>
                        {getMessageIcon(favorite.message?.type || "text")}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0 hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForwardMessage({
                              content: favorite.message?.content || "",
                              type: favorite.message?.type || "text",
                              mediaUrl: favorite.message?.media_url
                            });
                            setForwardDialogOpen(true);
                          }}
                        >
                          <Forward className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFavorite(favorite.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Conversation Name */}
                    {favorite.conversation?.name && (
                      <p className="text-xs text-muted-foreground mb-1">
                        来自: {favorite.conversation.name}
                      </p>
                    )}

                    {/* Message Content */}
                    <div className="text-sm text-foreground mb-2">
                      {favorite.message?.type === "text" ? (
                        <p className="line-clamp-3">{favorite.message.content}</p>
                      ) : favorite.message?.type === "image" ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <ImageIcon className="h-4 w-4" />
                          <span>[图片]</span>
                        </div>
                      ) : favorite.message?.type === "audio" ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Music className="h-4 w-4" />
                          <span>[语音]</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">[{favorite.message?.type}]</span>
                      )}
                    </div>

                    {/* Timestamps */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        消息时间: {favorite.message?.created_at && format(new Date(favorite.message.created_at), "MM-dd HH:mm", { locale: zhCN })}
                      </span>
                      <span>
                        收藏于: {format(new Date(favorite.created_at), "MM-dd HH:mm", { locale: zhCN })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>取消收藏</AlertDialogTitle>
            <AlertDialogDescription>
              确定要取消收藏这条消息吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>确定</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Forward Message Dialog */}
      <ForwardMessageDialog
        isOpen={forwardDialogOpen}
        onClose={() => {
          setForwardDialogOpen(false);
          setForwardMessage(null);
        }}
        messageContent={forwardMessage?.content || ""}
        messageType={forwardMessage?.type || "text"}
        mediaUrl={forwardMessage?.mediaUrl}
        navigateToChat={true}
      />
    </div>
  );
}
