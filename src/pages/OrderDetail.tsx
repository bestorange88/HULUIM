import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, Truck, MapPin, Phone } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

interface OrderDetail {
  id: string;
  product_id: string;
  points_spent: number;
  status: string;
  shipping_address: string | null;
  contact_info: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  product?: {
    name: string;
    category: string;
    image_url: string | null;
    type: string;
    description: string | null;
  };
}

export default function OrderDetail() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (orderId) {
      loadOrderDetail();
    }
  }, [orderId]);

  const loadOrderDetail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: orderData, error } = await supabase
        .from("point_orders")
        .select("*")
        .eq("id", orderId)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      if (!orderData) {
        toast.error('订单不存在');
        navigate('/my-orders');
        return;
      }

      // Load product info
      const { data: productData } = await supabase
        .from("point_products")
        .select("*")
        .eq("id", orderData.product_id)
        .single();

      setOrder({
        ...orderData,
        product: productData || undefined
      });
    } catch (error) {
      console.error("Failed to load order:", error);
      toast.error('加载订单失败');
      navigate('/my-orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; icon: any; color: string }> = {
      pending: { label: '待处理', icon: Clock, color: 'text-yellow-500' },
      processing: { label: '处理中', icon: Package, color: 'text-blue-500' },
      shipped: { label: '已发货', icon: Truck, color: 'text-cyan-500' },
      completed: { label: '已完成', icon: CheckCircle, color: 'text-green-500' },
      cancelled: { label: '已取消', icon: XCircle, color: 'text-red-500' },
    };
    return statusMap[status] || statusMap.pending;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const statusInfo = getStatusInfo(order.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card flex items-center gap-3 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/my-orders')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">订单详情</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className={`p-4 rounded-full bg-muted ${statusInfo.color}`}>
                <StatusIcon className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">{statusInfo.label}</h2>
                <p className="text-sm text-muted-foreground">
                  订单号: {order.id.slice(0, 8)}...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Info */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">商品信息</h3>
            <div className="flex gap-3">
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
              <div className="flex-1">
                <h4 className="font-medium mb-1">{order.product?.name || '商品'}</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  {order.product?.category}
                </p>
                {order.product?.description && (
                  <p className="text-xs text-muted-foreground">
                    {order.product.description}
                  </p>
                )}
              </div>
            </div>
            <Separator className="my-3" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">消耗积分</span>
              <span className="font-semibold text-lg text-primary">
                {order.points_spent} 积分
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Logistics Info (for physical products) */}
        {order.product?.type === 'physical' && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Truck className="h-5 w-5" />
                物流信息
              </h3>
              
              {order.tracking_number ? (
                <div className="space-y-3">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">物流单号</div>
                    <div className="font-mono font-medium">{order.tracking_number}</div>
                  </div>
                  
                  {order.shipped_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>已发货</span>
                      <span className="text-muted-foreground">
                        {format(new Date(order.shipped_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}
                      </span>
                    </div>
                  )}
                  
                  {order.delivered_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>已送达</span>
                      <span className="text-muted-foreground">
                        {format(new Date(order.delivered_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  商品尚未发货，请耐心等待
                </p>
              )}
              
              {order.shipping_address && (
                <>
                  <Separator className="my-3" />
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      收货地址
                    </div>
                    <div className="text-sm">{order.shipping_address}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contact Info (for virtual products) */}
        {order.product?.type === 'virtual' && order.contact_info && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Phone className="h-5 w-5" />
                账户信息
              </h3>
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="text-sm">{order.contact_info}</div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                虚拟商品将在订单处理后发放到您的账户
              </p>
            </CardContent>
          </Card>
        )}

        {/* Order Timeline */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">订单时间</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">下单时间</span>
                <span>{format(new Date(order.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}</span>
              </div>
              {order.shipped_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">发货时间</span>
                  <span>{format(new Date(order.shipped_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}</span>
                </div>
              )}
              {order.delivered_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">送达时间</span>
                  <span>{format(new Date(order.delivered_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Admin Notes */}
        {order.admin_notes && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">管理员备注</h3>
              <p className="text-sm text-muted-foreground">{order.admin_notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
