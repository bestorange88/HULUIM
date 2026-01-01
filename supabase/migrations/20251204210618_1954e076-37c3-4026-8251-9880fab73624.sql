-- Fix overly permissive RLS policies on real_name_verifications table

-- Drop ALL potentially overly permissive policies
DROP POLICY IF EXISTS "Authenticated can update real name verifications" ON public.real_name_verifications;
DROP POLICY IF EXISTS "Authenticated can view all verifications" ON public.real_name_verifications;
DROP POLICY IF EXISTS "Authenticated can view all real name verifications" ON public.real_name_verifications;
DROP POLICY IF EXISTS "Authenticated users can view real name verifications" ON public.real_name_verifications;

-- Fix overly permissive DELETE policy on moments table
DROP POLICY IF EXISTS "Authenticated can delete moments" ON public.moments;