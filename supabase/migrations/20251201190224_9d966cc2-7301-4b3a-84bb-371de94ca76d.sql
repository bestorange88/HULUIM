-- Create RLS policies for sms_verification_codes table

-- Policy: Anyone can create verification codes (for registration/login)
CREATE POLICY "Anyone can create SMS verification codes"
ON public.sms_verification_codes
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy: Service role can manage all codes
CREATE POLICY "Service role can manage all codes"
ON public.sms_verification_codes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Users can view their own verification codes
CREATE POLICY "Users can view their own codes"
ON public.sms_verification_codes
FOR SELECT
TO authenticated
USING (phone IN (SELECT phone FROM public.profiles WHERE id = auth.uid()));