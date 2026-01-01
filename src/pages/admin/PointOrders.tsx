import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Package, Calendar, Download, Edit2 } from 'lucide-react';
import { exportToCSV } from '@/utils/exportUtils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { toast } from 'sonner';

interface PointOrder {
  id: string;
  user_id: string;
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
}

interface ExtendedOrder extends PointOrder {
  user?: {
    display_name: string;
    avatar_url: string | null;
    username: string;
  };
  product?: {
    name: string;
    category: string;
  };
}

export default function AdminPointOrders() {
  const [orders, setOrders] = useState<ExtendedOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<ExtendedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ExtendedOrder | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    let filtered = orders;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (order) =>
          order.user?.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.user?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.product?.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredOrders(filtered);
  }, [searchQuery, statusFilter, orders]);

  const loadOrders = async () => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('point_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Load users and products data
      const userIds = [...new Set(ordersData?.map((o) => o.user_id) || [])];
      const productIds = [...new Set(ordersData?.map((o) => o.product_id) || [])];

      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, username')
        .in('id', userIds);

      const { data: productsData } = await supabase
        .from('point_products')
        .select('id, name, category')
        .in('id', productIds);

      const extendedOrders = ordersData?.map((order) => ({
        ...order,
        user: usersData?.find((u) => u.id === order.user_id),
        product: productsData?.find((p) => p.id === order.product_id),
      })) || [];

      setOrders(extendedOrders);
      setFilteredOrders(extendedOrders);
    } catch (error) {
      console.error('Failed to load orders:', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('point_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;
      toast.success('订单状态已更新');
      loadOrders();
    } catch (error) {
      console.error('Failed to update order status:', error);
      toast.error('更新失败');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: '待处理', className: 'bg-yellow-500' },
      processing: { label: '处理中', className: 'bg-blue-500' },
      completed: { label: '已完成', className: 'bg-green-500' },
      cancelled: { label: '已取消', className: 'bg-gray-500' },
    };

    const config = statusConfig[status] || { label: status, className: '' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      virtual: '虚拟商品',
      physical: '实物商品',
    };
    return labels[category] || category;
  };

  const handleExport = () => {
    const exportData = filteredOrders.map(order => ({
      订单ID: order.id,
      用户: order.user?.display_name || '',
      用户名: order.user?.username || '',
      商品名称: order.product?.name || '',
      商品类型: getCategoryLabel(order.product?.category || ''),
      消耗积分: order.points_spent,
      状态: getStatusBadge(order.status).props.children,
      联系方式: order.contact_info || '',
      收货地址: order.shipping_address || '',
      物流单号: order.tracking_number || '',
      下单时间: order.created_at,
    }));
    exportToCSV(exportData, '积分订单');
    toast.success('导出成功');
  };

  const openEditDialog = (order: ExtendedOrder) => {
    setSelectedOrder(order);
    setTrackingNumber(order.tracking_number || '');
    setAdminNotes(order.admin_notes || '');
    setEditDialogOpen(true);
  };

  const handleUpdateLogistics = async () => {
    if (!selectedOrder) return;

    try {
      const updates: any = {
        tracking_number: trackingNumber,
        admin_notes: adminNotes,
        updated_at: new Date().toISOString(),
      };

      if (trackingNumber && !selectedOrder.shipped_at) {
        updates.shipped_at = new Date().toISOString();
        updates.status = 'shipped';
      }

      const { error } = await supabase
        .from('point_orders')
        .update(updates)
        .eq('id', selectedOrder.id);

      if (error) throw error;
      toast.success('物流信息已更新');
      setEditDialogOpen(false);
      loadOrders();
    } catch (error) {
      console.error('Failed to update logistics:', error);
      toast.error('更新失败');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">积分订单管理</h1>
        <p className="text-muted-foreground mt-2">管理积分商城订单</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>订单列表</CardTitle>
              <CardDescription>共 {orders.length} 个订单</CardDescription>
            </div>
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              导出数据
            </Button>
          </div>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户或商品..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="筛选状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待处理</SelectItem>
                <SelectItem value="processing">处理中</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="cancelled">已取消</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>订单ID</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead>积分消耗</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>下单时间</TableHead>
                  <TableHead>联系方式/物流</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">
                      {order.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={order.user?.avatar_url || undefined} />
                          <AvatarFallback>
                            {order.user?.display_name[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">
                            {order.user?.display_name || '未知用户'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            @{order.user?.username || ''}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {order.product?.name || '商品已删除'}
                        </div>
                        {order.product && (
                          <div className="text-xs text-muted-foreground">
                            {getCategoryLabel(order.product.category)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-red-500">
                        {order.points_spent} 积分
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(order.created_at), 'yyyy-MM-dd HH:mm', {
                          locale: zhCN,
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.contact_info ? (
                        <div className="text-sm space-y-1">
                          <div className="text-muted-foreground">
                            {order.contact_info}
                          </div>
                          {order.shipping_address && (
                            <div className="text-xs text-muted-foreground">
                              {order.shipping_address}
                            </div>
                          )}
                          {order.tracking_number && (
                            <div className="text-xs font-medium text-primary">
                              物流: {order.tracking_number}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {order.product?.category === 'physical' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(order)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Select
                          value={order.status}
                          onValueChange={(value) => updateOrderStatus(order.id, value)}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">待处理</SelectItem>
                            <SelectItem value="processing">处理中</SelectItem>
                            <SelectItem value="shipped">已发货</SelectItem>
                            <SelectItem value="completed">已完成</SelectItem>
                            <SelectItem value="cancelled">已取消</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Logistics Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑物流信息</DialogTitle>
            <DialogDescription>
              更新订单的物流单号和备注信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">物流单号</label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="输入物流单号"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">管理员备注</label>
              <Input
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="备注信息"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateLogistics}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
