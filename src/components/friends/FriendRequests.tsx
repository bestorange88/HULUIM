import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X, UserPlus, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { playFriendRequestNotification } from "@/utils/notificationSound";
import { Badge } from "@/components/ui/badge";

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

export function FriendRequests() {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [previousCount, setPreviousCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    console.log('[FriendRequests] Component mounted, fetching requests...');
    fetchFriendRequests();
    const cleanup = setupRealtime();
    return cleanup;
  }, []);

  const fetchFriendRequests = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[FriendRequests] No user logged in');
      return;
    }

    console.log('[FriendRequests] Fetching requests for user:', user.id);

    const { data, error } = await supabase
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

    if (error) {
      console.error('[FriendRequests] Error fetching requests:', error);
    } else {
      console.log('[FriendRequests] Found requests:', data?.length || 0, data);
    }

    if (data) {
      // Play notification sound and show toast if new requests arrived
      if (!loading && data.length > previousCount) {
        playFriendRequestNotification();
        const newCount = data.length - previousCount;
        toast({
          title: "🔔 新的好友请求",
          description: `您收到了 ${newCount} 个新的好友请求`,
          duration: 5000,
        });
      }
      setPreviousCount(data.length);
      setRequests(data as FriendRequest[]);
    }
    setLoading(false);
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel("friend-requests-list")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
        },
        (payload) => {
          console.log('[FriendRequests] Realtime update:', payload);
          fetchFriendRequests();
        }
      )
      .subscribe((status) => {
        console.log('[FriendRequests] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleRequest = async (requestId: string, action: "accept" | "reject") => {
    try {
      // Optimistically remove from UI immediately
      setRequests(prev => prev.filter(r => r.id !== requestId));
      setPreviousCount(prev => Math.max(0, prev - 1));

      if (action === "accept") {
        const request = requests.find(r => r.id === requestId);
        if (!request) {
          throw new Error("请求不存在");
        }

        // Update status to accepted
        const { error } = await supabase
          .from("friendships")
          .update({ status: "accepted" })
          .eq("id", requestId);

        if (error) throw error;

        // Check if reverse friendship already exists
        const { data: existingReverse } = await supabase
          .from("friendships")
          .select("id, status")
          .eq("user_id", request.friend_id)
          .eq("friend_id", request.user_id)
          .maybeSingle();

        if (existingReverse) {
          // Update existing reverse friendship to accepted
          if (existingReverse.status !== "accepted") {
            await supabase
              .from("friendships")
              .update({ status: "accepted" })
              .eq("id", existingReverse.id);
          }
        } else {
          // Create reverse friendship
          const { error: reverseError } = await supabase
            .from("friendships")
            .insert({
              user_id: request.friend_id,
              friend_id: request.user_id,
              status: "accepted"
            });

          // Ignore duplicate key error (23505)
          if (reverseError && reverseError.code !== '23505') {
            throw reverseError;
          }
        }

        toast({
          title: "好友申请已接受",
          description: "你们现在是好友了",
        });
      } else {
        // Delete the request completely so applicant can send again
        const { error } = await supabase
          .from("friendships")
          .delete()
          .eq("id", requestId);

        if (error) throw error;

        toast({
          title: "好友申请已拒绝",
          description: "对方可以重新发送申请",
        });
      }
    } catch (error) {
      console.error("Error handling friend request:", error);
      // Revert optimistic update on error
      fetchFriendRequests();
      toast({
        title: "操作失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return null;
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="px-2 mb-4">
      {/* Prominent header with badge */}
      <div className="flex items-center gap-2 mb-3 px-3">
        <div className="relative">
          <Bell className="h-5 w-5 text-primary animate-pulse" />
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-destructive rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-destructive rounded-full" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">新的朋友</h3>
        <Badge variant="destructive" className="ml-auto animate-bounce">
          {requests.length} 条待处理
        </Badge>
      </div>
      
      <div className="space-y-2">
        {requests.map((request, index) => (
          <div
            key={request.id}
            className="p-3 rounded-lg bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border-2 border-primary/30 shadow-lg shadow-primary/10 animate-in slide-in-from-left duration-300"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-12 w-12 ring-2 ring-primary/50 ring-offset-2 ring-offset-background">
                  <AvatarImage src={request.profiles.avatar_url || ""} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
                    {request.profiles.display_name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <UserPlus className="absolute -bottom-1 -right-1 h-4 w-4 text-primary bg-background rounded-full p-0.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">
                  {request.profiles.display_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{request.profiles.username}
                </p>
                <p className="text-xs text-primary mt-0.5">
                  想添加您为好友
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleRequest(request.id, "accept")}
                  className="h-9 px-3 bg-primary hover:bg-primary/90 shadow-md"
                >
                  <Check className="h-4 w-4 mr-1" />
                  接受
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRequest(request.id, "reject")}
                  className="h-9 px-3"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
