import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PERFORMANCE_CONFIG, createThrottle, createDebounce } from '@/config/performance';

interface PresenceState {
  isOnline: boolean;
  lastSeen: string | null;
  isTyping: boolean;
  isRecording: boolean;
}

interface UsePresenceProps {
  conversationId: string | null;
  currentUserId: string | null;
  otherUserId: string | null;
  memberCount?: number;
}

export function usePresence({ conversationId, currentUserId, otherUserId, memberCount = 0 }: UsePresenceProps) {
  const [otherUserPresence, setOtherUserPresence] = useState<PresenceState>({
    isOnline: false,
    lastSeen: null,
    isTyping: false,
    isRecording: false,
  });
  
  const [isInConversation, setIsInConversation] = useState(false);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const profileSubscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingUpdateRef = useRef<number>(0);
  
  // 判断是否应该禁用 typing 状态（大群聊优化）
  const typingDisabled = memberCount >= PERFORMANCE_CONFIG.TYPING_DISABLED_THRESHOLD;

  // 节流的 typing 更新函数
  const throttledTrack = useMemo(() => 
    createThrottle((channel: any, state: any) => {
      channel?.track(state);
    }, 2000), // 2秒节流
  []);

  // Fetch and subscribe to other user's profile status from database
  useEffect(() => {
    if (!otherUserId) return;

    let isMounted = true;

    const fetchProfileStatus = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('status, last_seen')
        .eq('id', otherUserId)
        .single();

      if (profile && isMounted) {
        if (!isInConversation) {
          setOtherUserPresence(prev => ({
            ...prev,
            isOnline: profile.status === 'online',
            lastSeen: profile.last_seen,
          }));
        }
      }
    };

    fetchProfileStatus();

    // Subscribe to profile changes - 使用更长的节流间隔
    const profileChannel = supabase
      .channel(`profile-status-${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${otherUserId}`,
        },
        (payload) => {
          if (!isMounted) return;
          const newProfile = payload.new as any;
          if (!isInConversation) {
            setOtherUserPresence(prev => ({
              ...prev,
              isOnline: newProfile.status === 'online',
              lastSeen: newProfile.last_seen,
            }));
          }
        }
      )
      .subscribe();

    profileSubscriptionRef.current = profileChannel;

    return () => {
      isMounted = false;
      profileChannel.unsubscribe();
      profileSubscriptionRef.current = null;
    };
  }, [otherUserId, isInConversation]);

  // Presence channel for typing/recording
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    // 大群聊完全禁用 presence channel
    if (memberCount > 500) {
      return;
    }

    const channel = supabase.channel(`presence-${conversationId}`, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        
        if (otherUserId && state[otherUserId]) {
          const otherState = state[otherUserId][0] as any;
          setIsInConversation(true);
          setOtherUserPresence({
            isOnline: true,
            lastSeen: new Date().toISOString(),
            isTyping: otherState?.isTyping || false,
            isRecording: otherState?.isRecording || false,
          });
        } else if (otherUserId) {
          setIsInConversation(false);
          setOtherUserPresence(prev => ({
            ...prev,
            isTyping: false,
            isRecording: false,
          }));
        }
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (key === otherUserId) {
          const presence = newPresences[0] as any;
          setIsInConversation(true);
          setOtherUserPresence({
            isOnline: true,
            lastSeen: new Date().toISOString(),
            isTyping: presence?.isTyping || false,
            isRecording: presence?.isRecording || false,
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key === otherUserId) {
          setIsInConversation(false);
          setOtherUserPresence(prev => ({
            ...prev,
            isTyping: false,
            isRecording: false,
          }));
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            isTyping: false,
            isRecording: false,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [conversationId, currentUserId, otherUserId, memberCount]);

  // 防抖的 setTyping 函数
  const setTyping = useCallback((isTyping: boolean) => {
    if (!channelRef.current) return;
    
    // 大群聊禁用 typing 状态
    if (typingDisabled) return;

    // 节流：2秒内只发送一次 typing 状态
    const now = Date.now();
    if (isTyping && now - lastTypingUpdateRef.current < 2000) {
      return;
    }
    lastTypingUpdateRef.current = now;

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    throttledTrack(channelRef.current, {
      isTyping,
      isRecording: false,
      online_at: new Date().toISOString(),
    });

    // Auto-clear typing after timeout
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        channelRef.current?.track({
          isTyping: false,
          isRecording: false,
          online_at: new Date().toISOString(),
        });
      }, PERFORMANCE_CONFIG.TYPING_AUTO_CLEAR_TIMEOUT);
    }
  }, [typingDisabled, throttledTrack]);

  const setRecording = useCallback((isRecording: boolean) => {
    if (!channelRef.current) return;
    if (typingDisabled) return; // 大群聊也禁用 recording 状态

    channelRef.current.track({
      isTyping: false,
      isRecording,
      online_at: new Date().toISOString(),
    });
  }, [typingDisabled]);

  return {
    otherUserPresence,
    setTyping,
    setRecording,
    typingDisabled,
  };
}
