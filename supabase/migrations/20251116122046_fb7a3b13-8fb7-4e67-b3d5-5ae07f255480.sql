-- Create table for USDT TRC20 transactions
CREATE TABLE IF NOT EXISTS public.crypto_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdraw')),
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  usdt_amount NUMERIC(20, 6) NOT NULL CHECK (usdt_amount > 0),
  trc20_address TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.crypto_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own crypto transactions"
ON public.crypto_transactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own crypto transactions"
ON public.crypto_transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_crypto_transactions_user_id ON public.crypto_transactions(user_id);
CREATE INDEX idx_crypto_transactions_status ON public.crypto_transactions(status);
CREATE INDEX idx_crypto_transactions_created_at ON public.crypto_transactions(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_crypto_transactions_updated_at
BEFORE UPDATE ON public.crypto_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();