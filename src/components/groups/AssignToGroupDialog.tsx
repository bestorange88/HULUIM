import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, Users } from "lucide-react";

interface Group {
  id: string;
  name: string;
  color?: string;
}

interface AssignToGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemType: "conversation" | "friend";
  onSuccess: () => void;
}

export default function AssignToGroupDialog({
  open,
  onOpenChange,
  itemId,
  itemType,
  onSuccess,
}: AssignToGroupDialogProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const tableName = itemType === "conversation" ? "conversation_groups" : "friend_groups";
  const memberTableName = itemType === "conversation" ? "conversation_group_members" : "friend_group_members";
  const itemFieldName = itemType === "conversation" ? "conversation_id" : "friend_id";

  useEffect(() => {
    if (open) {
      fetchGroups();
      fetchCurrentGroups();
    }
  }, [open, itemId]);

  const fetchGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentGroups = async () => {
    try {
      if (itemType === "conversation") {
        const { data, error } = await supabase
          .from("conversation_group_members")
          .select("group_id")
          .eq("conversation_id", itemId);

        if (error) throw error;
        const groupIds = new Set(data?.map((item) => item.group_id) || []);
        setSelectedGroups(groupIds);
      } else {
        const { data, error } = await supabase
          .from("friend_group_members")
          .select("group_id")
          .eq("friend_id", itemId);

        if (error) throw error;
        const groupIds = new Set(data?.map((item) => item.group_id) || []);
        setSelectedGroups(groupIds);
      }
    } catch (error) {
      console.error("Error fetching current groups:", error);
    }
  };

  const toggleGroup = (groupId: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const handleSubmit = async () => {
    // Prevent duplicate submissions
    if (submitting) return;
    setSubmitting(true);
    try {
      // Remove all current group assignments
      if (itemType === "conversation") {
        await supabase
          .from("conversation_group_members")
          .delete()
          .eq("conversation_id", itemId);
      } else {
        await supabase
          .from("friend_group_members")
          .delete()
          .eq("friend_id", itemId);
      }

      // Add new group assignments
      if (selectedGroups.size > 0) {
        if (itemType === "conversation") {
          const inserts = Array.from(selectedGroups).map((groupId) => ({
            group_id: groupId,
            conversation_id: itemId,
          }));

          const { error } = await supabase
            .from("conversation_group_members")
            .insert(inserts);

          if (error) throw error;
        } else {
          const inserts = Array.from(selectedGroups).map((groupId) => ({
            group_id: groupId,
            friend_id: itemId,
          }));

          const { error } = await supabase
            .from("friend_group_members")
            .insert(inserts);

          if (error) throw error;
        }
      }

      toast({
        title: t("common.success"),
        description: "分组设置已更新",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating groups:", error);
      toast({
        title: t("common.error"),
        description: error.message || "操作失败",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getColorClass = (color?: string) => {
    const colorMap: Record<string, string> = {
      blue: "bg-blue-500",
      green: "bg-green-500",
      red: "bg-red-500",
      yellow: "bg-yellow-500",
      purple: "bg-purple-500",
      pink: "bg-pink-500",
    };
    return colorMap[color || "blue"] || "bg-blue-500";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {itemType === "conversation" ? <Folder className="h-5 w-5" /> : <Users className="h-5 w-5" />}
            选择分组
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : groups.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            暂无分组，请先创建分组
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => toggleGroup(group.id)}
                >
                  <Checkbox
                    checked={selectedGroups.has(group.id)}
                    onCheckedChange={() => toggleGroup(group.id)}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`w-3 h-3 rounded-full ${getColorClass(group.color)}`} />
                    <span className="font-medium">{group.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || groups.length === 0}>
            {submitting ? t("common.loading") : t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
