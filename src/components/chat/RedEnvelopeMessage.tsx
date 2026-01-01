import { useState, useEffect } from "react";
import { Gift, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";

interface RedEnvelopeMessageProps {
  envelopeId: string;
  message: string;
  isOwn: boolean;
  conversationType?: string;
}

interface ClaimRecord {
  id: string;
  user_id: string;
  amount: number;
  claimed_at: string;
  profile?: {
    display_name: string;
    avatar_url: string | null;
  };
}

export default function RedEnvelopeMessage({ envelopeId, message, isOwn, conversationType }: RedEnvelopeMessageProps) {
  const [envelope, setEnvelope] = useState<any>(null);
  const [claimed, setClaimed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchEnvelope();
  }, [envelopeId]);

  useEffect(() => {
    if (dialogOpen && envelope) {
      fetchClaims();
    }
  }, [dialogOpen, envelope]);

  const fetchEnvelope = async () => {
    const { data } = await supabase
      .from("red_envelopes")
      .select("*")
      .eq("id", envelopeId)
      .maybeSingle();

    if (data) {
      setEnvelope(data);
      checkIfClaimed();
    }
  };

  const checkIfClaimed = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("red_envelope_claims")
      .select("*")
      .eq("red_envelope_id", envelopeId)
      .eq("user_id", user.id)
      .maybeSingle();

    setClaimed(!!data);
  };

  const fetchClaims = async () => {
    setLoadingClaims(true);
    try {
      const { data: claimsData } = await supabase
        .from("red_envelope_claims")
        .select(`
          id,
          user_id,
          amount,
          claimed_at
        `)
        .eq("red_envelope_id", envelopeId)
        .order("claimed_at", { ascending: false });

      if (claimsData && claimsData.length > 0) {
        // Fetch profiles for all claim users
        const userIds = claimsData.map(c => c.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        const claimsWithProfiles = claimsData.map(claim => ({
          ...claim,
          profile: profileMap.get(claim.user_id) as { display_name: string; avatar_url: string | null } | undefined
        }));
        
        setClaims(claimsWithProfiles);
      } else {
        setClaims([]);
      }
    } catch (error) {
      console.error("Failed to fetch claims:", error);
    } finally {
      setLoadingClaims(false);
    }
  };

  const handleClaim = async () => {
    // Prevent duplicate claims
    if (claiming) return;
    
    // Allow self-claim for group random (lucky) red envelopes
    const isGroupRandomEnvelope = envelope?.type === 'random' && conversationType === 'group';
    if (isOwn && !isGroupRandomEnvelope) {
      toast({
        title: "不能领取自己的红包",
        variant: "destructive",
      });
      return;
    }

    if (claimed) {
      toast({
        title: "已经领取过此红包",
        variant: "destructive",
      });
      return;
    }

    if (envelope?.status !== "active" || envelope?.remaining_quantity <= 0) {
      toast({
        title: "红包已被领完",
        variant: "destructive",
      });
      return;
    }

    setClaiming(true);
    try {
      // 使用数据库函数领取红包（包含余额增加）
      const { data, error } = await supabase.rpc("claim_red_envelope_with_balance", {
        envelope_id: envelopeId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; amount?: number; new_balance?: number };
      
      if (!result.success) {
        if (result.error === "already_claimed") {
          throw new Error("已经领取过此红包");
        } else if (result.error === "cannot_claim_own") {
          throw new Error("不能领取自己的红包");
        } else if (result.error === "not_available") {
          throw new Error("红包已被领完或已过期");
        } else if (result.error === "not_designated_recipient") {
          throw new Error("这是专属红包，仅限指定用户领取");
        }
        throw new Error(result.error || "领取失败");
      }

      toast({
        title: "领取成功",
        description: `恭喜获得 ¥${result.amount?.toFixed(2)}，当前余额 ¥${result.new_balance?.toFixed(2)}`,
      });

      fetchEnvelope();
      fetchClaims();
      setClaimed(true);
    } catch (error: any) {
      toast({
        title: "领取失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
    }
  };

  // Find max claim amount for "手气最佳" indicator
  const maxClaimAmount = claims.length > 0 ? Math.max(...claims.map(c => c.amount)) : 0;
  const claimedCount = envelope ? (envelope.quantity - envelope.remaining_quantity) : 0;

  if (!envelope) return null;

  return (
    <>
      <div
        onClick={() => setDialogOpen(true)}
        className="bg-gradient-to-br from-red-500 to-pink-600 text-white rounded-2xl p-4 cursor-pointer hover:opacity-90 transition-opacity w-[min(200px,70vw)]"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <Gift className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{message.replace("[红包]", "").replace("[专属红包]", "") || "恭喜发财"}</p>
            <p className="text-sm text-white/80">
              {envelope.type === "designated" ? "专属红包" : envelope.type === "fixed" ? "普通红包" : "拼手气红包"}
            </p>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-white/20 text-xs text-white/70 flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span>已领取 {claimedCount}/{envelope.quantity}</span>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">红包详情</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center mb-4">
                <Gift className="h-10 w-10 text-white" />
              </div>
              <p className="text-lg font-semibold mb-2">
                {message.replace("[红包]", "").replace("[专属红包]", "") || "恭喜发财"}
              </p>
              <p className="text-sm text-muted-foreground">
                {envelope.type === "designated" ? "专属红包" : envelope.type === "fixed" ? "普通红包" : "拼手气红包"}
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">总金额</span>
                <span className="font-semibold">¥{envelope.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">红包个数</span>
                <span className="font-semibold">{envelope.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">已领取</span>
                <span className="font-semibold text-green-500">
                  {claimedCount}/{envelope.quantity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">状态</span>
                <span className="font-semibold">
                  {envelope.status === "active" && envelope.remaining_quantity > 0
                    ? "可领取"
                    : envelope.status === "claimed" || envelope.remaining_quantity === 0
                    ? "已领完"
                    : "已过期"}
                </span>
              </div>
            </div>

            {/* 领取记录列表 */}
            {claims.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">领取记录</span>
                  <span className="text-xs text-muted-foreground">{claims.length}人已领取</span>
                </div>
                <ScrollArea className="h-40 border rounded-lg">
                  <div className="p-2 space-y-2">
                    {claims.map((claim) => (
                      <div key={claim.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={claim.profile?.avatar_url || ""} />
                          <AvatarFallback>
                            {claim.profile?.display_name?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {claim.profile?.display_name || "用户"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(claim.claimed_at), "MM-dd HH:mm")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-primary">
                            ¥{claim.amount.toFixed(2)}
                          </p>
                          {/* 拼手气红包显示手气最佳 */}
                          {envelope.type === "random" && claim.amount === maxClaimAmount && claims.length > 1 && (
                            <span className="text-xs text-orange-500 font-medium">手气最佳</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {loadingClaims && claims.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-4">
                加载中...
              </div>
            )}

            {!loadingClaims && claims.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-4">
                暂无人领取
              </div>
            )}

            {/* Show button for non-owners OR for group random red envelopes (owner can also claim) */}
            {(!isOwn || (envelope.type === 'random' && conversationType === 'group')) && (
              <Button
                onClick={handleClaim}
                disabled={
                  claiming ||
                  claimed ||
                  envelope.status !== "active" ||
                  envelope.remaining_quantity <= 0
                }
                className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:opacity-90"
              >
                {claiming
                  ? "领取中..."
                  : claimed
                  ? "已领取"
                  : envelope.status !== "active" || envelope.remaining_quantity <= 0
                  ? "红包已领完"
                  : "开红包"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
