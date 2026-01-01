import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DeleteAccount() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (confirmText !== "删除我的账户" || !agreedToTerms) {
      toast({
        title: "确认失败",
        description: "请完成所有确认步骤",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("未找到用户");
      }

      // 删除用户数据（通过RLS策略和级联删除自动处理）
      // 注意：实际生产环境中，您可能需要调用后端API来处理数据删除
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      
      if (deleteError) throw deleteError;

      // 登出
      await supabase.auth.signOut();

      toast({
        title: "账户已删除",
        description: "您的账户和所有数据将在30天内永久删除",
      });

      navigate("/auth");
    } catch (error) {
      console.error("删除账户失败:", error);
      toast({
        title: "删除失败",
        description: error instanceof Error ? error.message : "请稍后重试或联系客服",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDialog(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-14 border-b border-border bg-card flex items-center px-4 shadow-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="ml-3 text-lg font-semibold">删除账户</h1>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-destructive">警告：此操作不可撤销</h3>
              <p className="text-sm text-muted-foreground">
                删除账户后，您将永久失去所有数据和访问权限。请仔细阅读以下说明。
              </p>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
            <h2 className="text-lg font-semibold">删除账户将会：</h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-destructive shrink-0 mt-1.5" />
                <div>
                  <p className="font-medium">删除您的个人资料</p>
                  <p className="text-muted-foreground">包括用户名、头像、个性签名等所有个人信息</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-destructive shrink-0 mt-1.5" />
                <div>
                  <p className="font-medium">删除所有聊天记录</p>
                  <p className="text-muted-foreground">包括一对一聊天和群组消息，所有消息将无法恢复</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-destructive shrink-0 mt-1.5" />
                <div>
                  <p className="font-medium">删除好友和群组关系</p>
                  <p className="text-muted-foreground">您将从所有好友列表和群组中移除</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-destructive shrink-0 mt-1.5" />
                <div>
                  <p className="font-medium">清空钱包余额</p>
                  <p className="text-muted-foreground">请在删除账户前提现所有余额，删除后无法找回</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-destructive shrink-0 mt-1.5" />
                <div>
                  <p className="font-medium">删除所有上传文件</p>
                  <p className="text-muted-foreground">包括聊天中的图片、文件等所有上传内容</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
            <h2 className="text-lg font-semibold">删除时间线</h2>
            
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">1</div>
                  <div className="w-0.5 h-full bg-border mt-2" />
                </div>
                <div className="pb-6">
                  <p className="font-medium">立即</p>
                  <p className="text-muted-foreground">账户被禁用，无法登录</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">2</div>
                  <div className="w-0.5 h-full bg-border mt-2" />
                </div>
                <div className="pb-6">
                  <p className="font-medium">7天内</p>
                  <p className="text-muted-foreground">可以取消删除，重新激活账户</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">3</div>
                </div>
                <div>
                  <p className="font-medium">30天后</p>
                  <p className="text-muted-foreground">所有数据永久删除，无法恢复</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
            <h2 className="text-lg font-semibold">重要提醒</h2>
            
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>⚠️ 删除账户前，请确保：</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>已备份重要的聊天记录和文件</li>
                <li>已提现钱包中的所有余额</li>
                <li>已处理完所有待完成的转账</li>
                <li>已通知重要联系人您的新联系方式</li>
              </ul>
              
              <p className="mt-4">
                💡 如果您只是想暂时停止使用，可以选择注销登录而不是删除账户。
              </p>
              
              <p className="mt-4">
                📞 如有任何问题，请联系客服：support@example.com
              </p>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-card p-6">
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setShowDialog(true)}
            >
              我要删除账户
            </Button>
          </div>
        </div>
      </ScrollArea>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              最终确认
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="confirm-text" className="text-foreground">
                    请输入 <span className="font-bold text-destructive">"删除我的账户"</span> 以确认
                  </Label>
                  <Input
                    id="confirm-text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="输入确认文字"
                    className="mt-2"
                  />
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="agree"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                  />
                  <label
                    htmlFor="agree"
                    className="text-sm leading-relaxed cursor-pointer"
                  >
                    我已阅读并理解账户删除的后果，确认要永久删除我的账户和所有数据
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting || confirmText !== "删除我的账户" || !agreedToTerms}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
