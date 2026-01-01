-- Add RLS policies for remaining admin tables

-- Admin sessions: Only service role can manage
CREATE POLICY "Service role can manage admin sessions"
ON admin_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- System messages: Allow authenticated users to manage system messages
CREATE POLICY "Authenticated can view system messages"
ON system_messages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert system messages"
ON system_messages
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update system messages"
ON system_messages
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete system messages"
ON system_messages
FOR DELETE
TO authenticated
USING (true);