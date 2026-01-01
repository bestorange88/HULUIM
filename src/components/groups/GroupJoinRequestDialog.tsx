import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Check, X, Clock, MessageSquare } from "lucide-react";

interface JoinRequest {
  id: string;
  user_id: string;
  message: string | null;
  status: string;
  created_at: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface GroupJoinRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export function GroupJoinRequestDialog({
  open,
  onOpenChange,
  conversationId,
}: GroupJoinRequestDialogProps) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadRequests();
    }
  }, [open, conversationId]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("group_join_requests")
        .select(`
          *,
          profiles!group_join_requests_user_id_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("conversation_id", conversationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRequests(data || []);
    } catch (error) {
      console.error("Error loading join requests:", error);
      toast.error("加载申请列表失败");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string, userId: string) => {
    // Prevent duplicate submissions
    if (processing === requestId) return;
    
    try {
      setProcessing(requestId);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update request status
      const { error: updateError } = await supabase
        .from("group_join_requests")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // Add user to group
      const { error: addError } = await supabase
        .from("conversation_participants")
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          role: "member",
        });

      if (addError) throw addError;

      toast.success("已通过申请");
      loadRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      toast.error("操作失败");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    // Prevent duplicate submissions
    if (processing === requestId) return;
    
    try {
      setProcessing(requestId);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("group_join_requests")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      toast.success("已拒绝申请");
      loadRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error("操作失败");
    } finally {
      setProcessing(null);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            进群申请
            {requests.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {requests.length}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              加载中...
            </div>
          ) : requests.length === 0 ? (
            <div className="py-8 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">暂无待处理申请</p>
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {requests.map((request) => (
                <Card key={request.id} className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={request.profiles.avatar_url || ""} />
                      <AvatarFallback>
                        {request.profiles.display_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {request.profiles.display_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        @{request.profiles.username}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(request.created_at)}
                      </div>
                    </div>
                  </div>

                  {request.message && (
                    <div className="mb-3 p-2 bg-muted rounded-md text-sm flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">
                        {request.message}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleApprove(request.id, request.user_id)}
                      disabled={processing === request.id}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      通过
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleReject(request.id)}
                      disabled={processing === request.id}
                    >
                      <X className="h-4 w-4 mr-1" />
                      拒绝
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
