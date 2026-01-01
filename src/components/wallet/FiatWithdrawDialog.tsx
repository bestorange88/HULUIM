import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FiatWithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  onSuccess: () => void;
}

export default function FiatWithdrawDialog({
  open,
  onOpenChange,
  currentBalance,
  onSuccess,
}: FiatWithdrawDialogProps) {
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    // Prevent duplicate submissions
    if (submitting) return;
    
    const amount = parseFloat(withdrawAmount);

    // 验证金额
    if (!withdrawAmount || amount <= 0) {
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

    // 验证银行信息
    if (!bankName.trim()) {
      toast({
        title: "请输入开户银行",
        variant: "destructive",
      });
      return;
    }

    if (!bankAccount.trim()) {
      toast({
        title: "请输入银行账号",
        variant: "destructive",
      });
      return;
    }

    if (!bankHolder.trim()) {
      toast({
        title: "请输入账户名",
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

      // 创建提现记录
      const { error: cryptoError } = await supabase
        .from("crypto_transactions")
        .insert({
          user_id: user.id,
          type: "fiat_withdraw",
          amount: amount,
          usdt_amount: amount,
          trc20_address: `${bankName}|${bankHolder}|${bankAccount}`,
          status: "pending",
          review_status: "pending",
          notes: notes.trim() || "法币提现",
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
        description: "法币提现冻结",
        status: "completed",
      });

      toast({
        title: "提现申请已提交",
        description: "管理员审核通过后将转账到您的银行账户，相应金额已冻结",
      });

      setWithdrawAmount("");
      setBankName("");
      setBankAccount("");
      setBankHolder("");
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
          <DialogTitle className="text-lg font-semibold">法币提现</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* 警告提示 */}
          <Alert className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              请核对银行账户信息，审核通过后将转账到您的银行账户
            </AlertDescription>
          </Alert>

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
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              min="10"
              max={currentBalance}
              step="0.01"
              className="h-9"
            />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">最小：10元</span>
              <button
                type="button"
                onClick={() => setWithdrawAmount(currentBalance.toString())}
                className="text-primary hover:underline"
              >
                全部提现
              </button>
            </div>
          </div>

          {/* 银行信息 */}
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="bank-name" className="text-sm">开户银行*</Label>
              <Input
                id="bank-name"
                type="text"
                placeholder="如：中国工商银行"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bank-holder" className="text-sm">账户名*</Label>
              <Input
                id="bank-holder"
                type="text"
                placeholder="请输入账户名"
                value={bankHolder}
                onChange={(e) => setBankHolder(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bank-account" className="text-sm">银行账号*</Label>
              <Input
                id="bank-account"
                type="text"
                placeholder="请输入银行账号"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                className="font-mono h-9"
              />
            </div>
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
