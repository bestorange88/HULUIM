-- Create enum for group member roles
CREATE TYPE public.group_member_role AS ENUM ('owner', 'admin', 'member');

-- Add role column to conversation_participants for group chats
ALTER TABLE public.conversation_participants 
ADD COLUMN role public.group_member_role DEFAULT 'member';

-- Add group settings columns to conversations
ALTER TABLE public.conversations
ADD COLUMN description TEXT,
ADD COLUMN announcement TEXT,
ADD COLUMN announcement_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN settings JSONB DEFAULT '{"allow_member_invite": true, "allow_member_edit_info": false, "mute_all": false}'::jsonb;

-- Create group invite links table
CREATE TABLE public.group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  use_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- RLS policies for group_invites
CREATE POLICY "Members can view group invites"
ON public.group_invites FOR SELECT
USING (is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Admins and owners can create invites"
ON public.group_invites FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = group_invites.conversation_id
    AND cp.user_id = auth.uid()
    AND cp.role IN ('owner', 'admin')
  )
  OR (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = group_invites.conversation_id
      AND (c.settings->>'allow_member_invite')::boolean = true
    )
    AND is_conversation_member(conversation_id, auth.uid())
  )
);

CREATE POLICY "Admins and owners can update invites"
ON public.group_invites FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = group_invites.conversation_id
    AND cp.user_id = auth.uid()
    AND cp.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins and owners can delete invites"
ON public.group_invites FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = group_invites.conversation_id
    AND cp.user_id = auth.uid()
    AND cp.role IN ('owner', 'admin')
  )
);

-- Update existing group creators to be owners
UPDATE public.conversation_participants cp
SET role = 'owner'
FROM public.conversations c
WHERE cp.conversation_id = c.id
AND cp.user_id = c.created_by
AND c.type = 'group';

-- Function to join group via invite
CREATE OR REPLACE FUNCTION public.join_group_via_invite(invite_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  invite_record RECORD;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Get and lock invite
  SELECT * INTO invite_record
  FROM public.group_invites
  WHERE code = invite_code
  FOR UPDATE;

  IF invite_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invite_not_found');
  END IF;

  IF NOT invite_record.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'invite_disabled');
  END IF;

  IF invite_record.expires_at IS NOT NULL AND invite_record.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'invite_expired');
  END IF;

  IF invite_record.max_uses IS NOT NULL AND invite_record.use_count >= invite_record.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'invite_max_uses');
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = invite_record.conversation_id
    AND user_id = current_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_member', 'conversation_id', invite_record.conversation_id);
  END IF;

  -- Add user to group
  INSERT INTO conversation_participants (conversation_id, user_id, role)
  VALUES (invite_record.conversation_id, current_user_id, 'member');

  -- Update invite use count
  UPDATE group_invites
  SET use_count = use_count + 1
  WHERE id = invite_record.id;

  RETURN jsonb_build_object('success', true, 'conversation_id', invite_record.conversation_id);
END;
$$;

-- Function to check if user is group admin or owner
CREATE OR REPLACE FUNCTION public.is_group_admin(_conversation_id UUID, _user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = _conversation_id
    AND user_id = COALESCE(_user_id, auth.uid())
    AND role IN ('owner', 'admin')
  );
$$;

-- Function to update member role
CREATE OR REPLACE FUNCTION public.update_group_member_role(
  _conversation_id UUID,
  _target_user_id UUID,
  _new_role group_member_role
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_role group_member_role;
  target_role group_member_role;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Get current user's role
  SELECT role INTO current_role
  FROM conversation_participants
  WHERE conversation_id = _conversation_id AND user_id = current_user_id;

  IF current_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_member');
  END IF;

  -- Get target user's role
  SELECT role INTO target_role
  FROM conversation_participants
  WHERE conversation_id = _conversation_id AND user_id = _target_user_id;

  IF target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'target_not_member');
  END IF;

  -- Only owner can change roles
  IF current_role != 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- Cannot change owner's role
  IF target_role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_change_owner');
  END IF;

  -- Update role
  UPDATE conversation_participants
  SET role = _new_role
  WHERE conversation_id = _conversation_id AND user_id = _target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to remove member from group
CREATE OR REPLACE FUNCTION public.remove_group_member(
  _conversation_id UUID,
  _target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_role group_member_role;
  target_role group_member_role;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Get current user's role
  SELECT role INTO current_role
  FROM conversation_participants
  WHERE conversation_id = _conversation_id AND user_id = current_user_id;

  IF current_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_member');
  END IF;

  -- Get target user's role
  SELECT role INTO target_role
  FROM conversation_participants
  WHERE conversation_id = _conversation_id AND user_id = _target_user_id;

  IF target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'target_not_member');
  END IF;

  -- Owner can remove anyone except themselves
  -- Admin can remove members only
  IF current_role = 'owner' THEN
    IF _target_user_id = current_user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'owner_cannot_leave');
    END IF;
  ELSIF current_role = 'admin' THEN
    IF target_role IN ('owner', 'admin') THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- Remove member
  DELETE FROM conversation_participants
  WHERE conversation_id = _conversation_id AND user_id = _target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Enable realtime for group_invites
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_invites;