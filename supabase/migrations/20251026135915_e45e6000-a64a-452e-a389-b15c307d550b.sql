-- Drop and recreate the INSERT policy for conversations with better logging
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

-- Create a simpler policy that explicitly checks auth
CREATE POLICY "Users can create conversations" 
ON public.conversations 
FOR INSERT 
TO authenticated
WITH CHECK (
  created_by = auth.uid()
);