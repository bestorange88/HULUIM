-- Add policy for service role to manage all verifications
CREATE POLICY "Service role can read all verifications"
ON real_name_verifications
FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Service role can update all verifications"
ON real_name_verifications
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);