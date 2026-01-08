import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, Users, UserCircle, BookUser, UserPlus, MessageSquarePlus, Compass, Phone } from "lucide-react";
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
    { path: "/conversations", icon: MessageCircle, label: "消息" },
    { path: "/contacts", icon: BookUser, label: "通讯录" },
    { path: "/discover", icon: Compass, label: "发现" },
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
      return null; // Conversations page renders its own header
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
    "/lucky-draw",
    "/stories",
    "/moments",
    "/shop",
    "/nearby"
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
        <nav className="w-full h-16 bg-white/90 backdrop-blur-lg border-t border-purple-100 flex items-center justify-around px-2 safe-area-bottom flex-shrink-0">
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
                className={`flex flex-col items-center justify-center gap-1 px-5 py-2 rounded-xl transition-all duration-200 relative ${
                  active
                    ? "text-purple-600"
                    : "text-gray-400 hover:text-purple-500"
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
                <span className="text-[11px]">{item.label}</span>
                {/* Active indicator */}
                {active && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"></div>
                )}
                {/* Unread badge */}
                {(showMessageBadge || showFriendBadge) && (
                  <span className="absolute top-1 right-2 min-w-5 h-5 px-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-[11px] rounded-full flex items-center justify-center shadow-sm">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </button>
            );
          })}
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
