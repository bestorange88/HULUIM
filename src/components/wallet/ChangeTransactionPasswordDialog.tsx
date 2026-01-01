import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Eye, EyeOff } from "lucide-react";
import { hashTransactionPassword, verifyTransactionPassword } from "@/utils/security";

interface ChangeTransactionPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasExistingPassword: boolean;
}

export default function ChangeTransactionPasswordDialog({
  open,
  onOpenChange,
  hasExistingPassword,
}: ChangeTransactionPasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    // Validate new password
    if (newPassword.length < 6) {
      toast({
        title: "新密码长度不能少于6位",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "两次输入的新密码不一致",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      // If has existing password, verify it first
      if (hasExistingPassword) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("transaction_password_hash")
          .eq("id", user.id)
          .single();

        if (!profile?.transaction_password_hash) {
          throw new Error("获取当前密码失败");
        }

        // Verify with backward compatibility for legacy formats
        const verifyResult = await verifyTransactionPassword(currentPassword, profile.transaction_password_hash);
        if (!verifyResult.isValid) {
          toast({
            title: "当前密码错误",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
      }

      // Set new password using SHA-256
      const newHash = await hashTransactionPassword(newPassword);
      const { error } = await supabase
        .from("profiles")
        .update({ transaction_password_hash: newHash })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: hasExistingPassword ? "交易密码修改成功" : "交易密码设置成功",
      });

      // Reset form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Change password error:", error);
      toast({
        title: "操作失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {hasExistingPassword ? "修改交易密码" : "设置交易密码"}
          </DialogTitle>
          <DialogDescription>
            交易密码用于保护您的资金安全，在充值、提现等操作时需要验证
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {hasExistingPassword && (
            <div className="space-y-2">
              <Label htmlFor="current-password">当前密码</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="请输入当前交易密码"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-password">
              {hasExistingPassword ? "新密码" : "交易密码"}
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="请设置6位以上交易密码"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">确认密码</Label>
            <Input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              placeholder="请再次输入新密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? "处理中..." : "确认"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
