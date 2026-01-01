import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Bell, MessageSquare, Users, Volume2, Vibrate, Eye, Clock, Smartphone, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { 
    isSupported, 
    isRegistered, 
    registerPushNotifications, 
    isNativePlatform,
    error: pushError 
  } = usePushNotifications();
  
  const [settings, setSettings] = useState({
    messageNotifications: true,
    friendRequests: true,
    groupInvites: true,
    soundEnabled: true,
    vibrationEnabled: true,
    showPreview: true,
    doNotDisturb: false,
    doNotDisturbStart: "22:00",
    doNotDisturbEnd: "08:00",
    mentionNotifications: true,
    groupMessageNotifications: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const saved = localStorage.getItem("notification_settings");
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  };

  const saveSettings = (newSettings: typeof settings) => {
    setSettings(newSettings);
    localStorage.setItem("notification_settings", JSON.stringify(newSettings));
  };

  const handleSave = () => {
    saveSettings(settings);
    toast({
      title: t("common.success"),
      description: t("settings.settingsSaved"),
    });
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
        <h1 className="text-lg font-semibold">{t("profile.notificationSettings")}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Native Push Notifications (only show on native platforms) */}
        {isNativePlatform && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              系统推送通知
            </h2>
            <div className="space-y-2">
              {pushError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{pushError}</AlertDescription>
                </Alert>
              )}
              <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
                <div className="flex-1 space-y-1">
                  <Label className="text-base font-medium">
                    原生推送通知
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {isRegistered 
                      ? "推送通知已启用，您将收到新消息提醒" 
                      : "启用后可在应用关闭时收到消息通知"}
                  </p>
                </div>
                {isRegistered ? (
                  <div className="flex items-center gap-2 text-green-500">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm">已启用</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await registerPushNotifications();
                      toast({
                        title: "推送通知",
                        description: "正在请求推送通知权限...",
                      });
                    }}
                  >
                    启用
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Web notification hint */}
        {!isNativePlatform && (
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription>
              系统推送通知仅在原生应用中可用。请下载安装 Alo生态 App 以获得完整通知体验。
            </AlertDescription>
          </Alert>
        )}

        {/* Message Notifications */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {t("settings.messageSection")}
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="messageNotifications" className="text-base font-medium">
                  {t("settings.messageNotifications")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.messageNotificationsDesc")}
                </p>
              </div>
              <Switch
                id="messageNotifications"
                checked={settings.messageNotifications}
                onCheckedChange={(checked) =>
                  saveSettings({ ...settings, messageNotifications: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="groupMessageNotifications" className="text-base font-medium">
                  {t("settings.groupMessageNotifications")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.groupMessageNotificationsDesc")}
                </p>
              </div>
              <Switch
                id="groupMessageNotifications"
                checked={settings.groupMessageNotifications}
                onCheckedChange={(checked) =>
                  saveSettings({ ...settings, groupMessageNotifications: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="mentionNotifications" className="text-base font-medium">
                  {t("settings.mentionNotifications")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.mentionNotificationsDesc")}
                </p>
              </div>
              <Switch
                id="mentionNotifications"
                checked={settings.mentionNotifications}
                onCheckedChange={(checked) =>
                  saveSettings({ ...settings, mentionNotifications: checked })
                }
              />
            </div>
          </div>
        </div>

        {/* Social Notifications */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t("settings.socialSection")}
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="friendRequests" className="text-base font-medium">
                  {t("settings.friendRequestsNotif")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.friendRequestsNotifDesc")}
                </p>
              </div>
              <Switch
                id="friendRequests"
                checked={settings.friendRequests}
                onCheckedChange={(checked) =>
                  saveSettings({ ...settings, friendRequests: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="groupInvites" className="text-base font-medium">
                  {t("settings.groupInvites")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.groupInvitesDesc")}
                </p>
              </div>
              <Switch
                id="groupInvites"
                checked={settings.groupInvites}
                onCheckedChange={(checked) =>
                  saveSettings({ ...settings, groupInvites: checked })
                }
              />
            </div>
          </div>
        </div>

        {/* Notification Style */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t("settings.notificationStyle")}
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="soundEnabled" className="text-base font-medium flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  {t("settings.soundEnabled")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.soundEnabledDesc")}
                </p>
              </div>
              <Switch
                id="soundEnabled"
                checked={settings.soundEnabled}
                onCheckedChange={(checked) =>
                  saveSettings({ ...settings, soundEnabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="vibrationEnabled" className="text-base font-medium flex items-center gap-2">
                  <Vibrate className="h-4 w-4" />
                  {t("settings.vibrationEnabled")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.vibrationEnabledDesc")}
                </p>
              </div>
              <Switch
                id="vibrationEnabled"
                checked={settings.vibrationEnabled}
                onCheckedChange={(checked) =>
                  saveSettings({ ...settings, vibrationEnabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="showPreview" className="text-base font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  {t("settings.showPreview")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.showPreviewDesc")}
                </p>
              </div>
              <Switch
                id="showPreview"
                checked={settings.showPreview}
                onCheckedChange={(checked) =>
                  saveSettings({ ...settings, showPreview: checked })
                }
              />
            </div>
          </div>
        </div>

        {/* Do Not Disturb */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t("settings.doNotDisturb")}
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="doNotDisturb" className="text-base font-medium">
                  {t("settings.enableDoNotDisturb")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.doNotDisturbDesc")}
                </p>
              </div>
              <Switch
                id="doNotDisturb"
                checked={settings.doNotDisturb}
                onCheckedChange={(checked) =>
                  saveSettings({ ...settings, doNotDisturb: checked })
                }
              />
            </div>

            {settings.doNotDisturb && (
              <div className="p-4 rounded-lg bg-card border border-border space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label className="text-sm">{t("settings.startTime")}</Label>
                    <Select
                      value={settings.doNotDisturbStart}
                      onValueChange={(value) =>
                        saveSettings({ ...settings, doNotDisturbStart: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={`${i.toString().padStart(2, "0")}:00`}>
                            {`${i.toString().padStart(2, "0")}:00`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="text-sm">{t("settings.endTime")}</Label>
                    <Select
                      value={settings.doNotDisturbEnd}
                      onValueChange={(value) =>
                        saveSettings({ ...settings, doNotDisturbEnd: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={`${i.toString().padStart(2, "0")}:00`}>
                            {`${i.toString().padStart(2, "0")}:00`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border bg-card">
        <Button
          onClick={handleSave}
          className="w-full bg-gradient-to-r from-primary to-accent"
        >
          {t("settings.saveSettings")}
        </Button>
      </div>
    </div>
  );
}
