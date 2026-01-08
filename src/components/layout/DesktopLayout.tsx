import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessageSquare, Users, UserCircle, MessageSquarePlus, UserPlus, Settings, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Conversations from "@/pages/Conversations";
import Contacts from "@/pages/Contacts";
import NewConversationDialog from "@/components/chat/NewConversationDialog";
import { supabase } from "@/integrations/supabase/client";

export default function DesktopLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("conversations");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 获取当前用户信息
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // 根据当前路由设置活动标签
  useEffect(() => {
    if (location.pathname.startsWith("/contacts")) {
      setActiveTab("contacts");
    } else if (location.pathname.startsWith("/conversations") || location.pathname.startsWith("/chat")) {
      setActiveTab("conversations");
    }
  }, [location.pathname]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setCurrentUser(profile);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "conversations") {
      navigate("/conversations");
    } else if (value === "contacts") {
      navigate("/contacts");
    }
  };

    // 判断当前页面是否应该显示内容
    const shouldShowContent = location.pathname.startsWith("/chat/") ||
                             location.pathname.startsWith("/profile") ||
                             location.pathname.startsWith("/wallet") ||
                             location.pathname.startsWith("/personal-info") ||
                             location.pathname.startsWith("/notification-settings") ||
                             location.pathname.startsWith("/privacy-security") ||
                             location.pathname.startsWith("/general-settings") ||
                             location.pathname.startsWith("/help-feedback") ||
                             location.pathname.startsWith("/stories") ||
                             location.pathname.startsWith("/moments") ||
                             location.pathname.startsWith("/discover") ||
                             location.pathname.startsWith("/search-friends") ||
                             location.pathname.startsWith("/scan-qr") ||
                             location.pathname.startsWith("/system-messages") ||
                             location.pathname.startsWith("/my-favorites") ||
                             location.pathname.startsWith("/friend-requests") ||
                             location.pathname.startsWith("/groups") ||
                             location.pathname.startsWith("/nearby");

  return (
    <div className="h-screen flex bg-background">
      {/* 左侧边栏 - 对话列表和联系人 */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="h-14 border-b border-border flex items-center justify-between px-4">
          <h1 className="text-lg font-semibold">讯达</h1>
          <div className="flex items-center gap-2">
            {activeTab === "conversations" && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setNewConversationOpen(true)}
                className="h-8 w-8"
              >
                <MessageSquarePlus className="h-5 w-5" />
              </Button>
            )}
            {activeTab === "contacts" && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => navigate("/search-friends")}
                className="h-8 w-8"
              >
                <UserPlus className="h-5 w-5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => window.open("https://bosacoin.com/", "_blank")}
              className="h-8 w-8"
            >
              <ExternalLink className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full rounded-none border-b bg-card h-12 flex-shrink-0">
            <TabsTrigger value="conversations" className="flex-1 gap-2">
              <MessageSquare className="h-4 w-4" />
              对话
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex-1 gap-2">
              <Users className="h-4 w-4" />
              通讯录
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversations" className="flex-1 m-0 overflow-hidden">
            <Conversations />
          </TabsContent>

          <TabsContent value="contacts" className="flex-1 m-0 overflow-hidden">
            <Contacts />
          </TabsContent>
        </Tabs>

        {/* 底部功能菜单 */}
        <div className="border-t border-border bg-card p-3 flex items-center justify-center flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10 transition-colors w-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={currentUser?.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                    {currentUser?.display_name?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium truncate">{currentUser?.display_name}</p>
                  <p className="text-xs text-muted-foreground truncate">@{currentUser?.username}</p>
                </div>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate("/profile")}>
                              <UserCircle className="h-4 w-4 mr-2" />
                              个人资料
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/notification-settings")}>
                通知设置
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/privacy-security")}>
                隐私与安全
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/general-settings")}>
                通用设置
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/help-feedback")}>
                帮助与反馈
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 右侧主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {shouldShowContent ? (
          <Outlet />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">选择一个对话开始聊天</p>
            </div>
          </div>
        )}
      </div>

      <NewConversationDialog
        open={newConversationOpen}
        onOpenChange={setNewConversationOpen}
        onConversationCreated={(id) => {
          navigate(`/chat/${id}`);
        }}
      />
    </div>
  );
}
