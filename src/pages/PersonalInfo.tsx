import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, Loader2, Lock, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import ChangeTransactionPasswordDialog from "@/components/wallet/ChangeTransactionPasswordDialog";
import { useWalletEnabled } from "@/hooks/useWalletEnabled";
import ShippingAddressManager from "@/components/profile/ShippingAddressManager";
import BankCardManager from "@/components/profile/BankCardManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { useFormValidation } from "@/hooks/useFormValidation";
import { validators } from "@/utils/validation";
import { useApiCall } from "@/hooks/useApiCall";

export default function PersonalInfo() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [hasTransactionPassword, setHasTransactionPassword] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [phone, setPhone] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { walletEnabled } = useWalletEnabled();

  const { values, errors, touched, handleChange, handleBlur, validateAll, setFieldValue } = useFormValidation(
    {
      display_name: "",
      bio: "",
      gender: "",
      birth_date: "",
    },
    {
      display_name: [(v) => validators.required(v, t("personalInfo.nickname"))],
      bio: [(v) => validators.maxLength(v, 200, t("personalInfo.signature"))],
    }
  );

  const { execute: saveProfile, loading: saving } = useApiCall({
    successMessage: t("personalInfo.saveSuccess"),
    errorMessage: t("personalInfo.saveFailed"),
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setUsername(data.username || "");
        setUserId((data as any).user_id || "");
        setPhone((data as any).phone || "");
        setFieldValue("display_name", data.display_name || "");
        setFieldValue("bio", data.bio || "");
        setFieldValue("gender", (data as any).gender || "");
        setFieldValue("birth_date", (data as any).birth_date || "");
        setAvatarUrl(data.avatar_url || "");
        setHasTransactionPassword(!!data.transaction_password_hash);
      }
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("personalInfo.loadFailed"),
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
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
        title: t("personalInfo.fileTypeError"),
        description: t("personalInfo.selectImage"),
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t("personalInfo.fileTooLarge"),
        description: t("personalInfo.imageSizeLimit"),
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
      if (avatarUrl) {
        const oldPath = avatarUrl.split("/").pop();
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
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicURL } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicURL.publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicURL.publicUrl);
      toast({
        title: t("personalInfo.uploadSuccess"),
        description: t("personalInfo.avatarUpdated"),
      });
    } catch (error: any) {
      toast({
        title: t("personalInfo.uploadFailed"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateAll()) {
      toast({
        title: t("common.error"),
        description: t("common.pleaseFillRequired"),
        variant: "destructive",
      });
      return;
    }

    await saveProfile(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: values.display_name,
          bio: values.bio,
          gender: values.gender || null,
          birth_date: values.birth_date || null,
        } as any)
        .eq("id", user.id);

      if (error) throw error;
    });
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingSkeleton variant="profile" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border bg-card flex items-center gap-3 shadow-card flex-shrink-0">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold">{t("personalInfo.title")}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">{t("personalInfo.basicInfo")}</TabsTrigger>
            <TabsTrigger value="address">{t("personalInfo.shippingAddress")}</TabsTrigger>
            <TabsTrigger value="bank">{t("personalInfo.bankCard")}</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-24 w-24 cursor-pointer" onClick={handleAvatarClick}>
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-2xl bg-gradient-to-br from-primary/20 to-accent/20">
                    {values.display_name?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={handleAvatarClick}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <p className="text-sm text-muted-foreground">{t("personalInfo.avatar")}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId">ID</Label>
                <Input
                  id="userId"
                  value={userId}
                  disabled
                  className="bg-muted font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">手机号</Label>
                <Input
                  id="phone"
                  value={phone || "未绑定"}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">{t("personalInfo.username")}</Label>
                <Input
                  id="username"
                  value={username}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">{t("personalInfo.usernameCannotChange")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name">{t("personalInfo.nickname")}</Label>
                <Input
                  id="display_name"
                  value={values.display_name}
                  onChange={(e) => handleChange("display_name", e.target.value)}
                  onBlur={() => handleBlur("display_name")}
                  placeholder={t("personalInfo.enterNickname")}
                  className={errors.display_name && touched.display_name ? "border-destructive" : ""}
                />
                {errors.display_name && touched.display_name && (
                  <p className="text-sm text-destructive">{errors.display_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">{t("personalInfo.gender")}</Label>
                <Select value={values.gender} onValueChange={(value) => handleChange("gender", value)}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder={t("personalInfo.selectGender")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t("personalInfo.male")}</SelectItem>
                    <SelectItem value="female">{t("personalInfo.female")}</SelectItem>
                    <SelectItem value="other">{t("personalInfo.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="birth_date">{t("personalInfo.birthdate")}</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={values.birth_date}
                  onChange={(e) => handleChange("birth_date", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">{t("personalInfo.signature")}</Label>
                <Textarea
                  id="bio"
                  value={values.bio}
                  onChange={(e) => handleChange("bio", e.target.value)}
                  onBlur={() => handleBlur("bio")}
                  placeholder={t("personalInfo.enterSignature")}
                  rows={4}
                  className={errors.bio && touched.bio ? "border-destructive" : ""}
                />
                <div className="flex items-center justify-between">
                  {errors.bio && touched.bio && (
                    <p className="text-sm text-destructive">{errors.bio}</p>
                  )}
                  <p className="text-xs text-muted-foreground ml-auto">
                    {values.bio.length} / 200
                  </p>
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-border bg-card">
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full bg-gradient-to-r from-primary to-accent"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("common.saving")}
                  </>
                ) : (
                  t("common.save")
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="address">
            <ShippingAddressManager />
          </TabsContent>

          <TabsContent value="bank">
            <BankCardManager />
          </TabsContent>
        </Tabs>
      </div>

      {/* 修改交易密码对话框 */}
      <ChangeTransactionPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        hasExistingPassword={hasTransactionPassword}
      />
    </div>
  );
}
