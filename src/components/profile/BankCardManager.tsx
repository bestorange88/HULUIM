import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, CreditCard, Trash2, Star } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface BankCard {
  id: string;
  bank_name: string;
  card_number: string;
  cardholder_name: string;
  is_default: boolean;
}

export default function BankCardManager() {
  const [cards, setCards] = useState<BankCard[]>([]);
  const [editingCard, setEditingCard] = useState<BankCard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    bank_name: "",
    card_number: "",
    cardholder_name: "",
  });

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("bank_cards")
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

    setCards(data || []);
  };

  const handleOpenDialog = (card?: BankCard) => {
    if (card) {
      setEditingCard(card);
      setFormData({
        bank_name: card.bank_name,
        card_number: card.card_number,
        cardholder_name: card.cardholder_name,
      });
    } else {
      setEditingCard(null);
      setFormData({
        bank_name: "",
        card_number: "",
        cardholder_name: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.bank_name || !formData.card_number || !formData.cardholder_name) {
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
      if (editingCard) {
        const { error } = await supabase
          .from("bank_cards")
          .update(formData)
          .eq("id", editingCard.id);

        if (error) throw error;
        toast({ title: t("common.updateSuccess") });
      } else {
        const { error } = await supabase
          .from("bank_cards")
          .insert([{ ...formData, user_id: user.id }]);

        if (error) throw error;
        toast({ title: t("common.addSuccess") });
      }

      setDialogOpen(false);
      fetchCards();
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
        .from("bank_cards")
        .update({ is_default: false })
        .eq("user_id", user.id);

      await supabase
        .from("bank_cards")
        .update({ is_default: true })
        .eq("id", id);

      toast({ title: t("common.defaultSet") });
      fetchCards();
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
        .from("bank_cards")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      toast({ title: t("common.deleteSuccess") });
      fetchCards();
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

  const maskCardNumber = (cardNumber: string) => {
    if (cardNumber.length <= 8) return cardNumber;
    return cardNumber.slice(0, 4) + " **** **** " + cardNumber.slice(-4);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">银行卡管理</h3>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          添加银行卡
        </Button>
      </div>

      <div className="space-y-3">
        {cards.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>暂无银行卡</p>
          </div>
        ) : (
          cards.map((card) => (
            <div
              key={card.id}
              className="p-4 rounded-lg border border-border bg-gradient-to-br from-card to-muted/30 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <span className="font-medium">{card.bank_name}</span>
                    {card.is_default && (
                      <span className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary">
                        默认
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-mono text-muted-foreground">
                    {maskCardNumber(card.card_number)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    持卡人：{card.cardholder_name}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {!card.is_default && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetDefault(card.id)}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    设为默认
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenDialog(card)}
                >
                  编辑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteId(card.id)}
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
            <DialogTitle>{editingCard ? "编辑银行卡" : "添加银行卡"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>银行名称</Label>
              <Input
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="例如：中国工商银行"
              />
            </div>
            <div className="space-y-2">
              <Label>银行卡号</Label>
              <Input
                value={formData.card_number}
                onChange={(e) => setFormData({ ...formData, card_number: e.target.value.replace(/\s/g, '') })}
                placeholder="请输入银行卡号"
                maxLength={19}
              />
            </div>
            <div className="space-y-2">
              <Label>持卡人姓名</Label>
              <Input
                value={formData.cardholder_name}
                onChange={(e) => setFormData({ ...formData, cardholder_name: e.target.value })}
                placeholder="请输入持卡人姓名"
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
              确定要删除这张银行卡吗？此操作无法撤销。
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