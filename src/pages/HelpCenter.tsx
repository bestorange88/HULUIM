import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { ChevronRight, HelpCircle, Info, FileText, MessageSquare, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HelpCenter() {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-purple-50/30 to-white overflow-y-auto pb-20">
      {/* Header */}
      <div className="px-4 py-4 bg-white border-b border-purple-100 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">帮助中心</h1>
      </div>

      {/* Menu items */}
      <div className="px-4 space-y-4 mt-4">
        <Card className="overflow-hidden shadow-sm border-purple-100">
          <button onClick={() => navigate("/help-feedback")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors border-b border-purple-50">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-gray-700 block">帮助与反馈</span>
                <span className="text-xs text-gray-400">常见问题、意见反馈</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-purple-300" />
          </button>
          <button onClick={() => navigate("/about-us")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors border-b border-purple-50">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center">
                <Info className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-gray-700 block">关于我们</span>
                <span className="text-xs text-gray-400">了解迅达</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-purple-300" />
          </button>
          <button onClick={() => navigate("/privacy-policy")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors border-b border-purple-50">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-gradient-to-br from-green-50 to-green-100 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-gray-700 block">隐私政策</span>
                <span className="text-xs text-gray-400">了解我们如何保护您的隐私</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-purple-300" />
          </button>
          <button onClick={() => navigate("/terms-of-service")} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-gray-700 block">用户协议</span>
                <span className="text-xs text-gray-400">服务条款与使用规范</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-purple-300" />
          </button>
        </Card>
      </div>
    </div>
  );
}
