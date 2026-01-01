import { useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';

/**
 * Global Push Notification Manager
 * Initializes push notifications when user is authenticated on native platforms
 * 
 * NOTE: Push notifications are temporarily disabled on Android APK to fix login crash issue.
 * FCM configuration needs to be properly set up before re-enabling.
 */
export default function PushNotificationManager() {
  // Temporarily disabled to fix Android APK crash after login
  // The usePushNotifications hook was causing crashes on native platforms
  // because FCM/APNs is not properly configured
  console.log('Push notifications: Temporarily disabled for APK stability');
  return null;
}
