-- Security Review Fix: Restrict access to sensitive personal and financial data
-- This migration addresses critical security vulnerabilities identified in the security scan

-- 1. Fix bank_cards table - restrict to own cards only
DROP POLICY IF EXISTS "Users can view all bank cards" ON public.bank_cards;
DROP POLICY IF EXISTS "Users can view own bank cards" ON public.bank_cards;
CREATE POLICY "Users can view own bank cards"
  ON public.bank_cards FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Fix profiles table - create view for public data without phone numbers
DROP VIEW IF EXISTS public.safe_public_profiles;
CREATE VIEW public.safe_public_profiles AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  avatar_frame,
  bio,
  gender,
  birth_date,
  status,
  last_seen,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the safe view
GRANT SELECT ON public.safe_public_profiles TO authenticated;

-- 3. Fix real_name_verifications - already has correct policy

-- 4. Fix crypto_transactions - only user can view their own
DROP POLICY IF EXISTS "Authenticated can view all crypto transactions" ON public.crypto_transactions;
DROP POLICY IF EXISTS "Users can view own crypto transactions" ON public.crypto_transactions;
CREATE POLICY "Users can view own crypto transactions"
  ON public.crypto_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Fix shipping_addresses - only user can view their own
DROP POLICY IF EXISTS "Authenticated can view all addresses" ON public.shipping_addresses;
DROP POLICY IF EXISTS "Users can view own addresses" ON public.shipping_addresses;
CREATE POLICY "Users can view own addresses"
  ON public.shipping_addresses FOR SELECT
  USING (auth.uid() = user_id);

-- 6. Fix transactions table - only user can view their own
DROP POLICY IF EXISTS "Authenticated can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- 7. Fix user_memberships - only user can view their own
DROP POLICY IF EXISTS "Authenticated can view all memberships" ON public.user_memberships;
DROP POLICY IF EXISTS "Users can view own memberships" ON public.user_memberships;
CREATE POLICY "Users can view own memberships"
  ON public.user_memberships FOR SELECT
  USING (auth.uid() = user_id);

-- 8. Fix referral_rewards - only user can view their own
DROP POLICY IF EXISTS "Authenticated can view all referral rewards" ON public.referral_rewards;
DROP POLICY IF EXISTS "Users can view own referral rewards" ON public.referral_rewards;
CREATE POLICY "Users can view own referral rewards"
  ON public.referral_rewards FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = referred_user_id);

-- 9. Fix point_transactions - only user can view their own
DROP POLICY IF EXISTS "Authenticated can view all point transactions" ON public.point_transactions;
DROP POLICY IF EXISTS "Users can view own point transactions" ON public.point_transactions;
CREATE POLICY "Users can view own point transactions"
  ON public.point_transactions FOR SELECT
  USING (auth.uid() = user_id);
