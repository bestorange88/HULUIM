import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MobileLayout from "./MobileLayout";
import DesktopLayout from "./DesktopLayout";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function ResponsiveLayout() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Initialize online status management
  useOnlineStatus(userId);

  useEffect(() => {
    // Check authentication and get user ID
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      } else {
        setUserId(session.user.id);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUserId(null);
        navigate("/auth");
      } else if (event === 'SIGNED_IN' && session) {
        setUserId(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isDesktop ? <DesktopLayout /> : <MobileLayout />;
}
