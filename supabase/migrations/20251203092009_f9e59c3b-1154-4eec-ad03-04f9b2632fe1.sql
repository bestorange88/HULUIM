-- Allow authenticated users to view invite by code (for joining)
CREATE POLICY "Anyone can view invite by code" 
ON public.group_invites 
FOR SELECT 
USING (auth.uid() IS NOT NULL);