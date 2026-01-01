import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface PushNotificationState {
  isSupported: boolean;
  isRegistered: boolean;
  token: string | null;
  error: string | null;
}

export function usePushNotifications() {
  const navigate = useNavigate();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isRegistered: false,
    token: null,
    error: null,
  });

  const isNativePlatform = Capacitor.isNativePlatform();

  // Register push notifications
  const registerPushNotifications = useCallback(async () => {
    if (!isNativePlatform) {
      console.log('Push notifications only work on native platforms');
      return;
    }

    try {
      // Check current permission status
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        // Request permission
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        setState(prev => ({
          ...prev,
          error: '推送通知权限被拒绝',
        }));
        return;
      }

      // Register with APNs/FCM
      await PushNotifications.register();
      
      setState(prev => ({
        ...prev,
        isSupported: true,
        isRegistered: true,
      }));
    } catch (error) {
      console.error('Error registering push notifications:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '注册推送通知失败',
      }));
    }
  }, [isNativePlatform]);

  // Save token to database
  const saveTokenToDatabase = useCallback(async (token: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Store token in user's profile or a dedicated table
      // For now, we'll store it in localStorage and could be extended to database
      localStorage.setItem('push_notification_token', token);
      
      console.log('Push token saved:', token);
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }, []);

  // Handle notification tap (when app is opened from notification)
  const handleNotificationAction = useCallback((notification: ActionPerformed) => {
    const data = notification.notification.data;
    
    if (data?.conversationId) {
      navigate(`/chat/${data.conversationId}`);
    } else if (data?.type === 'friend_request') {
      navigate('/contacts');
    } else if (data?.type === 'system_message') {
      navigate('/discover');
    }
  }, [navigate]);

  // Handle foreground notification
  const handleForegroundNotification = useCallback((notification: PushNotificationSchema) => {
    const { title, body, data } = notification;
    
    // Show toast for foreground notifications
    toast(title || '新消息', {
      description: body,
      action: data?.conversationId ? {
        label: '查看',
        onClick: () => navigate(`/chat/${data.conversationId}`),
      } : undefined,
    });
  }, [navigate]);

  useEffect(() => {
    if (!isNativePlatform) {
      setState(prev => ({ ...prev, isSupported: false }));
      return;
    }

    setState(prev => ({ ...prev, isSupported: true }));

    // Add listeners
    const registrationListener = PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token:', token.value);
      setState(prev => ({
        ...prev,
        token: token.value,
        isRegistered: true,
      }));
      saveTokenToDatabase(token.value);
    });

    const registrationErrorListener = PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
      setState(prev => ({
        ...prev,
        error: error.error || '注册推送失败',
        isRegistered: false,
      }));
    });

    const pushNotificationReceivedListener = PushNotifications.addListener(
      'pushNotificationReceived',
      handleForegroundNotification
    );

    const pushNotificationActionPerformedListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      handleNotificationAction
    );

    // Cleanup
    return () => {
      registrationListener.then(l => l.remove());
      registrationErrorListener.then(l => l.remove());
      pushNotificationReceivedListener.then(l => l.remove());
      pushNotificationActionPerformedListener.then(l => l.remove());
    };
  }, [isNativePlatform, saveTokenToDatabase, handleForegroundNotification, handleNotificationAction]);

  return {
    ...state,
    registerPushNotifications,
    isNativePlatform,
  };
}
