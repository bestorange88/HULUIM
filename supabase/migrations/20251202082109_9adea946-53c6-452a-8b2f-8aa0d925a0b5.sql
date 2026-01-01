-- Add join request approval system for groups
CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Enable RLS
ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own join requests"
  ON public.group_join_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create join requests"
  ON public.group_join_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Group admins can view join requests for their groups"
  ON public.group_join_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = group_join_requests.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Group admins can update join requests"
  ON public.group_join_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = group_join_requests.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.role IN ('owner', 'admin')
    )
  );

-- Add approval requirement flag to conversations
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT false;

-- Update function for timestamps
CREATE TRIGGER update_group_join_requests_updated_at
  BEFORE UPDATE ON public.group_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_group_join_requests_conversation 
  ON public.group_join_requests(conversation_id, status);
CREATE INDEX IF NOT EXISTS idx_group_join_requests_user 
  ON public.group_join_requests(user_id, status);