-- Create a table for call invitations
CREATE TABLE public.call_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_invitations ENABLE ROW LEVEL SECURITY;

-- Policies: users can see invitations where they are caller or callee
CREATE POLICY "Users can view their own call invitations"
ON public.call_invitations
FOR SELECT
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Users can create invitations as caller
CREATE POLICY "Users can create call invitations"
ON public.call_invitations
FOR INSERT
WITH CHECK (auth.uid() = caller_id);

-- Users can update invitations they are part of
CREATE POLICY "Users can update their call invitations"
ON public.call_invitations
FOR UPDATE
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Users can delete their own invitations
CREATE POLICY "Users can delete their call invitations"
ON public.call_invitations
FOR DELETE
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Enable realtime for call invitations
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_invitations;

-- Create index for faster queries
CREATE INDEX idx_call_invitations_callee_status ON public.call_invitations(callee_id, status);
CREATE INDEX idx_call_invitations_caller_status ON public.call_invitations(caller_id, status);