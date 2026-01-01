-- Add RLS policies for admin_accounts table
-- Only service role can manage admin accounts
CREATE POLICY "Service role can manage admin accounts"
ON admin_accounts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);