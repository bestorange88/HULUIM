import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface SystemMessage {
  id: string;
  title: string;
  content: string;
  type: string;
  created_at: string;
}

export default function SystemMessages() {
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("system_messages")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (data) {
      setMessages(data);
    }
    setLoading(false);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'info':
        return '通知';
      case 'warning':
        return '警告';
      case 'announcement':
        return '公告';
      default:
        return '消息';
    }
  };

  const getTypeVariant = (type: string): "default" | "destructive" | "secondary" => {
    switch (type) {
      case 'warning':
        return 'destructive';
      case 'announcement':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-purple-50/30 to-white">
      {/* Header */}
      <div className="px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-purple-100 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-9 w-9 rounded-full hover:bg-purple-50"
        >
          <ArrowLeft className="h-5 w-5 text-purple-700" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">迅达官方</h1>
              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-purple-500">
                官方
              </Badge>
            </div>
            <p className="text-xs text-gray-500">官方通知与公告</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Shield className="h-12 w-12 mb-2 text-gray-300" />
            <p>暂无系统消息</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
              </div>
              
              {/* Message bubble */}
              <div className="flex-1 max-w-[85%]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-purple-700">迅达官方</span>
                  <Badge variant={getTypeVariant(msg.type)} className="text-[10px] px-1.5 py-0 h-4">
                    {getTypeLabel(msg.type)}
                  </Badge>
                </div>
                <div className="bg-white rounded-2xl rounded-tl-md p-4 shadow-sm border border-purple-100">
                  <h3 className="font-semibold text-gray-900 mb-2">{msg.title}</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{msg.content}</p>
                </div>
                <p className="text-xs text-gray-400 mt-1 ml-1">
                  {format(new Date(msg.created_at), "yyyy年MM月dd日 HH:mm", { locale: zhCN })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer notice */}
      <div className="px-4 py-3 bg-purple-50/50 border-t border-purple-100">
        <p className="text-xs text-center text-gray-500">
          这是来自迅达官方的系统通知，请勿回复
        </p>
      </div>
    </div>
  );
}
