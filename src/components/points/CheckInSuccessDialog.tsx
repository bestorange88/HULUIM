import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

interface CheckInSuccessDialogProps {
  open: boolean;
  onClose: () => void;
  points: number;
  consecutiveDays: number;
}

export function CheckInSuccessDialog({ 
  open, 
  onClose, 
  points,
  consecutiveDays 
}: CheckInSuccessDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-sm mx-auto">
        <div className="flex flex-col items-center text-center py-6">
          {/* Star icon with glow effect */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-yellow-400/30 blur-3xl rounded-full animate-pulse" />
            <div className="relative bg-gradient-to-br from-yellow-200 to-yellow-400 rounded-full p-8 shadow-2xl">
              <Star className="h-16 w-16 text-yellow-600 fill-yellow-500" />
            </div>
          </div>

          {/* Success message */}
          <h3 className="text-2xl font-bold mb-2">打卡成功</h3>
          
          {/* Points earned */}
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              +{points}
            </span>
            <span className="text-muted-foreground">积分</span>
          </div>

          {/* Encouragement message */}
          <p className="text-sm text-muted-foreground mb-6">
            已连续打卡{consecutiveDays}天，当前周期第{((consecutiveDays - 1) % 7) + 1}天！
          </p>

          {/* Close button */}
          <Button 
            onClick={onClose}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            我知道了
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
