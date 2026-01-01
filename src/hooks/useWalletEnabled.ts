import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useWalletEnabled() {
  const [walletEnabled, setWalletEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWalletSetting = async () => {
      try {
        const { data } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "enable_wallet")
          .maybeSingle();
        
        setWalletEnabled(data?.value !== "false");
      } catch (error) {
        console.error("Failed to fetch wallet setting:", error);
        setWalletEnabled(true); // Default to enabled
      } finally {
        setLoading(false);
      }
    };

    fetchWalletSetting();
  }, []);

  return { walletEnabled, loading };
}
