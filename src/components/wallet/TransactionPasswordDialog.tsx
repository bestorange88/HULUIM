import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Eye, EyeOff } from "lucide-react";
import { hashTransactionPassword, verifyTransactionPassword } from "@/utils/security";

interface TransactionPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "set" | "verify";
  onSuccess: () => void;
}

export default function TransactionPasswordDialog({
  open,
  onOpenChange,
  mode,
  onSuccess,
}: TransactionPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSetPassword = async () => {
    if (password.length < 6) {
      toast({
        title: "密码长度不能少于6位",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "两次输入的密码不一致",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      // Use SHA-256 hashing for security
      const hash = await hashTransactionPassword(password);

      const { error } = await supabase
        .from("profiles")
        .update({ transaction_password_hash: hash })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "交易密码设置成功",
      });

      setPassword("");
      setConfirmPassword("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Set password error:", error);
      toast({
        title: "设置失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyPassword = async () => {
    if (!password) {
      toast({
        title: "请输入交易密码",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      const { data: profile } = await supabase
        .from("profiles")
        .select("transaction_password_hash")
        .eq("id", user.id)
        .single();

      if (!profile?.transaction_password_hash) {
        throw new Error("未设置交易密码");
      }

      // Verify password with backward compatibility for legacy formats
      const result = await verifyTransactionPassword(password, profile.transaction_password_hash);
      
      if (!result.isValid) {
        toast({
          title: "交易密码错误",
          variant: "destructive",
        });
        return;
      }

      // Auto-migrate legacy password formats to SHA-256
      if (result.needsMigration && result.newHash) {
        await supabase
          .from("profiles")
          .update({ transaction_password_hash: result.newHash })
          .eq("id", user.id);
        console.log("Transaction password migrated to SHA-256 format");
      }

      setPassword("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Verify password error:", error);
      toast({
        title: "验证失败",
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
            {mode === "set" ? "设置交易密码" : "验证交易密码"}
          </DialogTitle>
          {mode === "set" && (
            <DialogDescription>
              首次使用钱包功能，请设置交易密码以保护您的资金安全
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="tx-password">
              {mode === "set" ? "交易密码" : "请输入交易密码"}
            </Label>
            <div className="relative">
              <Input
                id="tx-password"
                type={showPassword ? "text" : "password"}
                placeholder={mode === "set" ? "请设置6位以上交易密码" : "请输入交易密码"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          {mode === "set" && (
            <div className="space-y-2">
              <Label htmlFor="confirm-password">确认密码</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="请再次输入交易密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          <Button
            onClick={mode === "set" ? handleSetPassword : handleVerifyPassword}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? "处理中..." : mode === "set" ? "确认设置" : "确认"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
