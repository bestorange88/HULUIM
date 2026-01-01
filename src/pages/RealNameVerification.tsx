import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Upload, CheckCircle, XCircle, Clock, Loader2, AlertCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { checkImageQuality, formatFileSize, type ImageQualityResult } from "@/utils/imageQualityCheck";
import { useFormValidation } from "@/hooks/useFormValidation";
import { validators } from "@/utils/validation";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { useTranslation } from "react-i18next";

export default function RealNameVerification() {
  const { t } = useTranslation();
  const [verification, setVerification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasInitializedFromDb, setHasInitializedFromDb] = useState(false);
  
  const { values, errors, touched, handleChange, handleBlur, validateAll } = useFormValidation(
    { realName: "", idCardNumber: "" },
    {
      realName: [(v) => validators.required(v, t("verification.realName"))],
      idCardNumber: [validators.idCard]
    }
  );
  const [frontImageUrl, setFrontImageUrl] = useState("");
  const [backImageUrl, setBackImageUrl] = useState("");
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [frontQuality, setFrontQuality] = useState<ImageQualityResult | null>(null);
  const [backQuality, setBackQuality] = useState<ImageQualityResult | null>(null);
  const [checkingQuality, setCheckingQuality] = useState(false);
  
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchVerification();
  }, []);

  const fetchVerification = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data } = await supabase
      .from("real_name_verifications")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setVerification(data);
      // 只在首次加载时用数据库值填充表单，避免覆盖用户已输入的内容
      if (!hasInitializedFromDb) {
        if (data.real_name) {
          handleChange("realName", data.real_name);
        }
        if (data.id_card_number) {
          handleChange("idCardNumber", data.id_card_number);
        }
        setHasInitializedFromDb(true);
      }
      
      // 如果已有图片URL，需要重新生成签名URL（因为可能是旧的公共URL或过期的签名URL）
      if (data.id_card_front_url) {
        // 从URL中提取文件路径
        const frontPath = extractFilePathFromUrl(data.id_card_front_url, user.id);
        if (frontPath) {
          const { data: signedUrlData } = await supabase.storage
            .from("verification-documents")
            .createSignedUrl(frontPath, 365 * 24 * 60 * 60);
          setFrontImageUrl(signedUrlData?.signedUrl || data.id_card_front_url);
        } else {
          setFrontImageUrl(data.id_card_front_url);
        }
      }
      
      if (data.id_card_back_url) {
        const backPath = extractFilePathFromUrl(data.id_card_back_url, user.id);
        if (backPath) {
          const { data: signedUrlData } = await supabase.storage
            .from("verification-documents")
            .createSignedUrl(backPath, 365 * 24 * 60 * 60);
          setBackImageUrl(signedUrlData?.signedUrl || data.id_card_back_url);
        } else {
          setBackImageUrl(data.id_card_back_url);
        }
      }
    }
    setLoading(false);
  };

  // 从URL中提取文件路径的辅助函数
  const extractFilePathFromUrl = (url: string, userId: string): string | null => {
    try {
      // URL格式可能是: https://.../storage/v1/object/public/verification-documents/userId/filename
      // 或签名URL: https://.../storage/v1/object/sign/verification-documents/userId/filename?token=...
      const match = url.match(/verification-documents\/(.+?)(\?|$)/);
      if (match && match[1]) {
        return match[1];
      }
      // 如果无法从URL提取，尝试基于userId构建路径
      if (url.includes(userId)) {
        const parts = url.split(userId + '/');
        if (parts.length > 1) {
          const filename = parts[1].split('?')[0];
          return `${userId}/${filename}`;
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleImageUpload = async (file: File, type: 'front' | 'back') => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "文件类型错误",
        description: "请选择图片文件（JPG、PNG等格式）",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "文件过大",
        description: "图片大小不能超过10MB，请压缩后重新上传",
        variant: "destructive",
      });
      return;
    }

    const setUploading = type === 'front' ? setUploadingFront : setUploadingBack;
    const setQuality = type === 'front' ? setFrontQuality : setBackQuality;
    
    setUploading(true);
    setCheckingQuality(true);

    try {
      // 1. 首先进行质量检测（某些安卓设备可能不支持，需要降级处理）
      let qualityResult: ImageQualityResult | null = null;
      try {
        qualityResult = await checkImageQuality(file);
        setQuality(qualityResult);
      } catch (qualityError) {
        // 质量检测失败（可能是浏览器不支持某些API），跳过检测直接上传
        console.warn('质量检测失败，跳过检测:', qualityError);
        setQuality(null);
      }
      setCheckingQuality(false);

      // 2. 如果质量不合格，给出警告但仍然允许继续上传
      if (qualityResult && !qualityResult.passed) {
        toast({
          title: "照片质量提示",
          description: `${qualityResult.issues.join('；')}。照片仍将上传，但可能影响审核结果。`,
        });
      }

      // 3. 开始上传（无论质量检测结果如何）
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUploading(false);
        return;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${type}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(filePath, file, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 使用签名URL（私有存储桶需要签名URL才能访问）
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from("verification-documents")
        .createSignedUrl(filePath, 365 * 24 * 60 * 60); // 1年有效期

      if (urlError) throw urlError;

      const signedUrl = signedUrlData.signedUrl;

      if (type === 'front') {
        setFrontImageUrl(signedUrl);
      } else {
        setBackImageUrl(signedUrl);
      }

      toast({
        title: "上传成功",
        description: `身份证${type === 'front' ? '正面' : '反面'}照片已上传（质量评分：${qualityResult.score}/100）`,
      });
    } catch (error: any) {
      toast({
        title: "上传失败",
        description: error.message,
        variant: "destructive",
      });
      setQuality(null);
    } finally {
      setUploading(false);
      setCheckingQuality(false);
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

    if (!frontImageUrl || !backImageUrl) {
      toast({
        title: t("common.error"),
        description: "请上传身份证正反面照片",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const verificationData = {
        user_id: user.id,
        real_name: values.realName,
        id_card_number: values.idCardNumber,
        id_card_front_url: frontImageUrl,
        id_card_back_url: backImageUrl,
        status: 'pending',
      };

      if (verification) {
        const { error } = await supabase
          .from("real_name_verifications")
          .update(verificationData)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("real_name_verifications")
          .insert([verificationData]);
        if (error) throw error;
      }

      toast({
        title: "提交成功",
        description: "实名认证申请已提交，请等待审核",
      });
      
      fetchVerification();
    } catch (error: any) {
      toast({
        title: "提交失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    if (!verification) return null;
    
    switch (verification.status) {
      case 'pending':
        return (
          <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <Clock className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              认证审核中，请耐心等待
            </AlertDescription>
          </Alert>
        );
      case 'approved':
        return (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              实名认证已通过
            </AlertDescription>
          </Alert>
        );
      case 'rejected':
        return (
          <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              认证未通过：{verification.review_notes || "请重新提交"}
            </AlertDescription>
          </Alert>
        );
    }
  };

  const isDisabled = verification?.status === 'pending' || verification?.status === 'approved';

  if (loading) {
    return (
      <div className="h-full">
        <LoadingSkeleton variant="profile" />
      </div>
    );
  }

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
        <h1 className="text-lg font-semibold">实名认证</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {getStatusBadge()}

        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>请如实填写您的身份信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="realName">{t("verification.realName")} *</Label>
              <Input
                id="realName"
                value={values.realName}
                onChange={(e) => handleChange("realName", e.target.value)}
                onInput={(e) => handleChange("realName", (e.target as HTMLInputElement).value)}
                onBlur={(e) => {
                  handleChange("realName", e.currentTarget.value);
                  handleBlur("realName");
                }}
                onCompositionEnd={(e) => handleChange("realName", e.currentTarget.value)}
                placeholder={t("verification.enterRealName")}
                disabled={isDisabled}
                className={errors.realName && touched.realName ? "border-destructive" : ""}
              />
              {errors.realName && touched.realName && (
                <p className="text-sm text-destructive">{errors.realName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="idCardNumber">{t("verification.idCardNumber")} *</Label>
              <Input
                id="idCardNumber"
                value={values.idCardNumber}
                onChange={(e) => handleChange("idCardNumber", e.target.value)}
                onInput={(e) => handleChange("idCardNumber", (e.target as HTMLInputElement).value)}
                onBlur={(e) => {
                  handleChange("idCardNumber", e.currentTarget.value);
                  handleBlur("idCardNumber");
                }}
                onCompositionEnd={(e) => handleChange("idCardNumber", e.currentTarget.value)}
                placeholder={t("verification.enterIdCard")}
                disabled={isDisabled}
                className={errors.idCardNumber && touched.idCardNumber ? "border-destructive" : ""}
              />
              {errors.idCardNumber && touched.idCardNumber && (
                <p className="text-sm text-destructive">{errors.idCardNumber}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>身份证照片</CardTitle>
            <CardDescription>请上传清晰的身份证正反面照片</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 拍摄提示 */}
            <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                <strong>拍摄建议：</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>在光线充足的环境下拍摄</li>
                  <li>确保身份证边缘完整清晰</li>
                  <li>避免反光和阴影</li>
                  <li>保持相机对焦清晰</li>
                  <li>照片分辨率至少800x600</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* 身份证正面 */}
            <div className="space-y-3">
              <Label>身份证正面 *</Label>
              <div 
                className={`border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer ${
                  frontQuality?.passed ? 'border-green-500 bg-green-50 dark:bg-green-950' :
                  frontQuality && !frontQuality.passed ? 'border-red-500 bg-red-50 dark:bg-red-950' :
                  'border-border hover:border-primary'
                }`}
                onClick={() => !isDisabled && frontInputRef.current?.click()}
              >
                {frontImageUrl ? (
                  <img src={frontImageUrl} alt="身份证正面" className="w-full h-48 object-contain" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <Upload className="h-12 w-12 mb-2" />
                    <p className="text-sm">点击上传身份证正面照片</p>
                    <p className="text-xs mt-1">支持JPG、PNG格式，大小不超过10MB</p>
                  </div>
                )}
              </div>
              <input
                ref={frontInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'front')}
                className="hidden"
                disabled={isDisabled}
              />
              
              {/* 上传进度 */}
              {(uploadingFront || checkingQuality) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {checkingQuality ? '正在检测照片质量...' : '上传中...'}
                  </div>
                </div>
              )}

              {/* 质量检测结果 */}
              {frontQuality && !uploadingFront && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">质量评分</span>
                    <span className={`text-sm font-bold ${
                      frontQuality.score >= 80 ? 'text-green-600' :
                      frontQuality.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {frontQuality.score}/100
                    </span>
                  </div>
                  <Progress value={frontQuality.score} className="h-2" />
                  
                  {frontQuality.issues.length > 0 && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        <strong>发现问题：</strong>
                        <ul className="mt-1 space-y-1 list-disc list-inside">
                          {frontQuality.issues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {frontQuality.suggestions.length > 0 && (
                    <Alert className="mt-2 border-blue-500 bg-blue-50 dark:bg-blue-950">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>建议：</strong>
                        <ul className="mt-1 space-y-1 list-disc list-inside">
                          {frontQuality.suggestions.map((suggestion, idx) => (
                            <li key={idx}>{suggestion}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* 详细信息 */}
                  <div className="text-xs text-muted-foreground space-y-1 mt-2">
                    <div>分辨率: {frontQuality.details.resolution.width}x{frontQuality.details.resolution.height} {frontQuality.details.resolution.passed ? '✓' : '✗'}</div>
                    <div>文件大小: {formatFileSize(frontQuality.details.fileSize.size)} {frontQuality.details.fileSize.passed ? '✓' : '✗'}</div>
                    <div>清晰度: {frontQuality.details.sharpness.score.toFixed(1)} {frontQuality.details.sharpness.passed ? '✓' : '✗'}</div>
                    <div>亮度: {frontQuality.details.brightness.score.toFixed(0)} {frontQuality.details.brightness.passed ? '✓' : '✗'}</div>
                  </div>
                </div>
              )}
            </div>

            {/* 身份证反面 */}
            <div className="space-y-3">
              <Label>身份证反面 *</Label>
              <div 
                className={`border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer ${
                  backQuality?.passed ? 'border-green-500 bg-green-50 dark:bg-green-950' :
                  backQuality && !backQuality.passed ? 'border-red-500 bg-red-50 dark:bg-red-950' :
                  'border-border hover:border-primary'
                }`}
                onClick={() => !isDisabled && backInputRef.current?.click()}
              >
                {backImageUrl ? (
                  <img src={backImageUrl} alt="身份证反面" className="w-full h-48 object-contain" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <Upload className="h-12 w-12 mb-2" />
                    <p className="text-sm">点击上传身份证反面照片</p>
                    <p className="text-xs mt-1">支持JPG、PNG格式，大小不超过10MB</p>
                  </div>
                )}
              </div>
              <input
                ref={backInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'back')}
                className="hidden"
                disabled={isDisabled}
              />
              
              {/* 上传进度 */}
              {(uploadingBack || checkingQuality) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {checkingQuality ? '正在检测照片质量...' : '上传中...'}
                  </div>
                </div>
              )}

              {/* 质量检测结果 */}
              {backQuality && !uploadingBack && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">质量评分</span>
                    <span className={`text-sm font-bold ${
                      backQuality.score >= 80 ? 'text-green-600' :
                      backQuality.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {backQuality.score}/100
                    </span>
                  </div>
                  <Progress value={backQuality.score} className="h-2" />
                  
                  {backQuality.issues.length > 0 && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        <strong>发现问题：</strong>
                        <ul className="mt-1 space-y-1 list-disc list-inside">
                          {backQuality.issues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {backQuality.suggestions.length > 0 && (
                    <Alert className="mt-2 border-blue-500 bg-blue-50 dark:bg-blue-950">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>建议：</strong>
                        <ul className="mt-1 space-y-1 list-disc list-inside">
                          {backQuality.suggestions.map((suggestion, idx) => (
                            <li key={idx}>{suggestion}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* 详细信息 */}
                  <div className="text-xs text-muted-foreground space-y-1 mt-2">
                    <div>分辨率: {backQuality.details.resolution.width}x{backQuality.details.resolution.height} {backQuality.details.resolution.passed ? '✓' : '✗'}</div>
                    <div>文件大小: {formatFileSize(backQuality.details.fileSize.size)} {backQuality.details.fileSize.passed ? '✓' : '✗'}</div>
                    <div>清晰度: {backQuality.details.sharpness.score.toFixed(1)} {backQuality.details.sharpness.passed ? '✓' : '✗'}</div>
                    <div>亮度: {backQuality.details.brightness.score.toFixed(0)} {backQuality.details.brightness.passed ? '✓' : '✗'}</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {!isDisabled && (
        <div className="p-4 border-t border-border bg-card">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !values.realName || !values.idCardNumber || !frontImageUrl || !backImageUrl}
            className="w-full bg-gradient-to-r from-primary to-accent"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                提交中...
              </>
            ) : (
              verification ? "重新提交" : "提交认证"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
