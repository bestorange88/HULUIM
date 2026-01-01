-- Fix critical security vulnerabilities

-- 1. Drop insecure policies on admin_sessions
DROP POLICY IF EXISTS "Admin sessions are viewable by admins" ON public.admin_sessions;
DROP POLICY IF EXISTS "Anyone can view admin sessions" ON public.admin_sessions;

-- Create secure policy - only allow service role access
CREATE POLICY "Admin sessions service role only"
ON public.admin_sessions
FOR ALL
USING (false)
WITH CHECK (false);

-- 2. Drop insecure policies on admin_accounts
DROP POLICY IF EXISTS "Admin accounts are viewable by admins" ON public.admin_accounts;
DROP POLICY IF EXISTS "Anyone can view admin accounts" ON public.admin_accounts;

-- Create secure policy - only allow service role access
CREATE POLICY "Admin accounts service role only"
ON public.admin_accounts
FOR ALL
USING (false)
WITH CHECK (false);

-- 3. Fix crypto_transactions policy - restrict to own transactions only
DROP POLICY IF EXISTS "Admin users can view all crypto transactions" ON public.crypto_transactions;
DROP POLICY IF EXISTS "Users can view their own crypto transactions" ON public.crypto_transactions;
DROP POLICY IF EXISTS "Users can insert their own crypto transactions" ON public.crypto_transactions;

-- Users can only view their own crypto transactions
CREATE POLICY "Users can view own crypto transactions"
ON public.crypto_transactions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert their own crypto transactions
CREATE POLICY "Users can insert own crypto transactions"
ON public.crypto_transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4. Fix sensitive_words - only service role should access
DROP POLICY IF EXISTS "Anyone can view sensitive words" ON public.sensitive_words;
DROP POLICY IF EXISTS "Sensitive words are viewable by all" ON public.sensitive_words;

CREATE POLICY "Sensitive words service role only"
ON public.sensitive_words
FOR SELECT
USING (false);

-- 5. Create a view for public profile data that excludes sensitive fields
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  bio,
  status,
  last_seen,
  created_at
FROM public.profiles;

-- Grant select on the view
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- 6. Fix function search_path for security
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;