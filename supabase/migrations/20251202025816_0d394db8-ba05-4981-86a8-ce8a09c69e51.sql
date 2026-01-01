-- Fix user_points RLS policies to allow system inserts
DROP POLICY IF EXISTS "System can insert user points" ON public.user_points;
CREATE POLICY "System can insert user points"
ON public.user_points
FOR INSERT
WITH CHECK (true);

-- Add missing INSERT policy for point_transactions
DROP POLICY IF EXISTS "System can insert point transactions" ON public.point_transactions;
CREATE POLICY "System can insert point transactions"
ON public.point_transactions
FOR INSERT
WITH CHECK (true);

-- Allow service role to update point transactions for admin operations
DROP POLICY IF EXISTS "Authenticated can update point transactions" ON public.point_transactions;
CREATE POLICY "Authenticated can update point transactions"
ON public.point_transactions
FOR UPDATE
USING (true)
WITH CHECK (true);