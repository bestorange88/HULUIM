import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, ChevronLeft, Play, Pause, Volume2, VolumeX, Camera, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Story {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  created_at: string;
  expires_at: string;
  viewed?: boolean;
}

interface UserWithStories {
  user_id: string;
  display_name: string;
  avatar_url: string;
  stories: Story[];
  hasUnviewed: boolean;
}

export default function Stories() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [usersWithStories, setUsersWithStories] = useState<UserWithStories[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>("");
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [uploading, setUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [initialUserHandled, setInitialUserHandled] = useState(false);
  
  // Publish dialog state
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  
  // Story viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingUserIndex, setViewingUserIndex] = useState(0);
  const [viewingStoryIndex, setViewingStoryIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
      fetchStories();
    }, []);

    // Handle URL parameters after stories are loaded
    useEffect(() => {
      if (loading || initialUserHandled || usersWithStories.length === 0) return;
    
      const targetUserId = searchParams.get("user");
      const shouldCreate = searchParams.get("create");
    
      if (shouldCreate === "true") {
        videoInputRef.current?.click();
        setInitialUserHandled(true);
        return;
      }
    
      if (targetUserId) {
        const userIndex = usersWithStories.findIndex(u => u.user_id === targetUserId);
        if (userIndex >= 0) {
          openViewer(userIndex);
        }
        setInitialUserHandled(true);
      }
    }, [loading, usersWithStories, searchParams, initialUserHandled]);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  const fetchStories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setCurrentUserId(user.id);

      // Get current user's avatar
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .single();
      
      if (currentProfile) {
        setCurrentUserAvatar(currentProfile.avatar_url || "");
      }

      // Get friends list
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

      // Include current user
      friendIds.add(user.id);

      // Fetch stories from friends (not expired)
      const { data: storiesData, error: storiesError } = await supabase
        .from("stories")
        .select("*")
        .in("user_id", Array.from(friendIds))
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (storiesError) throw storiesError;

      // Fetch user profiles
      const userIds = [...new Set(storiesData?.map(s => s.user_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Fetch viewed stories
      const storyIds = storiesData?.map(s => s.id) || [];
      const { data: viewsData } = await supabase
        .from("story_views")
        .select("story_id")
        .eq("viewer_id", user.id)
        .in("story_id", storyIds);

      const viewedStoryIds = new Set(viewsData?.map(v => v.story_id) || []);

      // Group stories by user
      const userStoriesMap = new Map<string, Story[]>();
      storiesData?.forEach(story => {
        const stories = userStoriesMap.get(story.user_id) || [];
        stories.push({
          ...story,
          viewed: viewedStoryIds.has(story.id)
        });
        userStoriesMap.set(story.user_id, stories);
      });

      // Build users with stories array
      const usersArray: UserWithStories[] = [];
      
      // Current user's stories first
      if (userStoriesMap.has(user.id)) {
        const myStoriesList = userStoriesMap.get(user.id) || [];
        setMyStories(myStoriesList);
        const profile = profilesMap.get(user.id);
        usersArray.push({
          user_id: user.id,
          display_name: profile?.display_name || "Me",
          avatar_url: profile?.avatar_url || "",
          stories: myStoriesList,
          hasUnviewed: myStoriesList.some(s => !s.viewed)
        });
      }

      // Other users' stories
      userStoriesMap.forEach((stories, userId) => {
        if (userId !== user.id) {
          const profile = profilesMap.get(userId);
          usersArray.push({
            user_id: userId,
            display_name: profile?.display_name || "Unknown",
            avatar_url: profile?.avatar_url || "",
            stories: stories,
            hasUnviewed: stories.some(s => !s.viewed)
          });
        }
      });

      // Sort: users with unviewed stories first
      usersArray.sort((a, b) => {
        if (a.user_id === user.id) return -1;
        if (b.user_id === user.id) return 1;
        if (a.hasUnviewed && !b.hasUnviewed) return -1;
        if (!a.hasUnviewed && b.hasUnviewed) return 1;
        return 0;
      });

      setUsersWithStories(usersArray);
    } catch (error) {
      console.error("Error fetching stories:", error);
      toast.error("加载动态失败");
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      
      // Set selected video and open publish dialog
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      setSelectedVideo(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
      setPublishDialogOpen(true);
    };
    
    video.src = URL.createObjectURL(file);
  };

  const handlePublish = async () => {
    if (!selectedVideo) {
      toast.error("请选择视频");
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = selectedVideo.name.split(".").pop();
      const fileName = `stories/${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-files")
        .upload(fileName, selectedVideo);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("chat-files")
        .getPublicUrl(fileName);

      // Create story record with caption
      const { error: insertError } = await supabase
        .from("stories")
        .insert({
          user_id: user.id,
          video_url: publicUrl,
          caption: caption.trim() || null
        });

      if (insertError) throw insertError;

      toast.success("动态发布成功");
      
      // Reset state
      setPublishDialogOpen(false);
      setSelectedVideo(null);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
      setCaption("");
      if (videoInputRef.current) videoInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      
      fetchStories();
    } catch (error) {
      console.error("Error uploading story:", error);
      toast.error("发布失败");
    } finally {
      setUploading(false);
    }
  };

  const cancelPublish = () => {
    setPublishDialogOpen(false);
    setSelectedVideo(null);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    setCaption("");
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const openViewer = (userIndex: number) => {
    setViewingUserIndex(userIndex);
    setViewingStoryIndex(0);
    setProgress(0);
    setIsPlaying(true);
    setViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const markAsViewed = async (storyId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("story_views")
        .upsert({
          story_id: storyId,
          viewer_id: user.id
        }, {
          onConflict: 'story_id,viewer_id'
        });
    } catch (error) {
      console.error("Error marking story as viewed:", error);
    }
  };

  const goToNextStory = () => {
    const currentUser = usersWithStories[viewingUserIndex];
    if (viewingStoryIndex < currentUser.stories.length - 1) {
      setViewingStoryIndex(viewingStoryIndex + 1);
      setProgress(0);
    } else if (viewingUserIndex < usersWithStories.length - 1) {
      setViewingUserIndex(viewingUserIndex + 1);
      setViewingStoryIndex(0);
      setProgress(0);
    } else {
      closeViewer();
    }
  };

  const goToPrevStory = () => {
    if (viewingStoryIndex > 0) {
      setViewingStoryIndex(viewingStoryIndex - 1);
      setProgress(0);
    } else if (viewingUserIndex > 0) {
      const prevUser = usersWithStories[viewingUserIndex - 1];
      setViewingUserIndex(viewingUserIndex - 1);
      setViewingStoryIndex(prevUser.stories.length - 1);
      setProgress(0);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(progress);
    }
  };

  const handleVideoEnded = () => {
    goToNextStory();
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  useEffect(() => {
    if (viewerOpen && usersWithStories[viewingUserIndex]?.stories[viewingStoryIndex]) {
      const story = usersWithStories[viewingUserIndex].stories[viewingStoryIndex];
      markAsViewed(story.id);
    }
  }, [viewerOpen, viewingUserIndex, viewingStoryIndex]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    return "即将过期";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-medium">动态</h1>
        <div className="w-9" />
      </div>

      {/* Stories List */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* My Story / Add Story */}
        <div className="mb-6">
          <h2 className="text-sm text-gray-500 mb-3">我的动态</h2>
          <div className="flex items-center gap-4">
            <div 
              className="relative cursor-pointer"
              onClick={() => {
                if (myStories.length > 0) {
                  const myIndex = usersWithStories.findIndex(u => u.user_id === currentUserId);
                  if (myIndex >= 0) openViewer(myIndex);
                } else {
                  videoInputRef.current?.click();
                }
              }}
            >
              <div className={cn(
                "w-16 h-16 rounded-md p-0.5",
                myStories.length > 0 ? "bg-gradient-to-tr from-purple-500 to-pink-500" : "bg-gray-300"
              )}>
                <Avatar className="w-full h-full border-2 border-white">
                  <AvatarImage src={usersWithStories.find(u => u.user_id === currentUserId)?.avatar_url} />
                  <AvatarFallback>Me</AvatarFallback>
                </Avatar>
              </div>
              {myStories.length === 0 && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-purple-500 rounded flex items-center justify-center">
                  <Plus className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">我的动态</p>
              <p className="text-sm text-gray-500">
                {myStories.length > 0 
                  ? `${myStories.length}条动态` 
                  : "点击发布动态"}
              </p>
            </div>
            {/* Publish buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1"
              >
                <Camera className="h-4 w-4" />
                拍摄
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => videoInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1"
              >
                <Upload className="h-4 w-4" />
                上传
              </Button>
            </div>
          </div>
        </div>

        {/* Friends' Stories */}
        {usersWithStories.filter(u => u.user_id !== currentUserId).length > 0 && (
          <div>
            <h2 className="text-sm text-gray-500 mb-3">好友动态</h2>
            <div className="space-y-3">
              {usersWithStories
                .filter(u => u.user_id !== currentUserId)
                .map((user, index) => {
                  const actualIndex = usersWithStories.findIndex(u => u.user_id === user.user_id);
                  return (
                    <div 
                      key={user.user_id}
                      className="flex items-center gap-4 bg-white p-3 rounded-lg cursor-pointer hover:bg-gray-50"
                      onClick={() => openViewer(actualIndex)}
                    >
                      <div className={cn(
                        "w-14 h-14 rounded-md p-0.5",
                        user.hasUnviewed 
                          ? "bg-gradient-to-tr from-purple-500 to-pink-500" 
                          : "bg-gray-300"
                      )}>
                        <Avatar className="w-full h-full border-2 border-white">
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback>{user.display_name[0]}</AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{user.display_name}</p>
                        <p className="text-sm text-gray-500">
                          {formatTimeAgo(user.stories[0].created_at)}
                        </p>
                      </div>
                      <div className="text-sm text-gray-400">
                        {user.stories.length}条
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {usersWithStories.filter(u => u.user_id !== currentUserId).length === 0 && myStories.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>暂无动态</p>
            <p className="text-sm mt-2">发布你的第一条动态吧</p>
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
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
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={handleVideoSelect}
      />

      {/* Publish Dialog */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>发布动态</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Video Preview */}
            {videoPreviewUrl && (
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                <video
                  src={videoPreviewUrl}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                />
              </div>
            )}
            
            {/* Caption Input */}
            <Textarea
              placeholder="添加文字说明..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="resize-none"
              rows={3}
              maxLength={200}
            />
            <p className="text-xs text-gray-400 text-right">{caption.length}/200</p>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={cancelPublish}
                disabled={uploading}
              >
                取消
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                onClick={handlePublish}
                disabled={uploading}
              >
                {uploading ? "发布中..." : "发布"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Story Viewer Modal */}
      {viewerOpen && usersWithStories[viewingUserIndex] && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 z-10 p-2 flex gap-1">
            {usersWithStories[viewingUserIndex].stories.map((_, idx) => (
              <div key={idx} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-100"
                  style={{ 
                    width: idx < viewingStoryIndex ? '100%' : 
                           idx === viewingStoryIndex ? `${progress}%` : '0%' 
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-6 left-0 right-0 z-10 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 border-2 border-white">
                <AvatarImage src={usersWithStories[viewingUserIndex].avatar_url} />
                <AvatarFallback>{usersWithStories[viewingUserIndex].display_name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white font-medium">{usersWithStories[viewingUserIndex].display_name}</p>
                <p className="text-white/70 text-xs">
                  {formatTimeAgo(usersWithStories[viewingUserIndex].stories[viewingStoryIndex].created_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={toggleMute}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={closeViewer}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Video */}
          <div className="flex-1 flex items-center justify-center">
            <video
              ref={videoRef}
              src={usersWithStories[viewingUserIndex].stories[viewingStoryIndex].video_url}
              className="max-w-full max-h-full object-contain"
              autoPlay
              playsInline
              muted={isMuted}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
              onClick={togglePlayPause}
            />
            
            {/* Play/Pause overlay */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Play className="h-16 w-16 text-white" />
              </div>
            )}
          </div>

          {/* Navigation areas */}
          <div 
            className="absolute left-0 top-20 bottom-20 w-1/3 cursor-pointer"
            onClick={goToPrevStory}
          />
          <div 
            className="absolute right-0 top-20 bottom-20 w-1/3 cursor-pointer"
            onClick={goToNextStory}
          />

          {/* Caption */}
          {usersWithStories[viewingUserIndex].stories[viewingStoryIndex].caption && (
            <div className="absolute bottom-8 left-0 right-0 px-4">
              <p className="text-white text-center">
                {usersWithStories[viewingUserIndex].stories[viewingStoryIndex].caption}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
