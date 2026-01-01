import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  Wallet,
  ArrowLeftRight,
  LogOut,
  Shield,
  BadgeCheck,
  Settings,
  MessageCircle,
  AlertTriangle,
  Sliders,
  FileText,
  Landmark,
  BarChart3,
  UsersRound,
  Activity,
  UserCheck,
  Gift,
  Crown,
  ShoppingBag,
  Newspaper,
  Sparkles,
  Bell,
  Frame,
  Dices,
  ChevronDown,
  ChevronRight,
  CalendarCheck
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface MenuItem {
  path: string;
  icon: any;
  label: string;
}

interface MenuGroup {
  label: string;
  icon: any;
  items: MenuItem[];
}

export default function AdminLayout() {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const menuGroups: MenuGroup[] = [
    {
      label: '概览',
      icon: LayoutDashboard,
      items: [
        { path: '/superadmin', icon: LayoutDashboard, label: '仪表盘' },
        { path: '/superadmin/performance', icon: Activity, label: '性能监控' },
      ]
    },
    {
      label: '用户管理',
      icon: Users,
      items: [
        { path: '/superadmin/users', icon: Users, label: '用户管理' },
        { path: '/superadmin/membership-tiers', icon: Crown, label: '会员等级' },
        { path: '/superadmin/user-memberships', icon: ShoppingBag, label: '会员购买记录' },
      ]
    },
    {
      label: '内容管理',
      icon: MessageSquare,
      items: [
        { path: '/superadmin/conversations', icon: MessageSquare, label: '对话管理' },
        { path: '/superadmin/messages', icon: MessageCircle, label: '聊天记录' },
        { path: '/superadmin/moments', icon: Sparkles, label: '朋友圈管理' },
      ]
    },
    {
      label: '财务管理',
      icon: Wallet,
      items: [
        { path: '/superadmin/transactions', icon: Wallet, label: '交易管理' },
        { path: '/superadmin/red-envelopes', icon: Gift, label: '红包记录' },
        { path: '/superadmin/transfers', icon: ArrowLeftRight, label: '转账记录' },
        { path: '/superadmin/crypto-review', icon: BadgeCheck, label: '充值提现审核' },
        { path: '/superadmin/financial', icon: Landmark, label: '财务管理' },
        { path: '/superadmin/financial-reports', icon: BarChart3, label: '财务报表' },
      ]
    },
    {
      label: '审核管理',
      icon: UserCheck,
      items: [
        { path: '/superadmin/real-name-verifications', icon: UserCheck, label: '实名认证审核' },
      ]
    },
    {
      label: '推广运营',
      icon: UsersRound,
      items: [
        { path: '/superadmin/gifts', icon: Gift, label: '赠送管理' },
        { path: '/superadmin/point-products', icon: Gift, label: '积分商品' },
        { path: '/superadmin/point-orders', icon: ShoppingBag, label: '积分订单' },
        { path: '/superadmin/lucky-draw-records', icon: Dices, label: '抽奖管理' },
        { path: '/superadmin/avatar-frames', icon: Frame, label: '头像框管理' },
        { path: '/superadmin/checkin-settings', icon: CalendarCheck, label: '签到设置' },
      ]
    },
    {
      label: '内容发布',
      icon: Bell,
      items: [
        { path: '/superadmin/system-messages', icon: Bell, label: '系统消息' },
        { path: '/superadmin/news', icon: Newspaper, label: '资讯管理' },
        { path: '/superadmin/articles', icon: FileText, label: '文章管理' },
      ]
    },
    {
      label: '系统设置',
      icon: Settings,
      items: [
        { path: '/superadmin/sensitive-words', icon: AlertTriangle, label: '敏感词管理' },
        { path: '/superadmin/customer-service', icon: MessageCircle, label: '客服管理' },
        { path: '/superadmin/platform-settings', icon: Sliders, label: '平台设置' },
        { path: '/superadmin/settings', icon: Settings, label: '管理员设置' },
      ]
    },
  ];

  const toggleGroup = (groupLabel: string) => {
    setOpenGroups(prev => 
      prev.includes(groupLabel) 
        ? []  // 如果当前组已展开，点击后收起
        : [groupLabel]  // 否则只展开当前组（关闭其他所有组）
    );
  };

  const isGroupActive = (items: MenuItem[]) => {
    return items.some(item => location.pathname === item.path);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/superadmin/login');
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="h-6 w-6" />
            <h1 className="text-xl font-bold">管理后台</h1>
          </div>
        </div>
        <ScrollArea className="flex-1 p-4">
          <nav className="space-y-1">
            {menuGroups.map((group) => {
              const GroupIcon = group.icon;
              const isOpen = openGroups.includes(group.label);
              const isActive = isGroupActive(group.items);
              
              return (
                <div key={group.label} className="space-y-1">
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start font-medium",
                      isActive && "text-primary"
                    )}
                    onClick={() => toggleGroup(group.label)}
                  >
                    <GroupIcon className="mr-2 h-4 w-4" />
                    {group.label}
                    {isOpen ? (
                      <ChevronDown className="ml-auto h-4 w-4" />
                    ) : (
                      <ChevronRight className="ml-auto h-4 w-4" />
                    )}
                  </Button>
                  
                  {isOpen && (
                    <div className="ml-4 space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isItemActive = location.pathname === item.path;
                        return (
                          <Button
                            key={item.path}
                            variant={isItemActive ? 'default' : 'ghost'}
                            size="sm"
                            className={cn(
                              "w-full justify-start",
                              isItemActive && 'bg-primary text-primary-foreground'
                            )}
                            onClick={() => navigate(item.path)}
                          >
                            <Icon className="mr-2 h-3 w-3" />
                            {item.label}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </ScrollArea>
        <div className="p-4 border-t border-border">
          <Button
            variant="outline"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden select-text">
        <ScrollArea className="h-full">
          <div className="p-8 select-text">
            <Outlet />
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}