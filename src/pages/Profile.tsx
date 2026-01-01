import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import profileBg from "@/assets/profile-bg.png";
import profileInfoBg from "@/assets/profile-info-bg.png";
import membershipElite from "@/assets/membership-elite.png";
import membershipGold from "@/assets/membership-gold.png";
import membershipDiamond from "@/assets/membership-diamond.png";
import pointsMallBanner from "@/assets/points-mall-banner.jpg";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  QrCode, 
  Copy, 
  Wallet, 
  Gift, 
  CreditCard, 
  Truck, 
  Package, 
  CheckCircle as CheckCircleIcon,
  Star,
  Shield,
  ChevronRight,
  Settings,
  LogOut,
  User,
  Bell,
  Lock,
  HelpCircle,
  ExternalLink,
  FileText,
  Info,
  Trash2,
  Camera,
  Sparkles,
  Loader2,
  Download,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWalletEnabled } from "@/hooks/useWalletEnabled";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AvatarWithFrame } from "@/components/avatar/AvatarWithFrame";
import { AvatarFrameSelector } from "@/components/avatar/AvatarFrameSelector";
import QRCode from "qrcode";
import { copyToClipboard } from "@/utils/clipboard";

export default function Profile() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [membership, setMembership] = useState<any>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [frameDialogOpen, setFrameDialogOpen] = useState(false);
  const [officialWebsiteUrl, setOfficialWebsiteUrl] = useState<string>("https://k3.hualinup.com/");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
    const [uploading, setUploading] = useState(false);
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { walletEnabled } = useWalletEnabled();

  useEffect(() => {
    checkAuth();
    fetchCurrentUser();
    fetchPlatformSettings();
  }, []);

  useEffect(() => {
    if (currentUser?.username) {
      generateQRCode(currentUser.username);
    }
  }, [currentUser?.username]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, user_id, username, display_name, avatar_url, bio, status, gender, birth_date, phone, invite_code, avatar_frame")
        .eq("id", user.id)
        .single();
      setCurrentUser(profile);

      // Fetch wallet balance
      if (walletEnabled) {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", user.id)
          .single();
        if (wallet) {
          setWalletBalance(Number(wallet.balance));
        }
      }

      // Fetch points balance
      const { data: points } = await supabase
        .from("user_points")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (points) {
        setPointsBalance(Number(points.balance));
      } else {
        // Create initial points record if it doesn't exist
        await supabase.from("user_points").insert({
          user_id: user.id,
          balance: 0,
        });
        setPointsBalance(0);
      }

      // Fetch active membership
      const { data: membershipData } = await supabase
        .from("user_memberships")
        .select(`
          *,
          tier:membership_tiers(*)
        `)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("purchased_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membershipData) {
        setMembership(membershipData);
      }
    }
  };

  const fetchPlatformSettings = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("*")
      .eq("key", "official_website_url")
      .maybeSingle();
    
    if (data?.value) {
      setOfficialWebsiteUrl(data.value);
    }
  };

  const generateQRCode = async (username: string) => {
    try {
      const url = await QRCode.toDataURL(username, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(url);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleCopyId = async () => {
    if (currentUser?.user_id) {
      const success = await copyToClipboard(currentUser.user_id);
      if (success) {
        toast({ description: "ID已复制" });
      } else {
        toast({ description: "复制失败，请手动复制", variant: "destructive" });
      }
    }
  };

  const handleCopyUserId = async () => {
    if (currentUser?.user_id) {
      const success = await copyToClipboard(currentUser.user_id);
      if (success) {
        toast({ description: "ID已复制" });
      } else {
        toast({ description: "复制失败，请手动复制", variant: "destructive" });
      }
    }
  };

  const handleCopyInviteCode = async () => {
    if (currentUser?.invite_code) {
      const success = await copyToClipboard(currentUser.invite_code);
      if (success) {
        toast({ description: "邀请码已复制" });
      } else {
        toast({ description: "复制失败，请手动复制", variant: "destructive" });
      }
    }
  };

    const handleLogout = async () => {
      await supabase.auth.signOut();
      navigate("/auth");
      toast({
        title: t("auth.logout"),
        description: t("common.success"),
      });
    };

    const handleCheckUpdate = async () => {
      setCheckingUpdate(true);
      try {
        const currentVersion = "1.0.30";
        const response = await fetch('/version.json?t=' + Date.now());
        if (!response.ok) {
          throw new Error('无法获取版本信息');
        }
        const data = await response.json();
      
        if (data.version && data.version !== currentVersion) {
          toast({
            title: "发现新版本",
            description: `新版本 ${data.version} 可用，点击下载更新`,
          });
          if (data.downloadUrl) {
            window.open(data.downloadUrl, '_blank');
          }
        } else {
          toast({
            title: "已是最新版本",
            description: `当前版本 ${currentVersion} 已是最新`,
          });
        }
      } catch (error) {
        console.error('Check update error:', error);
        toast({
          title: "检查更新失败",
          description: "请检查网络连接后重试",
          variant: "destructive",
        });
      } finally {
        setCheckingUpdate(false);
      }
    };

    const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "文件类型错误",
        description: "请选择图片文件",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "文件过大",
        description: "图片大小不能超过5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      return;
    }

    try {
      // Delete old avatar if exists
      if (currentUser?.avatar_url) {
        const oldPath = currentUser.avatar_url.split("/").pop();
        if (oldPath) {
          await supabase.storage
            .from("avatars")
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicURL } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicURL.publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setCurrentUser({ ...currentUser, avatar_url: publicURL.publicUrl });
      toast({
        title: "上传成功",
        description: "头像已更新",
      });
    } catch (error: any) {
      toast({
        title: "上传失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-y-auto pb-20">
      {/* Upper Section: User Info with Premium Background */}
      <div 
        className="relative h-[180px] overflow-hidden flex-shrink-0"
        style={{
          backgroundImage: `url(${profileInfoBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
        
        {/* Decorative animated circles */}
        <div className="absolute top-10 right-20 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 left-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        {/* Sparkle effects */}
        <div className="absolute top-8 left-1/4 w-2 h-2 bg-white/80 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
        <div className="absolute top-16 right-1/3 w-1.5 h-1.5 bg-white/60 rounded-full animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
        <div className="absolute bottom-12 left-1/3 w-2 h-2 bg-white/70 rounded-full animate-ping" style={{ animationDuration: '2.5s', animationDelay: '1s' }} />
        
        {/* QR Code Button - Top Right with animation */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setQrDialogOpen(true)}
          className="absolute top-10 right-4 z-20 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border border-white/20 hover:scale-110 transition-all duration-300 hover:rotate-12 animate-fade-in"
        >
          <QrCode className="h-5 w-5" />
        </Button>

        {/* Hidden file input for avatar upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />

        {/* Content - Left Aligned with entrance animation */}
        <div className="relative h-full flex items-start pt-10 px-5 z-10 animate-fade-in">
          {/* Avatar with Frame Selection - larger size */}
          <div className="relative group mr-4">
            {/* Multi-layer glow effects */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/50 to-accent/50 rounded-full blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500 scale-110" />
            
            {/* Main avatar - clickable for upload */}
            <div 
              className="relative cursor-pointer"
              onClick={handleAvatarClick}
            >
              <AvatarWithFrame
                avatarUrl={currentUser?.avatar_url}
                displayName={currentUser?.display_name || "User"}
                frameStyle={currentUser?.avatar_frame || "none"}
                size="xl"
                className="relative transition-all duration-300 group-hover:scale-105 shadow-2xl"
              />
              
              {/* Upload overlay */}
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </div>
            </div>
            
            {/* Frame edit button - small elegant style */}
            <button
              className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200 border border-white/50"
              onClick={(e) => {
                e.stopPropagation();
                setFrameDialogOpen(true);
              }}
            >
              <Sparkles className="h-3 w-3 text-white" />
            </button>
          </div>

          {/* Right side - Name, Membership, ID */}
          <div className="flex flex-col gap-1 pt-2">
            {/* Name - large size */}
            <h2 className="text-2xl font-bold text-white drop-shadow-2xl">
              {currentUser?.display_name || "加载中..."}
            </h2>

            {/* Membership Badge */}
            {membership && (
              <Badge className="w-fit bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-white border-0 shadow-xl px-2 py-0.5 text-xs">
                <span className="flex items-center gap-1">
                  <span>👑</span>
                  {membership.tier.name}
                </span>
              </Badge>
            )}

            {/* Username - minimal compact style - now shows ALO ID */}
            <div className="flex items-center gap-0.5 bg-black/20 backdrop-blur-sm px-1 rounded-full border border-white/15 w-fit">
              <span className="text-[10px] font-mono text-white/70">
                {currentUser?.user_id || "ALO-------"}
              </span>
              <Copy 
                className="h-2.5 w-2.5 text-white/50 cursor-pointer hover:text-white/80" 
                onClick={handleCopyUserId}
              />
            </div>
          </div>
        </div>
        
        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background via-background/50 to-transparent" />
      </div>

      {/* Membership Center Card - Overlaps with upper section */}
      <div className="px-4 -mt-4 relative z-10 flex-shrink-0 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <Card 
          className={`relative overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:-translate-y-1 border-0 rounded-2xl group ${
            membership?.tier?.name === '至尊会员'
              ? 'bg-gradient-to-br from-black via-gray-900 to-black'
              : membership?.tier?.name === '钻石会员'
              ? 'bg-gradient-to-br from-black via-blue-950 to-black'
              : membership?.tier?.name === '黄金会员'
              ? 'bg-gradient-to-br from-black via-amber-900/30 to-black'
              : 'bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900'
          }`}
          style={{ minHeight: '120px' }}
          onClick={() => navigate('/referral')}
        >
          {/* Animated gradient overlay */}
          <div className={`absolute inset-0 rounded-2xl opacity-60 group-hover:opacity-80 transition-opacity duration-500 ${
            membership?.tier?.name === '至尊会员'
              ? 'bg-gradient-to-br from-purple-600/30 via-fuchsia-700/30 to-purple-900/30'
              : membership?.tier?.name === '钻石会员'
              ? 'bg-gradient-to-br from-cyan-600/30 via-blue-700/30 to-blue-900/30'
              : membership?.tier?.name === '黄金会员'
              ? 'bg-gradient-to-br from-yellow-600/30 via-orange-700/30 to-amber-900/30'
              : 'bg-gradient-to-br from-gray-600/30 via-slate-700/30 to-gray-900/30'
          }`} />

          {/* Shimmer effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          
          {/* Decorative corner accents */}
          <div className="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-white/10 to-transparent rounded-tl-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-tl from-white/10 to-transparent rounded-br-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Badge Icon - Top Right with membership images */}
          <div className="absolute top-3 right-3 z-20 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 filter drop-shadow-2xl">
            {membership?.tier?.name === '至尊会员' ? (
              <img src={membershipElite} alt="至尊会员" className="w-16 h-16 object-contain animate-pulse" />
            ) : membership?.tier?.name === '钻石会员' ? (
              <img src={membershipDiamond} alt="钻石会员" className="w-16 h-16 object-contain animate-pulse" />
            ) : membership?.tier?.name === '黄金会员' ? (
              <img src={membershipGold} alt="黄金会员" className="w-16 h-16 object-contain animate-pulse" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-500 via-slate-500 to-gray-600 shadow-2xl flex items-center justify-center">
                <Gift className="h-7 w-7 text-white" />
              </div>
            )}
          </div>

          <div className="relative p-4">
            {/* Membership Badge with animation */}
            <Badge className={`mb-1.5 text-xs font-bold px-2.5 py-0.5 hover:scale-110 transition-all duration-300 relative overflow-hidden ${
              membership?.tier?.name === '至尊会员' 
                ? 'bg-gradient-to-r from-purple-400 to-pink-500' 
                : membership?.tier?.name === '钻石会员'
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500'
                : membership?.tier?.name === '黄金会员'
                ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
                : 'bg-gradient-to-r from-gray-400 to-slate-500'
            } text-white border-0 shadow-lg`}>
              {/* Inner shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <span className="relative">{membership ? membership.tier.name : '普通会员'}</span>
            </Badge>

            {/* Validity Period with icon */}
            <p className="text-white/90 text-sm mb-2 font-medium flex items-center gap-2 group-hover:text-white transition-colors">
              <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse ${
                membership ? 'bg-green-400' : 'bg-gray-400'
              }`} />
              有效期：{membership ? '永久有效' : '未开通'}
            </p>

            {/* Enter Button with enhanced hover effect */}
            <Button
              variant="outline"
              size="sm"
              className="bg-white/20 border-white/40 text-white hover:bg-white/30 backdrop-blur-sm shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-300 font-medium group/btn relative overflow-hidden"
              onClick={() => navigate('/referral')}
            >
              {/* Button shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
              <span className="relative flex items-center gap-1">
                进入会员中心 
                <ChevronRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform duration-300" />
              </span>
            </Button>
          </div>
        </Card>
      </div>

      {/* Lower Section: Balance, Orders, and Settings */}
      <div className="space-y-4 mt-4">
        {/* Balance Cards */}
        <div className="px-4 grid grid-cols-2 gap-3">
          {walletEnabled && (
          <Card
            className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-0 cursor-pointer hover:shadow-lg transition-all hover:scale-105"
            onClick={() => navigate("/wallet")}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">我的余额</span>
              <Wallet className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
            <p className="text-2xl font-bold">¥{walletBalance.toFixed(2)}</p>
          </Card>
          )}
          
          <Card
            className="p-4 bg-gradient-to-br from-purple-50 to-blue-100 dark:from-purple-950 dark:to-blue-900 border-0 cursor-pointer hover:shadow-lg transition-all hover:scale-105"
            onClick={() => navigate("/my-points")}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">我的积分</span>
              <Gift className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
            <p className="text-2xl font-bold">{pointsBalance}</p>
          </Card>
        </div>

        {/* Invite Code Card */}
        <div className="px-4">
          <Card className="p-4 bg-gradient-to-br from-pink-50 to-rose-100 dark:from-pink-950 dark:to-rose-900 border-0">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="h-5 w-5 text-rose-500" />
                  <span className="text-sm text-muted-foreground">我的邀请码</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold font-mono">{currentUser?.invite_code || "加载中..."}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-white/30"
                    onClick={handleCopyInviteCode}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                <p>分享邀请码</p>
                <p>赚取奖励</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Points Mall Banner */}
        <div className="px-4">
          <div 
            className="relative overflow-hidden rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer hover:scale-[1.02] group"
            onClick={() => navigate('/points-mall')}
          >
            <img 
              src={pointsMallBanner} 
              alt="积分商城" 
              className="w-full h-auto object-cover rounded-2xl"
            />
            {/* Overlay effect on hover */}
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          </div>
        </div>

        {/* My Orders */}
        <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h3 className="font-semibold">我的订单</h3>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-sm text-muted-foreground hover:text-primary"
            onClick={() => navigate('/my-orders')}
          >
            全部 <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <Card className="p-4 shadow-md hover:shadow-lg transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <div className="grid grid-cols-4 gap-4">
            <button 
              className="flex flex-col items-center gap-2 hover:scale-110 transition-all duration-300 group"
              onClick={() => navigate('/my-orders')}
            >
              <div className="h-12 w-12 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:rotate-3 transition-all duration-300 relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CreditCard className="h-6 w-6 text-blue-500 relative z-10 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-blue-500 transition-colors font-medium">待付款</span>
            </button>

            <button 
              className="flex flex-col items-center gap-2 hover:scale-110 transition-all duration-300 group"
              onClick={() => navigate('/my-orders')}
            >
              <div className="h-12 w-12 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:-rotate-3 transition-all duration-300 relative overflow-hidden">
                <div className="absolute inset-0 bg-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Truck className="h-6 w-6 text-orange-500 relative z-10 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-orange-500 transition-colors font-medium">待发货</span>
            </button>

            <button 
              className="flex flex-col items-center gap-2 hover:scale-110 transition-all duration-300 group"
              onClick={() => navigate('/my-orders')}
            >
              <div className="h-12 w-12 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:rotate-3 transition-all duration-300 relative overflow-hidden">
                <div className="absolute inset-0 bg-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Package className="h-6 w-6 text-green-500 relative z-10 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-green-500 transition-colors font-medium">待收货</span>
            </button>

            <button 
              className="flex flex-col items-center gap-2 hover:scale-110 transition-all duration-300 group"
              onClick={() => navigate('/my-orders')}
            >
              <div className="h-12 w-12 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:-rotate-3 transition-all duration-300 relative overflow-hidden">
                <div className="absolute inset-0 bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CheckCircleIcon className="h-6 w-6 text-purple-500 relative z-10 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-purple-500 transition-colors font-medium">已完成</span>
            </button>
          </div>
        </Card>
      </div>

      {/* Quick Access Tiles */}
      <div className="px-4 mb-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
        <div className="grid grid-cols-2 gap-3">
          <Card
            className="p-4 cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-105 hover:-translate-y-1 group relative overflow-hidden"
            onClick={() => navigate('/my-favorites')}
          >
            {/* Hover gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="flex items-center gap-3 relative z-10">
              <div className="h-10 w-10 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 rounded-lg flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-sm group-hover:shadow-md">
                <Star className="h-5 w-5 text-yellow-500 group-hover:animate-pulse" />
              </div>
              <span className="text-sm font-medium group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">我的收藏</span>
            </div>
          </Card>

          <Card
            className="p-4 cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-105 hover:-translate-y-1 group relative overflow-hidden"
            onClick={() => window.open(officialWebsiteUrl, "_blank")}
          >
            {/* Hover gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="flex items-center gap-3 relative z-10">
              <div className="h-10 w-10 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 rounded-lg flex items-center justify-center group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300 shadow-sm group-hover:shadow-md">
                <ExternalLink className="h-5 w-5 text-indigo-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
              <span className="text-sm font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">进入官网</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Function Menu Groups */}
      <div className="px-4 space-y-3">
        {/* Account Settings */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h3 className="font-semibold text-sm">账户设置</h3>
          </div>
          <Card className="overflow-hidden shadow-md">
            <button
              onClick={() => navigate("/personal-info")}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-500" />
                </div>
                <span className="text-sm font-medium">{t("profile.personalInfo")}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            <button
              onClick={() => navigate("/real-name-verification")}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-lg flex items-center justify-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                </div>
                <span className="text-sm font-medium">实名认证</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            <button
              onClick={() => navigate("/notification-settings")}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 rounded-lg flex items-center justify-center">
                  <Bell className="h-5 w-5 text-yellow-500" />
                </div>
                <span className="text-sm font-medium">{t("profile.notificationSettings")}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            <button
              onClick={() => navigate("/privacy-security")}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 rounded-lg flex items-center justify-center">
                  <Lock className="h-5 w-5 text-red-500" />
                </div>
                <span className="text-sm font-medium">{t("profile.privacySecurity")}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            <button
              onClick={() => navigate("/general-settings")}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg flex items-center justify-center">
                  <Settings className="h-5 w-5 text-purple-500" />
                </div>
                <span className="text-sm font-medium">{t("profile.generalSettings")}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </Card>
        </div>

        {/* Help & About */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h3 className="font-semibold text-sm">帮助与关于</h3>
          </div>
          <Card className="overflow-hidden shadow-md">
            <button
              onClick={() => navigate("/help-feedback")}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 rounded-lg flex items-center justify-center">
                  <HelpCircle className="h-5 w-5 text-cyan-500" />
                </div>
                <span className="text-sm font-medium">{t("profile.helpFeedback")}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            <button
              onClick={() => navigate("/about-us")}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 rounded-lg flex items-center justify-center">
                  <Info className="h-5 w-5 text-teal-500" />
                </div>
                <span className="text-sm font-medium">关于我们</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            <button
              onClick={() => navigate("/privacy-policy")}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-slate-500" />
                </div>
                <span className="text-sm font-medium">隐私政策</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

                    <button
                      onClick={() => navigate("/terms-of-service")}
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 rounded-lg flex items-center justify-center">
                          <FileText className="h-5 w-5 text-zinc-500" />
                        </div>
                        <span className="text-sm font-medium">用户协议</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>

                    <button
                      onClick={handleCheckUpdate}
                      disabled={checkingUpdate}
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-lg flex items-center justify-center">
                          {checkingUpdate ? (
                            <RefreshCw className="h-5 w-5 text-green-500 animate-spin" />
                          ) : (
                            <Download className="h-5 w-5 text-green-500" />
                          )}
                        </div>
                        <span className="text-sm font-medium">
                          {checkingUpdate ? "检查中..." : "检查更新"}
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </Card>
                </div>

                {/* Logout Button */}
        <Card className="overflow-hidden shadow-md">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full p-4 justify-start hover:bg-muted/50 h-auto"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 rounded-lg flex items-center justify-center">
                <LogOut className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">退出登录</span>
            </div>
          </Button>
        </Card>
      </div>
      {/* End of Lower Section */}
      </div>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>我的二维码</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-6 space-y-4">
            {qrCodeUrl ? (
              <div className="relative">
                <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64 border-4 border-primary/20 rounded-2xl shadow-xl" />
                <div className="absolute -top-2 -right-2 h-10 w-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  <span className="text-lg">👑</span>
                </div>
              </div>
            ) : (
              <div className="w-64 h-64 bg-muted rounded-2xl flex items-center justify-center">
                <QrCode className="h-24 w-24 text-muted-foreground animate-pulse" />
              </div>
            )}
            <div className="text-center space-y-2 w-full">
              <h3 className="font-semibold text-lg">{currentUser?.display_name}</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">ID:</span>
                  <span className="text-sm font-mono font-semibold text-primary">{currentUser?.user_id || '-'}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-muted"
                    onClick={handleCopyId}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">用户名:</span>
                  <span className="text-sm font-mono font-semibold">@{currentUser?.username}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                扫描二维码或搜索用户名添加好友
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Avatar Frame Selector Dialog */}
      <AvatarFrameSelector
        open={frameDialogOpen}
        onOpenChange={setFrameDialogOpen}
        currentFrame={currentUser?.avatar_frame || "none"}
        avatarUrl={currentUser?.avatar_url}
        displayName={currentUser?.display_name || "User"}
        userTier={membership?.tier?.name === "黄金会员" ? "gold" : membership?.tier?.name === "钻石会员" ? "diamond" : membership?.tier?.name === "至尊会员" ? "elite" : null}
        onFrameSelected={(frameId) => {
          setCurrentUser((prev: any) => ({ ...prev, avatar_frame: frameId }));
        }}
      />
    </div>
  );
}
