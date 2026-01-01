-- Add DELETE policy for group_join_requests so users can delete their own rejected requests
CREATE POLICY "Users can delete their own rejected requests" 
ON public.group_join_requests 
FOR DELETE 
USING (auth.uid() = user_id AND status IN ('rejected', 'pending'));