-- Create customer service accounts table
CREATE TABLE public.customer_service_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_service_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view active customer service accounts"
ON public.customer_service_accounts
FOR SELECT
USING (is_active = true);

CREATE POLICY "Authenticated can view all customer service accounts"
ON public.customer_service_accounts
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage customer service accounts"
ON public.customer_service_accounts
FOR ALL
USING (true)
WITH CHECK (true);

-- Add is_customer_service flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_customer_service BOOLEAN DEFAULT false;