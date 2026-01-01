import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, Plus, Edit, Trash2, ChevronRight, 
  FolderPlus, UserMinus, ChevronDown, GripVertical 
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import FriendGroupDialog from "./FriendGroupDialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface FriendGroup {
  id: string;
  name: string;
  color?: string;
  sort_order?: number;
}

interface Friend {
  id: string;
  friend_id: string;
  profiles: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface GroupMember {
  friend_id: string;
  group_id: string;
}

interface FriendGroupManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupsChange?: () => void;
}

interface SortableGroupItemProps {
  group: FriendGroup;
  isExpanded: boolean;
  groupFriends: Friend[];
  onToggleExpand: () => void;
  onAddFriends: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRemoveFriend: (friendId: string, groupId: string) => void;
  getColorClass: (color?: string) => string;
}

function SortableGroupItem({
  group,
  isExpanded,
  groupFriends,
  onToggleExpand,
  onAddFriends,
  onEdit,
  onDelete,
  onRemoveFriend,
  getColorClass,
}: SortableGroupItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center p-3 bg-card hover:bg-accent/10 transition-colors">
        <button
          className="mr-2 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <div
          className="flex items-center flex-1 cursor-pointer"
          onClick={onToggleExpand}
        >
          <div className={`w-3 h-3 rounded-full ${getColorClass(group.color)} mr-3`} />
          <span className="font-medium flex-1">{group.name}</span>
          <span className="text-sm text-muted-foreground mr-2">
            {groupFriends.length} 人
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onAddFriends}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onEdit}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <button onClick={onToggleExpand} className="p-1">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && groupFriends.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {groupFriends.map((friend) => (
            <div
              key={friend.friend_id}
              className="flex items-center p-3 pl-10 hover:bg-accent/5"
            >
              <Avatar className="h-8 w-8 mr-3">
                <AvatarImage src={friend.profiles.avatar_url || ""} />
                <AvatarFallback className="text-xs">
                  {friend.profiles.display_name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm">{friend.profiles.display_name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onRemoveFriend(friend.friend_id, group.id)}
              >
                <UserMinus className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {isExpanded && groupFriends.length === 0 && (
        <div className="p-4 text-center text-sm text-muted-foreground border-t border-border">
          该分组暂无好友
        </div>
      )}
    </div>
  );
}

export default function FriendGroupManager({
  open,
  onOpenChange,
  onGroupsChange,
}: FriendGroupManagerProps) {
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FriendGroup | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<FriendGroup | null>(null);
  const [addingFriendsToGroup, setAddingFriendsToGroup] = useState<FriendGroup | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch groups
      const { data: groupsData } = await supabase
        .from("friend_groups")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      // Fetch all friends (excluding system accounts)
      const { data: friendsData } = await supabase
        .from("friendships")
        .select(`
          id,
          friend_id,
          profiles:profiles!friendships_friend_id_fkey (
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "accepted");

      // Fetch group members
      const { data: membersData } = await supabase
        .from("friend_group_members")
        .select("friend_id, group_id");

      const regularFriends = (friendsData || []).filter(
        (f: any) => f.profiles?.username !== 'customer_service' && f.profiles?.username !== 'ai_assistant'
      );

      setGroups(groupsData || []);
      setFriends(regularFriends as Friend[]);
      setGroupMembers(membersData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = groups.findIndex((g) => g.id === active.id);
      const newIndex = groups.findIndex((g) => g.id === over.id);

      const newGroups = arrayMove(groups, oldIndex, newIndex);
      setGroups(newGroups);

      // Update sort_order in database
      try {
        const updates = newGroups.map((group, index) => ({
          id: group.id,
          sort_order: index,
        }));

        for (const update of updates) {
          await supabase
            .from("friend_groups")
            .update({ sort_order: update.sort_order })
            .eq("id", update.id);
        }

        toast({
          title: t("common.success"),
          description: "分组顺序已更新",
        });

        onGroupsChange?.();
      } catch (error: any) {
        console.error("Error updating sort order:", error);
        toast({
          title: t("common.error"),
          description: "更新顺序失败",
          variant: "destructive",
        });
        fetchData(); // Revert to original order
      }
    }
  };

  const toggleGroupExpand = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const getFriendsInGroup = (groupId: string) => {
    const friendIds = groupMembers
      .filter(m => m.group_id === groupId)
      .map(m => m.friend_id);
    return friends.filter(f => friendIds.includes(f.friend_id));
  };

  const getUngroupedFriends = () => {
    const groupedFriendIds = new Set(groupMembers.map(m => m.friend_id));
    return friends.filter(f => !groupedFriendIds.has(f.friend_id));
  };

  const handleEditGroup = (group: FriendGroup) => {
    setEditingGroup(group);
    setGroupDialogOpen(true);
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;

    try {
      // First delete all members from the group
      await supabase
        .from("friend_group_members")
        .delete()
        .eq("group_id", groupToDelete.id);

      // Then delete the group
      const { error } = await supabase
        .from("friend_groups")
        .delete()
        .eq("id", groupToDelete.id);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: "分组已删除",
      });

      fetchData();
      onGroupsChange?.();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || "删除失败",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirmOpen(false);
      setGroupToDelete(null);
    }
  };

  const handleRemoveFriendFromGroup = async (friendId: string, groupId: string) => {
    try {
      const { error } = await supabase
        .from("friend_group_members")
        .delete()
        .eq("friend_id", friendId)
        .eq("group_id", groupId);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: "已从分组移除",
      });

      fetchData();
      onGroupsChange?.();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || "操作失败",
        variant: "destructive",
      });
    }
  };

  const handleAddFriendToGroup = async (friendId: string, groupId: string) => {
    try {
      const { error } = await supabase
        .from("friend_group_members")
        .insert({
          friend_id: friendId,
          group_id: groupId,
        });

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: "已添加到分组",
      });

      fetchData();
      onGroupsChange?.();
      setAddingFriendsToGroup(null);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || "操作失败",
        variant: "destructive",
      });
    }
  };

  const getColorClass = (color?: string) => {
    const colorMap: Record<string, string> = {
      blue: "bg-blue-500",
      green: "bg-green-500",
      red: "bg-red-500",
      yellow: "bg-yellow-500",
      purple: "bg-purple-500",
      pink: "bg-pink-500",
    };
    return colorMap[color || "blue"] || "bg-blue-500";
  };

  const ungroupedFriends = getUngroupedFriends();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                好友分组管理
              </span>
              <Button
                size="sm"
                onClick={() => {
                  setEditingGroup(null);
                  setGroupDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                新建分组
              </Button>
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Help tips */}
              <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
                <p>• 点击 <Edit className="h-3 w-3 inline" /> 编辑分组名称和颜色</p>
                <p>• 点击 <FolderPlus className="h-3 w-3 inline" /> 向分组添加好友</p>
                <p>• 点击 <Trash2 className="h-3 w-3 inline" /> 删除分组（好友不会被删除）</p>
                <p>• 拖拽 <GripVertical className="h-3 w-3 inline" /> 调整分组顺序</p>
              </div>

              {/* Sortable groups list */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={groups.map(g => g.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {groups.map((group) => (
                    <SortableGroupItem
                      key={group.id}
                      group={group}
                      isExpanded={expandedGroups.has(group.id)}
                      groupFriends={getFriendsInGroup(group.id)}
                      onToggleExpand={() => toggleGroupExpand(group.id)}
                      onAddFriends={() => setAddingFriendsToGroup(group)}
                      onEdit={() => handleEditGroup(group)}
                      onDelete={() => {
                        setGroupToDelete(group);
                        setDeleteConfirmOpen(true);
                      }}
                      onRemoveFriend={handleRemoveFriendFromGroup}
                      getColorClass={getColorClass}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {/* Ungrouped friends */}
              {ungroupedFriends.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div
                    className="flex items-center p-3 bg-muted/50 cursor-pointer"
                    onClick={() => toggleGroupExpand("ungrouped")}
                  >
                    <div className="w-3 h-3 rounded-full bg-muted-foreground/30 mr-3" />
                    <span className="font-medium flex-1 text-muted-foreground">未分组</span>
                    <span className="text-sm text-muted-foreground mr-2">
                      {ungroupedFriends.length} 人
                    </span>
                    {expandedGroups.has("ungrouped") ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {expandedGroups.has("ungrouped") && (
                    <div className="border-t border-border divide-y divide-border">
                      {ungroupedFriends.map((friend) => (
                        <div
                          key={friend.friend_id}
                          className="flex items-center p-3 pl-6 hover:bg-accent/5"
                        >
                          <Avatar className="h-8 w-8 mr-3">
                            <AvatarImage src={friend.profiles.avatar_url || ""} />
                            <AvatarFallback className="text-xs">
                              {friend.profiles.display_name[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 text-sm">{friend.profiles.display_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {groups.length === 0 && friends.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  暂无好友和分组
                </div>
              )}

              {groups.length === 0 && friends.length > 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="mb-2">还没有创建分组</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingGroup(null);
                      setGroupDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    创建第一个分组
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Group Dialog */}
      <FriendGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        group={editingGroup}
        onSuccess={() => {
          fetchData();
          onGroupsChange?.();
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除分组</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除分组"{groupToDelete?.name}"吗？分组内的好友不会被删除，只会变为未分组状态。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Friends to Group Dialog */}
      <Dialog open={!!addingFriendsToGroup} onOpenChange={() => setAddingFriendsToGroup(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加好友到"{addingFriendsToGroup?.name}"</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {friends
                .filter(f => !groupMembers.some(m => m.friend_id === f.friend_id && m.group_id === addingFriendsToGroup?.id))
                .map((friend) => (
                  <div
                    key={friend.friend_id}
                    className="flex items-center p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => addingFriendsToGroup && handleAddFriendToGroup(friend.friend_id, addingFriendsToGroup.id)}
                  >
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarImage src={friend.profiles.avatar_url || ""} />
                      <AvatarFallback>
                        {friend.profiles.display_name[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{friend.profiles.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{friend.profiles.username}</p>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              {friends.filter(f => !groupMembers.some(m => m.friend_id === f.friend_id && m.group_id === addingFriendsToGroup?.id)).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  所有好友都已在该分组中
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
