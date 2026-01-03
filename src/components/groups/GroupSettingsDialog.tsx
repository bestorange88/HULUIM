import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Settings,
  Link,
  Crown,
  Shield,
  User,
  MoreVertical,
  UserPlus,
  UserMinus,
  Copy,
  QrCode,
  Loader2,
  Camera,
  Volume2,
  VolumeX,
  UserCog,
  Trash2,
  Tags,
  X,
  Plus,
  Clock,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import QRCode from "qrcode";
import { GroupJoinRequestDialog } from "./GroupJoinRequestDialog";
import { Checkbox } from "@/components/ui/checkbox";

interface GroupMember {
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  is_muted?: boolean;
  muted_until?: string | null;
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    username: string;
  };
}

interface GroupInvite {
  id: string;
  code: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  is_active: boolean;
  created_at: string;
}

interface GroupSettings {
  allow_member_invite: boolean;
  allow_member_edit_info: boolean;
  mute_all: boolean;
}

interface GroupSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onUpdate?: () => void;
}

export function GroupSettingsDialog({
  open,
  onOpenChange,
  conversationId,
  onUpdate,
}: GroupSettingsDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<"owner" | "admin" | "member">("member");
  
  // Group info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [groupNote, setGroupNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [settings, setSettings] = useState<GroupSettings>({
    allow_member_invite: true,
    allow_member_edit_info: false,
    mute_all: false,
  });
  const [requireApproval, setRequireApproval] = useState(false);
  const [showJoinRequestsDialog, setShowJoinRequestsDialog] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [createdBy, setCreatedBy] = useState<string | null>(null);
  
  // Members
  const [members, setMembers] = useState<GroupMember[]>([]);
  
  // Invites
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [selectedInviteCode, setSelectedInviteCode] = useState<string | null>(null);
  
  // Transfer & Dissolve dialogs
  const [transferTarget, setTransferTarget] = useState<GroupMember | null>(null);
  const [showDissolveDialog, setShowDissolveDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showInviteFriendsDialog, setShowInviteFriendsDialog] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [invitingFriends, setInvitingFriends] = useState(false);
  
  // Mute member
  const [muteTarget, setMuteTarget] = useState<GroupMember | null>(null);
  const [muteDuration, setMuteDuration] = useState<string>("1h");

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, conversationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Load conversation details
      const { data: conv } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .single();

      if (conv) {
        setName(conv.name || "");
        setDescription((conv as any).description || "");
        setAnnouncement((conv as any).announcement || "");
        setAvatarUrl(conv.avatar_url);
        setTags(((conv as any).tags || []) as string[]);
        setGroupNote((conv as any).group_note || "");
        setRequireApproval((conv as any).require_approval || false);
        setCreatedBy(conv.created_by);
        if ((conv as any).settings) {
          setSettings((conv as any).settings as GroupSettings);
        }
      }

      // Load members with profiles
      const { data: memberData } = await supabase
        .from("conversation_participants")
        .select(`
          user_id,
          role,
          joined_at,
          is_muted,
          muted_until,
          profiles!inner (
            id,
            display_name,
            avatar_url,
            username
          )
        `)
        .eq("conversation_id", conversationId);

      if (memberData && conv) {
        const formattedMembers: GroupMember[] = memberData.map((m: any) => ({
          user_id: m.user_id,
          role: (m.user_id === conv.created_by ? "owner" : (m.role === "admin" ? "admin" : "member")) as "owner" | "admin" | "member",
          joined_at: m.joined_at,
          is_muted: m.is_muted && (!m.muted_until || new Date(m.muted_until) > new Date()),
          muted_until: m.muted_until,
          profile: m.profiles,
        }));
        setMembers(formattedMembers);
        
        const currentMember = formattedMembers.find(m => m.user_id === user.id);
        if (currentMember) {
          setCurrentUserRole(currentMember.role);
        }
      }

      // Load invites
      let { data: inviteData } = await supabase
        .from("group_invites")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false });

      // Auto-generate invite if none exists
      if (!inviteData || inviteData.length === 0) {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        const { data: newInvite, error: inviteError } = await supabase
          .from("group_invites")
          .insert({
            conversation_id: conversationId,
            created_by: user.id,
            code,
            expires_at: null, // No expiry for auto-generated invite
          })
          .select()
          .single();

        if (!inviteError && newInvite) {
          inviteData = [newInvite];
        }
      }

      if (inviteData) {
        setInvites(inviteData);
        
        // Auto-generate QR code for the first active invite
        const activeInvite = inviteData.find(inv => inv.is_active);
        if (activeInvite) {
          const inviteLink = `${getInviteBaseUrl()}/join/${activeInvite.code}`;
          try {
            const qrUrl = await QRCode.toDataURL(inviteLink, {
              width: 200,
              margin: 2,
              color: { dark: "#000000", light: "#ffffff" },
            });
            setQrCodeUrl(qrUrl);
            setSelectedInviteCode(activeInvite.code);
          } catch (err) {
            console.error("QR generation error:", err);
          }
        }
      }

      // Load pending join requests count
      const { count } = await supabase
        .from("group_join_requests")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conversationId)
        .eq("status", "pending");

      setPendingRequestsCount(count || 0);

      // Load friends for invite
      const { data: friendships } = await supabase
        .from("friendships")
        .select(`
          friend_id,
          profiles!friendships_friend_id_fkey (
            id,
            display_name,
            avatar_url,
            username
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "accepted");

      if (friendships) {
        const memberIds = new Set(memberData?.map((m: any) => m.user_id) || []);
        const availableFriends = friendships
          .filter((f: any) => {
            if (!f.profiles || memberIds.has(f.friend_id)) return false;
            const username = f.profiles.username?.toLowerCase() || '';
            return username !== 'customer_service' && username !== 'ai_assistant';
          })
          .map((f: any) => f.profiles);
        setFriends(availableFriends);
      }
    } catch (error) {
      console.error("Error loading group data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    // Prevent duplicate submissions
    if (saving) return;
    setSaving(true);
    console.log('[GroupSettings] Saving settings, name:', name, 'conversationId:', conversationId);
    try {
      const updateData = {
        name: name || null,
        description: description || null,
        announcement: announcement || null,
        announcement_updated_at: announcement ? new Date().toISOString() : null,
        tags: tags as any,
        group_note: groupNote || null,
        settings: settings as any,
        require_approval: requireApproval,
        mute_all: settings.mute_all,
      };
      console.log('[GroupSettings] Update data:', updateData);
      
      const { error, data } = await supabase
        .from("conversations")
        .update(updateData as any)
        .eq("id", conversationId)
        .select();

      console.log('[GroupSettings] Update result:', { error, data });
      if (error) throw error;

      toast({ title: t("groups.settingsSaved") });
      onUpdate?.();
    } catch (error) {
      console.error('[GroupSettings] Save error:', error);
      toast({ title: t("groups.saveError"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `group-${conversationId}-${Date.now()}.${fileExt}`;
      const filePath = `groups/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("conversations")
        .update({ avatar_url: publicUrl })
        .eq("id", conversationId);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast({ title: t("groups.avatarUpdated") });
      onUpdate?.();
    } catch (error) {
      toast({ title: t("groups.avatarError"), variant: "destructive" });
    }
  };

  const handleUpdateMemberRole = async (userId: string, newRole: "admin" | "member") => {
    try {
      const { data, error } = await supabase.rpc("update_group_member_role", {
        _conversation_id: conversationId,
        _target_user_id: userId,
        _new_role: newRole,
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        toast({ title: t(`groups.error.${result.error}`), variant: "destructive" });
        return;
      }

      toast({ title: t("groups.roleUpdated") });
      loadData();
    } catch (error) {
      toast({ title: t("groups.updateError"), variant: "destructive" });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc("remove_group_member", {
        _conversation_id: conversationId,
        _target_user_id: userId,
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        toast({ title: t(`groups.error.${result.error}`), variant: "destructive" });
        return;
      }

      toast({ title: t("groups.memberRemoved") });
      loadData();
    } catch (error) {
      toast({ title: t("groups.removeError"), variant: "destructive" });
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferTarget) return;
    
    try {
      const { data, error } = await supabase.rpc("transfer_group_ownership", {
        _conversation_id: conversationId,
        _new_owner_id: transferTarget.user_id,
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        toast({ title: t(`groups.error.${result.error}`), variant: "destructive" });
        return;
      }

      toast({ title: t("groups.ownershipTransferred") });
      setTransferTarget(null);
      loadData();
    } catch (error) {
      toast({ title: t("groups.transferError"), variant: "destructive" });
    }
  };

  const handleDissolveGroup = async () => {
    try {
      const { data, error } = await supabase.rpc("dissolve_group", {
        _conversation_id: conversationId,
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        toast({ title: t(`groups.error.${result.error}`), variant: "destructive" });
        return;
      }

      toast({ title: t("groups.groupDissolved") });
      setShowDissolveDialog(false);
      onOpenChange(false);
      onUpdate?.();
    } catch (error) {
      toast({ title: t("groups.dissolveError"), variant: "destructive" });
    }
  };

  const handleLeaveGroup = async () => {
    if (!currentUserId) return;
    
    try {
      const { error } = await supabase
        .from("conversation_participants")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", currentUserId);

      if (error) throw error;

      toast({ title: t("chat.leftGroup") });
      setShowLeaveDialog(false);
      onOpenChange(false);
      onUpdate?.();
      // Navigate to groups page after leaving
      navigate("/groups");
    } catch (error) {
      toast({ title: t("chat.leaveFailed"), variant: "destructive" });
    }
  };

  const handleInviteFriends = async () => {
    if (selectedFriends.length === 0) return;
    
    setInvitingFriends(true);
    try {
      // Add selected friends to the group
      const insertData = selectedFriends.map(friendId => ({
        conversation_id: conversationId,
        user_id: friendId,
        role: 'member' as const,
      }));

      const { error } = await supabase
        .from("conversation_participants")
        .insert(insertData);

      if (error) throw error;

      toast({ title: t("chat.inviteFriendsToGroup") + ` ${selectedFriends.length}` });
      setSelectedFriends([]);
      setShowInviteFriendsDialog(false);
      loadData();
    } catch (error) {
      toast({ title: t("chat.inviteFailed"), variant: "destructive" });
    } finally {
      setInvitingFriends(false);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleMuteMember = async () => {
    if (!muteTarget) return;
    
    try {
      // Calculate mute end time based on duration
      const now = new Date();
      let mutedUntil: Date;
      switch (muteDuration) {
        case "10m":
          mutedUntil = new Date(now.getTime() + 10 * 60 * 1000);
          break;
        case "1h":
          mutedUntil = new Date(now.getTime() + 60 * 60 * 1000);
          break;
        case "12h":
          mutedUntil = new Date(now.getTime() + 12 * 60 * 60 * 1000);
          break;
        case "1d":
          mutedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case "7d":
          mutedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case "forever":
          mutedUntil = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000); // 100 years
          break;
        default:
          mutedUntil = new Date(now.getTime() + 60 * 60 * 1000);
      }

      const { error } = await supabase
        .from("conversation_participants")
        .update({
          is_muted: true,
          muted_until: mutedUntil.toISOString(),
        })
        .eq("conversation_id", conversationId)
        .eq("user_id", muteTarget.user_id);

      if (error) throw error;

      toast({ title: `${t("groups.muteMember")} ${muteTarget.profile.display_name}` });
      setMembers(prev => prev.map(m => 
        m.user_id === muteTarget.user_id ? { ...m, is_muted: true, muted_until: mutedUntil.toISOString() } : m
      ));
      setMuteTarget(null);
      setMuteDuration("1h");
    } catch (error) {
      toast({ title: t("chat.muteFailed"), variant: "destructive" });
    }
  };

  const handleUnmuteMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("conversation_participants")
        .update({
          is_muted: false,
          muted_until: null,
        })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);

      if (error) throw error;

      toast({ title: t("chat.unmuted") });
      setMembers(prev => prev.map(m => 
        m.user_id === userId ? { ...m, is_muted: false, muted_until: null } : m
      ));
    } catch (error) {
      toast({ title: t("chat.unmuteFailed"), variant: "destructive" });
    }
  };

  const handleGenerateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: t("groups.inviteError"), variant: "destructive" });
        return;
      }

      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const { error } = await supabase
        .from("group_invites")
        .insert({
          conversation_id: conversationId,
          created_by: user.id,
          code,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        });

      if (error) throw error;

      toast({ title: t("groups.inviteCreated") });
      loadData();
    } catch (error) {
      console.error("Error generating invite:", error);
      toast({ title: t("groups.inviteError"), variant: "destructive" });
    } finally {
      setGeneratingInvite(false);
    }
  };

  // Get the proper base URL for invite links (handles Capacitor app URLs)
  const getInviteBaseUrl = () => {
    const origin = window.location.origin;
    // If running in Capacitor/localhost, use the Supabase URL's domain or a configured web URL
    if (origin.includes('localhost') || origin.includes('capacitor://') || origin.includes('127.0.0.1')) {
      // Try to get the web URL from environment or use a known production URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        // Extract project ID and construct lovable preview URL
        const projectIdMatch = supabaseUrl.match(/https:\/\/([^.]+)\./);
        if (projectIdMatch) {
          return `https://preview--${projectIdMatch[1]}.lovable.app`;
        }
      }
    }
    return origin;
  };

  const handleCopyInviteLink = (code: string) => {
    const link = `${getInviteBaseUrl()}/join/${code}`;
    navigator.clipboard.writeText(link);
    toast({ title: t("groups.linkCopied") });
  };

  const handleShowQRCode = async (code: string) => {
    const link = `${getInviteBaseUrl()}/join/${code}`;
    try {
      const url = await QRCode.toDataURL(link, { width: 256 });
      setQrCodeUrl(url);
      setSelectedInviteCode(code);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const handleToggleInvite = async (inviteId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("group_invites")
        .update({ is_active: !isActive })
        .eq("id", inviteId);

      if (error) throw error;
      loadData();
    } catch (error) {
      toast({ title: t("groups.updateError"), variant: "destructive" });
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return (
          <span className="text-sm font-medium text-rose-500">群主</span>
        );
      case "admin":
        return (
          <span className="text-sm font-medium text-rose-500">管理员</span>
        );
      default:
        return null;
    }
  };

  const canManageMembers = currentUserRole === "owner" || currentUserRole === "admin";
  const canEditSettings = currentUserRole === "owner" || (currentUserRole === "admin" && settings.allow_member_edit_info);
  const canCreateInvite = currentUserRole === "owner" || currentUserRole === "admin" || settings.allow_member_invite;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="p-0 flex flex-col"
        style={{
          maxWidth: '42rem',
          maxHeight: 'calc(100dvh - 2rem)',
        }}
      >
        <DialogHeader className="p-4 sm:p-6 pb-0 flex-shrink-0">
          <DialogTitle>{t("groups.groupSettings")}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="members" className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="overflow-x-auto flex-shrink-0">
              <TabsList className="w-max min-w-full justify-start px-4 sm:px-6 bg-transparent border-b rounded-none">
                <TabsTrigger value="members" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-xs sm:text-sm whitespace-nowrap">
                  <Users className="h-4 w-4 mr-1 sm:mr-2" />
                  {t("groups.members")} ({members.length})
                </TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-xs sm:text-sm whitespace-nowrap">
                  <Settings className="h-4 w-4 mr-1 sm:mr-2" />
                  {t("groups.settings")}
                </TabsTrigger>
                <TabsTrigger value="invites" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-xs sm:text-sm whitespace-nowrap">
                  <Link className="h-4 w-4 mr-1 sm:mr-2" />
                  {t("groups.inviteLinks")}
                </TabsTrigger>
                {currentUserRole !== "member" && requireApproval && (
                  <TabsTrigger value="requests" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-xs sm:text-sm whitespace-nowrap">
                    <Clock className="h-4 w-4 mr-1 sm:mr-2" />
                    进群申请
                    {pendingRequestsCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1">
                        {pendingRequestsCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <TabsContent value="members" className="m-0 flex-1 overflow-hidden">
              <div className="h-full max-h-[50vh] overflow-y-auto overscroll-contain">
                <div className="p-4 sm:p-6 space-y-2">
                  {/* Pending join requests notification */}
                  {canManageMembers && pendingRequestsCount > 0 && (
                    <Button
                      variant="outline"
                      className="w-full mb-3 border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20"
                      onClick={() => setShowJoinRequestsDialog(true)}
                    >
                      <Clock className="h-4 w-4 mr-2 text-amber-500" />
                      <span className="text-amber-600">
                        {pendingRequestsCount} 条入群申请待审核
                      </span>
                    </Button>
                  )}
                  
                  {/* Invite friends button */}
                  {canCreateInvite && friends.length > 0 && (
                    <Button
                      variant="outline"
                      className="w-full mb-3"
                      onClick={() => setShowInviteFriendsDialog(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      邀请好友进群
                    </Button>
                  )}
                  
                  {/* Help text for admins */}
                  {canManageMembers && (
                    <div className="p-3 mb-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                      <p>点击成员右侧的 <MoreVertical className="h-3 w-3 inline" /> 按钮管理成员</p>
                    </div>
                  )}
                  
                  {members
                    .sort((a, b) => {
                      const order = { owner: 0, admin: 1, member: 2 };
                      return order[a.role] - order[b.role];
                    })
                    .map((member) => (
                      <div
                        key={member.user_id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarImage src={member.profile.avatar_url || ""} />
                            <AvatarFallback>
                              {member.profile.display_name[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium truncate block">{member.profile.display_name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getRoleBadge(member.role)}
                          
                          {member.role !== "owner" && canManageMembers && member.user_id !== currentUserId && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {currentUserRole === "owner" && (
                                  <>
                                    {member.role === "member" ? (
                                      <DropdownMenuItem onClick={() => handleUpdateMemberRole(member.user_id, "admin")}>
                                        <Shield className="h-4 w-4 mr-2" />
                                        {t("groups.setAdmin")}
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={() => handleUpdateMemberRole(member.user_id, "member")}>
                                        <User className="h-4 w-4 mr-2" />
                                        {t("groups.removeAdmin")}
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setTransferTarget(member)}>
                                      <UserCog className="h-4 w-4 mr-2" />
                                      {t("groups.transferOwnership")}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                {member.is_muted ? (
                                  <DropdownMenuItem onClick={() => handleUnmuteMember(member.user_id)}>
                                    <Volume2 className="h-4 w-4 mr-2" />
                                    解除禁言
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => setMuteTarget(member)}>
                                    <VolumeX className="h-4 w-4 mr-2" />
                                    禁言
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleRemoveMember(member.user_id)}
                                >
                                  <UserMinus className="h-4 w-4 mr-2" />
                                  {t("groups.removeMember")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="m-0 flex-1 overflow-hidden">
              <div className="h-full max-h-[50vh] overflow-y-auto overscroll-contain">
                <div className="p-4 sm:p-6 space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={avatarUrl || ""} />
                        <AvatarFallback className="text-2xl">
                          {name?.[0]?.toUpperCase() || "G"}
                        </AvatarFallback>
                      </Avatar>
                      {canEditSettings && (
                        <label className="absolute bottom-0 right-0 p-1.5 bg-primary rounded-full cursor-pointer hover:bg-primary/90 transition-colors">
                          <Camera className="h-4 w-4 text-primary-foreground" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarUpload}
                          />
                        </label>
                      )}
                    </div>
                    <div className="flex-1">
                      <Label>{t("groups.groupName")}</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("groups.groupNamePlaceholder")}
                        disabled={!canEditSettings}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Description */}
                  <div className="space-y-2">
                    <Label>{t("groups.description")}</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t("groups.descriptionPlaceholder")}
                      disabled={!canEditSettings}
                      rows={3}
                    />
                  </div>

                  {/* Announcement - supports up to 1000 characters */}
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                      <span>{t("groups.announcement")}</span>
                      <span className="text-xs text-muted-foreground">{announcement.length}/1000</span>
                    </Label>
                    <Textarea
                      value={announcement}
                      onChange={(e) => {
                        if (e.target.value.length <= 1000) {
                          setAnnouncement(e.target.value);
                        }
                      }}
                      placeholder={t("groups.announcementPlaceholder")}
                      disabled={!canEditSettings}
                      rows={5}
                      maxLength={1000}
                    />
                  </div>

                  <Separator />

                  {/* Tags - Owner only */}
                  {currentUserRole === "owner" && (
                    <>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Tags className="h-4 w-4" />
                          {t("groups.tags")}
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            placeholder={t("groups.addTagPlaceholder")}
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTag();
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleAddTag}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="gap-1 pr-1"
                            >
                              {tag}
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(tag)}
                                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Group Note - Owner only */}
                      <div className="space-y-2">
                        <Label>{t("groups.groupNote")}</Label>
                        <Textarea
                          value={groupNote}
                          onChange={(e) => setGroupNote(e.target.value)}
                          placeholder={t("groups.groupNotePlaceholder")}
                          rows={3}
                        />
                      </div>

                      <Separator />
                    </>
                  )}

                  {/* Permissions */}
                  {currentUserRole === "owner" && (
                    <div className="space-y-4">
                      <h4 className="font-medium">{t("groups.permissions")}</h4>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{t("groups.allowMemberInvite")}</p>
                          <p className="text-xs text-muted-foreground">{t("groups.allowMemberInviteDesc")}</p>
                        </div>
                        <Switch
                          checked={settings.allow_member_invite}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, allow_member_invite: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{t("groups.allowMemberEditInfo")}</p>
                          <p className="text-xs text-muted-foreground">{t("groups.allowMemberEditInfoDesc")}</p>
                        </div>
                        <Switch
                          checked={settings.allow_member_edit_info}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, allow_member_edit_info: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{t("groups.muteAll")}</p>
                          <p className="text-xs text-muted-foreground">{t("groups.muteAllDesc")}</p>
                        </div>
                        <Switch
                          checked={settings.mute_all}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, mute_all: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">进群审核</p>
                          <p className="text-xs text-muted-foreground">开启后新成员需要管理员审核才能加入</p>
                        </div>
                        <Switch
                          checked={requireApproval}
                          onCheckedChange={setRequireApproval}
                        />
                      </div>
                    </div>
                  )}

                  {canEditSettings && (
                    <Button onClick={handleSaveSettings} disabled={saving} className="w-full">
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {t("groups.saveSettings")}
                    </Button>
                  )}

                  {currentUserRole === "owner" && (
                    <>
                      <Separator />
                      <Button
                        variant="destructive"
                        onClick={() => setShowDissolveDialog(true)}
                        className="w-full"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t("groups.dissolveGroup")}
                      </Button>
                    </>
                  )}

                  {/* Leave group button for non-owners */}
                  {currentUserRole !== "owner" && (
                    <>
                      <Separator />
                      <Button
                        variant="outline"
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setShowLeaveDialog(true)}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        退出群聊
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="invites" className="m-0 flex-1 overflow-hidden">
              <div className="h-full max-h-[50vh] overflow-y-auto overscroll-contain">
                <div className="p-4 sm:p-6 space-y-4">
                  {canCreateInvite && (
                    <Button onClick={handleGenerateInvite} disabled={generatingInvite} className="w-full">
                      {generatingInvite ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-2" />
                      )}
                      {t("groups.generateInvite")}
                    </Button>
                  )}

                  {qrCodeUrl && selectedInviteCode && (
                    <div className="p-4 border rounded-lg bg-card text-center space-y-2">
                      <img src={qrCodeUrl} alt="QR Code" className="mx-auto" />
                      <p className="text-sm text-muted-foreground">{t("groups.scanToJoin")}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setQrCodeUrl(null);
                          setSelectedInviteCode(null);
                        }}
                      >
                        {t("common.close")}
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2">
                    {invites.map((invite) => (
                      <div
                        key={invite.id}
                        className={`p-4 border rounded-lg ${!invite.is_active ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-mono font-medium">{invite.code}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("groups.usedCount", { count: invite.use_count })}
                              {invite.max_uses && ` / ${invite.max_uses}`}
                            </p>
                            {invite.expires_at && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(invite.expires_at) < new Date()
                                  ? t("groups.expired")
                                  : t("groups.expiresAt", { date: new Date(invite.expires_at).toLocaleDateString() })}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleCopyInviteLink(invite.code)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleShowQRCode(invite.code)}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            {(currentUserRole === "owner" || currentUserRole === "admin") && (
                              <Button
                                variant={invite.is_active ? "destructive" : "default"}
                                size="sm"
                                onClick={() => handleToggleInvite(invite.id, invite.is_active)}
                              >
                                {invite.is_active ? t("groups.disable") : t("groups.enable")}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {invites.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        {t("groups.noInvites")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {currentUserRole !== "member" && requireApproval && (
              <TabsContent value="requests" className="m-0">
                <div className="p-6 flex flex-col items-center justify-center h-[400px]">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">进群申请管理</h3>
                  <p className="text-sm text-muted-foreground mb-4 text-center">
                    {pendingRequestsCount > 0 
                      ? `当前有 ${pendingRequestsCount} 条待审核申请` 
                      : "暂无待审核申请"}
                  </p>
                  <Button onClick={() => setShowJoinRequestsDialog(true)}>
                    查看申请列表
                  </Button>
                </div>
              </TabsContent>
            )}
          </Tabs>
        )}
      </DialogContent>

      {/* Join Requests Dialog */}
      <GroupJoinRequestDialog
        open={showJoinRequestsDialog}
        onOpenChange={(open) => {
          setShowJoinRequestsDialog(open);
          if (!open) {
            loadData(); // Reload to update pending count
          }
        }}
        conversationId={conversationId}
      />

      {/* Transfer Ownership Dialog */}
      <AlertDialog open={!!transferTarget} onOpenChange={() => setTransferTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("groups.transferOwnership")}</AlertDialogTitle>
            <AlertDialogDescription>
              {transferTarget && t("groups.transferOwnershipConfirm", { name: transferTarget.profile.display_name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransferOwnership}>
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dissolve Group Dialog */}
      <AlertDialog open={showDissolveDialog} onOpenChange={setShowDissolveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("groups.dissolveGroup")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("groups.dissolveGroupConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDissolveGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("groups.dissolveGroup")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Group Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>退出群聊</AlertDialogTitle>
            <AlertDialogDescription>
              确定要退出群聊「{name || "未命名群组"}」吗？退出后将无法查看群聊消息。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认退出
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite Friends Dialog */}
      <Dialog open={showInviteFriendsDialog} onOpenChange={setShowInviteFriendsDialog}>
        <DialogContent className="max-w-md max-h-[70vh]">
          <DialogHeader>
            <DialogTitle>邀请好友进群</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-2 pr-4">
              {friends.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  没有可邀请的好友
                </p>
              ) : (
                friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => toggleFriendSelection(friend.id)}
                  >
                    <Checkbox
                      checked={selectedFriends.includes(friend.id)}
                      onCheckedChange={() => toggleFriendSelection(friend.id)}
                    />
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={friend.avatar_url || ""} />
                      <AvatarFallback>
                        {friend.display_name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{friend.display_name}</p>
                      <p className="text-xs text-muted-foreground truncate">@{friend.username}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowInviteFriendsDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button 
              onClick={handleInviteFriends} 
              disabled={selectedFriends.length === 0 || invitingFriends}
            >
              {invitingFriends && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              邀请 {selectedFriends.length > 0 && `(${selectedFriends.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mute Member Dialog */}
      <AlertDialog open={!!muteTarget} onOpenChange={() => setMuteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>禁言成员</AlertDialogTitle>
            <AlertDialogDescription>
              确定要禁言 {muteTarget?.profile.display_name} 吗？禁言期间该成员无法在群内发送消息。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium">禁言时长</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { value: "10m", label: "10分钟" },
                { value: "1h", label: "1小时" },
                { value: "12h", label: "12小时" },
                { value: "1d", label: "1天" },
                { value: "7d", label: "7天" },
                { value: "forever", label: "永久" },
              ].map((option) => (
                <Button
                  key={option.value}
                  variant={muteDuration === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMuteDuration(option.value)}
                  className="w-full"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleMuteMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认禁言
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
