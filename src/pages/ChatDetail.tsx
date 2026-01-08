import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ChatArea from "@/components/chat/ChatArea";

export default function ChatDetail() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="h-full w-full flex flex-col bg-chat-bg overflow-hidden">
      <ChatArea conversationId={conversationId || null} />
    </div>
  );
}
