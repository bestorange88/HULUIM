import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Construction, MapPinOff } from "lucide-react";

export default function NearbyPeople() {
  const navigate = useNavigate();
  const [locationEnabled, setLocationEnabled] = useState(false);

  useEffect(() => {
    // Check if location is enabled in privacy settings
    const privacySettings = localStorage.getItem("privacy_settings");
    if (privacySettings) {
      const settings = JSON.parse(privacySettings);
      setLocationEnabled(settings.enableLocation || false);
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/20">
      <div className="p-4 border-b border-border bg-card flex items-center gap-3 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">附近的人</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {!locationEnabled ? (
          <>
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
              <MapPinOff className="h-10 w-10 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">定位未开启</h2>
            <p className="text-muted-foreground text-center max-w-xs mb-4">
              请在"隐私与安全"设置中开启定位功能，才能查看附近的人
            </p>
            <Button 
              variant="outline"
              onClick={() => navigate("/privacy-security")}
            >
              前往设置
            </Button>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-6">
              <MapPin className="h-10 w-10 text-blue-500" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Construction className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold text-foreground">功能开发中</h2>
            </div>
            <p className="text-muted-foreground text-center max-w-xs">
              附近的人功能即将上线，敬请期待
            </p>
          </>
        )}
      </div>
    </div>
  );
}
