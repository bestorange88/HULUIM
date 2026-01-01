import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Crown, ShoppingCart, User, Tag, Ticket, ChevronRight, Gift, MessageCircle, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TransactionPasswordDialog from "@/components/wallet/TransactionPasswordDialog";

interface MembershipTier {
  id: string;
  name: string;
  price: number;
  benefits: string[];
  sort_order: number;
  withdrawal_minimum?: number;
  daily_check_in_bonus?: number;
  daily_draw_tickets?: number;
}

// 权益UI配置映射表 - 根据关键词匹配数据库中的权益文本，提供图标和跳转
const BENEFIT_CONFIGS: {
  match: (text: string) => boolean;
  icon: React.ComponentType<{ className?: string }>;
  defaultDesc: string;
  action?: string;
  route?: string;
}[] = [
  {
    match: txt => txt.includes("购物") || txt.includes("折扣"),
    icon: ShoppingCart,
    defaultDesc: "商城专属折扣优惠",
    action: "去购物",
    route: "/points-mall",
  },
  {
    match: txt => txt.includes("头像框"),
    icon: User,
    defaultDesc: "解锁多款酷炫头像框",
    action: "去装饰",
    route: "/profile",
  },
  {
    match: txt => txt.includes("标签"),
    icon: Tag,
    defaultDesc: "解锁专属身份标签",
    action: "去装饰",
    route: "/profile",
  },
  {
    match: txt => txt.includes("抽奖") || txt.includes("入场券"),
    icon: Ticket,
    defaultDesc: "每月赠送抽奖入场券",
    action: "去抽奖",
    route: "/lucky-draw",
  },
  {
    match: txt => txt.includes("靓号") || txt.includes("聊天"),
    icon: MessageCircle,
    defaultDesc: "专属聊天靓号",
  },
  {
    match: txt => txt.includes("签到"),
    icon: Gift,
    defaultDesc: "每日签到奖励加成",
  },
];

// 根据权益文本获取UI配置
const getBenefitConfig = (text: string) => {
  const config = BENEFIT_CONFIGS.find(c => c.match(text));
  if (!config) {
    return { text, Icon: Star, desc: text };
  }
  return {
    text,
    Icon: config.icon,
    desc: config.defaultDesc,
    action: config.action,
    route: config.route,
  };
};

interface UserMembership {
  id: string;
  tier_id: string;
  tier: MembershipTier;
  purchased_at: string;
  payment_amount: number;
  is_active: boolean;
}

