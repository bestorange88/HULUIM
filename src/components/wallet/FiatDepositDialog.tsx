import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, CheckCircle2, CreditCard, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FiatDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface PaymentChannels {
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  wechatQrcode: string;
  alipayQrcode: string;
}

export default function FiatDepositDialog({ open, onOpenChange, onSuccess }: FiatDepositDialogProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("bank");
  const [channels, setChannels] = useState<PaymentChannels>({
    bankName: "",
    bankAccount: "",
    bankHolder: "",
    wechatQrcode: "",
    alipayQrcode: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadPaymentChannels();
    }
  }, [open]);

  const loadPaymentChannels = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["fiat_bank_name", "fiat_bank_account", "fiat_bank_holder", "fiat_wechat_qrcode", "fiat_alipay_qrcode"]);

    if (data) {
      const channelMap: Record<string, string> = {};
      data.forEach((item) => {
        channelMap[item.key] = item.value || "";
      });
      setChannels({
        bankName: channelMap.fiat_bank_name || "",
        bankAccount: channelMap.fiat_bank_account || "",
        bankHolder: channelMap.fiat_bank_holder || "",
        wechatQrcode: channelMap.fiat_wechat_qrcode || "",
        alipayQrcode: channelMap.fiat_alipay_qrcode || "",
      });
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    toast({
      title: "已复制",
      description: "内容已复制到剪贴板",
    });
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmit = async () => {
    // Prevent duplicate submissions
    if (submitting) return;
    
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "请输入充值金额",
        variant: "destructive",
      });
      return;
    }

    if (parseFloat(amount) < 10) {
      toast({
        title: "最小充值金额为10元",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      const parsedAmount = parseFloat(amount);
      const methodName = paymentMethod === "bank" ? "银行卡" : paymentMethod === "wechat" ? "微信" : "支付宝";

      // 创建法币充值记录
      const { error } = await supabase
        .from("crypto_transactions")
        .insert({
          user_id: user.id,
          type: "fiat_deposit",
          amount: parsedAmount,
          usdt_amount: parsedAmount,
          trc20_address: methodName,
          status: "pending",
          review_status: "pending",
          notes: `法币充值 - ${methodName}`,
        });

      if (error) throw error;

      toast({
        title: "充值申请已提交",
        description: "请完成转账后等待管理员审核，审核通过后将自动到账",
      });

      setAmount("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Deposit error:", error);
      toast({
        title: "提交失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">法币充值</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* 充值说明 */}
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-accent">充值说明</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>请选择支付方式并转账至指定账户</li>
              <li>转账完成后提交充值申请</li>
              <li>管理员审核通过后自动到账</li>
              <li>最小充值金额：10元</li>
            </ul>
          </div>

          {/* 支付方式选择 */}
          <Tabs value={paymentMethod} onValueChange={setPaymentMethod}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="bank" className="gap-1">
                <CreditCard className="h-4 w-4" />
                银行卡
              </TabsTrigger>
              <TabsTrigger value="wechat" className="gap-1">
                <QrCode className="h-4 w-4" />
                微信
              </TabsTrigger>
              <TabsTrigger value="alipay" className="gap-1">
                <QrCode className="h-4 w-4" />
                支付宝
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bank" className="space-y-3 mt-4">
              {channels.bankName ? (
                <>
                  <div className="space-y-2">
                    <Label>开户银行</Label>
                    <div className="flex gap-2">
                      <Input value={channels.bankName} readOnly className="bg-muted" />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopy(channels.bankName, "bankName")}
                      >
                        {copied === "bankName" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>账户名</Label>
                    <div className="flex gap-2">
                      <Input value={channels.bankHolder} readOnly className="bg-muted" />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopy(channels.bankHolder, "bankHolder")}
                      >
                        {copied === "bankHolder" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>银行账号</Label>
                    <div className="flex gap-2">
                      <Input value={channels.bankAccount} readOnly className="bg-muted font-mono" />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopy(channels.bankAccount, "bankAccount")}
                      >
                        {copied === "bankAccount" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  暂未配置银行卡收款信息
                </div>
              )}
            </TabsContent>

            <TabsContent value="wechat" className="mt-4">
              {channels.wechatQrcode ? (
                <div className="flex flex-col items-center space-y-3">
                  <img
                    src={channels.wechatQrcode}
                    alt="微信收款码"
                    className="w-48 h-48 rounded-lg border"
                  />
                  <p className="text-sm text-muted-foreground">请使用微信扫描二维码付款</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  暂未配置微信收款码
                </div>
              )}
            </TabsContent>

            <TabsContent value="alipay" className="mt-4">
              {channels.alipayQrcode ? (
                <div className="flex flex-col items-center space-y-3">
                  <img
                    src={channels.alipayQrcode}
                    alt="支付宝收款码"
                    className="w-48 h-48 rounded-lg border"
                  />
                  <p className="text-sm text-muted-foreground">请使用支付宝扫描二维码付款</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  暂未配置支付宝收款码
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* 充值金额 */}
          <div className="space-y-2">
            <Label htmlFor="fiat-amount">充值金额（元）*</Label>
            <Input
              id="fiat-amount"
              type="number"
              placeholder="请输入充值金额"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="10"
              step="0.01"
            />
            <div className="grid grid-cols-4 gap-2">
              {[50, 100, 500, 1000].map((preset) => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(preset.toString())}
                >
                  ¥{preset}
                </Button>
              ))}
            </div>
          </div>

          {/* 提交按钮 */}
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
            size="lg"
          >
            {submitting ? "提交中..." : "提交充值申请"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
