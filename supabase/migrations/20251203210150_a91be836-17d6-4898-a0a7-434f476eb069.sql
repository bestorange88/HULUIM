
-- Create admin_gifts table for storing gift records
CREATE TABLE public.admin_gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  gift_type TEXT NOT NULL CHECK (gift_type IN ('points', 'red_envelope')),
  amount NUMERIC(10, 2) NOT NULL,
  admin_username TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_gifts ENABLE ROW LEVEL SECURITY;

-- Policy for admin access (via service role)
CREATE POLICY "Service role can manage admin gifts"
ON public.admin_gifts
FOR ALL
USING (true)
WITH CHECK (true);

-- Policy for users to view their own gifts
CREATE POLICY "Users can view their own gifts"
ON public.admin_gifts
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_admin_gifts_user_id ON public.admin_gifts(user_id);
CREATE INDEX idx_admin_gifts_created_at ON public.admin_gifts(created_at DESC);
