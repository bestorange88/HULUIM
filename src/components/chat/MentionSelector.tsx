import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface GroupMember {
  user_id: string;
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    username: string;
  };
}

interface MentionSelectorProps {
  conversationId: string;
  searchText: string;
  onSelect: (member: GroupMember) => void;
  onClose: () => void;
}

export default function MentionSelector({
  conversationId,
  searchText,
  onSelect,
  onClose,
}: MentionSelectorProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMembers();
  }, [conversationId]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchText]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredMembers.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filteredMembers.length > 0) {
        e.preventDefault();
        onSelect(filteredMembers[selectedIndex]);
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, searchText]);

  const fetchMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[MentionSelector] No user found');
        setLoading(false);
        return;
      }

      console.log('[MentionSelector] Fetching members for conversation:', conversationId);
      const { data: memberData, error } = await supabase
        .from("conversation_participants")
        .select(`
          user_id,
          profiles!inner (
            id,
            display_name,
            avatar_url,
            username
          )
        `)
        .eq("conversation_id", conversationId)
        .neq("user_id", user.id);

      if (error) {
        console.error('[MentionSelector] Error fetching members:', error);
        setLoading(false);
        return;
      }

      console.log('[MentionSelector] Member data:', memberData);
      if (memberData) {
        const formattedMembers = memberData
          .filter((m: any) => m.profiles)
          .map((m: any) => ({
            user_id: m.user_id,
            profile: m.profiles,
          }));
        console.log('[MentionSelector] Formatted members:', formattedMembers);
        setMembers(formattedMembers);
      }
    } catch (err) {
      console.error('[MentionSelector] Exception:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter((member) => {
    if (!searchText) return true;
    const query = searchText.toLowerCase();
    return (
      member.profile.display_name.toLowerCase().includes(query) ||
      member.profile.username.toLowerCase().includes(query)
    );
  });

  if (loading || filteredMembers.length === 0) return null;

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-popover border border-border rounded-lg shadow-lg z-50"
    >
      <div 
        className="max-h-[50vh] overflow-y-auto overscroll-contain p-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
      >
        {filteredMembers.map((member, index) => (
          <div
            key={member.user_id}
            className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
              index === selectedIndex
                ? "bg-accent"
                : "hover:bg-accent/50"
            }`}
            onClick={() => onSelect(member)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={member.profile.avatar_url || ""} />
              <AvatarFallback className="text-xs">
                {member.profile.display_name[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {member.profile.display_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                @{member.profile.username}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
