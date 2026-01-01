import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronRight, Shield, Lock, Eye, UserX, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";

export default function PrivacySecurity() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showBlockedUsersDialog, setShowBlockedUsersDialog] = useState(false);
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [passwords, setPasswords] = useState({
    new: "",
    confirm: "",
  });
  
  const [privacy, setPrivacy] = useState({
    showOnlineStatus: true,
    allowFriendRequests: true,
    showProfileToStrangers: false,
    readReceipts: true,
  });

  useEffect(() => {
    loadPrivacySettings();
    fetchBlockedUsers();
  }, []);

  const loadPrivacySettings = () => {
    const saved = localStorage.getItem("privacy_settings");
    if (saved) {
      setPrivacy(JSON.parse(saved));
    }
  };

  const savePrivacySettings = (newSettings: typeof privacy) => {
    setPrivacy(newSettings);
    localStorage.setItem("privacy_settings", JSON.stringify(newSettings));
  };

  const fetchBlockedUsers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("friendships")
      .select(`
        id,
        friend_id,
        profiles:profiles!friendships_friend_id_fkey (
          id,
          display_name,
          username,
          avatar_url
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "blocked");

    setBlockedUsers(data || []);
  };

  const handleUnblockUser = async (friendshipId: string) => {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipId);

    if (error) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: t("common.success"),
        description: t("privacy.userUnblocked"),
      });
      fetchBlockedUsers();
    }
  };

  const handleChangePassword = async () => {
    if (passwords.new.length < 6) {
      toast({
        title: t("privacy.passwordTooShort"),
        description: t("privacy.passwordMinLength"),
        variant: "destructive",
      });
      return;
    }

    if (passwords.new !== passwords.confirm) {
      toast({
        title: t("privacy.passwordMismatch"),
        description: t("privacy.passwordMismatchDesc"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: passwords.new,
    });

    if (error) {
      toast({
        title: t("privacy.changeFailed"),
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: t("privacy.changeSuccess"),
        description: t("privacy.passwordUpdated"),
      });
      setShowPasswordDialog(false);
      setPasswords({ new: "", confirm: "" });
    }
    setLoading(false);
  };

  const handleClearChatHistory = async () => {
    // This would clear local chat cache
    localStorage.removeItem("chat_drafts");
    toast({
      title: t("common.success"),
      description: t("privacy.cacheCleared"),
    });
    setShowClearDataDialog(false);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border bg-card flex items-center gap-3 shadow-card">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold">{t("privacy.title")}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Account Security */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t("privacy.accountSecurity")}
          </h2>
          <div className="space-y-2">
            <button
              onClick={() => setShowPasswordDialog(true)}
              className="w-full p-4 rounded-lg bg-card border border-border flex items-center justify-between hover:bg-accent/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <div className="text-left">
                  <p className="font-medium">{t("privacy.changePassword")}</p>
                  <p className="text-sm text-muted-foreground">{t("privacy.changePasswordDesc")}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {t("privacy.privacySettings")}
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="showOnlineStatus" className="text-base font-medium">
                  {t("privacy.showOnlineStatus")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("privacy.showOnlineStatusDesc")}
                </p>
              </div>
              <Switch
                id="showOnlineStatus"
                checked={privacy.showOnlineStatus}
                onCheckedChange={(checked) =>
                  savePrivacySettings({ ...privacy, showOnlineStatus: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="allowFriendRequests" className="text-base font-medium">
                  {t("privacy.allowFriendRequests")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("privacy.allowFriendRequestsDesc")}
                </p>
              </div>
              <Switch
                id="allowFriendRequests"
                checked={privacy.allowFriendRequests}
                onCheckedChange={(checked) =>
                  savePrivacySettings({ ...privacy, allowFriendRequests: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="showProfileToStrangers" className="text-base font-medium">
                  {t("privacy.showProfileToStrangers")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("privacy.showProfileToStrangersDesc")}
                </p>
              </div>
              <Switch
                id="showProfileToStrangers"
                checked={privacy.showProfileToStrangers}
                onCheckedChange={(checked) =>
                  savePrivacySettings({ ...privacy, showProfileToStrangers: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="readReceipts" className="text-base font-medium">
                  {t("privacy.readReceipts")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("privacy.readReceiptsDesc")}
                </p>
              </div>
              <Switch
                id="readReceipts"
                checked={privacy.readReceipts}
                onCheckedChange={(checked) =>
                  savePrivacySettings({ ...privacy, readReceipts: checked })
                }
              />
            </div>
          </div>
        </div>

        {/* Blocked Users */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
            <UserX className="h-4 w-4" />
            {t("privacy.blockedUsers")}
          </h2>
          <button
            onClick={() => setShowBlockedUsersDialog(true)}
            className="w-full p-4 rounded-lg bg-card border border-border flex items-center justify-between hover:bg-accent/10 transition-colors"
          >
            <div className="text-left">
              <p className="font-medium">{t("privacy.manageBlockedUsers")}</p>
              <p className="text-sm text-muted-foreground">
                {blockedUsers.length} {t("privacy.blockedCount")}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Data Management */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            {t("privacy.dataManagement")}
          </h2>
          <button
            onClick={() => setShowClearDataDialog(true)}
            className="w-full p-4 rounded-lg bg-card border border-border flex items-center justify-between hover:bg-accent/10 transition-colors"
          >
            <div className="text-left">
              <p className="font-medium">{t("privacy.clearCache")}</p>
              <p className="text-sm text-muted-foreground">{t("privacy.clearCacheDesc")}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Danger Zone - Delete Account */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-destructive px-2 flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            危险操作
          </h2>
          <button
            onClick={() => navigate("/delete-account")}
            className="w-full p-4 rounded-lg bg-destructive/5 border border-destructive/20 flex items-center justify-between hover:bg-destructive/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-destructive/10 rounded-lg flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div className="text-left">
                <p className="font-medium text-destructive">删除账户</p>
                <p className="text-sm text-destructive/70">永久删除您的账户和所有数据</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-destructive" />
          </button>
        </div>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("privacy.changePassword")}</DialogTitle>
            <DialogDescription>
              {t("privacy.enterNewPassword")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new">{t("privacy.newPassword")}</Label>
              <Input
                id="new"
                type="password"
                value={passwords.new}
                onChange={(e) =>
                  setPasswords({ ...passwords, new: e.target.value })
                }
                placeholder={t("privacy.enterNewPassword")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t("privacy.confirmPassword")}</Label>
              <Input
                id="confirm"
                type="password"
                value={passwords.confirm}
                onChange={(e) =>
                  setPasswords({ ...passwords, confirm: e.target.value })
                }
                placeholder={t("privacy.confirmNewPassword")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPasswordDialog(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleChangePassword} disabled={loading}>
              {loading ? t("common.loading") : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocked Users Dialog */}
      <Dialog open={showBlockedUsersDialog} onOpenChange={setShowBlockedUsersDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("privacy.blockedUsers")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {blockedUsers.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                {t("privacy.noBlockedUsers")}
              </p>
            ) : (
              blockedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-accent/10"
                >
                  <div>
                    <p className="font-medium">{user.profiles?.display_name}</p>
                    <p className="text-sm text-muted-foreground">@{user.profiles?.username}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnblockUser(user.id)}
                  >
                    {t("privacy.unblock")}
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Data Confirmation */}
      <AlertDialog open={showClearDataDialog} onOpenChange={setShowClearDataDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("privacy.clearCache")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("privacy.clearCacheConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearChatHistory}>
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
