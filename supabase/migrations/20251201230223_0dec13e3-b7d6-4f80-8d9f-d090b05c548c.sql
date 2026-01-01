-- Create helper functions for moment likes
CREATE OR REPLACE FUNCTION increment_moment_likes(moment_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.moments
  SET likes_count = likes_count + 1
  WHERE id = moment_id;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_moment_likes(moment_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.moments
  SET likes_count = GREATEST(0, likes_count - 1)
  WHERE id = moment_id;
END;
$$;