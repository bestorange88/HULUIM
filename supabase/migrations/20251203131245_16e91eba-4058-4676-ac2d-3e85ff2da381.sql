-- Add RLS policy to allow group owners and admins to remove members
CREATE POLICY "Group owners and admins can remove members"
ON public.conversation_participants
FOR DELETE
USING (
  -- User is the group owner (created_by)
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_participants.conversation_id
    AND c.created_by = auth.uid()
  )
  OR
  -- User is an admin of the group
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
    AND cp.user_id = auth.uid()
    AND cp.role IN ('owner', 'admin')
  )
);