import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUnreadCount = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUnreadCount();
    
    // Get current user ID
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
      }
    });

    // Subscribe to message changes
    const channel = supabase
      .channel("unread-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchUnreadCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUnreadCount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Get all conversations the user is part of
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id);

      if (!participants) return;

      let totalUnread = 0;

      // Calculate unread count for each conversation
      for (const p of participants) {
        const lastReadAt = p.last_read_at;
        
        if (lastReadAt) {
          const { count } = await supabase
            .from("messages")
            .select("*", { count: 'exact', head: true })
            .eq("conversation_id", p.conversation_id)
            .neq("sender_id", user.id)
            .gt("created_at", lastReadAt);
          
          totalUnread += count || 0;
        } else {
          // If never read, count all messages from others
          const { count } = await supabase
            .from("messages")
            .select("*", { count: 'exact', head: true })
            .eq("conversation_id", p.conversation_id)
            .neq("sender_id", user.id);
          
          totalUnread += count || 0;
        }
      }

      setUnreadCount(totalUnread);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  return { unreadCount, refreshUnreadCount: fetchUnreadCount };
};
