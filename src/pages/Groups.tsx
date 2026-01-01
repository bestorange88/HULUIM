import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GroupConversation {
  id: string;
  name: string | null;
  avatar_url: string | null;
  updated_at: string;
}

export default function Groups() {
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    checkAuth();
    fetchGroups();

    const channel = supabase
      .channel("group-conversations-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          fetchGroups();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchGroups = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: participations } = await supabase
      .from("conversation_participants")
      .select(`
        conversation_id,
        conversations!inner (
          id,
          type,
          name,
          avatar_url,
          updated_at
        )
      `)
      .eq("user_id", user.id)
      .eq("conversations.type", "group");

    if (participations) {
      const groupList = participations
        .map((p: any) => p.conversations)
        .filter(Boolean)
        .sort((a: any, b: any) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      setGroups(groupList);
    }
  };

  const filteredGroups = groups.filter((group) =>
    group.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border bg-card shadow-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("groups.searchGroups")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-muted-foreground mb-2">{t("groups.noGroups")}</p>
            <p className="text-xs text-muted-foreground">{t("groups.createGroupHint")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => navigate(`/chat/${group.id}`)}
                className="w-full p-4 hover:bg-accent/10 transition-colors text-left"
              >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={group.avatar_url || ""} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                        {group.name?.[0]?.toUpperCase() || "G"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {group.name || t("groups.unnamedGroup")}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("groups.groupChat")}</p>
                    </div>
                  </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
