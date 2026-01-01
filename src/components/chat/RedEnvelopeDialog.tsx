import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";
import TransactionPasswordDialog from "@/components/wallet/TransactionPasswordDialog";

interface RedEnvelopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onSent: () => void;
}

interface GroupMember {
  user_id: string;
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    username: string;
  };
}

export default function RedEnvelopeDialog({
  open,
  onOpenChange,
  conversationId,
  onSent,
}: RedEnvelopeDialogProps) {
  const [type, setType] = useState<"fixed" | "random" | "designated">("random");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGroupConversation, setIsGroupConversation] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [hasTransactionPassword, setHasTransactionPassword] = useState(false);
  const [pendingParams, setPendingParams] = useState<{
    amount: number;
    quantity: number;
    type: "fixed" | "random" | "designated";
    message: string;
    designatedUserId: string | null;
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
    if (open) {
      checkConversationType();
    }
  }, [open, conversationId]);

  const checkConversationType = async () => {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("type")
      .eq("id", conversationId)
      .single();

    const isGroup = conversation?.type === "group";
    setIsGroupConversation(isGroup);
    
    // 群聊默认拼手气红包，私聊默认普通红包
    setType(isGroup ? "random" : "fixed");

    if (isGroup) {
      fetchGroupMembers();
    }
  };

  const fetchGroupMembers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: memberData } = await supabase
      .from("conversation_participants")
      .select(`
        user_id,
        profiles!inner (
          id,
          display_name,
          avatar_url,
          username
        )
      `)
      .eq("conversation_id", conversationId)
      .neq("user_id", user.id);

    if (memberData) {
      const formattedMembers = memberData.map((m: any) => ({
        user_id: m.user_id,
        profile: m.profiles,
      }));
      setMembers(formattedMembers);
    }
  };

  const filteredMembers = members.filter((member) =>
    member.profile.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.profile.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Validate and open password dialog before sending
  const handleVerifyThenSend = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "请输入有效金额",
        variant: "destructive",
      });
      return;
    }

    // For designated red envelope, must select a member
    if (type === "designated" && !selectedMember) {
      toast({
        title: "请选择接收人",
        variant: "destructive",
      });
      return;
    }

    const qty = type === "designated" ? 1 : (parseInt(quantity) || 1);
    if (qty <= 0) {
      toast({
        title: "请输入有效数量",
        variant: "destructive",
      });
      return;
    }

    // Store pending params and open password dialog
    setPendingParams({
      amount: parseFloat(amount),
      quantity: qty,
      type,
      message: message || "",
      designatedUserId: type === "designated" && selectedMember ? selectedMember.user_id : null,
    });
    setPasswordDialogOpen(true);
  };

  // Actually send red envelope after password verification
  const handleSendWithParams = async (params: NonNullable<typeof pendingParams>) => {
    // Prevent duplicate submissions
    if (loading) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      // Use database function to send red envelope
      const { data, error } = await supabase.rpc("send_red_envelope_with_balance", {
        p_conversation_id: conversationId,
        p_amount: params.amount,
        p_quantity: params.quantity,
        p_type: params.type,
        p_message: params.message || null,
        p_designated_user_id: params.designatedUserId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; envelope_id?: string };
      
      if (!result.success) {
        if (result.error === "insufficient_balance") {
          throw new Error("余额不足，请先充值");
        } else if (result.error === "wallet_not_found") {
          throw new Error("钱包未初始化");
        }
        throw new Error(result.error || "发送失败");
      }

      // Send message
      const contentPrefix = params.type === "designated" && params.designatedUserId
        ? `[专属红包] @${selectedMember?.profile.display_name}` 
        : "[红包]";
      
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: `${contentPrefix}${params.message || "恭喜发财，大吉大利"}`,
        type: "text",
        media_url: result.envelope_id,
      });

      toast({
        title: "红包已发送",
        description: `已扣除余额 ¥${params.amount.toFixed(2)}`,
      });

      onSent();
      onOpenChange(false);
      setAmount("");
      setQuantity("1");
      setMessage("");
      setSelectedMember(null);
      setType("fixed");
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>发红包</DialogTitle>
        </DialogHeader>

        <Tabs value={type} onValueChange={(v) => setType(v as "fixed" | "random" | "designated")}>
          <TabsList className={`grid w-full ${isGroupConversation ? "grid-cols-2" : "grid-cols-1"}`}>
            {/* 私聊只显示普通红包，群聊显示拼手气和专属红包 */}
            {!isGroupConversation && (
              <TabsTrigger value="fixed">普通红包</TabsTrigger>
            )}
            {isGroupConversation && (
              <>
                <TabsTrigger value="random">拼手气红包</TabsTrigger>
                <TabsTrigger value="designated">专属红包</TabsTrigger>
              </>
            )}
          </TabsList>

          {/* 普通红包 - 仅私聊 */}
          {!isGroupConversation && (
          <TabsContent value="fixed" className="space-y-4">
            <div className="space-y-2">
              <Label>总金额</Label>
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
              <Label>红包个数</Label>
              <Input
                type="number"
                placeholder="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label>祝福语</Label>
              <Textarea
                placeholder="恭喜发财，大吉大利"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>
          </TabsContent>
          )}

          {/* 拼手气红包 - 仅群聊 */}
          {isGroupConversation && (
          <TabsContent value="random" className="space-y-4">
            <div className="space-y-2">
              <Label>总金额</Label>
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
              <Label>红包个数</Label>
              <Input
                type="number"
                placeholder="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label>祝福语</Label>
              <Textarea
                placeholder="恭喜发财，大吉大利"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>
          </TabsContent>
          )}

          {/* 专属红包 - 仅群聊 */}
          {isGroupConversation && (
            <TabsContent value="designated" className="space-y-4">
              <div className="space-y-2">
                <Label>选择接收人</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索成员..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <ScrollArea className="h-32 border rounded-md">
                  <div className="p-2 space-y-1">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.user_id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedMember?.user_id === member.user_id
                            ? "bg-primary/20 border border-primary"
                            : "hover:bg-accent/50"
                        }`}
                        onClick={() => setSelectedMember(member)}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.profile.avatar_url || ""} />
                          <AvatarFallback>
                            {member.profile.display_name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {member.profile.display_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            @{member.profile.username}
                          </p>
                        </div>
                      </div>
                    ))}
                    {filteredMembers.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        暂无成员
                      </p>
                    )}
                  </div>
                </ScrollArea>
                {selectedMember && (
                  <p className="text-sm text-primary">
                    已选择: {selectedMember.profile.display_name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>红包金额</Label>
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
                <Label>祝福语</Label>
                <Textarea
                  placeholder="恭喜发财"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                />
              </div>
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleVerifyThenSend}
            disabled={loading || (type === "designated" && !selectedMember)}
            className="bg-gradient-to-r from-red-500 to-pink-500 hover:opacity-90"
          >
            {loading ? "发送中..." : "发送红包"}
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
