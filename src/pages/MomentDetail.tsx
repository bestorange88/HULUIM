import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AvatarWithFrame } from "@/components/avatar/AvatarWithFrame";
import { Heart, MessageCircle, Send, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
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

interface Moment {
  id: string;
  user_id: string;
  content: string;
  images: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string;
    avatar_frame?: string;
  };
  user_liked?: boolean;
}

interface Comment {
  id: string;
  moment_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string;
    avatar_frame?: string;
  };
}

export default function MomentDetail() {
  const { momentId } = useParams<{ momentId: string }>();
  const navigate = useNavigate();
  const [moment, setMoment] = useState<Moment | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);

  useEffect(() => {
    fetchMomentDetail();
    fetchComments();
    getCurrentUser();
  }, [momentId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const fetchMomentDetail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !momentId) return;

      const { data: momentData, error: momentError } = await supabase
        .from("moments")
        .select("*")
        .eq("id", momentId)
        .maybeSingle();

      if (momentError) throw momentError;
      if (!momentData) {
        toast.error("动态不存在");
        navigate("/discover");
        return;
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, avatar_frame")
        .eq("id", momentData.user_id)
        .maybeSingle();

      // Check if user liked this moment
      const { data: likeData } = await supabase
        .from("moment_likes")
        .select("moment_id")
        .eq("moment_id", momentId)
        .eq("user_id", user.id)
        .maybeSingle();

      // Parse images
      let imageUrls: string[] = [];
      try {
        if (momentData.images) {
          imageUrls = Array.isArray(momentData.images)
            ? momentData.images.map(img => typeof img === 'string' ? img : String(img))
            : [];
        }
      } catch (e) {
        console.error('Error parsing images:', e);
      }

      setMoment({
        ...momentData,
        images: imageUrls,
        profiles: {
          username: profileData?.username || "Unknown",
          display_name: profileData?.display_name || "Unknown",
          avatar_url: profileData?.avatar_url || "",
          avatar_frame: profileData?.avatar_frame
        },
        user_liked: !!likeData
      });
    } catch (error) {
      console.error("Error fetching moment:", error);
      toast.error("加载动态失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      if (!momentId) return;

      const { data: commentsData, error: commentsError } = await supabase
        .from("moment_comments")
        .select("*")
        .eq("moment_id", momentId)
        .order("created_at", { ascending: true });

      if (commentsError) throw commentsError;
      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        return;
      }

      // Fetch profiles for all commenters
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, avatar_frame")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      const commentsWithProfiles: Comment[] = commentsData.map(comment => {
        const profile = profilesMap.get(comment.user_id);
        return {
          ...comment,
          profiles: {
            username: profile?.username || "Unknown",
            display_name: profile?.display_name || "Unknown",
            avatar_url: profile?.avatar_url || "",
            avatar_frame: profile?.avatar_frame
          }
        };
      });

      setComments(commentsWithProfiles);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const handleLike = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !moment) return;

      if (moment.user_liked) {
        // Unlike
        await supabase
          .from("moment_likes")
          .delete()
          .eq("moment_id", moment.id)
          .eq("user_id", user.id);
        // Note: likes_count is automatically updated by database trigger
      } else {
        // Like
        await supabase
          .from("moment_likes")
          .insert({ moment_id: moment.id, user_id: user.id });
        // Note: likes_count is automatically updated by database trigger
      }

      fetchMomentDetail();
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error("操作失败");
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) {
      toast.error("请输入评论内容");
      return;
    }

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !momentId) return;

      const { error } = await supabase
        .from("moment_comments")
        .insert({
          moment_id: momentId,
          user_id: user.id,
          content: newComment.trim()
        });

      if (error) throw error;

      toast.success("评论成功");
      setNewComment("");
      fetchComments();
      fetchMomentDetail(); // Refresh to update comment count
    } catch (error) {
      console.error("Error posting comment:", error);
      toast.error("评论失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("moment_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      toast.success("评论已删除");
      fetchComments();
      fetchMomentDetail(); // Refresh to update comment count
      setDeleteCommentId(null);
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("删除失败");
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="p-4 border-b border-border bg-card shadow-card">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">动态详情</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!moment) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="p-4 border-b border-border bg-card shadow-card">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">动态详情</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">动态不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card shadow-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">动态详情</h1>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Moment Card */}
          <Card className="p-4 shadow-card">
            <div className="flex gap-3">
              <AvatarWithFrame
                avatarUrl={moment.profiles?.avatar_url}
                displayName={moment.profiles?.display_name}
                frameStyle={moment.profiles?.avatar_frame || "none"}
                size="md"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">
                    {moment.profiles?.display_name || moment.profiles?.username}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(moment.created_at)}
                  </span>
                </div>

                <p className="text-sm whitespace-pre-wrap mb-3">
                  {moment.content}
                </p>

                {moment.images && moment.images.length > 0 && (
                  <div className={`grid gap-2 mb-3 ${
                    moment.images.length === 1 ? "grid-cols-1" :
                    moment.images.length === 2 ? "grid-cols-2" :
                    "grid-cols-3"
                  }`}>
                    {moment.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt=""
                        className={`w-full ${
                          moment.images.length === 1 ? "max-w-xs aspect-square" : "aspect-square"
                        } object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity`}
                        onClick={() => window.open(img, '_blank')}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 pt-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                    onClick={handleLike}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        moment.user_liked ? "fill-red-500 text-red-500" : ""
                      }`}
                    />
                    <span className="text-xs">{moment.likes_count || 0}</span>
                  </Button>

                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-xs">{moment.comments_count || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Comments Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm px-1">评论 ({comments.length})</h3>
            
            {comments.length === 0 ? (
              <Card className="p-8 text-center shadow-card">
                <p className="text-muted-foreground text-sm">暂无评论</p>
                <p className="text-xs text-muted-foreground mt-1">
                  快来发表第一条评论吧！
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {comments.map((comment) => (
                  <Card key={comment.id} className="p-3 shadow-sm">
                    <div className="flex gap-2">
                      <AvatarWithFrame
                        avatarUrl={comment.profiles?.avatar_url}
                        displayName={comment.profiles?.display_name}
                        frameStyle={comment.profiles?.avatar_frame || "none"}
                        size="sm"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs">
                              {comment.profiles?.display_name || comment.profiles?.username}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(comment.created_at)}
                            </p>
                          </div>
                          {currentUserId === comment.user_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteCommentId(comment.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Comment Input */}
      <div className="p-4 border-t border-border bg-card shadow-card">
        <div className="flex gap-2">
          <Input
            placeholder="写评论..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handlePostComment();
              }
            }}
            disabled={submitting}
          />
          <Button
            size="icon"
            onClick={handlePostComment}
            disabled={submitting || !newComment.trim()}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Delete Comment Dialog */}
      <AlertDialog open={!!deleteCommentId} onOpenChange={(open) => !open && setDeleteCommentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除评论</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条评论吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCommentId && handleDeleteComment(deleteCommentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
