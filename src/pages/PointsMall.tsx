import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Search, Smartphone, Home, Car, Zap, Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import TransactionPasswordDialog from "@/components/wallet/TransactionPasswordDialog";

interface Product {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  points_required: number;
  category: string;
  type: string;
}

const quickActions = [
  { icon: Smartphone, label: "手机充值", type: "mobile_recharge" },
  { icon: Home, label: "生活缴费", type: "utilities" },
  { icon: Car, label: "交通出行", type: "transport" },
  { icon: Zap, label: "生态点", type: "gift" },
];

export default function PointsMall() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [contactInfo, setContactInfo] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingAddresses, setShippingAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [userPoints, setUserPoints] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(true);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordMode, setPasswordMode] = useState<"set" | "verify">("verify");
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    checkVerification();
  }, []);

  useEffect(() => {
    if (checkingVerification || !isVerified) return;
    loadData();
  }, [checkingVerification, isVerified]);

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
        toast.error(t("pointsMall.verificationRequired"));
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

  useEffect(() => {
    filterProducts();
  }, [searchQuery, products, selectedCategory]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load user points
      const { data: pointsData } = await supabase
        .from("user_points")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (pointsData) {
        setUserPoints(Number(pointsData.balance));
      } else {
        // Create initial points record if it doesn't exist
        await supabase.from("user_points").insert({
          user_id: user.id,
          balance: 0,
        });
        setUserPoints(0);
      }

      // Load products
      const { data: productsData } = await supabase
        .from("point_products")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (productsData) {
        setProducts(productsData.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          image_url: p.image_url,
          points_required: Number(p.points_required),
          category: p.category,
          type: p.type,
        })));
      }

      // Load shipping addresses
      const { data: addressesData } = await supabase
        .from("shipping_addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });

      if (addressesData) {
        setShippingAddresses(addressesData);
        const defaultAddress = addressesData.find(a => a.is_default);
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
        }
      }
    } catch (error) {
      console.error("Failed to load products:", error);
      toast.error(t("pointsMall.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    // Apply category filter from icon navigation
    if (selectedCategory !== "all") {
      filtered = filtered.filter(p => p.category === selectedCategory || p.type === selectedCategory);
    }
    setFilteredProducts(filtered);
  };

  const filterByCategory = (category: string) => {
    if (category === "all") return filteredProducts;
    return filteredProducts.filter(p => p.category === category);
  };

  const filterByType = (type: string) => {
    return filteredProducts.filter(p => p.type === type);
  };

  const openPurchaseDialog = (product: Product) => {
    setSelectedProduct(product);
    setContactInfo("");
    
    // For physical goods, use selected address
    if (product.category === "physical") {
      const selectedAddr = shippingAddresses.find(a => a.id === selectedAddressId);
      if (selectedAddr) {
        setShippingAddress(`${selectedAddr.province}${selectedAddr.city}${selectedAddr.district}${selectedAddr.detailed_address} ${selectedAddr.receiver_name} ${selectedAddr.phone}`);
      }
    } else {
      setShippingAddress("");
    }
    
    setPurchaseDialogOpen(true);
  };

  const handlePurchaseClick = async () => {
    if (!selectedProduct) return;

    if (selectedProduct.category === "physical" && !shippingAddress) {
      toast.error(t("pointsMall.enterShippingAddress"));
      return;
    }

    if (!contactInfo) {
      toast.error(t("pointsMall.enterContactInfo"));
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t("common.pleaseLogin"));
        return;
      }

      if (userPoints < selectedProduct.points_required) {
        toast.error(t("pointsMall.insufficientPoints"));
        return;
      }

      // Check if user has transaction password set
      const { data: profile } = await supabase
        .from("profiles")
        .select("transaction_password_hash")
        .eq("id", user.id)
        .single();

      if (!profile?.transaction_password_hash) {
        // Need to set transaction password first
        setPasswordMode("set");
        setPasswordDialogOpen(true);
      } else {
        // Verify transaction password
        setPasswordMode("verify");
        setPasswordDialogOpen(true);
      }
    } catch (error) {
      console.error("Error checking password:", error);
      toast.error("操作失败，请重试");
    }
  };

  const handlePasswordSuccess = () => {
    if (passwordMode === "set") {
      // Password just set, now verify it
      setPasswordMode("verify");
      setPasswordDialogOpen(true);
    } else {
      // Password verified, proceed with purchase
      executePurchase();
    }
  };

  const executePurchase = async () => {
    if (!selectedProduct) return;

    setPurchasing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t("common.pleaseLogin"));
        return;
      }

      // Get current points with lock check
      const { data: currentPoints } = await supabase
        .from("user_points")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      const oldBalance = Number(currentPoints?.balance || 0);
      
      if (oldBalance < selectedProduct.points_required) {
        toast.error(t("pointsMall.insufficientPoints"));
        return;
      }

      const newBalance = oldBalance - selectedProduct.points_required;

      // Deduct points
      const { error: updateError } = await supabase
        .from("user_points")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("point_orders")
        .insert({
          user_id: user.id,
          product_id: selectedProduct.id,
          points_spent: selectedProduct.points_required,
          contact_info: contactInfo,
          shipping_address: selectedProduct.category === "physical" ? shippingAddress : null,
          status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create transaction record
      await supabase.from("point_transactions").insert({
        user_id: user.id,
        type: "purchase",
        amount: -selectedProduct.points_required,
        balance_before: oldBalance,
        balance_after: newBalance,
        description: t("pointsMall.exchangeFor", { name: selectedProduct.name }),
        reference_id: order?.id,
        reference_type: "point_order",
      });

      toast.success(t("pointsMall.exchangeSuccess"));
      setPurchaseDialogOpen(false);
      setUserPoints(newBalance);
      loadData();
    } catch (error) {
      console.error("Purchase failed:", error);
      toast.error(t("pointsMall.exchangeFailed"));
    } finally {
      setPurchasing(false);
    }
  };

  if (loading || checkingVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-y-auto pb-20">
      {/* Search Bar Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-br from-primary via-blue-600 to-purple-600 text-white pb-4 pt-4 px-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm opacity-90">{t("points.myPoints")}</div>
              <div className="text-xl font-bold">{userPoints}</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/my-points')}
            className="text-white hover:bg-white/20"
          >
            {t("points.details")}
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("pointsMall.searchProducts")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border-0"
          />
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
      {/* Category Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { icon: Gift, label: "全部", value: "all" },
            { icon: Smartphone, label: "手机充值", value: "mobile_recharge" },
            { icon: Home, label: "生活缴费", value: "utilities" },
            { icon: Car, label: "交通出行", value: "transport" },
            { icon: Gift, label: "实物礼品", value: "physical" },
          ].map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.value}
                className={`flex flex-col items-center gap-1 min-w-[70px] cursor-pointer group ${
                  selectedCategory === cat.value ? 'opacity-100' : 'opacity-70'
                }`}
                onClick={() => setSelectedCategory(cat.value)}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm ${
                  selectedCategory === cat.value 
                    ? 'bg-gradient-to-br from-primary to-accent' 
                    : 'bg-gradient-to-br from-primary/10 to-accent/10'
                }`}>
                  <Icon className={`h-7 w-7 ${selectedCategory === cat.value ? 'text-white' : 'text-primary'}`} />
                </div>
                <span className={`text-xs text-center font-medium ${selectedCategory === cat.value ? 'text-primary' : ''}`}>{cat.label}</span>
              </div>
            );
          })}
        </div>

        {/* All Products Section */}

        {/* Products Tabs */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-gradient-to-b from-primary to-accent rounded-full" />
            <h2 className="text-lg font-bold">全部商品</h2>
          </div>
          
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger value="all" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white">
                全部
              </TabsTrigger>
              <TabsTrigger value="physical" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white">
                实物类
              </TabsTrigger>
              <TabsTrigger value="virtual" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white">
                虚拟商品
              </TabsTrigger>
            </TabsList>

            {['all', 'physical', 'virtual'].map((category) => (
              <TabsContent key={category} value={category} className="mt-4">
                <div className="grid grid-cols-2 gap-3">
                  {filterByCategory(category === "all" ? "all" : category).map((product) => (
                    <Card
                      key={product.id}
                      className="overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-105 group border-0 shadow-md"
                      onClick={() => openPurchaseDialog(product)}
                    >
                      {product.image_url ? (
                        <div className="relative overflow-hidden">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-36 object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        </div>
                      ) : (
                        <div className="w-full h-36 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          <span className="text-5xl">🎁</span>
                        </div>
                      )}
                      <div className="p-3 bg-gradient-to-br from-background to-muted/30">
                        <h3 className="font-semibold text-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                          {product.name}
                        </h3>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <span className="text-lg font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                              {product.points_required}
                            </span>
                            <span className="text-xs text-muted-foreground">积分</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                
                {filterByCategory(category === "all" ? "all" : category).length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="text-6xl mb-4">🛍️</div>
                    <p>暂无商品</p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>兑换商品</DialogTitle>
            <DialogDescription>
              请填写以下信息完成兑换
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">{selectedProduct?.name}</h3>
              <p className="text-sm text-muted-foreground mb-2">
                {selectedProduct?.description}
              </p>
              <p className="text-lg font-bold text-red-500">
                需要 {selectedProduct?.points_required} 积分
              </p>
              <p className="text-sm text-muted-foreground">
                当前积分：{userPoints}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                联系方式 <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="请输入手机号或其他联系方式"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
              />
            </div>

            {selectedProduct?.category === "virtual" && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  账户信息 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder={
                    selectedProduct.type === "mobile_recharge" 
                      ? "请输入需要充值的手机号码"
                      : selectedProduct.type === "utilities"
                      ? "请输入户号信息（如：水费户号、电费户号等）"
                      : "请输入相关账户信息"
                  }
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedProduct.type === "mobile_recharge" && "充值将在1-5分钟内到账"}
                  {selectedProduct.type === "utilities" && "缴费将在24小时内处理"}
                </p>
              </div>
            )}

            {selectedProduct?.category === "physical" && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  收货地址 <span className="text-red-500">*</span>
                </label>
                {shippingAddresses.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      className="w-full p-2 border rounded-md"
                      value={selectedAddressId}
                      onChange={(e) => {
                        setSelectedAddressId(e.target.value);
                        const addr = shippingAddresses.find(a => a.id === e.target.value);
                        if (addr) {
                          setShippingAddress(`${addr.province}${addr.city}${addr.district}${addr.detailed_address} ${addr.receiver_name} ${addr.phone}`);
                        }
                      }}
                    >
                      {shippingAddresses.map(addr => (
                        <option key={addr.id} value={addr.id}>
                          {addr.receiver_name} {addr.phone} - {addr.province}{addr.city}{addr.district}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/personal-info')}
                      className="w-full"
                    >
                      管理收货地址
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-sm text-muted-foreground">暂无收货地址</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/personal-info')}
                    >
                      添加收货地址
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)} disabled={purchasing}>
              取消
            </Button>
            <Button onClick={handlePurchaseClick} disabled={purchasing}>
              {purchasing ? "处理中..." : "确认兑换"}
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
