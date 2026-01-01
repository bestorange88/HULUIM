import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ChatArea from "@/components/chat/ChatArea";

export default function ChatDetail() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex flex-col bg-chat-bg overflow-hidden h-screen-safe max-h-screen-safe">
      <ChatArea conversationId={conversationId || null} />
    </div>
  );
}
