import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, FolderOpen, ChevronDown, ChevronRight, Bell } from "lucide-react";
import { FriendRequests } from "@/components/friends/FriendRequests";
import { useFriendRequests } from "@/hooks/useFriendRequests";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import FriendGroupManager from "@/components/groups/FriendGroupManager";
import { AvatarWithFrame } from "@/components/avatar/AvatarWithFrame";
import { pinyin } from "pinyin-pro";
import OnlineStatus from "@/components/chat/OnlineStatus";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface FriendGroup {
  id: string;
  name: string;
  color?: string;
}

interface GroupMember {
  friend_id: string;
  group_id: string;
}

interface Friend {
  id: string;
  friend_id: string;
  status: string;
  profiles: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
    avatar_frame?: string | null;
    status: string;
  };
}

interface FriendMembership {
  friend_id: string;
  tier_name: string;
  tier_sort_order: number;
}

interface CustomerServiceAccount {
  id: string;
  user_id: string | null;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
}

export default function Contacts() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [customerServiceAccounts, setCustomerServiceAccounts] = useState<CustomerServiceAccount[]>([]);
  const [friendMemberships, setFriendMemberships] = useState<FriendMembership[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["ungrouped"]));
  const [activeIndex, setActiveIndex] = useState<string>("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const friendRequestsRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { pendingCount } = useFriendRequests();

  // Scroll to friend requests section
  const scrollToFriendRequests = () => {
    friendRequestsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    checkAuth();
    fetchFriends();
    fetchGroups();
    fetchCustomerServiceAccounts();
    fetchFriendMemberships();
    ensureSystemFriends();

    const channel = supabase
      .channel("friendships-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
        },
        () => {
          fetchFriends();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const ensureSystemFriends = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      console.log('Ensuring system friends...');

      // Create system accounts if they don't exist
      const csResult = await supabase.functions.invoke('create-customer-service');
      console.log('Customer service result:', csResult);
      
      const aiResult = await supabase.functions.invoke('create-ai-assistant');
      console.log('AI assistant result:', aiResult);

      // Wait a bit for accounts to be created
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Add them as friends
      const csFriendResult = await supabase.functions.invoke('add-customer-service-friend', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      console.log('Customer service friend result:', csFriendResult);
      
      const aiFriendResult = await supabase.functions.invoke('add-ai-assistant-friend', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      console.log('AI assistant friend result:', aiFriendResult);

      // Refresh friends list
      await fetchFriends();
    } catch (error) {
      console.error('Error ensuring system friends:', error);
    }
  };

  const fetchFriends = async () => {
    if (!hasLoadedOnce) { setIsInitialLoading(true); }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("friendships")
        .select(`id, friend_id, status, profiles:profiles!friendships_friend_id_fkey (id, display_name, username, avatar_url, avatar_frame, status)`)
        .eq("user_id", user.id)
        .eq("status", "accepted");
      if (data) {
        setFriends(data as Friend[]);
        setHasLoadedOnce(true);
      }
    } finally {
      setIsInitialLoading(false);
    }
  };

  const fetchGroups = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: groupsData } = await supabase
      .from("friend_groups")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    const { data: membersData } = await supabase
      .from("friend_group_members")
      .select("friend_id, group_id");

    setGroups(groupsData || []);
    setGroupMembers(membersData || []);
  };

  const fetchCustomerServiceAccounts = async () => {
    const { data } = await supabase
      .from("customer_service_accounts")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    
    setCustomerServiceAccounts(data || []);
  };

  const fetchFriendMemberships = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all friend IDs
      const { data: friendships } = await supabase
        .from("friendships")
        .select("friend_id")
        .eq("user_id", user.id)
        .eq("status", "accepted");

      if (!friendships || friendships.length === 0) return;

      const friendIds = friendships.map(f => f.friend_id);

      // Get membership info for all friends (highest tier for each friend)
      const { data: memberships } = await supabase
        .from("user_memberships")
        .select(`
          user_id,
          tier:membership_tiers(name, sort_order)
        `)
        .in("user_id", friendIds)
        .eq("is_active", true);

      if (memberships) {
        // Group by user_id and get highest tier
        const membershipMap = new Map<string, FriendMembership>();
        memberships.forEach((m: any) => {
          if (m.tier) {
            const existing = membershipMap.get(m.user_id);
            if (!existing || m.tier.sort_order > existing.tier_sort_order) {
              membershipMap.set(m.user_id, {
                friend_id: m.user_id,
                tier_name: m.tier.name,
                tier_sort_order: m.tier.sort_order,
              });
            }
          }
        });
        setFriendMemberships(Array.from(membershipMap.values()));
      }
    } catch (error) {
      console.error("Error fetching friend memberships:", error);
    }
  };

  const getFriendMembershipBadge = (friendId: string) => {
    const membership = friendMemberships.find(m => m.friend_id === friendId);
    if (!membership) return null;
    
    const badgeColors: Record<string, string> = {
      "黄金会员": "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
      "钻石会员": "bg-blue-500/20 text-blue-600 dark:text-blue-400",
      "至尊会员": "bg-purple-500/20 text-purple-600 dark:text-purple-400",
    };
    
    const badgeIcons: Record<string, string> = {
      "黄金会员": "👑",
      "钻石会员": "💎",
      "至尊会员": "🏆",
    };
    
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${badgeColors[membership.tier_name] || "bg-gray-500/20 text-gray-600"}`}>
        {badgeIcons[membership.tier_name] || ""} {membership.tier_name.replace("会员", "")}
      </span>
    );
  };

  const toggleGroupExpand = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const getFriendsInGroup = (groupId: string) => {
    const friendIds = groupMembers
      .filter(m => m.group_id === groupId)
      .map(m => m.friend_id);
    return regularFriends.filter(f => friendIds.includes(f.friend_id));
  };

  const getUngroupedFriends = () => {
    const groupedFriendIds = new Set(groupMembers.map(m => m.friend_id));
    return regularFriends.filter(f => !groupedFriendIds.has(f.friend_id));
  };

  // Get first letter of name (pinyin for Chinese characters)
  const getFirstLetter = (name: string): string => {
    if (!name) return "#";
    const firstChar = name.charAt(0);
    // Check if it's a Chinese character
    if (/[\u4e00-\u9fa5]/.test(firstChar)) {
      const pinyinResult = pinyin(firstChar, { pattern: "first", toneType: "none" });
      return pinyinResult.toUpperCase();
    }
    // For English or numbers
    if (/[A-Za-z]/.test(firstChar)) {
      return firstChar.toUpperCase();
    }
    return "#";
  };

  // Sort and group friends by first letter
  const getSortedFriendsByLetter = (friendsList: Friend[]) => {
    const grouped: Record<string, Friend[]> = {};
    
    friendsList.forEach(friend => {
      const letter = getFirstLetter(friend.profiles.display_name);
      if (!grouped[letter]) {
        grouped[letter] = [];
      }
      grouped[letter].push(friend);
    });

    // Sort each group by name
    Object.keys(grouped).forEach(letter => {
      grouped[letter].sort((a, b) => 
        a.profiles.display_name.localeCompare(b.profiles.display_name, 'zh-CN')
      );
    });

    return grouped;
  };

  // Get sorted letters
  const getSortedLetters = (grouped: Record<string, Friend[]>): string[] => {
    const letters = Object.keys(grouped);
    const alphabetLetters = letters.filter(l => l !== "#").sort();
    const specialLetters = letters.filter(l => l === "#");
    return [...alphabetLetters, ...specialLetters];
  };

  // Scroll to letter section
  const scrollToLetter = (letter: string) => {
    const element = sectionRefs.current[letter];
    if (element && scrollAreaRef.current) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveIndex(letter);
    }
  };

  const getColorClass = (color?: string) => {
    const colorMap: Record<string, string> = {
      blue: "bg-blue-500",
      green: "bg-green-500",
      red: "bg-red-500",
      yellow: "bg-yellow-500",
      purple: "bg-purple-500",
      pink: "bg-pink-500",
    };
    return colorMap[color || "blue"] || "bg-blue-500";
  };

  const handleOpenChat = async (friendId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("No user found");
        return;
      }
      
      console.log("Current user:", user.id);
      console.log("Opening chat with friend:", friendId);

      // 查找是否已存在与该好友的对话
      const { data: existingConversations, error: fetchError } = await supabase
        .from("conversation_participants")
        .select(`
          conversation_id,
          conversations!inner (
            id,
            type
          )
        `)
        .eq("user_id", user.id);

      console.log("Existing conversations:", existingConversations);
      if (fetchError) {
        console.error("Fetch error:", fetchError);
      }

      // 查找该好友的参与记录
      let conversationId = null;
      
      if (existingConversations && existingConversations.length > 0) {
        for (const conv of existingConversations) {
          const { data: otherParticipants } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", conv.conversation_id);
          
          // 检查是否是一对一对话且对方是目标好友
          if (otherParticipants && otherParticipants.length === 2) {
            const participantIds = otherParticipants.map(p => p.user_id);
            if (participantIds.includes(friendId) && participantIds.includes(user.id)) {
              conversationId = conv.conversation_id;
              console.log("Found existing conversation:", conversationId);
              break;
            }
          }
        }
      }

      // 如果不存在，创建新对话
      if (!conversationId) {
        console.log("Creating direct conversation via RPC...");
        const { data: rpcConvId, error: rpcError } = await (supabase as any)
          .rpc('create_direct_conversation', { friend_id: friendId });
        if (rpcError || !rpcConvId) {
          console.error('RPC error:', rpcError);
          throw rpcError ?? new Error('无法创建对话');
        }
        conversationId = rpcConvId as string;
        console.log('Created or found conversation:', conversationId);
      }

      // 导航到对话页面
      console.log("Navigating to chat:", conversationId);
      navigate(`/chat/${conversationId}`);
    } catch (error) {
      console.error("Error opening chat:", error);
      toast({
        title: "打开对话失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const filteredFriends = friends.filter((friend) =>
    friend.profiles.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.profiles.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate system and regular friends
  const systemFriends = filteredFriends.filter((friend) => 
    friend.profiles.username === 'customer_service' || 
    friend.profiles.username === 'ai_assistant'
  );
  const regularFriends = filteredFriends.filter((friend) => 
    friend.profiles.username !== 'customer_service' && 
    friend.profiles.username !== 'ai_assistant'
  );

  // Get all available letters from ungrouped friends for index
  const ungroupedFriends = getUngroupedFriends();
  const groupedByLetter = getSortedFriendsByLetter(ungroupedFriends);
  const availableLetters = getSortedLetters(groupedByLetter);

  return (
    <div className="h-full flex flex-col bg-background relative">
      <div className="p-4 border-b border-border bg-card shadow-card space-y-3">
        {/* Prominent Friend Request Banner */}
        {pendingCount > 0 && (
          <div 
            className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 border-2 border-primary/40 cursor-pointer animate-pulse hover:animate-none transition-all shadow-lg"
            onClick={scrollToFriendRequests}
          >
            <div className="relative">
              <Bell className="h-6 w-6 text-primary" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">您有新的好友申请</p>
              <p className="text-xs text-muted-foreground">点击查看并处理</p>
            </div>
            <Badge variant="destructive" className="text-sm px-3 py-1">
              {pendingCount} 条
            </Badge>
          </div>
        )}
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("contacts.searchFriend")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setGroupManagerOpen(true)}
            className="shrink-0"
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" ref={scrollAreaRef}>
        <div className="space-y-4 pb-20">
          {/* Friend Requests Entry - Always visible when there are pending requests */}
          {pendingCount > 0 && (
            <div className="px-2 pt-2">
              <div 
                className="p-4 rounded-xl bg-gradient-to-r from-orange-500/10 via-red-500/10 to-orange-500/10 border-2 border-orange-400/40 cursor-pointer shadow-lg hover:shadow-xl transition-all"
                onClick={scrollToFriendRequests}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                      <UserPlus className="h-6 w-6 text-white" />
                    </div>
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-ping" />
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-base text-foreground">新的朋友</p>
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      {pendingCount} 条好友申请待处理
                    </p>
                  </div>
                  <Badge variant="destructive" className="text-sm px-3 py-1 animate-pulse">
                    {pendingCount}
                  </Badge>
                </div>
              </div>
            </div>
          )}
          
          <div ref={friendRequestsRef}>
            <FriendRequests />
          </div>
          
          {/* System accounts section - Customer Service from database */}
          {customerServiceAccounts.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-4 pt-2">{t("contacts.systemServices")}</h3>
              <div className="divide-y divide-border">
                {customerServiceAccounts.map((cs) => (
                  <div
                    key={cs.id}
                    className="px-4 py-2.5 hover:bg-accent/10 transition-colors cursor-pointer"
                    onClick={() => cs.user_id && handleOpenChat(cs.user_id)}
                  >
                    <div className="flex items-center gap-2.5">
                      <AvatarWithFrame
                        avatarUrl={cs.avatar_url}
                        displayName={cs.display_name}
                        frameStyle="none"
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm flex items-center gap-2">
                          {cs.display_name}
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                            官方
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">客户服务</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* AI Assistant */}
                {systemFriends.find(f => f.profiles.username === 'ai_assistant') && (() => {
                  const aiFriend = systemFriends.find(f => f.profiles.username === 'ai_assistant')!;
                  return (
                    <div
                      key={aiFriend.id}
                      className="px-4 py-2.5 hover:bg-accent/10 transition-colors cursor-pointer"
                      onClick={() => handleOpenChat(aiFriend.friend_id)}
                    >
                      <div className="flex items-center gap-2.5">
                        <AvatarWithFrame
                          avatarUrl={aiFriend.profiles.avatar_url}
                          displayName={aiFriend.profiles.display_name}
                          frameStyle={aiFriend.profiles.avatar_frame || "none"}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm flex items-center gap-2">
                            {aiFriend.profiles.display_name}
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              AI
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">智能助手</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          
          {/* Regular friends section with groups */}
          <div className="border-t-2 border-border pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-4">{t("contacts.myFriends")}</h3>
            {isInitialLoading ? (
              <div className="px-4 py-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : regularFriends.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-muted-foreground mb-4">{t("contacts.noContacts")}</p>
                <Button
                  onClick={() => navigate("/search-friends")}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t("contacts.addFriend")}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Grouped friends */}
                {groups.map((group) => {
                  const groupFriends = getFriendsInGroup(group.id);
                  if (groupFriends.length === 0) return null;
                  const isExpanded = expandedGroups.has(group.id);
                  
                  return (
                    <div key={group.id} className="mx-2">
                      <div
                        className="flex items-center p-2 rounded-lg hover:bg-accent/10 cursor-pointer transition-colors"
                        onClick={() => toggleGroupExpand(group.id)}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full ${getColorClass(group.color)} mr-2`} />
                        <span className="text-sm font-medium flex-1">{group.name}</span>
                        <span className="text-xs text-muted-foreground mr-2">{groupFriends.length}</span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      
                      {isExpanded && (
                        <div className="divide-y divide-border ml-4">
                          {groupFriends.map((friend) => (
                            <div
                              key={friend.id}
                              className="px-3 py-2.5 hover:bg-accent/10 transition-colors cursor-pointer"
                              onClick={() => handleOpenChat(friend.friend_id)}
                            >
                            <div className="flex items-center gap-2.5">
                              <AvatarWithFrame
                                avatarUrl={friend.profiles.avatar_url}
                                displayName={friend.profiles.display_name}
                                frameStyle={friend.profiles.avatar_frame || "none"}
                                size="sm"
                              />
                               <div className="flex-1 min-w-0">
                                 <p className="font-medium text-sm flex items-center gap-1.5">
                                   {friend.profiles.display_name}
                                   {getFriendMembershipBadge(friend.friend_id)}
                                 </p>
                                 <OnlineStatus 
                                   isOnline={friend.profiles.status === "online"}
                                   lastSeen={null}
                                   className="mt-0.5"
                                 />
                               </div>
                            </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Ungrouped friends - sorted by letter */}
                {getUngroupedFriends().length > 0 && (() => {
                  const ungroupedFriends = getUngroupedFriends();
                  const groupedByLetter = getSortedFriendsByLetter(ungroupedFriends);
                  const sortedLetters = getSortedLetters(groupedByLetter);
                  const isExpanded = expandedGroups.has("ungrouped");

                  return (
                    <div className="mx-2">
                      <div
                        className="flex items-center p-2 rounded-lg hover:bg-accent/10 cursor-pointer transition-colors"
                        onClick={() => toggleGroupExpand("ungrouped")}
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 mr-2" />
                        <span className="text-sm font-medium flex-1">{t("contacts.ungrouped")}</span>
                        <span className="text-xs text-muted-foreground mr-2">{ungroupedFriends.length}</span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      
                      {isExpanded && (
                        <div className="ml-4">
                          {sortedLetters.map((letter) => (
                            <div key={letter}>
                              {/* Letter header */}
                              <div 
                                ref={(el) => sectionRefs.current[letter] = el}
                                className="sticky top-0 bg-muted/50 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-primary z-10"
                              >
                                {letter}
                              </div>
                              {/* Friends under this letter */}
                              <div className="divide-y divide-border">
                                {groupedByLetter[letter].map((friend) => (
                                  <div
                                    key={friend.id}
                                    className="px-3 py-2.5 hover:bg-accent/10 transition-colors cursor-pointer"
                                    onClick={() => handleOpenChat(friend.friend_id)}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <AvatarWithFrame
                                        avatarUrl={friend.profiles.avatar_url}
                                        displayName={friend.profiles.display_name}
                                        frameStyle={friend.profiles.avatar_frame || "none"}
                                        size="sm"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm flex items-center gap-1.5">
                                          {friend.profiles.display_name}
                                          {getFriendMembershipBadge(friend.friend_id)}
                                        </p>
                                        <OnlineStatus 
                                          isOnline={friend.profiles.status === "online"}
                                          lastSeen={null}
                                          className="mt-0.5"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alphabetical index - only show when ungrouped section is expanded and has friends */}
      {expandedGroups.has("ungrouped") && ungroupedFriends.length > 0 && (
        <div className="fixed right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-0.5 bg-card/80 backdrop-blur-sm rounded-lg p-1 shadow-lg border border-border">
          {availableLetters.map((letter) => (
            <button
              key={letter}
              onClick={() => scrollToLetter(letter)}
              className={`w-6 h-6 flex items-center justify-center text-[10px] font-semibold rounded transition-colors ${
                activeIndex === letter
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      )}

      <FriendGroupManager 
        open={groupManagerOpen}
        onOpenChange={setGroupManagerOpen}
        onGroupsChange={fetchGroups}
      />
    </div>
  );
}
