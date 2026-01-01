import { Capacitor, registerPlugin } from '@capacitor/core';
import { toast } from 'sonner';

interface GallerySaverPlugin {
  saveImageFromUrl(options: { url: string; filename?: string }): Promise<{ success: boolean; filename: string }>;
  saveImageFromBase64(options: { data: string; filename?: string }): Promise<{ success: boolean; filename: string }>;
}

const GallerySaver = registerPlugin<GallerySaverPlugin>('GallerySaver');

export const saveImageToGallery = async (imageUrl: string): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const filename = `Alo_${Date.now()}.jpg`;
      const result = await GallerySaver.saveImageFromUrl({ url: imageUrl, filename });
      if (result.success) {
        toast.success('图片已保存到相册');
        return true;
      }
      toast.error('保存失败');
      return false;
    } catch (error) {
      console.error('[GallerySaver] Error saving image:', error);
      toast.error('保存失败: ' + (error as Error).message);
      return false;
    }
  } else {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Alo_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('图片已下载');
      return true;
    } catch (error) {
      console.error('[GallerySaver] Error downloading image:', error);
      toast.error('下载失败');
      return false;
    }
  }
};

export const saveBase64ImageToGallery = async (base64Data: string): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const filename = `Alo_${Date.now()}.jpg`;
      const result = await GallerySaver.saveImageFromBase64({ data: base64Data, filename });
      if (result.success) {
        toast.success('图片已保存到相册');
        return true;
      }
      toast.error('保存失败');
      return false;
    } catch (error) {
      console.error('[GallerySaver] Error saving base64 image:', error);
      toast.error('保存失败: ' + (error as Error).message);
      return false;
    }
  } else {
    try {
      const a = document.createElement('a');
      a.href = base64Data;
      a.download = `Alo_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('图片已下载');
      return true;
    } catch (error) {
      console.error('[GallerySaver] Error downloading base64 image:', error);
      toast.error('下载失败');
      return false;
    }
  }
};
