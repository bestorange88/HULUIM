-- Drop old SELECT policy for admins
DROP POLICY IF EXISTS "Group admins can view join requests for their groups" ON public.group_join_requests;

-- Create new policy that checks both conversation_participants.role AND conversations.created_by
CREATE POLICY "Group admins can view join requests for their groups" 
ON public.group_join_requests 
FOR SELECT 
USING (
  -- Check if user is the conversation creator (owner)
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = group_join_requests.conversation_id 
    AND c.created_by = auth.uid()
  )
  OR
  -- Or check if user has admin role in conversation_participants
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = group_join_requests.conversation_id 
    AND cp.user_id = auth.uid() 
    AND cp.role IN ('owner', 'admin')
  )
);

-- Also fix the UPDATE policy
DROP POLICY IF EXISTS "Group admins can update join requests" ON public.group_join_requests;

CREATE POLICY "Group admins can update join requests" 
ON public.group_join_requests 
FOR UPDATE 
USING (
  -- Check if user is the conversation creator (owner)
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = group_join_requests.conversation_id 
    AND c.created_by = auth.uid()
  )
  OR
  -- Or check if user has admin role in conversation_participants
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = group_join_requests.conversation_id 
    AND cp.user_id = auth.uid() 
    AND cp.role IN ('owner', 'admin')
  )
);