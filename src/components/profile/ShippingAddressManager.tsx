import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Trash2, Star } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ShippingAddress {
  id: string;
  receiver_name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detailed_address: string;
  is_default: boolean;
}

export default function ShippingAddressManager() {
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [editingAddress, setEditingAddress] = useState<ShippingAddress | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    receiver_name: "",
    phone: "",
    province: "",
    city: "",
    district: "",
    detailed_address: "",
  });

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("shipping_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: t("common.loadFailed"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setAddresses(data || []);
  };

  const handleOpenDialog = (address?: ShippingAddress) => {
    if (address) {
      setEditingAddress(address);
      setFormData({
        receiver_name: address.receiver_name,
        phone: address.phone,
        province: address.province,
        city: address.city,
        district: address.district,
        detailed_address: address.detailed_address,
      });
    } else {
      setEditingAddress(null);
      setFormData({
        receiver_name: "",
        phone: "",
        province: "",
        city: "",
        district: "",
        detailed_address: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.receiver_name || !formData.phone || !formData.province || !formData.city || !formData.detailed_address) {
      toast({
        title: "请填写完整信息",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      if (editingAddress) {
        const { error } = await supabase
          .from("shipping_addresses")
          .update(formData)
          .eq("id", editingAddress.id);

        if (error) throw error;
        toast({ title: t("common.updateSuccess") });
      } else {
        const { error } = await supabase
          .from("shipping_addresses")
          .insert([{ ...formData, user_id: user.id }]);

        if (error) throw error;
        toast({ title: t("common.addSuccess") });
      }

      setDialogOpen(false);
      fetchAddresses();
    } catch (error: any) {
      toast({
        title: t("common.operationFailed"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await supabase
        .from("shipping_addresses")
        .update({ is_default: false })
        .eq("user_id", user.id);

      await supabase
        .from("shipping_addresses")
        .update({ is_default: true })
        .eq("id", id);

      toast({ title: t("common.defaultSet") });
      fetchAddresses();
    } catch (error: any) {
      toast({
        title: t("common.operationFailed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("shipping_addresses")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      toast({ title: t("common.deleteSuccess") });
      fetchAddresses();
    } catch (error: any) {
      toast({
        title: t("common.operationFailed"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">收货地址</h3>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          新增地址
        </Button>
      </div>

      <div className="space-y-3">
        {addresses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>暂无收货地址</p>
          </div>
        ) : (
          addresses.map((address) => (
            <div
              key={address.id}
              className="p-4 rounded-lg border border-border bg-card space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{address.receiver_name}</span>
                    <span className="text-sm text-muted-foreground">{address.phone}</span>
                    {address.is_default && (
                      <span className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary">
                        默认
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {address.province} {address.city} {address.district} {address.detailed_address}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {!address.is_default && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetDefault(address.id)}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    设为默认
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenDialog(address)}
                >
                  编辑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteId(address.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAddress ? "编辑地址" : "新增地址"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>收货人</Label>
                <Input
                  value={formData.receiver_name}
                  onChange={(e) => setFormData({ ...formData, receiver_name: e.target.value })}
                  placeholder="请输入收货人姓名"
                />
              </div>
              <div className="space-y-2">
                <Label>手机号</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="请输入手机号"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>省份</Label>
                <Input
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  placeholder="省"
                />
              </div>
              <div className="space-y-2">
                <Label>城市</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="市"
                />
              </div>
              <div className="space-y-2">
                <Label>区县</Label>
                <Input
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  placeholder="区/县"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>详细地址</Label>
              <Input
                value={formData.detailed_address}
                onChange={(e) => setFormData({ ...formData, detailed_address: e.target.value })}
                placeholder="请输入详细地址"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个收货地址吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}