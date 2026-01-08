import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, ShoppingBag, MapPin, ChevronRight, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";

interface FriendMoment {
  user_id: string;
  avatar_url: string;
  display_name: string;
  created_at: string;
}

export default function Discover() {
  const navigate = useNavigate();
  const [friendMoments, setFriendMoments] = useState<FriendMoment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFriendMoments();
  }, []);

  const fetchFriendMoments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get friends
      const { data: friendshipsData } = await supabase
        .from("friendships")
        .select("friend_id, user_id")
        .eq("status", "accepted")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      const friendIds = new Set<string>();
      friendshipsData?.forEach(f => {
        if (f.user_id === user.id) {
          friendIds.add(f.friend_id);
        } else {
          friendIds.add(f.user_id);
        }
      });

      if (friendIds.size === 0) {
        setFriendMoments([]);
        setLoading(false);
        return;
      }

      // Get recent moments from friends (last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data: momentsData } = await supabase
        .from("moments")
        .select("user_id, created_at")
        .in("user_id", Array.from(friendIds))
        .gte("created_at", oneDayAgo.toISOString())
        .order("created_at", { ascending: false });

      if (!momentsData || momentsData.length === 0) {
        setFriendMoments([]);
        setLoading(false);
        return;
      }

      // Get unique users who posted moments
      const uniqueUserIds = [...new Set(momentsData.map(m => m.user_id))];

      // Get profiles for these users
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", uniqueUserIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Create friend moments list (unique users)
      const moments: FriendMoment[] = uniqueUserIds.slice(0, 5).map(userId => {
        const profile = profilesMap.get(userId);
        const moment = momentsData.find(m => m.user_id === userId);
        return {
          user_id: userId,
          avatar_url: profile?.avatar_url || "",
          display_name: profile?.display_name || "Unknown",
          created_at: moment?.created_at || ""
        };
      });

      setFriendMoments(moments);
    } catch (error) {
      console.error("Error fetching friend moments:", error);
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    {
      icon: Users,
      title: "朋友圈",
      description: "查看好友动态",
      path: "/moments",
      iconColor: "text-purple-500"
    },
    {
      icon: ShoppingBag,
      title: "迅达商城",
      description: "精选好物推荐",
      path: "/shop",
      iconColor: "text-orange-500"
    },
    {
      icon: MapPin,
      title: "附近的人",
      description: "发现身边的朋友",
      path: "/nearby",
      iconColor: "text-blue-500"
    }
  ];

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/20 overflow-hidden">
      <Header title="发现" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {/* Menu Items */}
          {menuItems.map((item, index) => (
            <Card 
              key={index}
              className="shadow-lg border-0 bg-card/80 backdrop-blur-sm overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-200"
              onClick={() => navigate(item.path)}
            >
              <div className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center">
                  <item.icon className={`h-6 w-6 ${item.iconColor}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                
                {/* Friend avatars for moments */}
                {item.path === "/moments" && friendMoments.length > 0 && (
                  <div className="flex items-center -space-x-2 mr-2">
                    {friendMoments.map((friend, idx) => (
                      <Avatar key={idx} className="h-8 w-8 border-2 border-white">
                        <AvatarImage src={friend.avatar_url} />
                        <AvatarFallback className="bg-gradient-to-br from-purple-400 to-purple-600 text-white text-xs">
                          {friend.display_name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {friendMoments.length > 0 && (
                      <div className="h-8 w-8 rounded-full bg-purple-100 border-2 border-white flex items-center justify-center">
                        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                    )}
                  </div>
                )}
                
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
