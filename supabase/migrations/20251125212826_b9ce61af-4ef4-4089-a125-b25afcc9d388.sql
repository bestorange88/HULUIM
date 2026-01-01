-- Allow viewing other profiles for chat functionality (without sensitive fields in application code)
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);