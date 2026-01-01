/**
 * QR Code Image Parser Utility
 * 从图片中解析二维码
 */

import { Html5Qrcode } from "html5-qrcode";

/**
 * 从图片文件解析二维码
 */
export async function parseQRFromImage(file: File): Promise<string | null> {
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
        console.log("[QR Parser] Html5Qrcode scanFile failed, trying canvas method");
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

/**
 * 使用 Canvas 解析二维码图片
 */
async function parseQRWithCanvas(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const img = new Image();
      
      img.onload = async () => {
        try {
          // 创建 canvas
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          
          // 限制最大尺寸以提高性能
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
          
          // 尝试使用 Html5Qrcode 从 canvas 数据 URL 解析
          const dataUrl = canvas.toDataURL('image/png');
          const blob = await fetch(dataUrl).then(r => r.blob());
          const tempFile = new File([blob], 'temp.png', { type: 'image/png' });
          
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

/**
 * 验证文件是否为有效图片
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  return validTypes.includes(file.type.toLowerCase());
}

/**
 * 获取图片文件大小限制（MB）
 */
export const MAX_IMAGE_SIZE_MB = 10;

/**
 * 验证图片文件大小
 */
export function isValidImageSize(file: File): boolean {
  return file.size <= MAX_IMAGE_SIZE_MB * 1024 * 1024;
}
