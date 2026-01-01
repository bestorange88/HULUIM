-- Allow users to update their own rejected requests back to pending
CREATE POLICY "Users can update their own rejected requests"
ON public.group_join_requests
FOR UPDATE
USING (auth.uid() = user_id AND status = 'rejected')
WITH CHECK (auth.uid() = user_id AND status = 'pending');