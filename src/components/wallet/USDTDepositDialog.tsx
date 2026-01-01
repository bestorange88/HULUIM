import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";

interface USDTDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function USDTDepositDialog({ open, onOpenChange, onSuccess }: USDTDepositDialogProps) {
  const [copied, setCopied] = useState(false);
  const [usdtAmount, setUsdtAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [trc20Address, setTrc20Address] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [exchangeRate, setExchangeRate] = useState(7.2);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["usdt_trc20_address", "usdt_exchange_rate"]);

    if (data) {
      data.forEach((item) => {
        if (item.key === "usdt_trc20_address" && item.value) {
          setTrc20Address(item.value);
          generateQRCode(item.value);
        }
        if (item.key === "usdt_exchange_rate" && item.value) {
          setExchangeRate(parseFloat(item.value));
        }
      });
    }
  };

  const generateQRCode = async (address: string) => {
    try {
      const qrUrl = await QRCode.toDataURL(address, {
        width: 200,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      setQrCodeUrl(qrUrl);
    } catch (err) {
      console.error("QR code generation error:", err);
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(trc20Address);
    setCopied(true);
    toast({
      title: "已复制地址",
      description: "TRC20地址已复制到剪贴板",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const cnyAmount = usdtAmount ? (parseFloat(usdtAmount) * exchangeRate).toFixed(2) : "0.00";

  const handleSubmit = async () => {
    // Prevent duplicate submissions
    if (submitting) return;
    
    if (!usdtAmount || parseFloat(usdtAmount) <= 0) {
      toast({
        title: "请输入充值金额",
        variant: "destructive",
      });
      return;
    }

    if (parseFloat(usdtAmount) < 10) {
      toast({
        title: "最小充值金额为10 USDT",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      const usdt = parseFloat(usdtAmount);
      const cny = usdt * exchangeRate;

      // 创建充值记录
      const { error } = await supabase
        .from("crypto_transactions")
        .insert({
          user_id: user.id,
          type: "deposit",
          amount: cny, // CNY amount to credit
          usdt_amount: usdt, // USDT amount user transfers
          trc20_address: trc20Address,
          status: "pending",
          review_status: "pending",
          notes: `USDT充值 ${usdt} USDT，汇率 ${exchangeRate}`,
        });

      if (error) throw error;

      toast({
        title: "充值申请已提交",
        description: "请完成转账后等待管理员审核，审核通过后将自动到账",
      });

      setUsdtAmount("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Deposit error:", error);
      toast({
        title: "充值失败",
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
          <DialogTitle className="text-xl font-semibold">USDT TRC20 充值</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* 充值说明 */}
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 space-y-1">
            <p className="text-sm font-medium text-accent">充值说明</p>
            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
              <li>仅支持TRC20网络的USDT</li>
              <li>请向下方地址转入USDT后提交申请</li>
              <li>管理员审核通过后自动到账</li>
              <li>当前汇率：1 USDT = ¥{exchangeRate.toFixed(2)}</li>
            </ul>
          </div>

          {/* 二维码 */}
          {qrCodeUrl && (
            <div className="flex justify-center">
              <div className="p-3 bg-white rounded-lg">
                <img
                  src={qrCodeUrl}
                  alt="TRC20收款码"
                  className="w-40 h-40"
                />
              </div>
            </div>
          )}

          {/* TRC20地址 */}
          <div className="space-y-2">
            <Label className="text-sm">充值地址（TRC20网络）</Label>
            <div className="flex gap-2">
              <Input
                value={trc20Address}
                readOnly
                className="font-mono text-xs bg-muted"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyAddress}
                className="shrink-0"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* 充值金额 */}
          <div className="space-y-2">
            <Label htmlFor="usdt-amount" className="text-sm">充值金额（USDT）*</Label>
            <Input
              id="usdt-amount"
              type="number"
              placeholder="请输入USDT数量"
              value={usdtAmount}
              onChange={(e) => setUsdtAmount(e.target.value)}
              min="10"
              step="0.01"
            />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">最小：10 USDT</span>
              <span className="text-primary font-medium">≈ ¥{cnyAmount}</span>
            </div>
          </div>

          {/* 提交按钮 */}
          <Button
            onClick={handleSubmit}
            disabled={submitting || !trc20Address}
            className="w-full"
          >
            {submitting ? "提交中..." : "提交充值申请"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
