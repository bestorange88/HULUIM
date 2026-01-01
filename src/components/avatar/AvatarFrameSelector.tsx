import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AvatarWithFrame } from "./AvatarWithFrame";
import { Loader2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AvatarFrame {
  id: string;
  name: string;
  description: string | null;
  style_class: string;
  required_tier: string | null;
  sort_order: number;
}

interface AvatarFrameSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFrame: string | null;
  avatarUrl: string | null;
  displayName: string;
  userTier: string | null;
  onFrameSelected: (frameId: string) => void;
}

const tierLevels: Record<string, number> = {
  gold: 1,
  diamond: 2,
  elite: 3
};

const tierNames: Record<string, string> = {
  gold: "黄金会员",
  diamond: "钻石会员",
  elite: "至尊会员"
};

export function AvatarFrameSelector({
  open,
  onOpenChange,
  currentFrame,
  avatarUrl,
  displayName,
  userTier,
  onFrameSelected
}: AvatarFrameSelectorProps) {
  const { t } = useTranslation();
  const [frames, setFrames] = useState<AvatarFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFrame, setSelectedFrame] = useState(currentFrame || "none");
  const [selectedFrameStyleClass, setSelectedFrameStyleClass] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchFrames();
    }
  }, [open]);

  useEffect(() => {
    // Find the style_class for the current frame
    if (currentFrame && frames.length > 0) {
      const frame = frames.find(f => f.id === currentFrame);
      if (frame) {
        setSelectedFrameStyleClass(frame.style_class);
      } else if (currentFrame !== "none") {
        // If current frame is a style class, use it directly
        setSelectedFrameStyleClass(currentFrame);
      }
    }
  }, [currentFrame, frames]);

  const fetchFrames = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("avatar_frames")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (error) throw error;
      setFrames(data || []);
    } catch (error: any) {
      console.error("Error fetching frames:", error);
      toast.error("加载头像框失败");
    } finally {
      setLoading(false);
    }
  };

  const canUseFrame = (frame: AvatarFrame) => {
    if (!frame.required_tier) return true;
    if (!userTier) return false;
    return tierLevels[userTier] >= tierLevels[frame.required_tier];
  };

  const handleFrameSelect = (frame: AvatarFrame) => {
    setSelectedFrame(frame.id);
    setSelectedFrameStyleClass(frame.style_class);
  };

  const handleSave = async () => {
    // Prevent duplicate submissions
    if (saving) return;
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      // Save the style_class instead of id for direct use
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_frame: selectedFrameStyleClass || "none" })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("头像框已更新");
      onFrameSelected(selectedFrameStyleClass || "none");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating frame:", error);
      toast.error("更新头像框失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>选择头像框</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="mb-6 flex justify-center">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-3">预览效果</p>
                <AvatarWithFrame
                  avatarUrl={avatarUrl}
                  displayName={displayName}
                  frameStyle={selectedFrameStyleClass || selectedFrame}
                  size="xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {frames.map((frame) => {
                const isLocked = !canUseFrame(frame);
                const isSelected = selectedFrame === frame.id;

                return (
                  <div
                    key={frame.id}
                    onClick={() => !isLocked && handleFrameSelect(frame)}
                    className={`
                      relative p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
                      ${isLocked ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                  >
                    {isLocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg z-10">
                        <div className="text-center">
                          <Lock className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                          <Badge variant="secondary" className="text-xs">
                            {tierNames[frame.required_tier!]}
                          </Badge>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col items-center gap-2">
                      <AvatarWithFrame
                        avatarUrl={avatarUrl}
                        displayName={displayName}
                        frameStyle={frame.style_class}
                        size="lg"
                      />
                      <div className="text-center">
                        <p className="font-medium text-sm">{frame.name}</p>
                        {frame.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {frame.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                取消
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
