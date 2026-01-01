-- Create conversation groups table
CREATE TABLE IF NOT EXISTS public.conversation_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Create conversation group members table
CREATE TABLE IF NOT EXISTS public.conversation_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.conversation_groups(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, conversation_id)
);

-- Create friend groups table
CREATE TABLE IF NOT EXISTS public.friend_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Create friend group members table
CREATE TABLE IF NOT EXISTS public.friend_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, friend_id)
);

-- Enable RLS
ALTER TABLE public.conversation_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversation_groups
CREATE POLICY "Users can view their own conversation groups"
ON public.conversation_groups
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversation groups"
ON public.conversation_groups
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversation groups"
ON public.conversation_groups
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversation groups"
ON public.conversation_groups
FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for conversation_group_members
CREATE POLICY "Users can view their conversation group members"
ON public.conversation_group_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_groups
    WHERE id = conversation_group_members.group_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can add to their conversation groups"
ON public.conversation_group_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversation_groups
    WHERE id = group_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove from their conversation groups"
ON public.conversation_group_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_groups
    WHERE id = group_id
    AND user_id = auth.uid()
  )
);

-- RLS Policies for friend_groups
CREATE POLICY "Users can view their own friend groups"
ON public.friend_groups
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own friend groups"
ON public.friend_groups
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friend groups"
ON public.friend_groups
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own friend groups"
ON public.friend_groups
FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for friend_group_members
CREATE POLICY "Users can view their friend group members"
ON public.friend_group_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.friend_groups
    WHERE id = friend_group_members.group_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can add to their friend groups"
ON public.friend_group_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.friend_groups
    WHERE id = group_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove from their friend groups"
ON public.friend_group_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.friend_groups
    WHERE id = group_id
    AND user_id = auth.uid()
  )
);

-- Create indexes
CREATE INDEX idx_conversation_groups_user_id ON public.conversation_groups(user_id);
CREATE INDEX idx_conversation_group_members_group_id ON public.conversation_group_members(group_id);
CREATE INDEX idx_conversation_group_members_conversation_id ON public.conversation_group_members(conversation_id);
CREATE INDEX idx_friend_groups_user_id ON public.friend_groups(user_id);
CREATE INDEX idx_friend_group_members_group_id ON public.friend_group_members(group_id);
CREATE INDEX idx_friend_group_members_friend_id ON public.friend_group_members(friend_id);

-- Create triggers for updated_at
CREATE TRIGGER update_conversation_groups_updated_at
BEFORE UPDATE ON public.conversation_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_friend_groups_updated_at
BEFORE UPDATE ON public.friend_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();