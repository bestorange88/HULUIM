import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, Truck } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";

interface Order {
  id: string;
  product_id: string;
  points_spent: number;
  status: string;
  shipping_address: string | null;
  contact_info: string | null;
  created_at: string;
  product?: {
    name: string;
    category: string;
    image_url: string | null;
    type: string;
  };
}

export default function MyOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: ordersData, error } = await supabase
        .from("point_orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // 加载商品信息
      const productIds = [...new Set(ordersData?.map(o => o.product_id) || [])];
      const { data: productsData } = await supabase
        .from("point_products")
        .select("id, name, category, image_url, type")
        .in("id", productIds);

      const enrichedOrders = ordersData?.map(order => ({
        ...order,
        product: productsData?.find(p => p.id === order.product_id)
      })) || [];

      setOrders(enrichedOrders);
    } catch (error) {
      console.error("Failed to load orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      pending: { label: t("orders.pending"), variant: "secondary", icon: Clock },
      processing: { label: t("orders.processing"), variant: "default", icon: Package },
      shipped: { label: t("orders.shipped"), variant: "default", icon: Truck },
      completed: { label: t("orders.completed"), variant: "outline", icon: CheckCircle },
      cancelled: { label: t("orders.cancelled"), variant: "destructive", icon: XCircle },
    };

    const statusInfo = statusMap[status] || statusMap.pending;
    const Icon = statusInfo.icon;

    return (
      <Badge variant={statusInfo.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {statusInfo.label}
      </Badge>
    );
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === "all") return true;
    return order.status === activeTab;
  });

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card flex items-center gap-3 flex-shrink-0">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold">{t("orders.myOrders")}</h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-background px-4">
          <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
          <TabsTrigger value="pending">{t("orders.pending")}</TabsTrigger>
          <TabsTrigger value="processing">{t("orders.processing")}</TabsTrigger>
          <TabsTrigger value="shipped">{t("orders.shipped")}</TabsTrigger>
          <TabsTrigger value="completed">{t("orders.completed")}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Package className="h-16 w-16 mb-4 opacity-20" />
              <p>{t("orders.noOrders")}</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <Card 
                key={order.id} 
                className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/order-detail/${order.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    {/* Product Image */}
                    <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                      {order.product?.image_url ? (
                        <img 
                          src={order.product.image_url} 
                          alt={order.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Order Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-medium truncate">{order.product?.name || "商品"}</h3>
                        {getStatusBadge(order.status)}
                      </div>
                      
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>{t("orders.category")}: {order.product?.category}</p>
                        <p>{t("orders.pointsSpent")}: {order.points_spent}</p>
                        <p className="text-xs">
                          {format(new Date(order.created_at), "yyyy年MM月dd日 HH:mm", { locale: zhCN })}
                        </p>
                      </div>

                      {/* Additional Info */}
                      {order.product?.type === "physical" && order.shipping_address && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                          <p className="text-muted-foreground">{t("orders.shippingAddress")}:</p>
                          <p className="truncate">{order.shipping_address}</p>
                        </div>
                      )}

                      {order.product?.type === "virtual" && order.contact_info && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                          <p className="text-muted-foreground">{t("orders.accountInfo")}:</p>
                          <p className="truncate">{order.contact_info}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
