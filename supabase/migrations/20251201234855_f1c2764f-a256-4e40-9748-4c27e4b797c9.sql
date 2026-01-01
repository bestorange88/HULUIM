-- Create lucky_draws table for recording lottery results
CREATE TABLE IF NOT EXISTS public.lucky_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prize_type TEXT NOT NULL DEFAULT 'points',
  prize_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lucky_draws ENABLE ROW LEVEL SECURITY;

-- Users can create their own draws
CREATE POLICY "Users can create their own draws"
  ON public.lucky_draws
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own draws
CREATE POLICY "Users can view their own draws"
  ON public.lucky_draws
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lucky_draws_user_created 
  ON public.lucky_draws(user_id, created_at DESC);

COMMENT ON TABLE public.lucky_draws IS '幸运抽奖记录表';
COMMENT ON COLUMN public.lucky_draws.prize_type IS '奖品类型：points（积分）';
COMMENT ON COLUMN public.lucky_draws.prize_amount IS '奖品数量';