export default function Referral() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [myMemberships, setMyMemberships] = useState<UserMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<MembershipTier | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("");
  
  // Transaction password states
  const [hasTransactionPassword, setHasTransactionPassword] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordMode, setPasswordMode] = useState<"set" | "verify">("set");
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    loadData();
    checkTransactionPassword();
  }, []);

  const checkTransactionPassword = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("transaction_password_hash")
        .eq("id", user.id)
        .single();

      if (profile?.transaction_password_hash) {
        setHasTransactionPassword(true);
      }
    } catch (error) {
      console.error("Error checking transaction password:", error);
    }
  };

  const requirePassword = (action: () => void) => {
    if (!hasTransactionPassword) {
      setPasswordMode("set");
      setPendingAction(() => action);
      setPasswordDialogOpen(true);
    } else {
      setPasswordMode("verify");
      setPendingAction(() => action);
      setPasswordDialogOpen(true);
    }
  };

  const handlePasswordSuccess = () => {
    setHasTransactionPassword(true);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load membership tiers
      const { data: tiersData } = await supabase
        .from("membership_tiers")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (tiersData) {
        const mappedTiers = tiersData.map(tier => ({
          id: tier.id,
          name: tier.name,
          price: Number(tier.price),
          sort_order: tier.sort_order,
          benefits: Array.isArray(tier.benefits) 
            ? (tier.benefits as string[])
            : [],
          withdrawal_minimum: tier.withdrawal_minimum !== null ? Number(tier.withdrawal_minimum) : undefined,
          daily_check_in_bonus: tier.daily_check_in_bonus ?? undefined,
          daily_draw_tickets: tier.daily_draw_tickets ?? undefined,
        }));
        setTiers(mappedTiers);
        // Set first tier as active by default
        if (mappedTiers.length > 0 && !activeTab) {
          setActiveTab(mappedTiers[0].id);
        }
      }

      // Load user's memberships
      const { data: membershipsData } = await supabase
        .from("user_memberships")
        .select(`
          *,
          tier:membership_tiers(*)
        `)
        .eq("user_id", user.id)
        .order("purchased_at", { ascending: false });

      if (membershipsData) {
        setMyMemberships(membershipsData.map(m => ({
          id: m.id,
          tier_id: m.tier_id,
          purchased_at: m.purchased_at,
          payment_amount: Number(m.payment_amount),
          is_active: m.is_active,
          tier: {
            id: m.tier.id,
            name: m.tier.name,
            price: Number(m.tier.price),
            sort_order: m.tier.sort_order,
            benefits: Array.isArray(m.tier.benefits) 
              ? (m.tier.benefits as string[])
              : []
          }
        })));
      }
    } catch (error) {
      console.error("Failed to load membership data:", error);
      toast.error(t("membership.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const openPurchaseDialog = (tier: MembershipTier) => {
    setSelectedTier(tier);
    setPurchaseDialogOpen(true);
  };

  // Calculate the payable amount for upgrade (difference between tiers)
  const getPayableAmount = (tier: MembershipTier): number => {
    // Find the highest price among active memberships
    const activeMemberships = myMemberships.filter(m => m.is_active);
    const maxOwnedPrice = activeMemberships.reduce((max, m) => {
      const membershipTier = tiers.find(t => t.id === m.tier_id);
      return membershipTier ? Math.max(max, membershipTier.price) : max;
    }, 0);
    
    // Calculate difference
    const diff = tier.price - maxOwnedPrice;
    return diff > 0 ? diff : 0;
  };

  const performPurchase = async () => {
    if (!selectedTier) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t("common.pleaseLogin"));
        return;
      }

      // Calculate payable amount (upgrade difference)
      const payableAmount = getPayableAmount(selectedTier);
      
      // Check if user already has this tier or higher
      if (payableAmount <= 0) {
        toast.error("您已拥有该等级或更高级会员，无需再次购买");
        return;
      }

      // Check wallet balance
      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      if (!wallet || Number(wallet.balance) < payableAmount) {
        toast.error(t("membership.insufficientBalance"));
        return;
      }

      // Deduct from wallet
      const newBalance = Number(wallet.balance) - payableAmount;
      await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("user_id", user.id);

      // Create transaction record
      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "membership_purchase",
        amount: -payableAmount,
        balance_before: wallet.balance,
        balance_after: newBalance,
        description: t("membership.purchase", { name: selectedTier.name }),
        reference_type: "membership",
      });

      // Create membership record
      await supabase.from("user_memberships").insert({
        user_id: user.id,
        tier_id: selectedTier.id,
        payment_amount: payableAmount,
        payment_method: "wallet",
        is_active: true,
      });

      toast.success(t("membership.purchaseSuccess"));
      setPurchaseDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Failed to purchase membership:", error);
      toast.error(t("membership.purchaseFailed"));
    }
  };

  const handlePurchase = () => {
    // Require transaction password before purchase
    requirePassword(() => performPurchase());
  };

  const getTierGradient = (name: string) => {
    if (name.includes("黄金")) return "from-yellow-100 to-orange-100";
    if (name.includes("钻石")) return "from-blue-100 to-purple-100";
    if (name.includes("至尊")) return "from-purple-100 to-pink-100";
    return "from-gray-100 to-gray-200";
  };

  // 获取当前选中等级的权益
  const currentTier = tiers.find(t => t.id === activeTab);
  const currentBenefits = currentTier?.benefits || [];

  const hasTier = (tierId: string) => {
    return myMemberships.some(m => m.tier_id === tierId && m.is_active);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/profile')}
        >
          <ChevronRight className="h-5 w-5 rotate-180" />
        </Button>
        <h1 className="text-lg font-semibold">{t("membership.membershipCenter")}</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab Selector */}
          <TabsList className="grid w-full grid-cols-3 mb-6">
            {tiers.map((tier) => (
              <TabsTrigger key={tier.id} value={tier.id} className="relative">
                {tier.name}
                {hasTier(tier.id) && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab Content for each tier */}
          {tiers.map((tier) => (
            <TabsContent key={tier.id} value={tier.id} className="space-y-6">
              {/* Membership Card */}
              <Card 
                className={`relative h-48 rounded-2xl bg-gradient-to-br ${getTierGradient(tier.name)} p-6 cursor-pointer transition-transform hover:scale-[1.02] shadow-lg overflow-hidden`}
                onClick={() => openPurchaseDialog(tier)}
              >
                <div className="relative z-10 flex flex-col justify-between h-full">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-foreground mb-2">{tier.name}</h3>
                      <p className="text-sm text-muted-foreground">会员时长：永久有效</p>
                    </div>
                    {hasTier(tier.id) && (
                      <Badge className="bg-green-500 text-white">已开通</Badge>
                    )}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold text-foreground">¥{tier.price.toLocaleString()}</p>
                      <Button 
                        className="mt-2" 
                        size="sm"
                        disabled={hasTier(tier.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          openPurchaseDialog(tier);
                        }}
                      >
                        {hasTier(tier.id) ? "已开通" : "立即开通"}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20">
                  <Crown className="h-32 w-32 text-yellow-500" />
                </div>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Benefits Section - 显示当前选中等级的权益 */}
        {currentBenefits.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground px-2">
              {currentTier?.name || '会员'}专属权益 ({currentBenefits.length}项)
            </h2>
            <div className="space-y-2">
              {currentBenefits.map((benefitText, index) => {
                const config = getBenefitConfig(benefitText);
                const Icon = config.Icon;
                return (
                  <Card 
                    key={index} 
                    className={`p-3 hover:shadow-md transition-shadow ${config.route ? 'cursor-pointer' : ''}`}
                    onClick={() => config.route && navigate(config.route)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground text-sm mb-0.5">{benefitText}</h3>
                          <p className="text-xs text-muted-foreground">{config.desc}</p>
                        </div>
                      </div>
                      {config.action && config.route && (
                        <div className="flex items-center gap-1 text-primary">
                          <span className="text-xs">{config.action}</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* 会员特权数值展示 */}
        {currentTier && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground px-2">会员特权</h2>
            <Card className="p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{currentTier.daily_check_in_bonus || 10}</p>
                  <p className="text-xs text-muted-foreground">每日签到积分</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{currentTier.daily_draw_tickets || 3}</p>
                  <p className="text-xs text-muted-foreground">每月抽奖券</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">¥{currentTier.withdrawal_minimum || 0}</p>
                  <p className="text-xs text-muted-foreground">最低提现额</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>购买会员</DialogTitle>
            <DialogDescription>
              确认购买 {selectedTier?.name} 吗？
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className={`p-6 rounded-2xl bg-gradient-to-br ${selectedTier ? getTierGradient(selectedTier.name) : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-1">{selectedTier?.name}</h3>
                  <p className="text-sm text-muted-foreground">永久有效</p>
                </div>
                <Crown className="h-12 w-12 text-yellow-500" />
              </div>
            </div>
            {selectedTier && (
              <>
                {getPayableAmount(selectedTier) < selectedTier.price && getPayableAmount(selectedTier) > 0 && (
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-sm text-green-700">升级优惠</span>
                    <span className="text-sm text-green-700">
                      原价 ¥{selectedTier.price.toLocaleString()} - 已付 ¥{(selectedTier.price - getPayableAmount(selectedTier)).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <span className="text-sm">支付金额</span>
                  <span className="text-2xl font-bold text-primary">¥{getPayableAmount(selectedTier).toLocaleString()}</span>
                </div>
              </>
            )}
            <div className="text-sm text-muted-foreground">
              <p>购买后将立即从您的钱包余额中扣除相应金额</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handlePurchase} disabled={selectedTier ? getPayableAmount(selectedTier) <= 0 : true}>
              确认购买
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Password Dialog */}
      <TransactionPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        mode={passwordMode}
        onSuccess={handlePasswordSuccess}
      />
    </div>
  );
}
