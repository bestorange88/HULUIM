import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, ZoomIn, ZoomOut, Copy, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/utils/clipboard';
import { saveImageToGallery } from '@/utils/gallerySaver';

interface ImageMessageViewerProps {
  src: string;
  alt?: string;
  className?: string;
}

const ImageMessageViewer: React.FC<ImageMessageViewerProps> = ({ src, alt = '图片', className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Use native gallery saver for Android/iOS, which handles both native and web platforms
      const success = await saveImageToGallery(src);
      if (!success) {
        toast({
          title: '保存失败',
          description: '无法保存图片到相册',
          variant: 'destructive',
        });
      }
      // Success toast is handled by saveImageToGallery
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: '保存失败',
        description: '无法下载图片',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleCopyLink = async () => {
    const success = await copyToClipboard(src);
    if (success) {
      toast({ title: '链接已复制', description: '图片链接已复制到剪贴板' });
    } else {
      toast({ title: '复制失败', variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: alt, url: src });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={className}
        onClick={() => setIsOpen(true)}
      />
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-none">
          <div className="relative flex flex-col h-full">
            {/* Header with controls */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  className="text-white hover:bg-white/20"
                >
                  <ZoomOut className="h-5 w-5" />
                </Button>
                <span className="text-white text-sm">{Math.round(scale * 100)}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  className="text-white hover:bg-white/20"
                >
                  <ZoomIn className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyLink}
                  className="text-white hover:bg-white/20"
                  title="复制链接"
                >
                  <Copy className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleShare}
                  className="text-white hover:bg-white/20"
                  title="分享"
                >
                  <Share2 className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="text-white hover:bg-white/20"
                  title="保存"
                >
                  <Download className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            {/* Image container */}
            <div className="flex-1 flex items-center justify-center overflow-auto p-8 pt-16">
              <img
                src={src}
                alt={alt}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{ transform: `scale(${scale})` }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageMessageViewer;
