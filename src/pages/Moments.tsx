import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Heart, MessageCircle, Send, Image as ImageIcon, X, Sparkles, Trash2, Scan, Video, Play, Camera, Upload, ArrowLeft, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { MomentTags } from "@/components/moments/MomentTags";
import { AvatarWithFrame } from "@/components/avatar/AvatarWithFrame";
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


interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string;
  cover_url?: string;
}

export default function Moments() {
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
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

    useEffect(() => {
      fetchMoments();
      fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url, cover_url")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUserProfile(profile);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        setUploadingCover(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const fileExt = file.name.split(".").pop();
        const fileName = `covers/${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-images")
          .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("chat-images")
          .getPublicUrl(fileName);

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ cover_url: publicUrl })
          .eq("id", user.id);

        if (updateError) throw updateError;

        setUserProfile(prev => prev ? { ...prev, cover_url: publicUrl } : null);
        toast.success("封面更新成功");
      } catch (error) {
        console.error("Error uploading cover:", error);
        toast.error("封面上传失败");
      } finally {
        setUploadingCover(false);
        if (coverInputRef.current) coverInputRef.current.value = "";
      }
    };

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
      <div className="flex flex-col h-full bg-gray-100 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {/* Cover Wall - WeChat Style */}
          <div className="relative">
            {/* Cover Image */}
            <div 
              className="h-72 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 relative overflow-hidden cursor-pointer"
              onClick={() => coverInputRef.current?.click()}
            >
              {userProfile?.cover_url ? (
                <img 
                  src={userProfile.cover_url} 
                  alt="Cover" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white/60">
                    <ImagePlus className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">点击更换封面</p>
                  </div>
                </div>
              )}
              {uploadingCover && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-white text-sm">上传中...</div>
                </div>
              )}
              {/* Back button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 left-3 h-9 w-9 bg-black/30 hover:bg-black/50 text-white rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  window.history.back();
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {/* Camera icon for changing cover */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 h-9 w-9 bg-black/30 hover:bg-black/50 text-white rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  coverInputRef.current?.click();
                }}
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
          
            {/* User Avatar - positioned at bottom right of cover */}
            <div className="absolute -bottom-10 right-4 flex items-end gap-3">
              <span className="text-white font-semibold text-lg mb-3 drop-shadow-lg">
                {userProfile?.display_name || "加载中..."}
              </span>
              <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
                <AvatarImage src={userProfile?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xl">
                  {userProfile?.display_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
            </div>
          
            {/* Hidden cover input */}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverUpload}
            />
          </div>

          {/* Spacer for avatar overflow */}
          <div className="h-14" />

          {/* Create Moment Card */}
          <div className="px-4 pt-2 pb-4">
            <Card className="shadow-sm border-0 bg-white overflow-hidden">
              <div 
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-all duration-200"
                onClick={() => setShowPostDialog(true)}
              >
                <div className="flex-shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={userProfile?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                      <Sparkles className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1">
                  <p className="text-gray-400 text-sm">这一刻的想法...</p>
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:bg-gray-100 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadMode('local');
                      setShowPostDialog(true);
                    }}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:bg-gray-100 rounded-full"
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
                    <div className="px-4 space-y-0 pb-24">
                      {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin mb-3"></div>
                          <p className="text-sm">加载中...</p>
                        </div>
                      ) : moments.length === 0 ? (
                        <div className="py-12 text-center">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center">
                            <Sparkles className="h-8 w-8 text-gray-400" />
                          </div>
                          <p className="text-gray-600 font-medium">暂无动态</p>
                          <p className="text-sm text-gray-400 mt-1">
                            快来发布第一条动态吧！
                          </p>
                        </div>
                      ) : (
                        moments.map((moment) => (
                          <div 
                            key={moment.id} 
                            className="py-4 border-b border-gray-200 last:border-b-0 cursor-pointer"
                            onClick={() => navigate(`/moment/${moment.id}`)}
                          >
                            <div className="flex gap-3">
                              <Avatar className="h-10 w-10 flex-shrink-0">
                                <AvatarImage src={moment.profiles?.avatar_url} />
                                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm">
                                  {moment.profiles?.display_name?.charAt(0) || "U"}
                                </AvatarFallback>
                              </Avatar>

                          <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between mb-1">
                                      <h3 className="font-medium text-sm text-blue-600">
                                        {moment.profiles?.display_name || moment.profiles?.username}
                                      </h3>
                                      {moment.user_id === currentUserId && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 hover:bg-red-50 rounded-full -mt-1"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeletingMoment(moment.id);
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3 text-gray-400" />
                                        </Button>
                                      )}
                                    </div>

                                    <p className="text-sm whitespace-pre-wrap mb-2 text-gray-800 leading-relaxed">
                                      {moment.content}
                                    </p>

                                    {moment.images && moment.images.length > 0 && (
                                      <div className={`grid gap-1 mb-2 ${
                                        moment.images.length === 1 ? "grid-cols-1 max-w-[200px]" :
                                        moment.images.length === 2 ? "grid-cols-2 max-w-[240px]" :
                                        moment.images.length === 4 ? "grid-cols-2 max-w-[240px]" :
                                        "grid-cols-3 max-w-[280px]"
                                      }`}>
                                        {moment.images.map((img, idx) => (
                                          isVideoUrl(img) ? (
                                            <div key={idx} className="relative aspect-square bg-black rounded overflow-hidden">
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
                                                <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                                                  <Play className="h-5 w-5 text-white ml-0.5" />
                                                </div>
                                              </div>
                                            </div>
                                          ) : (
                                            <img
                                              key={idx}
                                              src={img}
                                              alt=""
                                              className="w-full aspect-square object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                                              onClick={(e) => handleImageClick(moment.images.filter(i => !isVideoUrl(i)), idx, e)}
                                            />
                                          )
                                        ))}
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between mt-2">
                                      <span className="text-xs text-gray-400">
                                        {formatTime(moment.created_at)}
                                      </span>
                                      <div className="flex items-center gap-4">
                                        <button
                                          className={`flex items-center gap-1 text-xs ${
                                            moment.user_liked ? "text-blue-500" : "text-gray-400"
                                          }`}
                                          disabled={likingMomentId === moment.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleLike(moment.id, moment.user_liked || false);
                                          }}
                                        >
                                          <Heart
                                            className={`h-4 w-4 ${moment.user_liked ? "fill-blue-500" : ""}`}
                                          />
                                          {moment.likes_count > 0 && <span>{moment.likes_count}</span>}
                                        </button>
                                        <button
                                          className="flex items-center gap-1 text-xs text-gray-400"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/moment/${moment.id}`);
                                          }}
                                        >
                                          <MessageCircle className="h-4 w-4" />
                                          {moment.comments_count > 0 && <span>{moment.comments_count}</span>}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
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
