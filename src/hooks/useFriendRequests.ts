import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useFriendRequests = () => {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchPendingRequests();

    // Subscribe to friendship changes with unique channel name
    const channel = supabase
      .channel("friend-requests-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
        },
        () => {
          fetchPendingRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPendingRequests = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[useFriendRequests] No user found');
      return;
    }

    console.log('[useFriendRequests] Fetching pending requests for user:', user.id);

    // Count pending friend requests where the current user is the friend_id (receiver)
    const { count, error } = await supabase
      .from("friendships")
      .select("*", { count: "exact", head: true })
      .eq("friend_id", user.id)
      .eq("status", "pending");

    if (error) {
      console.error('[useFriendRequests] Error fetching count:', error);
    } else {
      console.log('[useFriendRequests] Pending count:', count);
    }

    setPendingCount(count || 0);
  };

  return { pendingCount, refreshPendingRequests: fetchPendingRequests };
};