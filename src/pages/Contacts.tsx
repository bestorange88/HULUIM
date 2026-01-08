import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Users, MessageSquare } from "lucide-react";
import { useFriendRequests } from "@/hooks/useFriendRequests";
import { useToast } from "@/hooks/use-toast";
import { AvatarWithFrame } from "@/components/avatar/AvatarWithFrame";
import { pinyin } from "pinyin-pro";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [customerServiceAccounts, setCustomerServiceAccounts] = useState<CustomerServiceAccount[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [activeIndex, setActiveIndex] = useState<string>("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navigate = useNavigate();
  const { toast } = useToast();
  const { pendingCount } = useFriendRequests();

  useEffect(() => {
    checkAuth();
    fetchFriends();
    fetchCustomerServiceAccounts();
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

      await supabase.functions.invoke('create-customer-service');
      await supabase.functions.invoke('create-ai-assistant');

      await new Promise(resolve => setTimeout(resolve, 1000));

      await supabase.functions.invoke('add-customer-service-friend', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      
      await supabase.functions.invoke('add-ai-assistant-friend', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

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

  const fetchCustomerServiceAccounts = async () => {
    const { data } = await supabase
      .from("customer_service_accounts")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    
    setCustomerServiceAccounts(data || []);
  };

  // Get first letter of name (pinyin for Chinese characters)
  const getFirstLetter = (name: string): string => {
    if (!name) return "#";
    const firstChar = name.charAt(0);
    if (/[\u4e00-\u9fa5]/.test(firstChar)) {
      const pinyinResult = pinyin(firstChar, { pattern: "first", toneType: "none" });
      return pinyinResult.toUpperCase();
    }
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

  const handleOpenChat = async (friendId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existingConversations } = await supabase
        .from("conversation_participants")
        .select(`conversation_id, conversations!inner (id, type)`)
        .eq("user_id", user.id);

      let conversationId = null;
      
      if (existingConversations && existingConversations.length > 0) {
        for (const conv of existingConversations) {
          const { data: otherParticipants } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", conv.conversation_id);
          
          if (otherParticipants && otherParticipants.length === 2) {
            const participantIds = otherParticipants.map(p => p.user_id);
            if (participantIds.includes(friendId) && participantIds.includes(user.id)) {
              conversationId = conv.conversation_id;
              break;
            }
          }
        }
      }

      if (!conversationId) {
        const { data: rpcConvId, error: rpcError } = await (supabase as any)
          .rpc('create_direct_conversation', { friend_id: friendId });
        if (rpcError || !rpcConvId) {
          throw rpcError ?? new Error('无法创建对话');
        }
        conversationId = rpcConvId as string;
      }

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

  // Separate system and regular friends
  const systemFriends = friends.filter((friend) => 
    friend.profiles.username === 'customer_service' || 
    friend.profiles.username === 'ai_assistant'
  );
  const regularFriends = friends.filter((friend) => 
    friend.profiles.username !== 'customer_service' && 
    friend.profiles.username !== 'ai_assistant'
  );

  // Group all regular friends by letter
  const groupedByLetter = getSortedFriendsByLetter(regularFriends);
  const availableLetters = getSortedLetters(groupedByLetter);

  // Full alphabet for index
  const fullAlphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'];

  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <h1 className="text-lg font-medium">通讯录</h1>
        <button 
          onClick={() => navigate("/search-friends")}
          className="p-2 hover:bg-accent rounded-full transition-colors"
        >
          <UserPlus className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" ref={scrollAreaRef}>
                {/* Function Entries - WeChat style */}
                <div className="bg-background">
                  {/* Group Chats */}
                  <div 
                    className="flex items-center px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-accent/5 active:bg-accent/10"
                    onClick={() => navigate("/groups")}
                  >
                    <div className="w-10 h-10 rounded bg-green-500 flex items-center justify-center mr-3">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <span className="flex-1 text-[15px]">群聊</span>
                  </div>

                                            {/* AI Assistant */}
                          {systemFriends.find(f => f.profiles.username === 'ai_assistant') && (() => {
                            const aiFriend = systemFriends.find(f => f.profiles.username === 'ai_assistant')!;
                            return (
                              <div 
                                className="flex items-center px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-accent/5 active:bg-accent/10"
                                onClick={() => handleOpenChat(aiFriend.friend_id)}
                              >
                                <div className="w-10 h-10 rounded bg-purple-500 flex items-center justify-center mr-3 overflow-hidden">
                                  {aiFriend.profiles.avatar_url ? (
                                    <img src={aiFriend.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <MessageSquare className="h-5 w-5 text-white" />
                                  )}
                                </div>
                                <span className="flex-1 text-[15px]">{aiFriend.profiles.display_name}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">AI</span>
                              </div>
                            );
                          })()}

                          {/* New Friends - 新的好友 */}
                          <div 
                            className="flex items-center px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-accent/5 active:bg-accent/10"
                            onClick={() => navigate("/friend-requests")}
                          >
                            <div className="w-10 h-10 rounded bg-orange-500 flex items-center justify-center mr-3">
                              <UserPlus className="h-5 w-5 text-white" />
                            </div>
                            <span className="flex-1 text-[15px]">新的好友</span>
                            {pendingCount > 0 && (
                              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                {pendingCount}
                              </span>
                            )}
                          </div>

                          {/* Customer Service */}
                          {customerServiceAccounts.map((cs) => (
                            <div 
                              key={cs.id}
                              className="flex items-center px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-accent/5 active:bg-accent/10"
                              onClick={() => cs.user_id && handleOpenChat(cs.user_id)}
                            >
                              <div className="w-10 h-10 rounded bg-blue-500 flex items-center justify-center mr-3">
                                <MessageSquare className="h-5 w-5 text-white" />
                              </div>
                              <span className="flex-1 text-[15px]">{cs.display_name}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">官方</span>
                            </div>
                          ))}
                        </div>

        {/* Friends List by Letter */}
        {isInitialLoading ? (
          <div className="px-4 py-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-10 w-10 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : regularFriends.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-muted-foreground mb-4">暂无联系人</p>
            <button
              onClick={() => navigate("/search-friends")}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
            >
              添加朋友
            </button>
          </div>
        ) : (
          <div className="pb-20">
            {availableLetters.map((letter) => (
              <div key={letter}>
                {/* Letter header */}
                <div 
                  ref={(el) => sectionRefs.current[letter] = el}
                  className="sticky top-0 bg-muted/80 backdrop-blur-sm px-4 py-1 text-xs font-medium text-muted-foreground z-10"
                >
                  {letter}
                </div>
                {/* Friends under this letter */}
                {groupedByLetter[letter].map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center px-4 py-3 border-b border-border/30 cursor-pointer hover:bg-accent/5 active:bg-accent/10"
                    onClick={() => handleOpenChat(friend.friend_id)}
                  >
                    <AvatarWithFrame
                      avatarUrl={friend.profiles.avatar_url}
                      displayName={friend.profiles.display_name}
                      size="sm"
                      className="mr-3"
                    />
                    <span className="text-[15px]">{friend.profiles.display_name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alphabetical index - WeChat style on right side */}
      {regularFriends.length > 0 && (
        <div className="fixed right-1 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center py-1">
          {fullAlphabet.map((letter) => (
            <button
              key={letter}
              onClick={() => availableLetters.includes(letter) && scrollToLetter(letter)}
              className={`w-5 h-4 flex items-center justify-center text-[10px] transition-colors ${
                activeIndex === letter
                  ? "text-primary font-bold"
                  : availableLetters.includes(letter)
                    ? "text-muted-foreground hover:text-primary"
                    : "text-muted-foreground/30"
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
