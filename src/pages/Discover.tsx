import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Heart, MessageCircle, Send, Image as ImageIcon, X, Sparkles, Trash2, Scan, Video, Play, Camera, Upload } from "lucide-react";
import { toast } from "sonner";
import { MomentTags } from "@/components/moments/MomentTags";
import { AvatarWithFrame } from "@/components/avatar/AvatarWithFrame";
import Header from "@/components/layout/Header";
import ImageViewer from "@/components/moments/ImageViewer";
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
  images: any;
  video_url?: string | null;
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


export default function Discover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMomentContent, setNewMomentContent] = useState("");
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'local' | 'camera' | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoInputRef = useRef<HTMLInputElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [deletingMoment, setDeletingMoment] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likingMomentId, setLikingMomentId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMoments();
  }, []);

  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [previewUrls, videoPreviewUrl]);

  const fetchMoments= async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: friendshipsData } = await supabase
        .from("friendships")
        .select("friend_id, user_id")
        .eq("status", "accepted")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      const friendIds = new Set<string>();
      friendshipsData?.forEach(f => {
        if (f.user_id === user.id) {
          friendIds.add(f.friend_id);
        } else {
          friendIds.add(f.user_id);
        }
      });

      friendIds.add(user.id);

      if (friendIds.size === 0) {
        setMoments([]);
        return;
      }

      const { data: momentsData, error: momentsError } = await supabase
        .from("moments")
        .select("*")
        .in("user_id", Array.from(friendIds))
        .order("created_at", { ascending: false })
        .limit(20);

      if (momentsError) throw momentsError;
      if (!momentsData || momentsData.length === 0) {
        setMoments([]);
        return;
      }

      const userIds = [...new Set(momentsData.map(m => m.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, avatar_frame")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      const momentIds = momentsData.map(m => m.id);
      const { data: likesData } = await supabase
        .from("moment_likes")
        .select("moment_id")
        .eq("user_id", user.id)
        .in("moment_id", momentIds);

      const likedMomentIds = new Set(likesData?.map(l => l.moment_id) || []);

      const momentsWithProfiles: Moment[] = momentsData.map(moment => {
        const profile = profilesMap.get(moment.user_id);
        let imageUrls: string[] = [];
        try {
          if (moment.images) {
            imageUrls = Array.isArray(moment.images) 
              ? moment.images.map(img => typeof img === 'string' ? img : String(img))
              : [];
          }
        } catch (e) {
          console.error('Error parsing images:', e);
        }
        
        return {
          ...moment,
          images: imageUrls,
          profiles: {
            username: profile?.username || "Unknown",
            display_name: profile?.display_name || "Unknown",
            avatar_url: profile?.avatar_url || "",
            avatar_frame: profile?.avatar_frame
          },
          user_liked: likedMomentIds.has(moment.id)
        };
      });

      setMoments(momentsWithProfiles);
    } catch (error) {
      console.error("Error fetching moments:", error);
      toast.error("加载动态失败");
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Cannot select images if video is already selected
    if (selectedVideo) {
      toast.error("已选择视频，不能同时上传图片");
      return;
    }

    const remainingSlots = 9 - selectedImages.length;
    const filesToAdd = files.slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      toast.error(`最多只能上传9张图片`);
    }

    const newPreviewUrls = filesToAdd.map(file => URL.createObjectURL(file));
    setPreviewUrls([...previewUrls, ...newPreviewUrls]);
    setSelectedImages([...selectedImages, ...filesToAdd]);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Cannot select video if images are already selected
    if (selectedImages.length > 0) {
      toast.error("已选择图片，不能同时上传视频");
      return;
    }

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("视频文件不能超过50MB");
      return;
    }

    // Check video duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > 60) {
        toast.error("视频时长不能超过60秒");
        return;
      }
      
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(URL.createObjectURL(file));
      setSelectedVideo(file);
    };
    video.src = URL.createObjectURL(file);
  };

  const handleRemoveImage = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setPreviewUrls(previewUrls.filter((_, i) => i !== index));
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const handleRemoveVideo = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    setSelectedVideo(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleTagSelect = (tag: string) => {
    setNewMomentContent(prev => prev + tag + " ");
  };

  const handlePostMoment = async () => {
    if (!newMomentContent.trim() && selectedImages.length === 0 && !selectedVideo) {
      toast.error("请输入内容或选择图片/视频");
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const uploadedImageUrls: string[] = [];
      let uploadedVideoUrl: string | null = null;
      
      // Upload images
      for (const file of selectedImages) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-images")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("chat-images")
          .getPublicUrl(fileName);

        uploadedImageUrls.push(publicUrl);
      }

      // Upload video
      if (selectedVideo) {
        const fileExt = selectedVideo.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-files")
          .upload(fileName, selectedVideo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("chat-files")
          .getPublicUrl(fileName);

        uploadedVideoUrl = publicUrl;
      }

      // Create moment - note: video_url might need to be added to moments table
      const momentData: any = {
        user_id: user.id,
        content: newMomentContent.trim(),
        images: uploadedImageUrls.length > 0 ? uploadedImageUrls : (uploadedVideoUrl ? [uploadedVideoUrl] : [])
      };

      const { error } = await supabase
        .from("moments")
        .insert(momentData);

      if (error) throw error;

      toast.success("发布成功");
      setNewMomentContent("");
      setSelectedImages([]);
      setPreviewUrls([]);
      handleRemoveVideo();
      setShowPostDialog(false);
      fetchMoments();
    } catch (error) {
      console.error("Error posting moment:", error);
      toast.error("发布失败");
    } finally {
      setUploading(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const handleLike = async (momentId: string, currentlyLiked: boolean) => {
    if (likingMomentId === momentId) return;
    
    try {
      setLikingMomentId(momentId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (currentlyLiked) {
        await supabase
          .from("moment_likes")
          .delete()
          .eq("moment_id", momentId)
          .eq("user_id", user.id);
        // Note: likes_count is automatically updated by database trigger
      } else {
        const { error: insertError } = await supabase
          .from("moment_likes")
          .insert({ moment_id: momentId, user_id: user.id });

        if (insertError && insertError.code !== '23505') {
          throw insertError;
        }
        // Note: likes_count is automatically updated by database trigger
      }

      fetchMoments();
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error("操作失败，请稍后重试");
    } finally {
      setLikingMomentId(null);
    }
  };

  const handleDeleteMoment = async (momentId: string) => {
    try {
      const { error } = await supabase
        .from("moments")
        .delete()
        .eq("id", momentId)
        .eq("user_id", currentUserId);

      if (error) throw error;

      toast.success("删除成功");
      setDeletingMoment(null);
      fetchMoments();
    } catch (error) {
      console.error("Error deleting moment:", error);
      toast.error("删除失败");
    }
  };

  const handleImageClick = (images: string[], index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setViewerImages(images);
    setViewerInitialIndex(index);
    setViewerOpen(true);
  };

  const isVideoUrl = (url: string) => {
    return /\.(mp4|webm|mov|avi|mkv)$/i.test(url);
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


  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/20 overflow-hidden">
      <Header 
        title="朋友圈" 
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4 pb-24">
          {/* Create Moment Card */}
          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm overflow-hidden">
            <div 
              className="p-4 flex items-center gap-4 cursor-pointer hover:bg-accent/5 transition-all duration-200"
              onClick={() => setShowPostDialog(true)}
            >
              <div className="flex-shrink-0">
                <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                    <Sparkles className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground text-sm">分享你的想法...</p>
              </div>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-9 w-9 text-primary hover:bg-primary/10 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadMode('local');
                    setShowPostDialog(true);
                  }}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-9 w-9 text-accent hover:bg-accent/10 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadMode('camera');
                    setShowPostDialog(true);
                  }}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Post Dialog Content */}
            {showPostDialog && (
              <div className="border-t border-border p-4 space-y-4">
                <Textarea
                  placeholder="分享你的想法..."
                  value={newMomentContent}
                  onChange={(e) => setNewMomentContent(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
                
                {/* Image Previews */}
                {previewUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {previewUrls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square">
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => handleRemoveImage(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Video Preview */}
                {videoPreviewUrl && (
                  <div className="relative">
                    <video
                      src={videoPreviewUrl}
                      className="w-full max-h-64 rounded-lg object-cover"
                      controls
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={handleRemoveVideo}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex gap-2 items-center">
                    {uploadMode === 'local' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => imageInputRef.current?.click()}
                          disabled={selectedImages.length >= 9 || !!selectedVideo}
                          type="button"
                        >
                          <ImageIcon className="h-4 w-4 mr-1" />
                          图片
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => videoInputRef.current?.click()}
                          disabled={selectedImages.length > 0 || !!selectedVideo}
                          type="button"
                        >
                          <Video className="h-4 w-4 mr-1" />
                          视频
                        </Button>
                      </>
                    )}
                    {uploadMode === 'camera' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cameraInputRef.current?.click()}
                          disabled={selectedImages.length >= 9 || !!selectedVideo}
                          type="button"
                        >
                          <Camera className="h-4 w-4 mr-1" />
                          拍照
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cameraVideoInputRef.current?.click()}
                          disabled={selectedImages.length > 0 || !!selectedVideo}
                          type="button"
                        >
                          <Video className="h-4 w-4 mr-1" />
                          录像
                        </Button>
                      </>
                    )}
                    <MomentTags onTagSelect={handleTagSelect} />
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleVideoSelect}
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    <input
                      ref={cameraVideoInputRef}
                      type="file"
                      accept="video/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleVideoSelect}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowPostDialog(false);
                        setNewMomentContent("");
                        setSelectedImages([]);
                        previewUrls.forEach(url => URL.revokeObjectURL(url));
                        setPreviewUrls([]);
                        handleRemoveVideo();
                        setUploadMode(null);
                      }}
                      disabled={uploading}
                    >
                      取消
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handlePostMoment}
                      disabled={uploading}
                    >
                      {uploading ? "发布中..." : "发布"}
                    </Button>
                  </div>
                </div>
                {selectedImages.length > 0 && (
                  <p className="text-xs text-muted-foreground text-right">
                    已选择 {selectedImages.length}/9 张图片
                  </p>
                )}
                {selectedVideo && (
                  <p className="text-xs text-muted-foreground text-right">
                    已选择视频（最长60秒，最大50MB）
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Moments Feed */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3"></div>
                <p className="text-sm">加载中...</p>
              </div>
            ) : moments.length === 0 ? (
              <Card className="p-8 text-center shadow-lg border-0 bg-card/80 backdrop-blur-sm">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary/60" />
                </div>
                <p className="text-foreground font-medium">暂无动态</p>
                <p className="text-sm text-muted-foreground mt-1">
                  快来发布第一条动态吧！
                </p>
              </Card>
            ) : (
              moments.map((moment) => (
                <Card 
                  key={moment.id} 
                  className="shadow-lg border-0 bg-card/80 backdrop-blur-sm overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-200"
                  onClick={() => navigate(`/moment/${moment.id}`)}
                >
                  <div className="p-4 flex gap-3">
                    <AvatarWithFrame
                      avatarUrl={moment.profiles?.avatar_url}
                      displayName={moment.profiles?.display_name}
                      size="md"
                      className="cursor-pointer flex-shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-sm text-foreground">
                          {moment.profiles?.display_name || moment.profiles?.username}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatTime(moment.created_at)}
                          </span>
                          {moment.user_id === currentUserId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-destructive/10 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingMoment(moment.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <p className="text-sm whitespace-pre-wrap mb-3 text-foreground/90 leading-relaxed">
                        {moment.content}
                      </p>

                      {moment.images && moment.images.length > 0 && (
                        <div className={`grid gap-1.5 mb-3 ${
                          moment.images.length === 1 ? "grid-cols-1 max-w-[240px]" :
                          moment.images.length === 2 ? "grid-cols-2 max-w-[280px]" :
                          moment.images.length === 4 ? "grid-cols-2 max-w-[280px]" :
                          "grid-cols-3 max-w-[320px]"
                        }`}>
                          {moment.images.map((img, idx) => (
                            isVideoUrl(img) ? (
                              <div key={idx} className="relative aspect-square bg-black rounded-xl overflow-hidden shadow-sm">
                                <video
                                  src={img}
                                  className="w-full h-full object-cover"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const video = e.target as HTMLVideoElement;
                                    if (video.paused) {
                                      video.play();
                                    } else {
                                      video.pause();
                                    }
                                  }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
                                  <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                                    <Play className="h-6 w-6 text-white ml-0.5" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img
                                key={idx}
                                src={img}
                                alt=""
                                className="w-full aspect-square object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                                onClick={(e) => handleImageClick(moment.images.filter(i => !isVideoUrl(i)), idx, e)}
                              />
                            )
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-1 pt-3 mt-3 border-t border-border/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`flex items-center gap-1.5 rounded-full px-3 transition-all duration-200 ${
                            moment.user_liked 
                              ? "text-primary bg-primary/10" 
                              : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                          }`}
                          disabled={likingMomentId === moment.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLike(moment.id, moment.user_liked || false);
                          }}
                        >
                          <Heart
                            className={`h-4 w-4 transition-transform ${moment.user_liked ? "fill-primary scale-110" : ""}`}
                          />
                          <span className="text-xs font-medium">{moment.likes_count || 0}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full px-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/moment/${moment.id}`);
                          }}
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span className="text-xs font-medium">{moment.comments_count || 0}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Image Viewer */}
      <ImageViewer
        images={viewerImages}
        initialIndex={viewerInitialIndex}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingMoment} onOpenChange={() => setDeletingMoment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条动态吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingMoment && handleDeleteMoment(deletingMoment)}
              className="bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
