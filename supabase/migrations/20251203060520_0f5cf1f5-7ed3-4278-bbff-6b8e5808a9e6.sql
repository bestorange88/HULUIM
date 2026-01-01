-- Enable REPLICA IDENTITY FULL for proper realtime updates
ALTER TABLE public.call_invitations REPLICA IDENTITY FULL;