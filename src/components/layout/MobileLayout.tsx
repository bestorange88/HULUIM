import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, Users, UserCircle, BookUser, UserPlus, MessageSquarePlus, Compass } from "lucide-react";
import Header from "./Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import NewConversationDialog from "@/components/chat/NewConversationDialog";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useFriendRequests } from "@/hooks/useFriendRequests";

export default function MobileLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const { unreadCount } = useUnreadCount();
  const { pendingCount: friendRequestCount } = useFriendRequests();

  const navItems = [
    { path: "/discover", icon: Compass, label: "发现" },
    { path: "/conversations", icon: MessageSquare, label: "对话" },
    { path: "/contacts", icon: BookUser, label: "通讯录" },
    { path: "/groups", icon: Users, label: "群组" },
    { path: "/profile", icon: UserCircle, label: "我的" },
  ];

  const isActive = (path: string) => location.pathname === path;

  // 根据路由配置标题栏
  const getHeaderConfig = () => {
    // 发现页由页面自己渲染Header，不在这里配置
    if (location.pathname === "/discover") {
      return null;
    }
    if (location.pathname === "/conversations") {
      return { 
        title: "对话",
        rightContent: (
          <Button
            size="icon"
            onClick={() => setNewConversationOpen(true)}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
        )
      };
    }
    if (location.pathname === "/contacts") {
      return { 
        title: "通讯录",
        linkUrl: "/search-friends",
        linkLabel: "",
        linkIcon: UserPlus
      };
    }
    if (location.pathname === "/groups") {
      return { 
        title: "群组",
        rightContent: (
          <Button
            size="icon"
            onClick={() => setNewConversationOpen(true)}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
        )
      };
    }
    
  const subPages = [
    "/wallet",
    "/my-points",
    "/my-orders",
    "/my-favorites",
    "/profile",
    "/referral",
    "/points-mall",
    "/personal-info",
    "/notification-settings",
    "/privacy-security",
    "/general-settings",
    "/help-feedback",
    "/privacy-policy",
    "/terms-of-service",
    "/about-us",
    "/delete-account",
    "/real-name-verification",
    "/search-friends",
    "/lucky-draw"
  ];
    
    if (subPages.includes(location.pathname) || location.pathname.startsWith("/chat/") || location.pathname.startsWith("/news/") || location.pathname.startsWith("/moment/")) {
      return null;
    }
    
    return { title: "首页" };
  };

  const headerConfig = getHeaderConfig();
  
  // Hide bottom nav in chat pages
  const hiddenNavPaths = ["/chat/"];
  const shouldHideNav = hiddenNavPaths.some(path => location.pathname.startsWith(path));

  return (
    <div className="h-full max-h-full flex flex-col bg-background border-x border-border max-w-screen-sm mx-auto safe-area-top overflow-hidden">
      {headerConfig && <Header {...headerConfig} />}
      <main className="flex-1 overflow-hidden min-h-0 transition-opacity duration-200 flex flex-col">
        <Outlet />
      </main>

      {!shouldHideNav && (
        <nav className="border-t border-border bg-card shadow-elevated safe-area-bottom flex-shrink-0">
          <div className="flex items-center justify-around h-16 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const showMessageBadge = item.path === "/conversations" && unreadCount > 0;
              const showFriendBadge = item.path === "/contacts" && friendRequestCount > 0;
              const badgeCount = item.path === "/conversations" ? unreadCount : friendRequestCount;
              
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 no-tap-highlight ${
                    active
                      ? "text-primary scale-105"
                      : "text-muted-foreground hover:text-foreground active:scale-95"
                  }`}
                >
                  <div className="relative">
                    <Icon className={`h-6 w-6 transition-all ${active ? "fill-primary/20 stroke-[2.5]" : "stroke-2"}`} />
                    {(showMessageBadge || showFriendBadge) && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px] font-bold rounded-full"
                      >
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </Badge>
                    )}
                  </div>
                  <span className={`text-[11px] font-medium transition-all ${active ? "font-semibold" : ""}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

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
