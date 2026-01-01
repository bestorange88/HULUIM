import { useState, useEffect } from "react";
import { Banknote, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TransferMessageProps {
  transferId: string;
  isOwn: boolean;
}

export default function TransferMessage({ transferId, isOwn }: TransferMessageProps) {
  const [transfer, setTransfer] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTransfer();
  }, [transferId]);

  const fetchTransfer = async () => {
    const { data } = await supabase
      .from("transfers")
      .select("*, sender:profiles!transfers_sender_id_fkey(display_name), receiver:profiles!transfers_receiver_id_fkey(display_name)")
      .eq("id", transferId)
      .maybeSingle();

    if (data) {
      setTransfer(data);
    }
  };

  const handleAccept = async () => {
    // Prevent duplicate submissions
    if (loading) return;
    setLoading(true);
    try {
      // 使用数据库函数接受转账（包含余额增加）
      const { data, error } = await supabase.rpc("accept_transfer_with_balance", {
        transfer_id: transferId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; new_balance?: number };
      
      if (!result.success) {
        if (result.error === "not_receiver") {
          throw new Error("您不是收款人");
        } else if (result.error === "already_processed") {
          throw new Error("转账已处理");
        }
        throw new Error(result.error || "操作失败");
      }

      toast({
        title: "收款成功",
        description: `当前余额 ¥${result.new_balance?.toFixed(2)}`,
      });

      fetchTransfer();
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "操作失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

    const handleReject = async () => {
      // Prevent duplicate submissions
      if (loading) return;
      setLoading(true);
      try {
        // Use database function to reject transfer with refund
        const { data, error } = await supabase.rpc("reject_transfer_with_refund", {
          transfer_id: transferId,
        });

        if (error) throw error;

        const result = data as { success: boolean; error?: string; refunded_amount?: number };
      
        if (!result.success) {
          if (result.error === "not_receiver") {
            throw new Error("您不是收款人");
          } else if (result.error === "already_processed") {
            throw new Error("转账已处理");
          }
          throw new Error(result.error || "操作失败");
        }

        toast({
          title: "已拒绝转账",
          description: `¥${result.refunded_amount?.toFixed(2)} 已退回给对方`,
        });

        fetchTransfer();
        setDialogOpen(false);
      } catch (error: any) {
        toast({
          title: "操作失败",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

  if (!transfer) return null;

  const isReceiver = !isOwn;
  const canAccept = isReceiver && transfer.status === "pending";

    const isAccepted = transfer.status === "accepted";
    const isRejected = transfer.status === "rejected";
    const isPending = transfer.status === "pending";

    return (
      <>
        <div
          onClick={() => setDialogOpen(true)}
          className={`rounded-2xl p-4 cursor-pointer hover:opacity-90 transition-opacity w-[min(11rem,60vw)] ${
            isRejected 
              ? "bg-gradient-to-br from-gray-400 to-gray-500 text-white" 
              : "bg-gradient-to-br from-orange-500 to-yellow-600 text-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isRejected ? "bg-white/10" : "bg-white/20"
            }`}>
              <Banknote className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">转账</p>
              <p className="text-xl font-bold">¥{transfer.amount.toFixed(2)}</p>
            </div>
            {isAccepted && (
              <Check className="h-5 w-5 flex-shrink-0" />
            )}
            {isRejected && (
              <X className="h-5 w-5 flex-shrink-0" />
            )}
          </div>
          {/* Status indicator like WeChat */}
          <div className={`mt-2 pt-2 border-t text-xs flex items-center gap-1 ${
            isRejected ? "border-white/10 text-white/70" : "border-white/20 text-white/80"
          }`}>
            {isPending && <span>待收款</span>}
            {isAccepted && <span>已被领取</span>}
            {isRejected && <span>已退还</span>}
          </div>
        </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center">转账详情</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-orange-500 to-yellow-600 flex items-center justify-center mb-4">
                <Banknote className="h-10 w-10 text-white" />
              </div>
              <p className="text-3xl font-bold mb-2">¥{transfer.amount.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">
                {transfer.sender.display_name} 转账给 {transfer.receiver.display_name}
              </p>
            </div>

            {transfer.message && (
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">留言</p>
                <p>{transfer.message}</p>
              </div>
            )}

                        <div className="bg-muted rounded-lg p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">状态</span>
                            <span className={`font-semibold ${
                              isAccepted ? "text-green-500" : isRejected ? "text-red-500" : ""
                            }`}>
                              {isPending
                                ? "待收款"
                                : isAccepted
                                ? "已收款"
                                : isRejected
                                ? "已拒绝（已退款）"
                                : "已过期"}
                            </span>
                          </div>
                          {transfer.accepted_at && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">收款时间</span>
                              <span className="text-sm">
                                {new Date(transfer.accepted_at).toLocaleString("zh-CN")}
                              </span>
                            </div>
                          )}
                          {isRejected && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">退款金额</span>
                              <span className="text-sm text-red-500">¥{transfer.amount.toFixed(2)}</span>
                            </div>
                          )}
                        </div>

            {canAccept && (
              <div className="flex gap-2">
                <Button
                  onClick={handleReject}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  拒绝
                </Button>
                <Button
                  onClick={handleAccept}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-600 hover:opacity-90"
                >
                  {loading ? "处理中..." : "确认收款"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
