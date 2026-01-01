-- Drop the existing type check constraint
ALTER TABLE public.crypto_transactions DROP CONSTRAINT IF EXISTS crypto_transactions_type_check;

-- Add updated constraint to allow both USDT and fiat transaction types
ALTER TABLE public.crypto_transactions ADD CONSTRAINT crypto_transactions_type_check 
CHECK (type = ANY (ARRAY['deposit'::text, 'withdraw'::text, 'fiat_deposit'::text, 'fiat_withdraw'::text]));