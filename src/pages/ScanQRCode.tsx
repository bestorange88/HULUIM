import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Camera, AlertCircle, ScanLine, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

// Custom ZXing Barcode Scanner Plugin (pure Java, offline, no Google Play Services)
interface ZXingScanResult {
  cancelled: boolean;
  text: string;
  format: string;
  error: string | null;
}

interface ZXingBarcodeScannerPlugin {
  scan(): Promise<ZXingScanResult>;
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
}

const ZXingBarcodeScanner = registerPlugin<ZXingBarcodeScannerPlugin>('ZXingBarcodeScanner');

// MLKit will be loaded dynamically inside useEffect to avoid race condition
let BarcodeScanner: any = null;
let BarcodeFormat: any = null;

/**
 * QR Code Image Parser Utils
 * 从图片中解析二维码（Html5Qrcode + Canvas 兜底）
 */
const MAX_IMAGE_SIZE_MB = 10;

function isValidImageFile(file: File): boolean {
  const validTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
  ];
  return validTypes.includes(file.type.toLowerCase());
}

function isValidImageSize(file: File): boolean {
  return file.size <= MAX_IMAGE_SIZE_MB * 1024 * 1024;
}

async function parseQRWithCanvas(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      const img = new Image();

      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }

          const maxSize = 1024;
          let width = img.width;
          let height = img.height;

          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL("image/png");
          const blob = await fetch(dataUrl).then((r) => r.blob());
          const tempFile = new File([blob], "temp.png", { type: "image/png" });

          const html5QrCode = new Html5Qrcode("qr-canvas-parser-temp", {
            verbose: false,
          });

          try {
            const result = await html5QrCode.scanFile(tempFile, true);
            html5QrCode.clear();
            resolve(result);
          } catch {
            html5QrCode.clear();
            resolve(null);
          }
        } catch (err) {
          console.error("[QR Canvas Parser] Error:", err);
          resolve(null);
        }
      };

      img.onerror = () => {
        console.error("[QR Canvas Parser] Image load error");
        resolve(null);
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      console.error("[QR Canvas Parser] FileReader error");
      resolve(null);
    };

    reader.readAsDataURL(file);
  });
}

async function parseQRFromImage(file: File): Promise<string | null> {
  return new Promise(async (resolve) => {
    try {
      // 方法1: 使用 Html5Qrcode 的 scanFile 方法
      const html5QrCode = new Html5Qrcode("qr-image-parser-temp", {
        verbose: false,
      });

      try {
        const result = await html5QrCode.scanFile(file, true);
        html5QrCode.clear();
        resolve(result);
        return;
      } catch (scanErr) {
        console.log(
          "[QR Parser] Html5Qrcode scanFile failed, trying canvas method",
          scanErr
        );
        html5QrCode.clear();
      }

      // 方法2: 使用 Canvas 方式解析
      const result = await parseQRWithCanvas(file);
      resolve(result);
    } catch (err) {
      console.error("[QR Parser] All methods failed:", err);
      resolve(null);
    }
  });
}

