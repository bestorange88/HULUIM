import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QrCode, Copy, ChevronRight, Settings, LogOut, User, Bell, Lock, HelpCircle, FileText, Info, Camera, Loader2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AvatarWithFrame } from "@/components/avatar/AvatarWithFrame";
import QRCode from "qrcode";
import { copyToClipboard } from "@/utils/clipboard";

export default function Profile() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    checkAuth();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser?.username) {
      generateQRCode(currentUser.username);
    }
  }, [currentUser?.username]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/auth");
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("id, user_id, username, display_name, avatar_url, bio, status, gender, birth_date, phone, avatar_frame").eq("id", user.id).single();
      setCurrentUser(profile);
    }
  };

  const generateQRCode = async (username: string) => {
    try {
      const url = await QRCode.toDataURL(username, { width: 300, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } });
      setQrCodeUrl(url);
    } catch (error) { console.error("Error generating QR code:", error); }
  };

  const handleCopyId = async () => {
    if (currentUser?.user_id) {
      const success = await copyToClipboard(currentUser.user_id);
      toast({ description: success ? "ID已复制" : "复制失败", variant: success ? "default" : "destructive" });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
    toast({ title: t("auth.logout"), description: t("common.success") });
  };

  const handleAvatarClick= () => fileInputRef.current?.click();

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "文件类型错误", description: "请选择图片文件", variant: "destructive" }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: "文件过大", description: "图片大小不能超过5MB", variant: "destructive" }); return; }
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }
    try {
      if (currentUser?.avatar_url) {
        const oldPath = currentUser.avatar_url.split("/").pop();
        if (oldPath) await supabase.storage.from("avatars").remove([user.id + "/" + oldPath]);
      }
      const fileExt = file.name.split(".").pop();
      const filePath = user.id + "/" + Date.now() + "." + fileExt;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicURL } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicURL.publicUrl }).eq("id", user.id);
      if (updateError) throw updateError;
      setCurrentUser({ ...currentUser, avatar_url: publicURL.publicUrl });
      toast({ title: "上传成功", description: "头像已更新" });
    } catch (error: any) { toast({ title: "上传失败", description: error.message, variant: "destructive" }); }
    finally { setUploading(false); }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-purple-50/30 to-white overflow-y-auto pb-20">
      <div className="px-5 pt-8 pb-6 bg-gradient-to-br from-purple-100/50 to-white relative">
        <Button variant="ghost" size="icon" onClick={() => setQrDialogOpen(true)} className="absolute top-4 right-4 z-20 bg-white/50 backdrop-blur-sm hover:bg-white/80 text-purple-600 border border-purple-100">
          <QrCode className="h-5 w-5" />
        </Button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="relative cursor-pointer" onClick={handleAvatarClick}>
              <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-purple-100">
                <AvatarWithFrame avatarUrl={currentUser?.avatar_url} displayName={currentUser?.display_name || "User"} size="xl" className="transition-all duration-300 group-hover:scale-105" />
              </div>
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                {uploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-gray-900">{currentUser?.display_name || "加载中..."}</h2>
            <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-full w-fit">
              <span className="text-xs font-mono text-purple-600">{currentUser?.user_id || "ID-------"}</span>
              <Copy className="h-3 w-3 text-purple-400 cursor-pointer hover:text-purple-600" onClick={handleCopyId} />
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 space-y-4 mt-4">
        <div>
          <div className="flex items-center gap-2 mb-3"><div className="w-1 h-5 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full" /><h3 className="font-semibold text-sm text-gray-700">账户设置</h3></div>
          <Card className="overflow-hidden shadow-sm border-purple-100">
            <button onClick={() => navigate("/personal-info")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors border-b border-purple-50">
              <div className="flex items-center gap-3"><div className="h-9 w-9 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center"><User className="h-5 w-5 text-purple-500" /></div><span className="text-sm font-medium text-gray-700">{t("profile.personalInfo")}</span></div>
              <ChevronRight className="h-5 w-5 text-purple-300" />
            </button>
            <button onClick={() => navigate("/notification-settings")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors border-b border-purple-50">
              <div className="flex items-center gap-3"><div className="h-9 w-9 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center"><Bell className="h-5 w-5 text-purple-500" /></div><span className="text-sm font-medium text-gray-700">{t("profile.notificationSettings")}</span></div>
              <ChevronRight className="h-5 w-5 text-purple-300" />
            </button>
            <button onClick={() => navigate("/privacy-security")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors border-b border-purple-50">
              <div className="flex items-center gap-3"><div className="h-9 w-9 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center"><Lock className="h-5 w-5 text-purple-500" /></div><span className="text-sm font-medium text-gray-700">{t("profile.privacySecurity")}</span></div>
              <ChevronRight className="h-5 w-5 text-purple-300" />
            </button>
            <button onClick={() => navigate("/general-settings")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors border-b border-purple-50">
              <div className="flex items-center gap-3"><div className="h-9 w-9 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center"><Settings className="h-5 w-5 text-purple-500" /></div><span className="text-sm font-medium text-gray-700">{t("profile.generalSettings")}</span></div>
              <ChevronRight className="h-5 w-5 text-purple-300" />
            </button>
            <button onClick={() => navigate("/my-favorites")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors">
              <div className="flex items-center gap-3"><div className="h-9 w-9 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg flex items-center justify-center"><Star className="h-5 w-5 text-amber-500" /></div><span className="text-sm font-medium text-gray-700">收藏夹</span></div>
              <ChevronRight className="h-5 w-5 text-purple-300" />
            </button>
          </Card>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3"><div className="w-1 h-5 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full" /><h3 className="font-semibold text-sm text-gray-700">帮助与关于</h3></div>
          <Card className="overflow-hidden shadow-sm border-purple-100">
            <button onClick={() => navigate("/help-feedback")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors border-b border-purple-50">
              <div className="flex items-center gap-3"><div className="h-9 w-9 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center"><HelpCircle className="h-5 w-5 text-purple-500" /></div><span className="text-sm font-medium text-gray-700">{t("profile.helpFeedback")}</span></div>
              <ChevronRight className="h-5 w-5 text-purple-300" />
            </button>
            <button onClick={() => navigate("/about-us")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors border-b border-purple-50">
              <div className="flex items-center gap-3"><div className="h-9 w-9 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center"><Info className="h-5 w-5 text-purple-500" /></div><span className="text-sm font-medium text-gray-700">关于我们</span></div>
              <ChevronRight className="h-5 w-5 text-purple-300" />
            </button>
            <button onClick={() => navigate("/privacy-policy")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors border-b border-purple-50">
              <div className="flex items-center gap-3"><div className="h-9 w-9 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center"><FileText className="h-5 w-5 text-purple-500" /></div><span className="text-sm font-medium text-gray-700">隐私政策</span></div>
              <ChevronRight className="h-5 w-5 text-purple-300" />
            </button>
            <button onClick={() => navigate("/terms-of-service")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors">
              <div className="flex items-center gap-3"><div className="h-9 w-9 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center"><FileText className="h-5 w-5 text-purple-500" /></div><span className="text-sm font-medium text-gray-700">用户协议</span></div>
              <ChevronRight className="h-5 w-5 text-purple-300" />
            </button>
          </Card>
        </div>
        <Card className="overflow-hidden shadow-sm border-purple-100">
          <Button onClick={handleLogout} variant="ghost" className="w-full p-4 justify-start hover:bg-purple-50/50 h-auto">
            <div className="flex items-center gap-3"><div className="h-9 w-9 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center"><LogOut className="h-5 w-5 text-gray-500" /></div><span className="text-sm font-medium text-gray-700">退出登录</span></div>
          </Button>
        </Card>
      </div>
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>我的二维码</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center py-6 space-y-4">
            {qrCodeUrl ? <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64 border-4 border-purple-100 rounded-2xl shadow-xl" /> : <div className="w-64 h-64 bg-purple-50 rounded-2xl flex items-center justify-center"><QrCode className="h-24 w-24 text-purple-300 animate-pulse" /></div>}
            <div className="text-center space-y-2 w-full">
              <h3 className="font-semibold text-lg">{currentUser?.display_name}</h3>
              <div className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 rounded-lg">
                <span className="text-sm text-gray-500">ID:</span><span className="text-sm font-mono font-semibold text-purple-600">{currentUser?.user_id || "-"}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-purple-100" onClick={handleCopyId}><Copy className="h-3 w-3" /></Button>
              </div>
              <p className="text-xs text-gray-400 pt-2">扫描二维码或搜索用户名添加好友</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
