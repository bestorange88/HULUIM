import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X, UserPlus, ArrowLeft, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FriendRequest {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  created_at: string;
  profiles: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface RecentFriend {
  id: string;
  friend_id: string;
  created_at: string;
  profiles: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

export default function FriendRequests() {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [recentFriends, setRecentFriends] = useState<RecentFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchFriendRequests();
    fetchRecentFriends();
    const cleanup = setupRealtime();
    return cleanup;
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchFriendRequests = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("friendships")
      .select(`
        id,
        user_id,
        friend_id,
        status,
        created_at,
        profiles:profiles!friendships_user_id_fkey (
          id,
          display_name,
          username,
          avatar_url
        )
      `)
      .eq("friend_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (data) {
      setRequests(data as FriendRequest[]);
    }
    setLoading(false);
  };

  const fetchRecentFriends = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get recently added friends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await supabase
      .from("friendships")
      .select(`
        id,
        friend_id,
        created_at,
        profiles:profiles!friendships_friend_id_fkey (
          id,
          display_name,
          username,
          avatar_url
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setRecentFriends(data as RecentFriend[]);
    }
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel("friend-requests-page")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
        },
        () => {
          fetchFriendRequests();
          fetchRecentFriends();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleRequest = async (requestId: string, action: "accept" | "reject") => {
    try {
      setRequests(prev => prev.filter(r => r.id !== requestId));

      if (action === "accept") {
        const request = requests.find(r => r.id === requestId);
        if (!request) {
          throw new Error("请求不存在");
        }

        const { error } = await supabase
          .from("friendships")
          .update({ status: "accepted" })
          .eq("id", requestId);

        if (error) throw error;

        const { data: existingReverse } = await supabase
          .from("friendships")
          .select("id, status")
          .eq("user_id", request.friend_id)
          .eq("friend_id", request.user_id)
          .maybeSingle();

        if (existingReverse) {
          if (existingReverse.status !== "accepted") {
            await supabase
              .from("friendships")
              .update({ status: "accepted" })
              .eq("id", existingReverse.id);
          }
        } else {
          const { error: reverseError } = await supabase
            .from("friendships")
            .insert({
              user_id: request.friend_id,
              friend_id: request.user_id,
              status: "accepted"
            });

          if (reverseError && reverseError.code !== '23505') {
            throw reverseError;
          }
        }

        toast({
          title: "好友申请已接受",
          description: "你们现在是好友了",
        });

        fetchRecentFriends();
      } else {
        const { error } = await supabase
          .from("friendships")
          .delete()
          .eq("id", requestId);

        if (error) throw error;

        toast({
          title: "好友申请已拒绝",
        });
      }
    } catch (error) {
      console.error("Error handling friend request:", error);
      fetchFriendRequests();
      toast({
        title: "操作失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "今天";
    if (diffDays === 1) return "昨天";
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-border bg-background">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-medium ml-2">新的好友</h1>
        <button 
          onClick={() => navigate("/search-friends")}
          className="ml-auto p-2 hover:bg-accent rounded-full transition-colors"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Add Friend Entry */}
        <div 
          className="flex items-center px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-accent/5 active:bg-accent/10"
          onClick={() => navigate("/search-friends")}
        >
          <div className="w-10 h-10 rounded bg-green-500 flex items-center justify-center mr-3">
            <UserPlus className="h-5 w-5 text-white" />
          </div>
          <span className="flex-1 text-[15px]">添加朋友</span>
        </div>

        {/* Pending Requests */}
        {requests.length > 0 && (
          <div className="mt-4">
            <div className="px-4 py-2 text-xs text-muted-foreground font-medium">
              待处理的好友请求
            </div>
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center px-4 py-3 border-b border-border/30"
              >
                <Avatar className="h-10 w-10 mr-3">
                  <AvatarImage src={request.profiles.avatar_url || ""} />
                  <AvatarFallback>
                    {request.profiles.display_name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[15px]">
                    {request.profiles.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    想添加您为好友
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleRequest(request.id, "accept")}
                    className="h-8 px-3"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    接受
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRequest(request.id, "reject")}
                    className="h-8 px-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent Friends */}
        {recentFriends.length > 0 && (
          <div className="mt-4">
            <div className="px-4 py-2 text-xs text-muted-foreground font-medium">
              最近添加的好友
            </div>
            {recentFriends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center px-4 py-3 border-b border-border/30 cursor-pointer hover:bg-accent/5"
                onClick={() => navigate(`/user/${friend.friend_id}`)}
              >
                <Avatar className="h-10 w-10 mr-3">
                  <AvatarImage src={friend.profiles.avatar_url || ""} />
                  <AvatarFallback>
                    {friend.profiles.display_name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[15px]">
                    {friend.profiles.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @{friend.profiles.username}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatTime(friend.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && requests.length === 0 && recentFriends.length === 0 && (
          <div className="text-center py-12 px-4">
            <UserPlus className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">暂无好友请求</p>
            <Button
              onClick={() => navigate("/search-friends")}
              className="px-4"
            >
              添加朋友
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