export default function ScanQRCode() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>("");
  const [useNative, setUseNative] = useState(Capacitor.isNativePlatform());
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isNativePlatform = Capacitor.isNativePlatform();
  // Track MLKit availability status to avoid repeated failed attempts
  const mlkitStatusRef = useRef<'unknown' | 'available' | 'unavailable' | 'failed'>('unknown');

  useEffect(() => {
    // Auto-start based on platform
    const initScanner = async () => {
      console.log('[ScanQRCode] initScanner called');
      console.log('[ScanQRCode] Platform info:', {
        isNativePlatform,
        capacitorPlatform: Capacitor.getPlatform(),
        capacitorIsNative: Capacitor.isNativePlatform(),
        userAgent: navigator.userAgent.substring(0, 100)
      });
      
      // On Android native platform, use custom ZXing plugin (pure Java, offline)
      if (isNativePlatform && Capacitor.getPlatform() === 'android') {
        console.log('[ScanQRCode] Android detected, using native ZXing scanner');
        startNativeZXingScan();
        return;
      }
      
      // On other platforms, use web-based scanner
      console.log('[ScanQRCode] Using web-based scanner');
      console.log('[ScanQRCode] Secure context:', window.isSecureContext);
      console.log('[ScanQRCode] Location:', window.location.href);
      setUseNative(false);
      startWebScanner();
    };
    
    initScanner();

    return () => {
      stopWebScanner();
      if (isNativePlatform && BarcodeScanner) {
        BarcodeScanner.stopScan?.().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Native ZXing scanner (pure Java, offline, no Google Play Services required)
  const startNativeZXingScan = async () => {
    console.log('[ScanQRCode] Starting native ZXing scan...');
    setScanning(true);
    setError("");

    try {
      const result = await ZXingBarcodeScanner.scan();
      console.log('[ScanQRCode] Native ZXing scan result:', result);
      
      setScanning(false);

      if (result.cancelled) {
        console.log('[ScanQRCode] Scan cancelled by user');
        navigate(-1);
        return;
      }

      if (result.error) {
        console.error('[ScanQRCode] Scan error:', result.error);
        if (result.error.includes('permission') || result.error.includes('Permission')) {
          setError("需要相机权限才能扫码，请在系统设置中允许访问相机");
        } else {
          setError("扫码失败: " + result.error);
        }
        return;
      }

      if (result.text) {
        console.log('[ScanQRCode] Scan successful, processing content:', result.text);
        await processQRContent(result.text);
      } else {
        toast.error("无法识别二维码内容");
        navigate(-1);
      }
    } catch (err: any) {
      console.error('[ScanQRCode] Native ZXing scan error:', err);
      setScanning(false);
      
      // Fallback to web scanner if native fails
      console.log('[ScanQRCode] Falling back to web scanner');
      toast.info("原生扫码不可用，正在切换到备用扫码方式...");
      setUseNative(false);
      startWebScanner();
    }
  };

  // Native MLKit scanner (kept as fallback, but not used by default)
  const startNativeScan = async () => {
    console.log('[ScanQRCode] startNativeScan called, BarcodeScanner:', !!BarcodeScanner);
    console.log('[ScanQRCode] isNativePlatform:', isNativePlatform, 'Capacitor:', typeof (window as any).Capacitor);
    console.log('[ScanQRCode] mlkitStatus:', mlkitStatusRef.current);
    
    // If MLKit was previously marked as unavailable, go directly to web scanner
    if (mlkitStatusRef.current === 'unavailable' || mlkitStatusRef.current === 'failed') {
      console.log('[ScanQRCode] MLKit previously failed, using web scanner');
      setUseNative(false);
      startWebScanner();
      return;
    }
    
    if (!BarcodeScanner) {
      console.log("[ScanQRCode] MLKit not loaded, falling back to web scanner");
      mlkitStatusRef.current = 'failed';
      setUseNative(false);
      startWebScanner();
      return;
    }

    try {
      setScanning(true);
      setError("");

      // Check if Google Barcode Scanner module is available (Android only)
      console.log('[ScanQRCode] Checking Google Barcode Scanner module availability...');
      try {
        const moduleCheck = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        console.log('[ScanQRCode] Module availability:', moduleCheck);
        
        if (!moduleCheck.available) {
          console.log('[ScanQRCode] MLKit module not available, trying to install with timeout...');
          toast.info("正在尝试启用扫码组件...");
          
          // Try to install with a timeout - if it takes too long, fallback to web scanner
          const installPromise = BarcodeScanner.installGoogleBarcodeScannerModule();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('MLKitInstallTimeout')), 8000)
          );
          
          try {
            await Promise.race([installPromise, timeoutPromise]);
            
            // Wait a bit for installation to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check again
            const recheckModule = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
            console.log('[ScanQRCode] Module availability after install:', recheckModule);
            
            if (!recheckModule.available) {
              // Module still not available after install attempt - mark as unavailable and use web scanner
              console.log('[ScanQRCode] MLKit module still not available, marking as unavailable');
              mlkitStatusRef.current = 'unavailable';
              localStorage.setItem('mlkit_unavailable', 'true');
              toast.info("扫码组件不可用，已切换到备用扫码方式");
              setScanning(false);
              setUseNative(false);
              startWebScanner();
              return;
            }
          } catch (installErr: any) {
            // Install timed out or failed - mark as unavailable and use web scanner
            console.log('[ScanQRCode] MLKit install failed or timed out:', installErr?.message);
            mlkitStatusRef.current = 'unavailable';
            localStorage.setItem('mlkit_unavailable', 'true');
            toast.info("扫码组件下载超时，已切换到备用扫码方式");
            setScanning(false);
            setUseNative(false);
            startWebScanner();
            return;
          }
        }
        
        // Module is available
        mlkitStatusRef.current = 'available';
      } catch (moduleErr: any) {
        console.log('[ScanQRCode] Module check error:', moduleErr?.message);
        // If module check fails (e.g., on iOS or unsupported device), try to continue
        // but if it's a serious error, fallback to web scanner
        if (moduleErr?.message?.includes('Play') || moduleErr?.message?.includes('Google')) {
          console.log('[ScanQRCode] Google Play Services issue, falling back to web scanner');
          mlkitStatusRef.current = 'unavailable';
          localStorage.setItem('mlkit_unavailable', 'true');
          toast.info("设备不支持谷歌扫码组件，已切换到备用扫码方式");
          setScanning(false);
          setUseNative(false);
          startWebScanner();
          return;
        }
      }

      // Check permissions
      console.log('[ScanQRCode] Checking camera permissions...');
      const { camera } = await BarcodeScanner.checkPermissions();
      console.log('[ScanQRCode] Camera permission status:', camera);
      
      if (camera !== "granted") {
        console.log('[ScanQRCode] Requesting camera permissions...');
        const result = await BarcodeScanner.requestPermissions();
        console.log('[ScanQRCode] Permission request result:', result.camera);
        if (result.camera !== "granted") {
          setError("需要相机权限才能扫码，请在系统设置中允许访问相机");
          setScanning(false);
          return;
        }
      }

      // Scan with MLKit
      console.log('[ScanQRCode] Starting MLKit scan...');
      const result = await BarcodeScanner.scan({
        formats: BarcodeFormat ? [BarcodeFormat.QrCode] : [],
      });
      console.log('[ScanQRCode] MLKit scan result:', result);

      setScanning(false);

      if (result.barcodes && result.barcodes.length > 0) {
        const content =
          result.barcodes[0].rawValue || result.barcodes[0].displayValue;
        if (content) {
          await processQRContent(content);
        } else {
          toast.error("无法识别二维码内容");
          navigate(-1);
        }
      } else {
        // User cancelled or no result
        navigate(-1);
      }
    } catch (err: any) {
      console.error("[ScanQRCode] Native scan error:", err);
      console.error("[ScanQRCode] Error message:", err.message);
      console.error("[ScanQRCode] Error name:", err.name);
      console.error("[ScanQRCode] Error code:", err.code);
      console.error("[ScanQRCode] Error stack:", err.stack);
      
      if (
        err.message?.includes("canceled") ||
        err.message?.includes("cancelled")
      ) {
        navigate(-1);
        return;
      }
      
      // Handle specific errors
      if (err.message?.includes("permission") || err.message?.includes("Permission")) {
        setError("相机权限被拒绝，请在系统设置中允许访问相机");
        setScanning(false);
        return;
      }
      
      // For other errors, try to fallback to web scanner
      console.log('[ScanQRCode] MLKit scan failed, trying web scanner fallback');
      mlkitStatusRef.current = 'failed';
      toast.info("原生扫码失败，正在切换到备用扫码方式...");
      setUseNative(false);
      startWebScanner();
    }
  };

  // Web HTML5 scanner
  const startWebScanner = async () => {
    console.log('[ScanQRCode] startWebScanner called');
    try {
      setScanning(true);
      setError("");

      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.log('[ScanQRCode] getUserMedia not supported');
        setError(t("scan.cameraError"));
        setScanning(false);
        return;
      }

      // Check camera permission
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({
            name: "camera" as PermissionName,
          });
          console.log("Camera permission status:", result.state);
          if (result.state === "denied") {
            setError(t("scan.cameraError"));
            setScanning(false);
            return;
          }
        } catch (e) {
          // Continue anyway
        }
      }

      // Cleanup existing scanner
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (e) {}
      }

      const html5QrCode = new Html5Qrcode("qr-reader", {
        verbose: false,
        formatsToSupport: [0], // QR_CODE only
      });
      scannerRef.current = html5QrCode;

      const screenWidth = Math.min(window.innerWidth - 32, 400);
      const qrboxSize = Math.floor(screenWidth * 0.7);

      // Html5Qrcode.start() expects cameraIdOrConfig with exactly 1 key
      // Use facingMode only, resolution is controlled via qrbox config
      const cameraConfig = { facingMode: "environment" };

      // Set a timeout to detect if camera fails to start
      const timeoutId = setTimeout(() => {
        if (scanning && !scannerRef.current?.isScanning) {
          console.log('[ScanQRCode] Camera start timeout');
          setError(t("scan.cameraError"));
          setScanning(false);
        }
      }, 10000);

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: { width: qrboxSize, height: qrboxSize },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        onScanSuccess,
        onScanError
      );
      
      clearTimeout(timeoutId);
    } catch (err: any) {
      console.error("Error starting web scanner:", err);
      if (
        err.name === "NotAllowedError" ||
        err.message?.includes("Permission")
      ) {
        setError("请在系统设置中允许访问相机，或点击右上角相册图标从本地相册选择二维码图片进行识别");
      } else if (
        err.name === "NotFoundError" ||
        err.message?.includes("not found") ||
        err.message?.includes("no camera")
      ) {
        setError("未检测到摄像头设备，请点击右上角相册图标从本地相册选择二维码图片进行识别");
      } else if (
        err.name === "NotReadableError" ||
        err.name === "OverconstrainedError"
      ) {
        setError("摄像头被占用或不可用，请点击右上角相册图标从本地相册选择二维码图片进行识别");
      } else {
        setError(t("scan.cameraError"));
      }
      setScanning(false);
    }
  };

  const stopWebScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
  };

  // Process scanned content
  const processQRContent = async (decodedText: string) => {
    console.log("QR Code detected:", decodedText);

    try {
      // Group invite URL
      const joinMatch = decodedText.match(/\/join\/([A-Za-z0-9]+)/);
      if (joinMatch) {
        toast.success(t("scan.scanSuccess"));
        navigate(`/join/${joinMatch[1]}`);
        return;
      }

      // User profile - send friend request
      const userMatch = decodedText.match(/\/user\/([A-Za-z0-9-]+)/);
      if (userMatch) {
        await sendFriendRequest(userMatch[1]);
        return;
      }

      // Direct username
      const usernameMatch = decodedText.match(/^@?([A-Za-z0-9_.-]{2,30})$/);
      if (usernameMatch) {
        await sendFriendRequestByUsername(usernameMatch[1]);
        return;
      }

      // 8-char invite code
      if (/^[A-Z0-9]{8}$/i.test(decodedText)) {
        toast.success(t("scan.scanSuccess"));
        navigate(`/join/${decodedText.toUpperCase()}`);
        return;
      }

      // Parse as URL
      try {
        const url = new URL(decodedText);
        const pathParts = url.pathname.split("/").filter(Boolean);

        if (pathParts.includes("join")) {
          const code = pathParts[pathParts.indexOf("join") + 1];
          if (code) {
            toast.success(t("scan.scanSuccess"));
            navigate(`/join/${code}`);
            return;
          }
        }

        if (pathParts.includes("user")) {
          const userId = pathParts[pathParts.indexOf("user") + 1];
          if (userId) {
            await sendFriendRequest(userId);
            return;
          }
        }

        const inviteCode = url.searchParams.get("invite");
        if (inviteCode) {
          toast.success(t("scan.scanSuccess"));
          navigate(`/auth?invite=${inviteCode}`);
          return;
        }
      } catch (urlError) {}

      toast.error(t("scan.unrecognizedQR"));
      navigate(-1);
    } catch (err) {
      console.error("Error processing QR:", err);
      toast.error(t("scan.parseFailed"));
      navigate(-1);
    }
  };

  const sendFriendRequest = async (friendId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("请先登录");
      navigate("/auth");
      return;
    }

    if (user.id === friendId) {
      toast.error("不能添加自己为好友");
      navigate(-1);
      return;
    }

    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status, user_id")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`
      )
      .maybeSingle();

    if (existing) {
      if (existing.status === "accepted") {
        toast.success("已经是好友了");
        navigate("/contacts");
      } else if (existing.user_id === user.id) {
        toast.info("好友申请已发送，等待对方同意");
        navigate("/contacts");
      } else {
        toast.info("对方已向你发送好友申请，请在好友请求中查看");
        navigate("/contacts");
      }
      return;
    }

    const { error } = await supabase.from("friendships").insert({
      user_id: user.id,
      friend_id: friendId,
      status: "pending",
    });

    if (error) {
      console.error("Error sending friend request:", error);
      toast.error("发送好友申请失败");
      navigate(-1);
      return;
    }

    toast.success("好友申请已发送，等待对方同意");
    navigate("/contacts");
  };

  const sendFriendRequestByUsername = async (username: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .single();

    if (!profile) {
      toast.error("用户不存在");
      navigate(-1);
      return;
    }

    await sendFriendRequest(profile.id);
  };

  const onScanSuccess = async (decodedText: string) => {
    await stopWebScanner();
    await processQRContent(decodedText);
  };

  const onScanError = (errorMessage: string) => {
    if (!errorMessage.includes("NotFoundException")) {
      console.warn("Scan error:", errorMessage);
    }
  };

  const handleRetry = () => {
    if (isNativePlatform && useNative) {
      startNativeScan();
    } else {
      startWebScanner();
    }
  };

  // Web / 非原生：处理选择图片后解析二维码
  const handleImageFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    // 重置 input value，避免同一张图片无法再次触发 change
    event.target.value = "";
    if (!file) return;

    if (!isValidImageFile(file)) {
      toast.error("请选择有效的图片文件（JPG/PNG/GIF/WebP/BMP）");
      return;
    }

    if (!isValidImageSize(file)) {
      toast.error(`图片大小不能超过 ${MAX_IMAGE_SIZE_MB}MB`);
      return;
    }

    const result = await parseQRFromImage(file);
    if (result) {
      await processQRContent(result);
    } else {
      toast.error("未能识别图片中的二维码");
    }
  };

  // Scan from photo gallery
  const scanFromGallery = async () => {
    console.log('[ScanQRCode] scanFromGallery called, isNativePlatform:', isNativePlatform);
    
    // 原生端：先用 @capacitor/camera 选择图片，再用 MLKit 解析
    if (isNativePlatform) {
      try {
        // Import Camera plugin dynamically
        const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
        
        console.log('[ScanQRCode] Opening photo gallery...');
        
        // Let user select image from gallery
        const photo = await Camera.getPhoto({
          source: CameraSource.Photos,
          resultType: CameraResultType.Uri,
          quality: 90,
        });
        
        console.log('[ScanQRCode] Photo selected:', photo);
        
        // Get the file path
        const imagePath = photo.path || photo.webPath;
        if (!imagePath) {
          toast.error("未能获取图片路径");
          return;
        }
        
        console.log('[ScanQRCode] Image path:', imagePath);
        
        // If MLKit is available, use it to scan the image
        if (BarcodeScanner) {
          try {
            console.log('[ScanQRCode] Using MLKit to scan image...');
            const result = await BarcodeScanner.readBarcodesFromImage({
              path: imagePath,
              formats: BarcodeFormat ? [BarcodeFormat.QrCode] : [],
            });
            
            console.log('[ScanQRCode] MLKit scan result:', result);

            if (result.barcodes && result.barcodes.length > 0) {
              const content =
                result.barcodes[0].rawValue || result.barcodes[0].displayValue;
              if (content) {
                await processQRContent(content);
                return;
              }
            }
            toast.error("未在图片中找到二维码");
          } catch (mlkitErr: any) {
            console.error('[ScanQRCode] MLKit readBarcodesFromImage error:', mlkitErr);
            // Fallback to web-based parsing
          }
        }
        
        // Fallback: fetch the image and use web-based QR parsing
        console.log('[ScanQRCode] Falling back to web-based QR parsing...');
        try {
          const response = await fetch(imagePath);
          const blob = await response.blob();
          const file = new File([blob], "qr-image.jpg", { type: "image/jpeg" });
          
          const qrContent = await parseQRFromImage(file);
          if (qrContent) {
            await processQRContent(qrContent);
          } else {
            toast.error("未能识别图片中的二维码");
          }
        } catch (fetchErr: any) {
          console.error('[ScanQRCode] Fetch image error:', fetchErr);
          toast.error("读取图片失败");
        }
      } catch (err: any) {
        console.error('[ScanQRCode] Gallery scan error:', err);
        if (err.message?.includes("canceled") || err.message?.includes("cancelled") || err.message?.includes("User cancelled")) {
          // User cancelled, do nothing
          return;
        }
        if (err.message?.includes("permission") || err.message?.includes("Permission")) {
          toast.error("需要相册权限，请在系统设置中允许访问相册");
        } else {
          toast.error("读取相册失败: " + (err.message || "未知错误"));
        }
      }
      return;
    }

    // Web / 非原生环境：使用 input + Html5Qrcode 解析
    if (!fileInputRef.current) {
      toast.error("当前环境不支持相册扫码");
      return;
    }
    fileInputRef.current.click();
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{t("scan.scanQRCode")}</h1>
        </div>

        {/* 相册扫码：现在原生 + Web 均可见 */}
        <Button variant="ghost" size="icon" onClick={scanFromGallery}>
          <ImageIcon className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {error ? (
          <Card className="w-full max-w-md p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {t("scan.scanFailed")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <div className="flex flex-col gap-3">
              <Button onClick={handleRetry} disabled={scanning} variant="outline">
                <Camera className="h-4 w-4 mr-2" />
                {t("scan.reScan")}
              </Button>
              <Button onClick={scanFromGallery} className="bg-primary">
                <ImageIcon className="h-4 w-4 mr-2" />
                从相册选择二维码
              </Button>
            </div>
          </Card>
        ): useNative && isNativePlatform ? (
          // Native scanning UI
          <Card className="w-full max-w-md p-6 text-center">
            <div className="relative w-48 h-48 mx-auto mb-6">
              <div className="absolute inset-0 border-2 border-primary rounded-lg" />
              <ScanLine className="absolute inset-0 m-auto h-32 w-32 text-primary animate-pulse" />
            </div>
            <p className="text-muted-foreground mb-4">
              {scanning ? "正在扫描..." : "点击下方按钮开始扫描"}
            </p>
            <div className="flex flex-col gap-3">
              <Button onClick={startNativeScan} disabled={scanning} className="bg-primary">
                <Camera className="h-4 w-4 mr-2" />
                {scanning ? "扫描中..." : "开始扫描"}
              </Button>
              <Button onClick={scanFromGallery} variant="outline">
                <ImageIcon className="h-4 w-4 mr-2" />
                从相册选择二维码
              </Button>
            </div>
          </Card>
        ) : (
          // Web scanner UI
          <div className="w-full max-w-md space-y-4">
            <Card className="overflow-hidden">
              <div
                id="qr-reader"
                ref={containerRef}
                className="w-full"
                style={{ minHeight: "300px" }}
              />
            </Card>

            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Camera className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium mb-1">{t("scan.tips")}</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• {t("scan.tip1")}</li>
                    <li>• {t("scan.tip2")}</li>
                    <li>• {t("scan.tip3")}</li>
                    <li>• {t("scan.tip4")}</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* 用于 Web 端相册选择图片 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />

      {/* Html5Qrcode scanFile / Canvas 解析所需的隐藏容器 */}
      <div id="qr-image-parser-temp" className="hidden" />
      <div id="qr-canvas-parser-temp" className="hidden" />
    </div>
  );
}
