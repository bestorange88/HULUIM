import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import TransactionPasswordDialog from "@/components/wallet/TransactionPasswordDialog";

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  conversationType: "direct" | "group";
  onSent: () => void;
}

export default function TransferDialog({
  open,
  onOpenChange,
  conversationId,
  conversationType,
  onSent,
}: TransferDialogProps) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [receiver, setReceiver] = useState<any>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [hasTransactionPassword, setHasTransactionPassword] = useState(false);
  const [pendingParams, setPendingParams] = useState<{
    amount: number;
    receiverId: string;
    message: string;
  } | null>(null);
  const { toast } = useToast();

  // Check if user has transaction password set
  useEffect(() => {
    const checkTransactionPassword = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("transaction_password_hash")
        .eq("id", user.id)
        .single();

      setHasTransactionPassword(!!profile?.transaction_password_hash);
    };

    if (open) {
      checkTransactionPassword();
    }
  }, [open]);

  useEffect(() => {
    if (open && conversationType === "direct") {
      fetchReceiver();
    }
  }, [open, conversationId]);

  const fetchReceiver = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("conversation_participants")
      .select("user_id, profiles!inner(*)")
      .eq("conversation_id", conversationId)
      .neq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setReceiver(data.profiles);
    }
  };

  // Validate and open password dialog before sending
  const handleVerifyThenSend = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "请输入有效金额",
        variant: "destructive",
      });
      return;
    }

    if (conversationType === "group") {
      toast({
        title: "暂不支持群聊转账",
        description: "转账功能仅支持一对一聊天",
        variant: "destructive",
      });
      return;
    }

    if (!receiver) {
      toast({
        title: "无法获取收款人信息",
        variant: "destructive",
      });
      return;
    }

    // Store pending params and open password dialog
    setPendingParams({
      amount: parseFloat(amount),
      receiverId: receiver.id,
      message: message || "",
    });
    setPasswordDialogOpen(true);
  };

  // Actually send transfer after password verification
  const handleSendWithParams = async (params: NonNullable<typeof pendingParams>) => {
    // Prevent duplicate submissions
    if (loading) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      // 使用数据库函数发送转账（包含余额检查和扣款）
      const { data, error } = await supabase.rpc("send_transfer_with_balance", {
        p_conversation_id: conversationId,
        p_receiver_id: params.receiverId,
        p_amount: params.amount,
        p_message: params.message || null,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; transfer_id?: string };
      
      if (!result.success) {
        if (result.error === "insufficient_balance") {
          throw new Error("余额不足，请先充值");
        } else if (result.error === "wallet_not_found") {
          throw new Error("钱包未初始化");
        }
        throw new Error(result.error || "发送失败");
      }

      // 发送消息
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: `[转账]¥${params.amount}`,
        type: "text",
        media_url: result.transfer_id,
      });

      toast({
        title: "转账已发送",
        description: `已扣除余额 ¥${params.amount.toFixed(2)}`,
      });

      onSent();
      onOpenChange(false);
      setAmount("");
      setMessage("");
      setPendingParams(null);
    } catch (error: any) {
      toast({
        title: "发送失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle password verification success
  const handlePasswordSuccess = () => {
    if (pendingParams) {
      handleSendWithParams(pendingParams);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>转账{receiver ? `给 ${receiver.display_name}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>转账金额</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0.01"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label>留言（可选）</Label>
            <Textarea
              placeholder="添加转账说明"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleVerifyThenSend}
            disabled={loading}
            className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:opacity-90"
          >
            {loading ? "发送中..." : "确认转账"}
          </Button>
        </div>
      </DialogContent>

      <TransactionPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        mode={hasTransactionPassword ? "verify" : "set"}
        onSuccess={handlePasswordSuccess}
      />
    </Dialog>
  );
}
