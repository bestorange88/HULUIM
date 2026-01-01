import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import TransactionPasswordDialog from "@/components/wallet/TransactionPasswordDialog";
import { useTranslation } from "react-i18next";

type ExchangeType = "balance-to-points" | "points-to-balance";

export default function PointsExchange() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [exchangeType, setExchangeType] = useState<ExchangeType>("balance-to-points");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState(0);
  const [balance, setBalance] = useState(0);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const exchangeRate = 1; // 1:1 exchange rate

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load points
      const { data: pointsData } = await supabase
        .from("user_points")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (pointsData) {
        setPoints(Number(pointsData.balance));
      }

      // Load wallet balance
      const { data: walletData } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (walletData) {
        setBalance(Number(walletData.balance));
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const handleExchange = async () => {
    const inputAmount = Number(amount);
    if (!inputAmount || inputAmount <= 0) {
      toast.error(t("exchange.enterValidAmount"));
      return;
    }

    if (exchangeType === "balance-to-points") {
      if (inputAmount > balance) {
        toast.error(t("exchange.insufficientBalance"));
        return;
      }
    } else {
      if (inputAmount > points) {
        toast.error(t("exchange.insufficientPoints"));
        return;
      }
    }

    setShowPasswordDialog(true);
  };

  const handlePasswordVerified = async () => {
    // Prevent duplicate submissions
    if (loading) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t("common.pleaseLogin"));
        return;
      }

      const inputAmount = Number(amount);

      if (exchangeType === "balance-to-points") {
        // Balance to Points: Deduct balance, add points
        const pointsToAdd = inputAmount * exchangeRate;
        
        // Get current balances
        const { data: walletData } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", user.id)
          .single();

        const { data: pointsData } = await supabase
          .from("user_points")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();

        const oldWalletBalance = Number(walletData?.balance || 0);
        const oldPointsBalance = Number(pointsData?.balance || 0);

        // Update wallet
        await supabase
          .from("wallets")
          .update({ balance: oldWalletBalance - inputAmount })
          .eq("user_id", user.id);

        // Update points
        if (!pointsData) {
          await supabase.from("user_points").insert({
            user_id: user.id,
            balance: pointsToAdd,
          });
        } else {
          await supabase
            .from("user_points")
            .update({ balance: oldPointsBalance + pointsToAdd })
            .eq("user_id", user.id);
        }

        // Create transaction records
        await supabase.from("transactions").insert({
          user_id: user.id,
          type: "exchange",
          amount: -inputAmount,
          balance_before: oldWalletBalance,
          balance_after: oldWalletBalance - inputAmount,
          description: t("exchange.balanceToPointsDesc", { amount: inputAmount, points: pointsToAdd }),
        });

        await supabase.from("point_transactions").insert({
          user_id: user.id,
          type: "exchange",
          amount: pointsToAdd,
          balance_before: oldPointsBalance,
          balance_after: oldPointsBalance + pointsToAdd,
          description: t("exchange.balanceToPoints", { amount: inputAmount }),
        });

        toast.success(t("exchange.earnedPoints", { points: pointsToAdd }));
      } else {
        // Points to Balance: Deduct points, add balance
        const balanceToAdd = inputAmount / exchangeRate;

        // Get current balances
        const { data: pointsData } = await supabase
          .from("user_points")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();

        const { data: walletData } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();

        const oldPointsBalance = Number(pointsData?.balance || 0);
        const oldWalletBalance = Number(walletData?.balance || 0);

        // Update points
        await supabase
          .from("user_points")
          .update({ balance: oldPointsBalance - inputAmount })
          .eq("user_id", user.id);

        // Update wallet
        if (!walletData) {
          await supabase.from("wallets").insert({
            user_id: user.id,
            balance: balanceToAdd,
          });
        } else {
          await supabase
            .from("wallets")
            .update({ balance: oldWalletBalance + balanceToAdd })
            .eq("user_id", user.id);
        }

        // Create transaction records
        await supabase.from("point_transactions").insert({
          user_id: user.id,
          type: "exchange",
          amount: -inputAmount,
          balance_before: oldPointsBalance,
          balance_after: oldPointsBalance - inputAmount,
          description: t("exchange.pointsToBalanceDesc", { points: inputAmount, amount: balanceToAdd }),
        });

        await supabase.from("transactions").insert({
          user_id: user.id,
          type: "exchange",
          amount: balanceToAdd,
          balance_before: oldWalletBalance,
          balance_after: oldWalletBalance + balanceToAdd,
          description: t("exchange.pointsToBalance", { points: inputAmount }),
        });

        toast.success(t("exchange.earnedBalance", { amount: balanceToAdd }));
      }

      setAmount("");
      loadData();
    } catch (error) {
      console.error("Exchange failed:", error);
      toast.error(t("exchange.exchangeFailed"));
    } finally {
      setLoading(false);
    }
  };

  const calculatedAmount = amount ? Number(amount) * exchangeRate : 0;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border bg-card flex items-center gap-3">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/my-points")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold">{t("exchange.title")}</h1>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Exchange Type Tabs */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={exchangeType === "balance-to-points" ? "default" : "outline"}
              className="h-12"
              onClick={() => setExchangeType("balance-to-points")}
            >
              {t("exchange.balanceToPoints")}
            </Button>
            <Button
              variant={exchangeType === "points-to-balance" ? "default" : "outline"}
              className="h-12"
              onClick={() => setExchangeType("points-to-balance")}
            >
              {t("exchange.pointsToBalance")}
            </Button>
          </div>

          {/* Current Balances */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground mb-1">{t("exchange.currentPoints")}</div>
              <div className="text-2xl font-bold text-primary">{points}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground mb-1">{t("exchange.currentBalance")}</div>
              <div className="text-2xl font-bold text-accent">¥{balance.toFixed(2)}</div>
            </Card>
          </div>

          {/* Exchange Form */}
          <Card className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {exchangeType === "balance-to-points" ? t("exchange.exchangePoints") : t("exchange.exchangeBalance")}
              </label>
              <Input
                type="number"
                placeholder={t("exchange.enterAmount")}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg h-12"
              />
            </div>

            <div className="text-right text-sm text-muted-foreground">
              {t("exchange.exchangeRate")}
            </div>

            {amount && (
              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-sm text-muted-foreground mb-1">{t("exchange.expectedToReceive")}</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {exchangeType === "balance-to-points" 
                    ? t("exchange.pointsAmount", { amount: calculatedAmount })
                    : t("exchange.balanceAmount", { amount: calculatedAmount.toFixed(2) })}
                </div>
              </div>
            )}
          </Card>

          <Button
            className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent hover:opacity-90"
            onClick={handleExchange}
            disabled={loading || !amount}
          >
            {loading ? t("exchange.exchanging") : t("exchange.confirmExchange")}
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            {t("exchange.integerOnly")}
          </div>
        </div>
      </ScrollArea>

      <TransactionPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        mode="verify"
        onSuccess={handlePasswordVerified}
      />
    </div>
  );
}
