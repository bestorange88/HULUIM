import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SearchMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  onMessageClick?: (messageId: string) => void;
}

interface SearchResult {
  id: string;
  content: string;
  created_at: string;
  sender: {
    display_name: string;
    avatar_url: string | null;
  };
}

export default function SearchMessagesDialog({
  open,
  onOpenChange,
  conversationId,
  onMessageClick,
}: SearchMessagesDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!searchQuery.trim() || !conversationId) return;

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          id,
          content,
          created_at,
          sender:profiles!messages_sender_id_fkey(display_name, avatar_url)
        `)
        .eq("conversation_id", conversationId)
        .eq("is_deleted", false)
        .ilike("content", `%${searchQuery}%`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setSearchResults(data || []);
    } catch (error: any) {
      toast({
        title: "搜索失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleClear = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>搜索聊天记录</DialogTitle>
          <DialogDescription>
            在当前对话中搜索历史消息
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="输入关键词搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
            搜索
          </Button>
        </div>

        <ScrollArea className="flex-1 mt-4">
          {searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="p-3 rounded-lg bg-accent/50 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => {
                    onMessageClick?.(result.id);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {result.sender.display_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(result.created_at).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <p className="text-sm line-clamp-2">{result.content}</p>
                </div>
              ))}
            </div>
          ) : searchQuery && !isSearching ? (
            <div className="text-center text-muted-foreground py-8">
              未找到匹配的消息
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
