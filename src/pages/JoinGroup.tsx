import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Users, CheckCircle, XCircle, Clock } from "lucide-react";

interface GroupInfo {
  id: string;
  name: string | null;
  avatar_url: string | null;
  description: string | null;
  member_count: number;
  require_approval: boolean;
}

export default function JoinGroup() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [requestPending, setRequestPending] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    checkAuthAndLoadGroup();
  }, [code]);

  const checkAuthAndLoadGroup = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Store the invite code and redirect to auth
      sessionStorage.setItem("pendingInviteCode", code || "");
      navigate("/auth");
      return;
    }

    loadGroupInfo();
  };

  const loadGroupInfo = async () => {
    if (!code) {
      setError("invalid_code");
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get invite details
      const { data: invite, error: inviteError } = await supabase
        .from("group_invites")
        .select(`
          conversation_id,
          is_active,
          expires_at,
          max_uses,
          use_count,
          conversations (
            id,
            name,
            avatar_url,
            description,
            require_approval
          )
        `)
        .eq("code", code)
        .single();

      if (inviteError || !invite) {
        setError("invite_not_found");
        setLoading(false);
        return;
      }

      if (!invite.is_active) {
        setError("invite_disabled");
        setLoading(false);
        return;
      }

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        setError("invite_expired");
        setLoading(false);
        return;
      }

      if (invite.max_uses && invite.use_count >= invite.max_uses) {
        setError("invite_max_uses");
        setLoading(false);
        return;
      }

      // Check if user has a pending request
      if (user) {
        const { data: existingRequest } = await supabase
          .from("group_join_requests")
          .select("status")
          .eq("conversation_id", invite.conversation_id)
          .eq("user_id", user.id)
          .eq("status", "pending")
          .maybeSingle();

        if (existingRequest) {
          setRequestPending(true);
        }
      }

      // Get member count
      const { count } = await supabase
        .from("conversation_participants")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", invite.conversation_id);

      const conv = invite.conversations as any;
      setGroupInfo({
        id: conv.id,
        name: conv.name,
        avatar_url: conv.avatar_url,
        description: conv.description,
        member_count: count || 0,
        require_approval: conv.require_approval || false,
      });
    } catch (err) {
      setError("load_error");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!code || !groupInfo) return;
    
    setJoining(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if already a member
      const { data: existingMember } = await supabase
        .from("conversation_participants")
        .select("id")
        .eq("conversation_id", groupInfo.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingMember) {
        toast({ title: t("groups.alreadyMember") });
        navigate(`/chat/${groupInfo.id}`);
        return;
      }

      // Check if group requires approval
      if (groupInfo.require_approval) {
        // Check if already has a request
        const { data: existingRequest } = await supabase
          .from("group_join_requests")
          .select("id, status")
          .eq("conversation_id", groupInfo.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingRequest) {
          if (existingRequest.status === "pending") {
            toast({ title: t("chat.requestSubmitted") });
            setRequestPending(true);
            return;
          } else if (existingRequest.status === "rejected") {
            // Update existing rejected request to pending
            const { error: updateError } = await supabase
              .from("group_join_requests")
              .update({
                status: "pending",
                message: joinMessage || null,
                invite_code: code,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingRequest.id);

            if (updateError) throw updateError;

            setRequestPending(true);
            toast({ title: t("chat.requestPending") });
            return;
          } else if (existingRequest.status === "approved") {
            // Already approved but not a member - something went wrong, try direct join
            toast({ title: t("chat.requestApproved") });
            navigate(`/chat/${groupInfo.id}`);
            return;
          }
        }

        // Submit new join request
        const { error: requestError } = await supabase
          .from("group_join_requests")
          .insert({
            conversation_id: groupInfo.id,
            user_id: user.id,
            invite_code: code,
            message: joinMessage || null,
            status: "pending",
          });

        if (requestError) throw requestError;

        setRequestPending(true);
        toast({ title: t("chat.requestPending") });
        return;
      }

      // Direct join without approval
      const { data, error } = await supabase.rpc("join_group_via_invite", {
        invite_code: code,
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        if (result.error === "already_member") {
          toast({ title: t("groups.alreadyMember") });
          navigate(`/chat/${result.conversation_id}`);
          return;
        }
        setError(result.error);
        return;
      }

      setJoined(true);
      toast({ title: t("groups.joinedSuccess") });
      
      setTimeout(() => {
        navigate(`/chat/${result.conversation_id}`);
      }, 1500);
    } catch (err) {
      console.error("Join error:", err);
      toast({ title: t("groups.joinError"), variant: "destructive" });
    } finally {
      setJoining(false);
    }
  };

  const getErrorMessage = (err: string) => {
    const messages: Record<string, string> = {
      invite_not_found: t("groups.error.inviteNotFound"),
      invite_disabled: t("groups.error.inviteDisabled"),
      invite_expired: t("groups.error.inviteExpired"),
      invite_max_uses: t("groups.error.inviteMaxUses"),
      load_error: t("groups.error.loadError"),
      not_authenticated: t("groups.error.notAuthenticated"),
    };
    return messages[err] || t("groups.error.unknown");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t("groups.joinFailed")}</h2>
            <p className="text-muted-foreground mb-6">{getErrorMessage(error)}</p>
            <Button onClick={() => navigate("/")} variant="outline">
              {t("common.backToHome")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t("groups.joinedSuccess")}</h2>
            <p className="text-muted-foreground">{t("groups.redirecting")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (requestPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Clock className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">申请已提交</h2>
            <p className="text-muted-foreground mb-6">
              您的入群申请已提交，请等待群主或管理员审核
            </p>
            <Button onClick={() => navigate("/")} variant="outline">
              {t("common.backToHome")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={groupInfo?.avatar_url || ""} />
              <AvatarFallback className="text-2xl bg-gradient-to-br from-primary/20 to-accent/20">
                {groupInfo?.name?.[0]?.toUpperCase() || "G"}
              </AvatarFallback>
            </Avatar>
          </div>
          <CardTitle>{groupInfo?.name || t("groups.unnamedGroup")}</CardTitle>
          <CardDescription className="flex items-center justify-center gap-1">
            <Users className="h-4 w-4" />
            {t("groups.memberCount", { count: groupInfo?.member_count || 0 })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupInfo?.description && (
            <p className="text-sm text-muted-foreground text-center">
              {groupInfo.description}
            </p>
          )}
          
          {groupInfo?.require_approval && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                该群组需要审核才能加入
              </p>
              <textarea
                className="w-full px-3 py-2 border rounded-md text-sm resize-none bg-background"
                placeholder="请输入申请理由（选填）"
                rows={2}
                value={joinMessage}
                onChange={(e) => setJoinMessage(e.target.value)}
              />
            </div>
          )}
          
          <Button onClick={handleJoin} disabled={joining} className="w-full">
            {joining && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {groupInfo?.require_approval ? "提交入群申请" : t("groups.joinGroup")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}