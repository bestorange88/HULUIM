import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ArrowLeft, UserPlus, Check, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
}

type FriendshipStatus = 'friend' | 'pending_sent' | 'pending_received' | 'none';

export default function SearchFriends() {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [recommendedUsers, setRecommendedUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [friendshipStatuses, setFriendshipStatuses] = useState<Map<string, FriendshipStatus>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setCurrentUserId(user.id);
    
    // Fetch all friendship data first
    const friendships = await fetchFriendships(user.id);
    await fetchRecommendedUsers(user.id, friendships);
  };

  const fetchFriendships = async (userId: string): Promise<Map<string, FriendshipStatus>> => {
    const statusMap = new Map<string, FriendshipStatus>();
    
    // Get all friendships where user is involved
    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_id, friend_id, status")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (friendships) {
      friendships.forEach((f) => {
        const otherId = f.user_id === userId ? f.friend_id : f.user_id;
        
        if (f.status === 'accepted') {
          statusMap.set(otherId, 'friend');
        } else if (f.status === 'pending') {
          if (f.user_id === userId) {
            statusMap.set(otherId, 'pending_sent');
          } else {
            statusMap.set(otherId, 'pending_received');
          }
        } else if (f.status === 'blocked') {
          statusMap.set(otherId, 'friend'); // Treat blocked as already connected to hide
        }
      });
    }

    setFriendshipStatuses(statusMap);
    return statusMap;
  };

  const fetchRecommendedUsers = async (userId: string, friendships: Map<string, FriendshipStatus>) => {
    // Get IDs to exclude (self, friends, pending, and special accounts)
    const excludeIds = [userId];
    friendships.forEach((status, id) => {
      excludeIds.push(id); // Exclude all existing friendships
    });

    // Get special system accounts to exclude
    const { data: systemUsers } = await supabase
      .from("profiles")
      .select("id")
      .in("username", ["customer_service", "ai_assistant"]);

    if (systemUsers) {
      systemUsers.forEach(u => excludeIds.push(u.id));
    }

    // Get current user's accepted friends
    const { data: myFriends } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq("status", "accepted");

    if (!myFriends || myFriends.length === 0) {
      setRecommendedUsers([]);
      return;
    }

    // Extract friend IDs
    const myFriendIds = myFriends.map(f => 
      f.user_id === userId ? f.friend_id : f.user_id
    );

    // Get friends of friends (second-degree connections)
    const { data: friendsOfFriends } = await supabase
      .from("friendships")
      .select("user_id, friend_id, profiles!friendships_friend_id_fkey(*)")
      .in("user_id", myFriendIds)
      .eq("status", "accepted");

    const { data: friendsOfFriends2 } = await supabase
      .from("friendships")
      .select("user_id, friend_id, profiles!friendships_user_id_fkey(*)")
      .in("friend_id", myFriendIds)
      .eq("status", "accepted");

    // Collect unique second-degree friends
    const secondDegreeFriends = new Map<string, Profile>();

    if (friendsOfFriends) {
      friendsOfFriends.forEach(f => {
        const profile = f.profiles as any;
        if (profile && !excludeIds.includes(f.friend_id)) {
          secondDegreeFriends.set(f.friend_id, profile);
        }
      });
    }

    if (friendsOfFriends2) {
      friendsOfFriends2.forEach(f => {
        const profile = f.profiles as any;
        if (profile && !excludeIds.includes(f.user_id)) {
          secondDegreeFriends.set(f.user_id, profile);
        }
      });
    }

    // Convert to array and limit to 10
    const recommendations = Array.from(secondDegreeFriends.values()).slice(0, 10);
    setRecommendedUsers(recommendations);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    if (!currentUserId) return;

    setLoading(true);
    
    // Refresh friendship statuses to get latest state
    await fetchFriendships(currentUserId);
    
    // Get system accounts to exclude
    const { data: systemUsers } = await supabase
      .from("profiles")
      .select("id")
      .in("username", ["customer_service", "ai_assistant"]);

    const systemIds = systemUsers?.map(u => u.id) || [];
    const excludeIds = [currentUserId, ...systemIds];

    // 标准化搜索词 - 去除+86前缀和空格用于手机号匹配
    const query = searchQuery.trim();
    const normalizedPhone = query.replace(/^\+86/, '').replace(/\s/g, '');
    
    // 支持通过用户名、显示名称、手机号、会员ID搜索
    // 同时搜索原始输入和标准化后的手机号
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,phone.ilike.%${query}%,phone.ilike.%${normalizedPhone}%,user_id.ilike.%${query}%`)
      .not("id", "in", `(${excludeIds.join(",")})`)
      .limit(20);

    if (data) {
      // 去重（因为可能同时匹配原始和标准化手机号）
      const uniqueResults = Array.from(new Map(data.map(item => [item.id, item])).values());
      setResults(uniqueResults);
    }
    setLoading(false);
  };

  const handleAddFriend = async (friendId: string) => {
    if (!currentUserId) return;

    const { error } = await supabase.from("friendships").insert({
      user_id: currentUserId,
      friend_id: friendId,
      status: "pending",
    });

    if (error) {
      if (error.code === '23505') {
        toast({
          title: t("friends.alreadySent"),
          variant: "destructive",
        });
      } else {
        toast({
          title: t("friends.sendFailed"),
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      setFriendshipStatuses(prev => new Map(prev).set(friendId, 'pending_sent'));
      toast({
        title: t("friends.requestSent"),
        description: t("friends.waitingConfirm"),
      });
    }
  };

  const getFriendshipStatus = (userId: string): FriendshipStatus => {
    return friendshipStatuses.get(userId) || 'none';
  };

  const renderUserCard = (profile: Profile) => {
    const status = getFriendshipStatus(profile.id);
    
    return (
      <div
        key={profile.id}
        className="p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={profile.avatar_url || ""} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
              {profile.display_name[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium">{profile.display_name}</p>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {profile.bio}
              </p>
            )}
          </div>
          {status === 'friend' ? (
            <Button variant="outline" size="sm" disabled>
              <Users className="h-4 w-4 mr-1" />
              {t("contacts.myFriends")}
            </Button>
          ) : status === 'pending_sent' ? (
            <Button variant="outline" size="sm" disabled>
              <Check className="h-4 w-4 mr-1" />
              {t("friends.alreadySent")}
            </Button>
          ) : status === 'pending_received' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/contacts")}
            >
              {t("friends.friendRequests")}
            </Button>
          ) : (
            <Button
              onClick={() => handleAddFriend(profile.id)}
              size="sm"
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              {t("contacts.addFriend")}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-background h-full">
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/contacts")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">{t("contacts.searchFriend")}</h1>
        </div>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索用户名/昵称/手机号/会员ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            {t("friends.searchButton")}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {!searchQuery && recommendedUsers.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">{t("friends.recommended")}</h2>
              <div className="space-y-2">
                {recommendedUsers.map(renderUserCard)}
              </div>
            </div>
          )}

          {!searchQuery && recommendedUsers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("friends.searchPlaceholder")}</p>
            </div>
          )}

          {searchQuery && (
            <>
              {results.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                  未找到相关用户
                </div>
              )}
              
              {results.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold mb-3 text-muted-foreground">{t("friends.searchResults")}</h2>
                  <div className="space-y-2">
                    {results.map(renderUserCard)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}