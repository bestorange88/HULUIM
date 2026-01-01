import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Tag } from "lucide-react";
import { z } from "zod";

const groupNameSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "分组名称不能为空")
    .max(20, "分组名称不能超过20个字符")
    .regex(/^[^<>'"\\]+$/, "分组名称包含非法字符"),
  color: z.string().min(1),
});

interface FriendGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: {
    id: string;
    name: string;
    color?: string;
    icon?: string;
  } | null;
  onSuccess: () => void;
}

const colorOptions = [
  { value: "blue", label: "蓝色", color: "bg-blue-500" },
  { value: "green", label: "绿色", color: "bg-green-500" },
  { value: "red", label: "红色", color: "bg-red-500" },
  { value: "yellow", label: "黄色", color: "bg-yellow-500" },
  { value: "purple", label: "紫色", color: "bg-purple-500" },
  { value: "pink", label: "粉色", color: "bg-pink-500" },
];

export default function FriendGroupDialog({
  open,
  onOpenChange,
  group,
  onSuccess,
}: FriendGroupDialogProps) {
  const [name, setName] = useState(group?.name || "");
  const [color, setColor] = useState(group?.color || "blue");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSubmit = async () => {
    // Prevent duplicate submissions
    if (submitting) return;
    
    // Validate input using zod
    const validation = groupNameSchema.safeParse({ name, color });
    if (!validation.success) {
      toast({
        title: t("common.error"),
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      if (group) {
        // Update existing group
        const { error } = await supabase
          .from("friend_groups")
          .update({ name: name.trim(), color })
          .eq("id", group.id);

        if (error) throw error;

        toast({
          title: t("common.success"),
          description: "分组已更新",
        });
      } else {
        // Create new group
        const { error } = await supabase
          .from("friend_groups")
          .insert({
            user_id: user.id,
            name: name.trim(),
            color,
          });

        if (error) throw error;

        toast({
          title: t("common.success"),
          description: "分组已创建",
        });
      }

      setName("");
      setColor("blue");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Group operation error:", error);
      toast({
        title: t("common.error"),
        description: error.message || "操作失败",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {group ? "编辑分组" : "新建分组"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">分组名称*</Label>
            <Input
              id="group-name"
              placeholder="例如：同事、家人、好友"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <Label>分组颜色</Label>
            <div className="grid grid-cols-6 gap-2">
              {colorOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setColor(option.value)}
                  className={`h-10 w-10 rounded-lg ${option.color} flex items-center justify-center transition-transform hover:scale-110 ${
                    color === option.value ? "ring-2 ring-offset-2 ring-primary" : ""
                  }`}
                  title={option.label}
                >
                  {color === option.value && <Tag className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("common.loading") : t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
