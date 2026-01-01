-- Fix SECURITY DEFINER view issue by dropping and recreating without security definer
DROP VIEW IF EXISTS public.public_profiles;

-- Create a simple view without SECURITY DEFINER (default is SECURITY INVOKER)
CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  bio,
  status,
  last_seen,
  created_at
FROM public.profiles;

-- Grant select on the view
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;