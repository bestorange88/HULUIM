-- Final security fixes

-- 1. Fix admin_sessions - remove all remaining policies
DROP POLICY IF EXISTS "System can manage admin sessions" ON public.admin_sessions;

-- 2. Fix profiles - create policy that hides transaction_password_hash from other users
-- First drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view other profiles basic info" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can only see their own full profile (including transaction_password_hash)
CREATE POLICY "Users can view own full profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- For chat functionality, we need users to see other profiles but without sensitive data
-- Since Postgres doesn't support column-level RLS, we create separate policies
-- and ensure application code never selects transaction_password_hash for other users

-- 3. Fix crypto_transactions - remove admin policies that allow any authenticated user
DROP POLICY IF EXISTS "Admins can view all crypto transactions" ON public.crypto_transactions;
DROP POLICY IF EXISTS "Admins can update crypto transaction reviews" ON public.crypto_transactions;
-- Only keep user's own transaction policies (already created)

-- 4. Fix sensitive_words - remove public access
DROP POLICY IF EXISTS "Admins can manage sensitive words" ON public.sensitive_words;
-- No policies = service role only access

-- 5. Fix transactions table - restrict INSERT to service role only
DROP POLICY IF EXISTS "System can insert transactions" ON public.transactions;
-- Keep only SELECT policy for users to view their own transactions