-- Create trigger to automatically update comments_count on moments table

-- Function to increment comments count
CREATE OR REPLACE FUNCTION public.increment_moment_comments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.moments
  SET comments_count = comments_count + 1
  WHERE id = NEW.moment_id;
  RETURN NEW;
END;
$$;

-- Function to decrement comments count
CREATE OR REPLACE FUNCTION public.decrement_moment_comments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.moments
  SET comments_count = GREATEST(0, comments_count - 1)
  WHERE id = OLD.moment_id;
  RETURN OLD;
END;
$$;

-- Create trigger for INSERT on moment_comments
CREATE TRIGGER increment_comments_count
AFTER INSERT ON public.moment_comments
FOR EACH ROW
EXECUTE FUNCTION public.increment_moment_comments();

-- Create trigger for DELETE on moment_comments
CREATE TRIGGER decrement_comments_count
AFTER DELETE ON public.moment_comments
FOR EACH ROW
EXECUTE FUNCTION public.decrement_moment_comments();