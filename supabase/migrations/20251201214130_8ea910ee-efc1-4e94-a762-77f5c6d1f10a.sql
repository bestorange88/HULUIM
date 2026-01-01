-- Create user points table
CREATE TABLE IF NOT EXISTS public.user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create point transactions table
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'check_in', 'purchase', 'gift', 'refund'
  amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create daily check-ins table
CREATE TABLE IF NOT EXISTS public.daily_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  consecutive_days INTEGER NOT NULL DEFAULT 1,
  points_earned NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, check_in_date)
);

-- Create point products table
CREATE TABLE IF NOT EXISTS public.point_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  points_required NUMERIC NOT NULL,
  category TEXT NOT NULL, -- 'virtual', 'physical'
  type TEXT NOT NULL, -- 'mobile_recharge', 'utilities', 'transport', 'gift'
  stock INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create point orders table
CREATE TABLE IF NOT EXISTS public.point_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.point_products(id),
  points_spent NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
  shipping_address TEXT,
  contact_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_points
CREATE POLICY "Users can view their own points"
  ON public.user_points FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own points"
  ON public.user_points FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own points"
  ON public.user_points FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for point_transactions
CREATE POLICY "Users can view their own transactions"
  ON public.point_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for daily_check_ins
CREATE POLICY "Users can view their own check-ins"
  ON public.daily_check_ins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own check-ins"
  ON public.daily_check_ins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for point_products
CREATE POLICY "Anyone can view active products"
  ON public.point_products FOR SELECT
  USING (is_active = true);

-- RLS Policies for point_orders
CREATE POLICY "Users can view their own orders"
  ON public.point_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders"
  ON public.point_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_user_points_user_id ON public.user_points(user_id);
CREATE INDEX idx_point_transactions_user_id ON public.point_transactions(user_id);
CREATE INDEX idx_point_transactions_created_at ON public.point_transactions(created_at DESC);
CREATE INDEX idx_daily_check_ins_user_id ON public.daily_check_ins(user_id);
CREATE INDEX idx_daily_check_ins_date ON public.daily_check_ins(check_in_date DESC);
CREATE INDEX idx_point_products_category ON public.point_products(category);
CREATE INDEX idx_point_products_active ON public.point_products(is_active);
CREATE INDEX idx_point_orders_user_id ON public.point_orders(user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_points_updated_at
  BEFORE UPDATE ON public.user_points
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_point_products_updated_at
  BEFORE UPDATE ON public.point_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_point_orders_updated_at
  BEFORE UPDATE ON public.point_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample products
INSERT INTO public.point_products (name, description, points_required, category, type, sort_order) VALUES
('手机充值50元', '移动/联通/电信通用', 50, 'virtual', 'mobile_recharge', 1),
('手机充值100元', '移动/联通/电信通用', 100, 'virtual', 'mobile_recharge', 2),
('生活缴费代金券', '水电煤气通用券', 30, 'virtual', 'utilities', 3),
('交通出行券10元', '滴滴/高德打车券', 20, 'virtual', 'transport', 4),
('泰国青草膏', '清凉止痛 舒缓疲劳', 35, 'physical', 'gift', 5),
('百花蜂蜜500克盒装', '纯天然野生蜂蜜', 60, 'physical', 'gift', 6);