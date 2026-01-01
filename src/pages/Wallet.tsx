import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownLeft, Gift, Banknote, ArrowLeft, Coins, MessageSquare, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import USDTDepositDialog from "@/components/wallet/USDTDepositDialog";
import USDTWithdrawDialog from "@/components/wallet/USDTWithdrawDialog";
import FiatDepositDialog from "@/components/wallet/FiatDepositDialog";
import FiatWithdrawDialog from "@/components/wallet/FiatWithdrawDialog";
import TransactionPasswordDialog from "@/components/wallet/TransactionPasswordDialog";
import { useWalletEnabled } from "@/hooks/useWalletEnabled";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { useApiCall } from "@/hooks/useApiCall";

interface WalletData {
  balance: number;
  frozen_balance: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
  status: string;
  reference_id?: string;
  reference_type?: string;
  related_user_id?: string;
  related_user_name?: string;
  conversation_id?: string;
}

export default function Wallet() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [usdtDepositOpen, setUsdtDepositOpen] = useState(false);
  const [usdtWithdrawOpen, setUsdtWithdrawOpen] = useState(false);
  const [fiatDepositOpen, setFiatDepositOpen] = useState(false);
  const [fiatWithdrawOpen, setFiatWithdrawOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordMode, setPasswordMode] = useState<"set" | "verify">("set");
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [hasTransactionPassword, setHasTransactionPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { walletEnabled, loading: walletLoading } = useWalletEnabled();
  const [isVerified, setIsVerified] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(true);
  const [enableCny, setEnableCny] = useState(true);
  const [enableUsdt, setEnableUsdt] = useState(true);

  useEffect(() => {
    checkVerification();
  }, []);

  useEffect(() => {
    // Redirect if wallet is disabled
    if (!walletLoading && !walletEnabled) {
      navigate("/profile");
      return;
    }
    if (checkingVerification || !isVerified) return;
    checkTransactionPassword();
    fetchWallet();
    fetchTransactions();
    fetchCurrencySettings();
  }, [walletLoading, walletEnabled, navigate, checkingVerification, isVerified]);

  const fetchCurrencySettings = async () => {
    try {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["enable_wallet_cny", "enable_wallet_usdt"]);

      if (data) {
        const cnyEnabled = data.find(s => s.key === "enable_wallet_cny")?.value;
        const usdtEnabled = data.find(s => s.key === "enable_wallet_usdt")?.value;
        
        // If neither is set, default both to true
        if (cnyEnabled === undefined && usdtEnabled === undefined) {
          setEnableCny(true);
          setEnableUsdt(true);
        } else {
          setEnableCny(cnyEnabled === "true");
          setEnableUsdt(usdtEnabled === "true");
        }
      }
    } catch (error) {
      console.error("Error fetching currency settings:", error);
    }
  };

  const checkVerification = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/profile");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_real_name_verified")
        .eq("id", user.id)
        .single();

      if (!profile?.is_real_name_verified) {
        toast({
          title: "需要实名认证",
          description: "使用钱包功能前需要完成实名认证",
          variant: "destructive",
        });
        navigate("/real-name-verification");
        return;
      }

      setIsVerified(true);
    } catch (error) {
      console.error("Error checking verification:", error);
      navigate("/profile");
    } finally {
      setCheckingVerification(false);
    }
  };

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
      } else {
        // First time - prompt to set password
        setPasswordMode("set");
        setPasswordDialogOpen(true);
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

  const fetchWallet = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setWallet({
          balance: parseFloat(data.balance.toString()),
          frozen_balance: parseFloat(data.frozen_balance.toString()),
        });
      }
    } catch (error: any) {
      console.error("Error fetching wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) {
        const transactionsWithRelatedUsers = await Promise.all(
          data.map(async (t) => {
            let related_user_id: string | undefined;
            let related_user_name: string | undefined;
            let conversation_id: string | undefined;

            if (t.reference_type === "transfer" && t.reference_id) {
              const { data: transfer } = await supabase
                .from("transfers")
                .select("sender_id, receiver_id, conversation_id")
                .eq("id", t.reference_id)
                .single();

              if (transfer) {
                conversation_id = transfer.conversation_id;
                const otherUserId = t.type === "transfer_send" 
                  ? transfer.receiver_id 
                  : transfer.sender_id;
                
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("display_name")
                  .eq("id", otherUserId)
                  .single();

                related_user_id = otherUserId;
                related_user_name = profile?.display_name;
              }
            }

            return {
              ...t,
              amount: parseFloat(t.amount.toString()),
              balance_before: parseFloat(t.balance_before.toString()),
              balance_after: parseFloat(t.balance_after.toString()),
              related_user_id,
              related_user_name,
              conversation_id,
            };
          })
        );
        setTransactions(transactionsWithRelatedUsers);
      }
    } catch (error: any) {
      console.error("Error fetching transactions:", error);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "recharge":
      case "fiat_deposit":
        return <Plus className="h-5 w-5 text-green-500" />;
      case "withdraw":
      case "fiat_withdraw":
      case "withdraw_freeze":
        return <ArrowUpRight className="h-5 w-5 text-orange-500" />;
      case "red_envelope_send":
        return <Gift className="h-5 w-5 text-red-500" />;
      case "red_envelope_receive":
        return <Gift className="h-5 w-5 text-green-500" />;
      case "transfer_send":
        return <Banknote className="h-5 w-5 text-orange-500" />;
      case "transfer_receive":
        return <Banknote className="h-5 w-5 text-green-500" />;
      default:
        return <ArrowDownLeft className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      recharge: t("wallet.rechargeRecord"),
      fiat_deposit: "法币充值",
      withdraw: t("wallet.withdraw"),
      fiat_withdraw: "法币提现",
      withdraw_freeze: "提现冻结",
      red_envelope_send: t("wallet.sentRedEnvelope"),
      red_envelope_receive: t("wallet.receivedRedEnvelope"),
      transfer_send: t("transfer.sendTransfer"),
      transfer_receive: t("transfer.accept"),
      refund: t("common.error"),
      membership_purchase: t("wallet.membershipPurchase"),
      points_exchange: t("wallet.pointsExchange"),
      exchange: "兑换",
    };
    return labels[type] || type;
  };

  if (loading || checkingVerification) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border bg-card flex items-center gap-3">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold">{t("wallet.myWallet")}</h1>
      </div>

      <ScrollArea className="flex-1">
        <div className="container mx-auto p-4 max-w-2xl">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WalletIcon className="h-6 w-6" />
                {t("wallet.myWallet")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-6 text-white">
                  <p className="text-sm opacity-80 mb-2">{t("wallet.balance")}</p>
                  <p className="text-4xl font-bold mb-4">
                    ¥{wallet?.balance.toFixed(2) || "0.00"}
                  </p>
                  {wallet && wallet.frozen_balance > 0 && (
                    <p className="text-sm opacity-80">
                      {t("wallet.frozenBalance")}: ¥{wallet.frozen_balance.toFixed(2)}
                    </p>
                  )}
                </div>

                {/* Show tabs only when both are enabled */}
                {enableCny && enableUsdt ? (
                  <Tabs defaultValue="fiat" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="fiat">法币充提</TabsTrigger>
                      <TabsTrigger value="crypto">
                        <Coins className="h-4 w-4 mr-1" />
                        {t("wallet.cryptoRecharge")}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="fiat" className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          onClick={() => requirePassword(() => setFiatDepositOpen(true))}
                          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {t("wallet.recharge")}
                        </Button>
                        <Button
                          onClick={() => requirePassword(() => setFiatWithdrawOpen(true))}
                          variant="outline"
                        >
                          <ArrowUpRight className="h-4 w-4 mr-2" />
                          {t("wallet.withdraw")}
                        </Button>
                      </div>
                      <p className="text-xs text-center text-muted-foreground">
                        支持银行卡、微信、支付宝充值提现
                      </p>
                    </TabsContent>

                    <TabsContent value="crypto" className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          onClick={() => requirePassword(() => setUsdtDepositOpen(true))}
                          className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90"
                        >
                          <ArrowDownLeft className="h-4 w-4 mr-2" />
                          {t("wallet.depositUSDT")}
                        </Button>
                        <Button
                          onClick={() => requirePassword(() => setUsdtWithdrawOpen(true))}
                          variant="outline"
                          className="border-primary text-primary hover:bg-primary/10"
                        >
                          <ArrowUpRight className="h-4 w-4 mr-2" />
                          {t("wallet.withdrawUSDT")}
                        </Button>
                      </div>
                      <p className="text-xs text-center text-muted-foreground">
                        USDT自动换算汇率
                      </p>
                    </TabsContent>
                  </Tabs>
                ) : enableCny ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => requirePassword(() => setFiatDepositOpen(true))}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t("wallet.recharge")}
                      </Button>
                      <Button
                        onClick={() => requirePassword(() => setFiatWithdrawOpen(true))}
                        variant="outline"
                      >
                        <ArrowUpRight className="h-4 w-4 mr-2" />
                        {t("wallet.withdraw")}
                      </Button>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      支持银行卡、微信、支付宝充值提现
                    </p>
                  </div>
                ) : enableUsdt ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => requirePassword(() => setUsdtDepositOpen(true))}
                        className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90"
                      >
                        <ArrowDownLeft className="h-4 w-4 mr-2" />
                        {t("wallet.depositUSDT")}
                      </Button>
                      <Button
                        onClick={() => requirePassword(() => setUsdtWithdrawOpen(true))}
                        variant="outline"
                        className="border-primary text-primary hover:bg-primary/10"
                      >
                        <ArrowUpRight className="h-4 w-4 mr-2" />
                        {t("wallet.withdrawUSDT")}
                      </Button>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      USDT自动换算汇率
                    </p>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    暂无可用的充值方式
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("wallet.transactions")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t("wallet.noTransactions")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getTransactionIcon(tx.type)}
                            <div>
                              <p className="font-medium">
                                {getTransactionLabel(tx.type)}
                              </p>
                              {tx.description && (
                                <p className="text-sm text-muted-foreground">
                                  {tx.description}
                                </p>
                              )}
                              {tx.related_user_name && (
                                <p className="text-sm text-muted-foreground">
                                  {tx.type === "transfer_send" ? "转给" : "来自"}: {tx.related_user_name}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {new Date(tx.created_at).toLocaleString("zh-CN")}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className={`font-semibold ${
                                // Use balance change to determine direction (more reliable than type)
                                // For exchange type, check actual balance change
                                tx.type === "exchange" || tx.type === "points_exchange"
                                  ? (tx.balance_after - tx.balance_before >= 0 ? "text-green-500" : "text-orange-500")
                                  : (["transfer_send", "red_envelope_send", "withdraw", "fiat_withdraw", "withdraw_freeze", "membership_purchase"].includes(tx.type)
                                    ? "text-orange-500"
                                    : "text-green-500")
                              }`}
                            >
                              {tx.type === "exchange" || tx.type === "points_exchange"
                                ? (tx.balance_after - tx.balance_before >= 0 ? "+" : "-")
                                : (["transfer_send", "red_envelope_send", "withdraw", "fiat_withdraw", "withdraw_freeze", "membership_purchase"].includes(tx.type) ? "-" : "+")}
                              ¥{Math.abs(tx.amount).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("wallet.balance")}: ¥{tx.balance_after.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        {tx.related_user_id && tx.conversation_id && (
                          <div className="flex gap-2 mt-2 pt-2 border-t border-border">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => navigate(`/chat/${tx.conversation_id}`)}
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              发送消息
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => navigate(`/chat/${tx.conversation_id}?action=transfer`)}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              发起转账
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Fiat Deposit Dialog */}
          <FiatDepositDialog
            open={fiatDepositOpen}
            onOpenChange={setFiatDepositOpen}
            onSuccess={() => {
              fetchWallet();
              fetchTransactions();
            }}
          />

          {/* Fiat Withdraw Dialog */}
          <FiatWithdrawDialog
            open={fiatWithdrawOpen}
            onOpenChange={setFiatWithdrawOpen}
            currentBalance={wallet?.balance || 0}
            onSuccess={() => {
              fetchWallet();
              fetchTransactions();
            }}
          />

          {/* USDT Deposit Dialog */}
          <USDTDepositDialog
            open={usdtDepositOpen}
            onOpenChange={setUsdtDepositOpen}
            onSuccess={() => {
              fetchWallet();
              fetchTransactions();
            }}
          />

          {/* USDT Withdraw Dialog */}
          <USDTWithdrawDialog
            open={usdtWithdrawOpen}
            onOpenChange={setUsdtWithdrawOpen}
            currentBalance={wallet?.balance || 0}
            onSuccess={() => {
              fetchWallet();
              fetchTransactions();
            }}
          />

          {/* Transaction Password Dialog */}
          <TransactionPasswordDialog
            open={passwordDialogOpen}
            onOpenChange={setPasswordDialogOpen}
            mode={passwordMode}
            onSuccess={handlePasswordSuccess}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
