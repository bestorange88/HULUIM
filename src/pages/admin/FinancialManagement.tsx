import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, CreditCard, QrCode, Coins, Upload } from "lucide-react";

export default function FinancialManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // 法币收款渠道
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [wechatQrcode, setWechatQrcode] = useState("");
  const [alipayQrcode, setAlipayQrcode] = useState("");

  // USDT收款地址
  const [usdtAddress, setUsdtAddress] = useState("");
  const [usdtExchangeRate, setUsdtExchangeRate] = useState("7.2");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", [
          "fiat_bank_name",
          "fiat_bank_account",
          "fiat_bank_holder",
          "fiat_wechat_qrcode",
          "fiat_alipay_qrcode",
          "usdt_trc20_address",
          "usdt_exchange_rate",
        ]);

      if (error) throw error;

      if (data) {
        data.forEach((item) => {
          switch (item.key) {
            case "fiat_bank_name":
              setBankName(item.value || "");
              break;
            case "fiat_bank_account":
              setBankAccount(item.value || "");
              break;
            case "fiat_bank_holder":
              setBankHolder(item.value || "");
              break;
            case "fiat_wechat_qrcode":
              setWechatQrcode(item.value || "");
              break;
            case "fiat_alipay_qrcode":
              setAlipayQrcode(item.value || "");
              break;
            case "usdt_trc20_address":
              setUsdtAddress(item.value || "");
              break;
            case "usdt_exchange_rate":
              setUsdtExchangeRate(item.value || "7.2");
              break;
          }
        });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast({
        title: "加载失败",
        description: "无法加载财务设置",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: "fiat_bank_name", value: bankName },
        { key: "fiat_bank_account", value: bankAccount },
        { key: "fiat_bank_holder", value: bankHolder },
        { key: "fiat_wechat_qrcode", value: wechatQrcode },
        { key: "fiat_alipay_qrcode", value: alipayQrcode },
        { key: "usdt_trc20_address", value: usdtAddress },
        { key: "usdt_exchange_rate", value: usdtExchangeRate },
      ];

      // Use upsert to handle both insert and update cases
      const { error } = await supabase
        .from("platform_settings")
        .upsert(updates, { onConflict: "key" });

      if (error) throw error;

      toast({
        title: "保存成功",
        description: "财务设置已更新",
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        title: "保存失败",
        description: "无法保存财务设置",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "文件类型错误",
        description: "请选择图片文件",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "文件太大",
        description: "图片大小不能超过2MB",
        variant: "destructive",
      });
      return;
    }

    try {
      const fileName = `payment-qrcode-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      setter(publicUrl);
      toast({
        title: "上传成功",
        description: "二维码已上传",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "上传失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">财务管理</h1>
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">财务管理</h1>
          <p className="text-muted-foreground mt-2">配置收款渠道和收款地址</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "保存中..." : "保存设置"}
        </Button>
      </div>

      <Tabs defaultValue="fiat" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fiat" className="gap-2">
            <CreditCard className="h-4 w-4" />
            法币收款
          </TabsTrigger>
          <TabsTrigger value="usdt" className="gap-2">
            <Coins className="h-4 w-4" />
            USDT收款
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fiat" className="space-y-4">
          {/* 银行卡收款 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                银行卡收款
              </CardTitle>
              <CardDescription>用于法币充值的银行卡信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank-name">开户银行</Label>
                  <Input
                    id="bank-name"
                    placeholder="如：中国工商银行"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank-holder">账户名</Label>
                  <Input
                    id="bank-holder"
                    placeholder="收款人姓名"
                    value={bankHolder}
                    onChange={(e) => setBankHolder(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank-account">银行账号</Label>
                  <Input
                    id="bank-account"
                    placeholder="收款银行账号"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 微信收款 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-green-500" />
                微信收款码
              </CardTitle>
              <CardDescription>用于法币充值的微信收款二维码</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-6">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="wechat-url">二维码图片URL</Label>
                  <Input
                    id="wechat-url"
                    placeholder="输入二维码图片URL或上传图片"
                    value={wechatQrcode}
                    onChange={(e) => setWechatQrcode(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Label htmlFor="wechat-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted">
                        <Upload className="h-4 w-4" />
                        上传图片
                      </div>
                      <input
                        id="wechat-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, setWechatQrcode)}
                      />
                    </Label>
                  </div>
                </div>
                {wechatQrcode && (
                  <div className="w-32 h-32 border rounded-lg overflow-hidden">
                    <img
                      src={wechatQrcode}
                      alt="微信收款码"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 支付宝收款 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-blue-500" />
                支付宝收款码
              </CardTitle>
              <CardDescription>用于法币充值的支付宝收款二维码</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-6">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="alipay-url">二维码图片URL</Label>
                  <Input
                    id="alipay-url"
                    placeholder="输入二维码图片URL或上传图片"
                    value={alipayQrcode}
                    onChange={(e) => setAlipayQrcode(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Label htmlFor="alipay-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted">
                        <Upload className="h-4 w-4" />
                        上传图片
                      </div>
                      <input
                        id="alipay-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, setAlipayQrcode)}
                      />
                    </Label>
                  </div>
                </div>
                {alipayQrcode && (
                  <div className="w-32 h-32 border rounded-lg overflow-hidden">
                    <img
                      src={alipayQrcode}
                      alt="支付宝收款码"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usdt" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                USDT汇率设置
              </CardTitle>
              <CardDescription>设置USDT与人民币的兑换汇率</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="usdt-rate">汇率（1 USDT = ? 人民币）</Label>
                <Input
                  id="usdt-rate"
                  type="number"
                  placeholder="如：7.2"
                  value={usdtExchangeRate}
                  onChange={(e) => setUsdtExchangeRate(e.target.value)}
                  step="0.01"
                  min="0"
                />
                <p className="text-sm text-muted-foreground">
                  用户充值和提现USDT时将按此汇率换算
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                USDT TRC20 收款地址
              </CardTitle>
              <CardDescription>用于USDT充值的TRC20网络收款地址</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="usdt-address">TRC20地址</Label>
                <Input
                  id="usdt-address"
                  placeholder="T开头的34位TRC20地址"
                  value={usdtAddress}
                  onChange={(e) => setUsdtAddress(e.target.value)}
                  className="font-mono"
                />
                <p className="text-sm text-muted-foreground">
                  请确保地址正确，用户将向此地址转入USDT
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
