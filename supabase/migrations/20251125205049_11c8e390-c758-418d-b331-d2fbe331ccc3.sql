-- Add gender and birth_date columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gender text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS birth_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS transaction_password_hash text DEFAULT NULL;