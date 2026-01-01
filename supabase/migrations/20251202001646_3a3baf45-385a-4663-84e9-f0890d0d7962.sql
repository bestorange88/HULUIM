-- 创建收货地址表
CREATE TABLE public.shipping_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  detailed_address TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建银行卡表
CREATE TABLE public.bank_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  card_number TEXT NOT NULL,
  cardholder_name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.shipping_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_cards ENABLE ROW LEVEL SECURITY;

-- 收货地址 RLS 策略
CREATE POLICY "用户可以查看自己的收货地址"
  ON public.shipping_addresses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户可以创建自己的收货地址"
  ON public.shipping_addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可以更新自己的收货地址"
  ON public.shipping_addresses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "用户可以删除自己的收货地址"
  ON public.shipping_addresses FOR DELETE
  USING (auth.uid() = user_id);

-- 银行卡 RLS 策略
CREATE POLICY "用户可以查看自己的银行卡"
  ON public.bank_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户可以创建自己的银行卡"
  ON public.bank_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可以更新自己的银行卡"
  ON public.bank_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "用户可以删除自己的银行卡"
  ON public.bank_cards FOR DELETE
  USING (auth.uid() = user_id);

-- 创建更新时间触发器
CREATE TRIGGER update_shipping_addresses_updated_at
  BEFORE UPDATE ON public.shipping_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_cards_updated_at
  BEFORE UPDATE ON public.bank_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();