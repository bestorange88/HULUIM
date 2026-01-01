import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Globe, Palette, Type, Download, Wifi, Moon, Sun, Monitor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

export default function GeneralSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  
  const [settings, setSettings] = useState({
    language: i18n.language || "zh",
    fontSize: 16,
    autoDownloadWifi: true,
    autoDownloadMobile: false,
    dataCompression: false,
    autoPlayVoice: true,
    enterToSend: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    setSettings(prev => ({ ...prev, language: i18n.language }));
  }, [i18n.language]);

  const loadSettings = () => {
    const saved = localStorage.getItem("general_settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      setSettings(prev => ({ ...prev, ...parsed }));
      // Apply font size
      document.documentElement.style.fontSize = `${parsed.fontSize || 16}px`;
    }
  };

  const saveSettings = (newSettings: typeof settings) => {
    setSettings(newSettings);
    localStorage.setItem("general_settings", JSON.stringify(newSettings));
  };

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    saveSettings({ ...settings, language: value });
    toast({
      title: t("common.success"),
      description: value === "zh" ? "语言已切换为中文" : "Language changed to English",
    });
  };

  const handleThemeChange = (value: string) => {
    setTheme(value);
    toast({
      title: t("common.success"),
      description: t("settings.themeChanged"),
    });
  };

  const handleFontSizeChange = (value: number[]) => {
    const fontSize = value[0];
    document.documentElement.style.fontSize = `${fontSize}px`;
    saveSettings({ ...settings, fontSize });
  };

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
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
        <h1 className="text-lg font-semibold">{t("profile.generalSettings")}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Language */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t("settings.language")}
          </h2>
          <div className="p-4 rounded-lg bg-card border border-border">
            <Select
              value={settings.language}
              onValueChange={handleLanguageChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">
                  <span className="flex items-center gap-2">🇨🇳 {t("settings.chinese")}</span>
                </SelectItem>
                <SelectItem value="en">
                  <span className="flex items-center gap-2">🇺🇸 {t("settings.english")}</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Font Size */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
            <Type className="h-4 w-4" />
            {t("settings.fontSize")}
          </h2>
          <div className="p-4 rounded-lg bg-card border border-border space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t("settings.small")}</span>
              <span className="text-lg font-medium">{settings.fontSize}px</span>
              <span className="text-sm">{t("settings.large")}</span>
            </div>
            <Slider
              value={[settings.fontSize]}
              onValueChange={handleFontSizeChange}
              min={12}
              max={20}
              step={1}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground text-center" style={{ fontSize: settings.fontSize }}>
              {t("settings.previewText")}
            </p>
          </div>
        </div>

        {/* Download Settings */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-2 flex items-center gap-2">
            <Download className="h-4 w-4" />
            {t("settings.downloadSettings")}
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="autoDownloadWifi" className="text-base font-medium flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  {t("settings.autoDownloadWifi")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.autoDownloadWifiDesc")}
                </p>
              </div>
              <Switch
                id="autoDownloadWifi"
                checked={settings.autoDownloadWifi}
                onCheckedChange={(checked) =>
                  saveSettings({ ...settings, autoDownloadWifi: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="autoDownloadMobile" className="text-base font-medium">
                  {t("settings.autoDownloadMobile")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.autoDownloadMobileDesc")}
                </p>
              </div>
              <Switch
                id="autoDownloadMobile"
                checked={settings.autoDownloadMobile}
                onCheckedChange={(checked) =>
                  saveSettings({ ...settings, autoDownloadMobile: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="dataCompression" className="text-base font-medium">
                  {t("settings.dataCompression")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.dataCompressionDesc")}
                </p>
              </div>
              <Switch
                id="dataCompression"
                checked={settings.dataCompression}
                onCheckedChange={(checked) =>
                  saveSettings({ ...settings, dataCompression: checked })
                }
              />
            </div>
          </div>
        </div>

        {/* Chat Settings */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-2">
            {t("settings.chatSettings")}
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="autoPlayVoice" className="text-base font-medium">
                  {t("settings.autoPlayVoice")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.autoPlayVoiceDesc")}
                </p>
              </div>
              <Switch
                id="autoPlayVoice"
                checked={settings.autoPlayVoice}
                onCheckedChange={(checked) =>
                  saveSettings({ ...settings, autoPlayVoice: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
              <div className="flex-1 space-y-1">
                <Label htmlFor="enterToSend" className="text-base font-medium">
                  {t("settings.enterToSend")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.enterToSendDesc")}
                </p>
              </div>
              <Switch
                id="enterToSend"
                checked={settings.enterToSend}
                onCheckedChange={(checked) =>
                  saveSettings({ ...settings, enterToSend: checked })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
