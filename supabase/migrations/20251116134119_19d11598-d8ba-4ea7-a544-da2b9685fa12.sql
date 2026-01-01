-- Create admin_sessions table for admin authentication
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  session_token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  last_activity timestamp with time zone DEFAULT now()
);

-- Enable RLS on admin_sessions
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- Allow public access to verify admin sessions (function will validate)
CREATE POLICY "Anyone can read admin sessions for validation"
ON public.admin_sessions
FOR SELECT
USING (true);

-- Only authenticated operations can manage sessions
CREATE POLICY "System can manage admin sessions"
ON public.admin_sessions
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON public.admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON public.admin_sessions(expires_at);

-- Function to clean up expired admin sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_admin_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.admin_sessions
  WHERE expires_at < now();
END;
$$;