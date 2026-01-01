/**
 * QR Code Scanning Environment Detection Utility
 * 检测用户浏览器环境，判断摄像头兼容性
 */

export interface EnvironmentInfo {
  isWeChat: boolean;
  isAlipay: boolean;
  isQQBrowser: boolean;
  isUCBrowser: boolean;
  isBaiduBrowser: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isOldIOS: boolean; // iOS < 14
  isSafari: boolean;
  isChrome: boolean;
  isInAppBrowser: boolean; // 内嵌浏览器
  supportsGetUserMedia: boolean;
  recommendImageUpload: boolean; // 推荐使用图片上传
  warningMessage: string | null;
}

export function detectEnvironment(): EnvironmentInfo {
  const ua = navigator.userAgent.toLowerCase();
  
  // 浏览器/App检测
  const isWeChat = /micromessenger/i.test(ua);
  const isAlipay = /alipayclient/i.test(ua);
  const isQQBrowser = /mqqbrowser/i.test(ua) || /qq\//i.test(ua);
  const isUCBrowser = /ucbrowser/i.test(ua);
  const isBaiduBrowser = /baidu/i.test(ua);
  
  // 系统检测
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome/i.test(ua);
  const isChrome = /chrome/i.test(ua) && !/edg/i.test(ua);
  
  // iOS版本检测
  let iosVersion = 0;
  if (isIOS) {
    const match = ua.match(/os (\d+)_/);
    if (match) {
      iosVersion = parseInt(match[1], 10);
    }
  }
  const isOldIOS = isIOS && iosVersion > 0 && iosVersion < 14;
  
  // 内嵌浏览器检测
  const isInAppBrowser = isWeChat || isAlipay || isQQBrowser || 
    /webview|wv\)|fbav|instagram|line\//i.test(ua);
  
  // getUserMedia 支持检测
  const supportsGetUserMedia = !!(
    navigator.mediaDevices?.getUserMedia ||
    (navigator as any).webkitGetUserMedia ||
    (navigator as any).mozGetUserMedia
  );
  
  // 判断是否推荐使用图片上传
  let recommendImageUpload = false;
  let warningMessage: string | null = null;
  
  if (isWeChat) {
    recommendImageUpload = true;
    warningMessage = "微信内置浏览器可能无法直接调用摄像头，建议点击下方「从相册选择」上传二维码图片";
  } else if (isAlipay) {
    recommendImageUpload = true;
    warningMessage = "支付宝内置浏览器可能无法直接调用摄像头，建议点击下方「从相册选择」上传二维码图片";
  } else if (isOldIOS) {
    recommendImageUpload = true;
    warningMessage = "您的iOS版本较低，摄像头扫码可能不稳定，建议使用「从相册选择」上传二维码图片";
  } else if (isInAppBrowser && !supportsGetUserMedia) {
    recommendImageUpload = true;
    warningMessage = "当前浏览器环境可能不支持摄像头，建议使用「从相册选择」上传二维码图片";
  } else if (!supportsGetUserMedia) {
    recommendImageUpload = true;
    warningMessage = "您的浏览器不支持摄像头功能，请使用「从相册选择」上传二维码图片";
  }
  
  return {
    isWeChat,
    isAlipay,
    isQQBrowser,
    isUCBrowser,
    isBaiduBrowser,
    isIOS,
    isAndroid,
    isOldIOS,
    isSafari,
    isChrome,
    isInAppBrowser,
    supportsGetUserMedia,
    recommendImageUpload,
    warningMessage,
  };
}

/**
 * 获取摄像头约束配置，按优先级尝试
 */
export function getCameraConstraints(level: number = 0): MediaStreamConstraints | null {
  const constraints: MediaStreamConstraints[] = [
    // Level 0: 最优配置 - 后置摄像头高清
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    // Level 1: 降级 - 后置摄像头标准
    {
      video: {
        facingMode: "environment",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    },
    // Level 2: 再降级 - 前置摄像头
    {
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    },
    // Level 3: 极限降级 - 任意摄像头
    {
      video: true,
      audio: false,
    },
  ];
  
  if (level >= constraints.length) {
    return null;
  }
  
  return constraints[level];
}

/**
 * 尝试获取摄像头流，自动降级
 */
export async function getCameraStreamWithFallback(): Promise<{
  stream: MediaStream | null;
  level: number;
  error: string | null;
}> {
  for (let level = 0; level < 4; level++) {
    const constraints = getCameraConstraints(level);
    if (!constraints) break;
    
    try {
      console.log(`[Camera] Trying level ${level}:`, constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log(`[Camera] Success at level ${level}`);
      return { stream, level, error: null };
    } catch (err: any) {
      console.warn(`[Camera] Level ${level} failed:`, err.message);
      
      // 权限被拒绝，不再尝试
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return { 
          stream: null, 
          level, 
          error: "请在系统设置中允许访问摄像头" 
        };
      }
      
      // 继续尝试下一级
    }
  }
  
  return { 
    stream: null, 
    level: -1, 
    error: "无法启动摄像头，请尝试从相册选择二维码图片" 
  };
}
