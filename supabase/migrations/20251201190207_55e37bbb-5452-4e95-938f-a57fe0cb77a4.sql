-- Add phone number column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE;

-- Create SMS verification codes table
CREATE TABLE IF NOT EXISTS public.sms_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'login', 'reset_password')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  used_at TIMESTAMP WITH TIME ZONE,
  is_valid BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS on sms_verification_codes table
ALTER TABLE public.sms_verification_codes ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sms_codes_phone_purpose ON public.sms_verification_codes(phone, purpose);
CREATE INDEX IF NOT EXISTS idx_sms_codes_expires_at ON public.sms_verification_codes(expires_at);

-- Create function to clean up expired codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_sms_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sms_verification_codes
  SET is_valid = false
  WHERE expires_at < now() AND is_valid = true;
END;
$$;

-- Comment on table
COMMENT ON TABLE public.sms_verification_codes IS 'Stores SMS verification codes for phone authentication';