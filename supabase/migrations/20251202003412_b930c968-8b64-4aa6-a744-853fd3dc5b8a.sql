-- Allow authenticated users to read all verifications (for admin backend)
-- Admin backend has separate authentication via admin_sessions
CREATE POLICY "Authenticated users can view all verifications"
ON real_name_verifications
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update verifications (for admin backend)
CREATE POLICY "Authenticated users can update verifications"
ON real_name_verifications
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);