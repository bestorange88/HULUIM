import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QrCode, Copy, ChevronRight, LogOut, Star, HelpCircle, Settings, Lock, ShoppingBag, Video, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AvatarWithFrame } from "@/components/avatar/AvatarWithFrame";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import QRCode from "qrcode";
import { copyToClipboard } from "@/utils/clipboard";
import { cn } from "@/lib/utils";

interface StoryUser {
  user_id: string;
  display_name: string;
  avatar_url: string;
  hasUnviewed: boolean;
}

export default function Profile() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [storyUsers, setStoryUsers] = useState<StoryUser[]>([]);
  const [myStoryCount, setMyStoryCount] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    checkAuth();
    fetchCurrentUser();
    fetchStoryUsers();
  }, []);

  useEffect(() => {
    if (currentUser?.username) {
      generateQRCode(currentUser.username);
    }
  }, [currentUser?.username]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/auth");
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("id, user_id, username, display_name, avatar_url, bio, status, gender, birth_date, phone, avatar_frame").eq("id", user.id).single();
      setCurrentUser(profile);
    }
  };

  const generateQRCode = async (username: string) => {
    try {
      const url = await QRCode.toDataURL(username, { width: 300, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } });
      setQrCodeUrl(url);
    } catch (error) { console.error("Error generating QR code:", error); }
  };

  const handleCopyId = async () => {
    if (currentUser?.user_id) {
      const success = await copyToClipboard(currentUser.user_id);
      toast({ description: success ? "ID已复制" : "复制失败", variant: success ? "default" : "destructive" });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
    toast({ title: t("auth.logout"), description: t("common.success") });
  };

    const handleAvatarClick = () => {
      navigate("/personal-info");
    };

    const handleStoryClick = () => {
      navigate("/stories");
    };

    const fetchStoryUsers = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get friends list
        const { data: friendshipsData } = await supabase
          .from("friendships")
          .select("friend_id, user_id")
          .eq("status", "accepted")
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

        const friendIds = new Set<string>();
        friendIds.add(user.id);
        friendshipsData?.forEach(f => {
          if (f.user_id === user.id) {
            friendIds.add(f.friend_id);
          } else {
            friendIds.add(f.user_id);
          }
        });

        // Fetch stories from friends (not expired)
        const { data: storiesData } = await supabase
          .from("stories")
          .select("id, user_id")
          .in("user_id", Array.from(friendIds))
          .gt("expires_at", new Date().toISOString());

        if (!storiesData || storiesData.length === 0) {
          setStoryUsers([]);
          setMyStoryCount(0);
          return;
        }

        // Count my stories
        const myStoriesCount = storiesData.filter(s => s.user_id === user.id).length;
        setMyStoryCount(myStoriesCount);

        // Get unique users who have stories (excluding current user)
        const userIds = [...new Set(storiesData.filter(s => s.user_id !== user.id).map(s => s.user_id))];
      
        if (userIds.length === 0) {
          setStoryUsers([]);
          return;
        }

        // Get profiles for these users
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

        // Fetch viewed stories
        const storyIds = storiesData.map(s => s.id);
        const { data: viewsData } = await supabase
          .from("story_views")
          .select("story_id")
          .eq("viewer_id", user.id)
          .in("story_id", storyIds);

        const viewedStoryIds = new Set(viewsData?.map(v => v.story_id) || []);

        // Build story users array
        const usersMap = new Map<string, { hasUnviewed: boolean }>();
        storiesData.forEach(story => {
          if (story.user_id === user.id) return;
          const existing = usersMap.get(story.user_id) || { hasUnviewed: false };
          if (!viewedStoryIds.has(story.id)) {
            existing.hasUnviewed = true;
          }
          usersMap.set(story.user_id, existing);
        });

        const users: StoryUser[] = [];
        usersMap.forEach((data, userId) => {
          const profile = profilesMap.get(userId);
          if (profile) {
            users.push({
              user_id: userId,
              display_name: profile.display_name || "Unknown",
              avatar_url: profile.avatar_url || "",
              hasUnviewed: data.hasUnviewed
            });
          }
        });

        // Sort: users with unviewed stories first
        users.sort((a, b) => {
          if (a.hasUnviewed && !b.hasUnviewed) return -1;
          if (!a.hasUnviewed && b.hasUnviewed) return 1;
          return 0;
        });

        setStoryUsers(users.slice(0, 5)); // Show max 5 users
      } catch (error) {
        console.error("Error fetching story users:", error);
      }
    };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-purple-50/30 to-white overflow-y-auto pb-20">
      {/* Header with user info */}
      <div className="px-5 pt-8 pb-6 bg-gradient-to-br from-purple-100/50 to-white relative">
        <Button variant="ghost" size="icon" onClick={() => setQrDialogOpen(true)} className="absolute top-4 right-4 z-20 bg-white/50 backdrop-blur-sm hover:bg-white/80 text-purple-600 border border-purple-100">
          <QrCode className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-4">
          {/* Avatar - click to go to personal info */}
          <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
            <AvatarWithFrame 
              avatarUrl={currentUser?.avatar_url} 
              displayName={currentUser?.display_name || "User"} 
              size="xl" 
              className="transition-all duration-300 group-hover:scale-105 ring-4 ring-purple-100 rounded-full" 
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-gray-900">{currentUser?.display_name || "加载中..."}</h2>
            
            {/* Alo ID */}
            <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-full w-fit">
              <span className="text-xs text-purple-500">Alo ID:</span>
              <span className="text-xs font-mono text-purple-600">{currentUser?.user_id || "-------"}</span>
              <Copy className="h-3 w-3 text-purple-400 cursor-pointer hover:text-purple-600" onClick={handleCopyId} />
            </div>
            
                  {/* Story row with button and friend avatars */}
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                    {/* My Story button */}
                    <div 
                      className="flex flex-col items-center gap-0.5 flex-shrink-0 cursor-pointer"
                      onClick={handleStoryClick}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full p-0.5 relative",
                        myStoryCount > 0 ? "bg-gradient-to-tr from-purple-500 to-pink-500" : "bg-gray-300"
                      )}>
                        <Avatar className="w-full h-full border-2 border-white">
                          <AvatarImage src={currentUser?.avatar_url} />
                          <AvatarFallback>Me</AvatarFallback>
                        </Avatar>
                        {myStoryCount === 0 && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center border-2 border-white">
                            <Plus className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500">
                        {myStoryCount > 0 ? "我的" : "发布"}
                      </span>
                    </div>
              
                    {/* Friends' Stories */}
                    {storyUsers.map((user) => (
                      <div 
                        key={user.user_id}
                        className="flex flex-col items-center gap-0.5 flex-shrink-0 cursor-pointer"
                        onClick={handleStoryClick}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-full p-0.5",
                          user.hasUnviewed 
                            ? "bg-gradient-to-tr from-purple-500 to-pink-500" 
                            : "bg-gray-300"
                        )}>
                          <Avatar className="w-full h-full border-2 border-white">
                            <AvatarImage src={user.avatar_url} />
                            <AvatarFallback>{user.display_name[0]}</AvatarFallback>
                          </Avatar>
                        </div>
                        <span className="text-[10px] text-gray-500 truncate max-w-10">{user.display_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

      {/* Menu sections */}
      <div className="px-4 space-y-4 mt-4">
        {/* Section 1: Payment & Mall */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full" />
            <h3 className="font-semibold text-sm text-gray-700">支付与商城</h3>
          </div>
          <Card className="overflow-hidden shadow-sm border-purple-100">
            <button onClick={() => toast({ description: "支付与商城功能即将上线" })} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-orange-500" />
                </div>
                <span className="text-sm font-medium text-gray-700">支付与商城</span>
              </div>
              <ChevronRight className="h-5 w-5 text-purple-300" />
            </button>
          </Card>
        </div>

        {/* Section 2: Favorites, Help, Settings, Privacy */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full" />
            <h3 className="font-semibold text-sm text-gray-700">功能设置</h3>
          </div>
          <Card className="overflow-hidden shadow-sm border-purple-100">
            <button onClick={() => navigate("/my-favorites")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors border-b border-purple-50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg flex items-center justify-center">
                  <Star className="h-5 w-5 text-amber-500" />
                </div>
                <span className="text-sm font-medium text-gray-700">收藏夹</span>
              </div>
              <ChevronRight className="h-5 w-5 text-purple-300" />
            </button>
            <button onClick={() => navigate("/help-center")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors border-b border-purple-50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
                  <HelpCircle className="h-5 w-5 text-blue-500" />
                </div>
                <span className="text-sm font-medium text-gray-700">帮助中心</span>
              </div>
              <ChevronRight className="h-5 w-5 text-purple-300" />
            </button>
            <button onClick={() => navigate("/general-settings")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors border-b border-purple-50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center">
                  <Settings className="h-5 w-5 text-purple-500" />
                </div>
                <span className="text-sm font-medium text-gray-700">通用设置</span>
              </div>
              <ChevronRight className="h-5 w-5 text-purple-300" />
            </button>
            <button onClick={() => navigate("/privacy-security")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gradient-to-br from-green-50 to-green-100 rounded-lg flex items-center justify-center">
                  <Lock className="h-5 w-5 text-green-500" />
                </div>
                <span className="text-sm font-medium text-gray-700">隐私安全</span>
              </div>
              <ChevronRight className="h-5 w-5 text-purple-300" />
            </button>
          </Card>
        </div>

              </div>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>我的二维码</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center py-6 space-y-4">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64 border-4 border-purple-100 rounded-2xl shadow-xl" />
            ) : (
              <div className="w-64 h-64 bg-purple-50 rounded-2xl flex items-center justify-center">
                <QrCode className="h-24 w-24 text-purple-300 animate-pulse" />
              </div>
            )}
            <div className="text-center space-y-2 w-full">
              <h3 className="font-semibold text-lg">{currentUser?.display_name}</h3>
              <div className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 rounded-lg">
                <span className="text-sm text-gray-500">Alo ID:</span>
                <span className="text-sm font-mono font-semibold text-purple-600">{currentUser?.user_id || "-"}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-purple-100" onClick={handleCopyId}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-gray-400 pt-2">扫描二维码或搜索用户名添加好友</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
