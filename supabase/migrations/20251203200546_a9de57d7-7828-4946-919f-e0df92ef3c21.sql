-- Allow anon role to view all verifications (for admin backend)
CREATE POLICY "Anon can view all verifications"
ON public.real_name_verifications
FOR SELECT
USING (true);

-- Allow anon role to update verifications (for admin backend)
CREATE POLICY "Anon can update all verifications"
ON public.real_name_verifications
FOR UPDATE
USING (true)
WITH CHECK (true);