-- Fix RLS policy for inviting friends to groups
-- The current policy only checks conversations.created_by, but should also check
-- conversation_participants.role = 'owner' or 'admin' to allow group owners/admins to invite

-- Drop the old policy
DROP POLICY IF EXISTS participants_insert_by_self_or_creator ON public.conversation_participants;

-- Create a new helper function that checks both created_by AND owner/admin role
CREATE OR REPLACE FUNCTION public.is_group_owner_or_admin(
  _conversation_id uuid,
  _user_id uuid default auth.uid()
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Check if user is the conversation creator
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = _conversation_id
      AND c.created_by = coalesce(_user_id, auth.uid())
    )
    OR
    -- Or check if user has owner/admin role in conversation_participants
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = _conversation_id
      AND cp.user_id = coalesce(_user_id, auth.uid())
      AND cp.role IN ('owner', 'admin')
    );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_group_owner_or_admin(uuid, uuid) TO authenticated;

-- Create new policy that allows insert by self, creator, or owner/admin
CREATE POLICY participants_insert_by_self_or_owner_admin
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_group_owner_or_admin(conversation_id, auth.uid())
);
