import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Global online status management hook
 * Updates user's online status in profiles table for accurate statistics
 */
export function useOnlineStatus(userId: string | null) {
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Reset IP recording flag when user changes (new login)
    const isNewUser = lastUserIdRef.current !== userId;
    lastUserIdRef.current = userId;

    const updateOnlineStatus = async (status: 'online' | 'offline', recordIp: boolean = false) => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;

      try {
        const updates: any = {
          status,
          last_seen: new Date().toISOString(),
        };

        // Record IP address on login (when recordIp is true)
        if (recordIp) {
          try {
            const ipResponse = await fetch('https://api.ipify.org?format=json', { 
              cache: 'no-store',
              signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            const ipData = await ipResponse.json();
            if (ipData.ip) {
              updates.last_login_ip = ipData.ip;
              console.log('[OnlineStatus] Recorded login IP:', ipData.ip);
            }
          } catch (ipError) {
            console.warn('[OnlineStatus] Failed to get IP address:', ipError);
          }
        }

        await supabase
          .from('profiles')
          .update(updates)
          .eq('id', userId);
        
        console.log('[OnlineStatus] Updated status:', status);
      } catch (error) {
        console.error('Failed to update online status:', error);
      } finally {
        isUpdatingRef.current = false;
      }
    };

    // Set online immediately on mount and record IP address
    updateOnlineStatus('online', true);

    // Update last_seen every 30 seconds while user is active
    heartbeatIntervalRef.current = setInterval(() => {
      updateOnlineStatus('online');
    }, 30000);

    // Set offline on page unload/close
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline status on page close
      const payload = JSON.stringify({
        id: userId,
        status: 'offline',
        last_seen: new Date().toISOString(),
      });

      // Fallback to synchronous update if sendBeacon not available
      if (navigator.sendBeacon) {
        const formData = new FormData();
        formData.append('userId', userId);
        formData.append('status', 'offline');
        // Note: sendBeacon is best-effort, we also rely on timeout-based cleanup
      } else {
        updateOnlineStatus('offline');
      }
    };

    // Handle visibility change (tab switch, minimize)
    // Only pause heartbeat when hidden, don't set offline immediately
    // This prevents false "offline" status when users just switch tabs
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Just stop the heartbeat, don't mark as offline
        // User will naturally appear offline after last_seen becomes stale
        console.log('[OnlineStatus] Tab hidden, pausing heartbeat');
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
      } else {
        // Tab is visible again, set online and restart heartbeat
        console.log('[OnlineStatus] Tab visible, resuming heartbeat');
        updateOnlineStatus('online');
        // Restart heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          updateOnlineStatus('online');
        }, 30000);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Set offline on unmount
      updateOnlineStatus('offline');
    };
  }, [userId]);
}
