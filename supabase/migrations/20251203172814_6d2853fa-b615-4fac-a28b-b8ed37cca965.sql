-- Ensure REPLICA IDENTITY FULL for complete row data in realtime events
ALTER TABLE public.call_invitations REPLICA IDENTITY FULL;