import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Crown, Check } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import TransactionPasswordDialog from "@/components/wallet/TransactionPasswordDialog";
import membershipElite from "@/assets/membership-elite.png";
import membershipGold from "@/assets/membership-gold.png";
import membershipDiamond from "@/assets/membership-diamond.png";

interface MembershipTier {
  id: string;
  name: string;
  price: number;
  benefits: any;
  withdrawal_minimum: number;
  daily_check_in_bonus: number;
  sort_order: number;
}

export default function MembershipPurchase() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<MembershipTier | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'usdt' | 'fiat'>('balance');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [processing, setProcessing] = useState(false);

  const [currentMembership, setCurrentMembership] = useState<{tierId: string; tierName: string; price: number} | null>(null);
  const [upgradeInfo, setUpgradeInfo] = useState<{payableAmount: number; isUpgrade: boolean; message: string} | null>(null);
  const [loadingUpgrade, setLoadingUpgrade] = useState(false);
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Load membership tiers
      const { data: tiersData, error } = await supabase
        .from('membership_tiers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setTiers(tiersData || []);

      // Load wallet balance
      const { data: walletData } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walletData) {
        setWalletBalance(Number(walletData.balance));
      }

      // Load user current membership
      const { data: userMemberships } = await supabase
        .from("user_memberships")
        .select("tier_id, membership_tiers(id, name, price, sort_order)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (userMemberships && userMemberships.length > 0) {
        let highestTier: any = null;
        for (const membership of userMemberships) {
          const tier = membership.membership_tiers as any;
          if (tier && (!highestTier || tier.sort_order > highestTier.sort_order)) {
            highestTier = tier;
          }
        }
        if (highestTier) {
          setCurrentMembership({
            tierId: highestTier.id,
            tierName: highestTier.name,
            price: Number(highestTier.price)
          });
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const getMembershipImage = (name: string) => {
    if (name.includes('至尊')) return membershipElite;
    if (name.includes('钻石')) return membershipDiamond;
    if (name.includes('黄金')) return membershipGold;
    return null;
  };

  const handlePurchaseClick = async (tier: MembershipTier) => {
    setSelectedTier(tier);
    setLoadingUpgrade(true);
    setUpgradeInfo(null);

    try {
      const { data, error } = await supabase.functions.invoke("calculate-membership-upgrade", {
        body: { targetTierId: tier.id }
      });

      if (error) {
        console.error("Failed to calculate upgrade price:", error);
        toast.error("计算升级价格失败");
        setLoadingUpgrade(false);
        return;
      }

      if (data?.success && data?.data) {
        const result = data.data;
        if (!result.isUpgrade) {
          toast.error(result.message || "您当前已是该等级或更高等级");
          setLoadingUpgrade(false);
          return;
        }
        setUpgradeInfo({
          payableAmount: result.payableAmount,
          isUpgrade: result.isUpgrade,
          message: result.message
        });
      }
    } catch (err) {
      console.error("Error calculating upgrade:", err);
      toast.error("计算升级价格失败");
      setLoadingUpgrade(false);
      return;
    }

    setLoadingUpgrade(false);
    setConfirmDialogOpen(true);
  };

  const handleConfirmPurchase = () => {
    if (paymentMethod === 'balance') {
      if (walletBalance < (upgradeInfo ? upgradeInfo.payableAmount : (selectedTier?.price || 0))) {
        toast.error('余额不足，请充值后再购买');
        return;
      }
      setShowPasswordDialog(true);
    } else {
      toast.info('充值功能请前往钱包页面操作');
      navigate('/wallet');
    }
  };

  const handlePasswordVerified = async () => {
    if (!selectedTier) return;

    // Calculate actual payment amount (use upgrade price if available)
    const actualPaymentAmount = upgradeInfo ? upgradeInfo.payableAmount : selectedTier.price;

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('请先登录');
        return;
      }

      // Get current wallet balance
      const { data: walletData } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      const oldBalance = Number(walletData?.balance || 0);
      const newBalance = oldBalance - actualPaymentAmount;

      // Deduct balance
      await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', user.id);

      // Create transaction record
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'membership_purchase',
        amount: -actualPaymentAmount,
        balance_before: oldBalance,
        balance_after: newBalance,
        description: `购买${selectedTier.name}`,
        reference_id: selectedTier.id,
        reference_type: 'membership',
      });

      // Create membership record
      await supabase.from('user_memberships').insert({
        user_id: user.id,
        tier_id: selectedTier.id,
        payment_amount: actualPaymentAmount,
        payment_method: 'balance',
        is_active: true,
      });

      toast.success(`成功购买${selectedTier.name}！`);
      setConfirmDialogOpen(false);
      setTimeout(() => navigate('/profile'), 1000);
    } catch (error) {
      console.error('Purchase failed:', error);
      toast.error('购买失败，请重试');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border bg-card flex items-center gap-3">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/profile')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold">会员购买</h1>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              升级您的会员等级
            </h2>
            <p className="text-muted-foreground">享受更多专属权益和特权</p>
          </div>

          {tiers.map((tier) => {
            const image = getMembershipImage(tier.name);
            return (
              <Card
                key={tier.id}
                className={`relative overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border-2 ${
                  tier.name.includes('至尊')
                    ? 'border-purple-500/50 bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/30 dark:to-fuchsia-950/30'
                    : tier.name.includes('钻石')
                    ? 'border-cyan-500/50 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30'
                    : 'border-amber-500/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Crown className={`h-6 w-6 ${
                          tier.name.includes('至尊')
                            ? 'text-purple-500'
                            : tier.name.includes('钻石')
                            ? 'text-cyan-500'
                            : 'text-amber-500'
                        }`} />
                        <h3 className="text-xl font-bold">{tier.name}</h3>
                      </div>
                      <div className="text-3xl font-bold mb-4">
                        <span className="text-primary">¥{tier.price}</span>
                        <span className="text-sm text-muted-foreground ml-2">永久有效</span>
                      </div>
                    </div>
                    {image && (
                      <img src={image} alt={tier.name} className="w-20 h-20 object-contain" />
                    )}
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="font-semibold text-sm mb-2">会员权益：</div>
                    {(Array.isArray(tier.benefits) ? tier.benefits : []).map((benefit, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                    <div className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>最低提现金额：¥{tier.withdrawal_minimum}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>每日签到奖励：{tier.daily_check_in_bonus} 积分</span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => handlePurchaseClick(tier)}
                  >
                    立即购买
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Confirm Purchase Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认购买</DialogTitle>
            <DialogDescription>
              您确定要购买 {selectedTier?.name} 吗？
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">会员等级</span>
              <span className="font-semibold">{selectedTier?.name}</span>
            </div>
            {currentMembership && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">当前等级</span>
                <span className="font-semibold">{currentMembership.tierName} (¥{currentMembership.price})</span>
              </div>
            )}
            {upgradeInfo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">原价</span>
                <span className="font-semibold line-through text-muted-foreground">¥{selectedTier?.price}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{upgradeInfo && currentMembership ? "补差价" : "支付金额"}</span>
              <span className="font-semibold text-primary">¥{upgradeInfo ? upgradeInfo.payableAmount.toFixed(2) : selectedTier?.price}</span>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">支付方式</label>
              <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balance">
                    钱包余额 (当前: ¥{walletBalance.toFixed(2)})
                  </SelectItem>
                  <SelectItem value="usdt">USDT充值</SelectItem>
                  <SelectItem value="fiat">法币充值</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmPurchase} disabled={processing}>
              {processing ? '处理中...' : '确认购买'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Password Dialog */}
      <TransactionPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        mode="verify"
        onSuccess={handlePasswordVerified}
      />
    </div>
  );
}
