-- Add unique constraint to prevent duplicate likes
-- This ensures a user can only like a moment once
ALTER TABLE public.moment_likes
ADD CONSTRAINT moment_likes_user_moment_unique 
UNIQUE (moment_id, user_id);