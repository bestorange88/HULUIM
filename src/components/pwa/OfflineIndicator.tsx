import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { toast } from 'sonner';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('网络已恢复', {
        icon: <Wifi className="h-4 w-4" />,
      });
      // Hide indicator after a delay
      setTimeout(() => setShowIndicator(false), 2000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
      toast.warning('网络已断开，部分功能可能受限', {
        icon: <WifiOff className="h-4 w-4" />,
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      setShowIndicator(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showIndicator) return null;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-[100] py-1.5 px-4 text-center text-sm font-medium transition-all duration-300 ${
        isOnline 
          ? 'bg-green-500 text-white' 
          : 'bg-amber-500 text-white'
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4" />
            <span>网络已恢复</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span>离线模式 - 部分功能可能受限</span>
          </>
        )}
      </div>
    </div>
  );
}
