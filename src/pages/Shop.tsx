import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingBag, Construction } from "lucide-react";

export default function Shop() {
  const navigate = useNavigate();

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
        <h1 className="text-lg font-semibold">迅达商城</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mb-6">
          <ShoppingBag className="h-10 w-10 text-orange-500" />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Construction className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">功能开发中</h2>
        </div>
        <p className="text-muted-foreground text-center max-w-xs">
          迅达商城即将上线，敬请期待精选好物推荐
        </p>
      </div>
    </div>
  );
}
