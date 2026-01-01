import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface USDTWithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  onSuccess: () => void;
}

export default function USDTWithdrawDialog({
  open,
  onOpenChange,
  currentBalance,
  onSuccess,
}: USDTWithdrawDialogProps) {
  const [cnyAmount, setCnyAmount] = useState("");
  const [trc20Address, setTrc20Address] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(7.2);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadExchangeRate();
    }
  }, [open]);

  const loadExchangeRate = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "usdt_exchange_rate")
      .maybeSingle();

    if (data?.value) {
      setExchangeRate(parseFloat(data.value));
    }
  };

  const usdtAmount = cnyAmount ? (parseFloat(cnyAmount) / exchangeRate).toFixed(2) : "0.00";

  const handleSubmit = async () => {
    // Prevent duplicate submissions
    if (submitting) return;
    
    const amount = parseFloat(cnyAmount);

    // 验证金额
    if (!cnyAmount || amount <= 0) {
      toast({
        title: "请输入提现金额",
        variant: "destructive",
      });
      return;
    }

    if (amount < 10) {
      toast({
        title: "提现金额不能低于10元",
        variant: "destructive",
      });
      return;
    }

    if (amount > currentBalance) {
      toast({
        title: "余额不足",
        description: `当前可用余额：¥${currentBalance.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    // 验证TRC20地址格式
    if (!trc20Address || trc20Address.trim().length === 0) {
      toast({
        title: "请输入TRC20地址",
        variant: "destructive",
      });
      return;
    }

    if (!trc20Address.startsWith("T") || trc20Address.length !== 34) {
      toast({
        title: "TRC20地址格式错误",
        description: "TRC20地址应以T开头，长度为34个字符",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      // 获取当前钱包余额
      const { data: walletData } = await supabase
        .from("wallets")
        .select("balance, frozen_balance")
        .eq("user_id", user.id)
        .single();

      if (!walletData) throw new Error("钱包不存在");

      const currentWalletBalance = parseFloat(walletData.balance.toString());
      if (amount > currentWalletBalance) {
        throw new Error("余额不足");
      }

      const usdt = parseFloat(usdtAmount);

      // 创建提现记录
      const { error: cryptoError } = await supabase
        .from("crypto_transactions")
        .insert({
          user_id: user.id,
          type: "withdraw",
          amount: amount, // CNY amount to deduct
          usdt_amount: usdt, // USDT amount user receives
          trc20_address: trc20Address.trim(),
          status: "pending",
          review_status: "pending",
          notes: notes.trim() || `USDT提现，汇率 ${exchangeRate}`,
        });

      if (cryptoError) throw cryptoError;

      // 冻结相应金额
      const newBalance = currentWalletBalance - amount;
      const currentFrozen = parseFloat(walletData.frozen_balance?.toString() || "0");
      const newFrozen = currentFrozen + amount;

      const { error: walletError } = await supabase
        .from("wallets")
        .update({
          balance: newBalance,
          frozen_balance: newFrozen,
        })
        .eq("user_id", user.id);

      if (walletError) throw walletError;

      // 创建交易记录
      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "withdraw_freeze",
        amount: amount,
        balance_before: currentWalletBalance,
        balance_after: newBalance,
        description: `USDT提现冻结 ≈${usdt} USDT`,
        status: "completed",
      });

      toast({
        title: "提现申请已提交",
        description: "管理员审核通过后将转账USDT到您的钱包，相应金额已冻结",
      });

      setCnyAmount("");
      setTrc20Address("");
      setNotes("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Withdraw error:", error);
      toast({
        title: "提现失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">USDT TRC20 提现</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* 警告提示 */}
          <Alert className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              请核对提现地址，转账后无法撤销
            </AlertDescription>
          </Alert>

          {/* 提现规则 */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="text-sm font-medium">提现规则</p>
            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
              <li>最小提现金额：10元</li>
              <li>当前汇率：1 USDT = ¥{exchangeRate.toFixed(2)}</li>
              <li>到账时间：1-3个工作日</li>
            </ul>
          </div>

          {/* 当前余额 */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">可用余额</p>
            <p className="text-xl font-semibold text-primary">
              ¥{currentBalance.toFixed(2)}
            </p>
          </div>

          {/* 提现金额 */}
          <div className="space-y-1">
            <Label htmlFor="withdraw-amount" className="text-sm">提现金额（元）*</Label>
            <Input
              id="withdraw-amount"
              type="number"
              placeholder="请输入提现金额"
              value={cnyAmount}
              onChange={(e) => setCnyAmount(e.target.value)}
              min="10"
              max={currentBalance}
              step="0.01"
              className="h-9"
            />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">最小：10元</span>
              <span className="text-primary font-medium">≈ {usdtAmount} USDT</span>
            </div>
          </div>

          {/* TRC20地址 */}
          <div className="space-y-1">
            <Label htmlFor="trc20-address" className="text-sm">TRC20钱包地址*</Label>
            <Input
              id="trc20-address"
              type="text"
              placeholder="T开头的34位地址"
              value={trc20Address}
              onChange={(e) => setTrc20Address(e.target.value)}
              className="font-mono text-xs h-9"
            />
          </div>

          {/* 备注 */}
          <div className="space-y-1">
            <Label htmlFor="notes" className="text-sm">备注（可选）</Label>
            <Textarea
              id="notes"
              placeholder="添加备注信息"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={200}
              className="resize-none"
            />
          </div>

          {/* 提交按钮 */}
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? "提交中..." : "提交提现申请"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
