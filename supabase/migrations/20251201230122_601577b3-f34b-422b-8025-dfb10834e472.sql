-- Create moments table for user posts (朋友圈)
CREATE TABLE IF NOT EXISTS public.moments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  images JSONB DEFAULT '[]'::jsonb,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create moment_likes table
CREATE TABLE IF NOT EXISTS public.moment_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  moment_id UUID NOT NULL REFERENCES public.moments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(moment_id, user_id)
);

-- Create moment_comments table
CREATE TABLE IF NOT EXISTS public.moment_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  moment_id UUID NOT NULL REFERENCES public.moments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_moments_user_id ON public.moments(user_id);
CREATE INDEX IF NOT EXISTS idx_moments_created_at ON public.moments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moment_likes_moment_id ON public.moment_likes(moment_id);
CREATE INDEX IF NOT EXISTS idx_moment_likes_user_id ON public.moment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_moment_comments_moment_id ON public.moment_comments(moment_id);

-- Enable RLS
ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moment_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for moments
CREATE POLICY "Users can view moments from friends"
ON public.moments FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (friendships.user_id = auth.uid() AND friendships.friend_id = moments.user_id)
       OR (friendships.friend_id = auth.uid() AND friendships.user_id = moments.user_id)
    AND friendships.status = 'accepted'
  )
);

CREATE POLICY "Users can create their own moments"
ON public.moments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own moments"
ON public.moments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own moments"
ON public.moments FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for moment_likes
CREATE POLICY "Users can view all likes"
ON public.moment_likes FOR SELECT
USING (true);

CREATE POLICY "Users can like moments"
ON public.moment_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike moments"
ON public.moment_likes FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for moment_comments
CREATE POLICY "Users can view all comments"
ON public.moment_comments FOR SELECT
USING (true);

CREATE POLICY "Users can create comments"
ON public.moment_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.moment_comments FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_moments_updated_at
BEFORE UPDATE ON public.moments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();