-- 创建会员等级表
CREATE TABLE IF NOT EXISTS public.membership_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  price NUMERIC NOT NULL,
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 插入三个会员等级
INSERT INTO public.membership_tiers (name, price, benefits, sort_order) VALUES
('黄金会员', 1200, '["聊天靓号", "购物折扣", "专属头像框", "专属标签", "抽奖入场券"]'::jsonb, 1),
('钻石会员', 6800, '["聊天靓号", "购物折扣", "专属头像框", "专属标签", "抽奖入场券"]'::jsonb, 2),
('至尊会员', 18888, '["聊天靓号", "购物折扣", "专属头像框", "专属标签", "抽奖入场券"]'::jsonb, 3);

-- 创建用户会员表
CREATE TABLE IF NOT EXISTS public.user_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES public.membership_tiers(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  payment_amount NUMERIC NOT NULL,
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tier_id)
);

-- 启用 RLS
ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;

-- membership_tiers RLS 策略
CREATE POLICY "所有人可以查看会员等级"
ON public.membership_tiers FOR SELECT
TO authenticated
USING (is_active = true);

-- user_memberships RLS 策略
CREATE POLICY "用户可以查看自己的会员记录"
ON public.user_memberships FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "用户可以购买会员"
ON public.user_memberships FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 创建索引
CREATE INDEX idx_user_memberships_user_id ON public.user_memberships(user_id);
CREATE INDEX idx_user_memberships_tier_id ON public.user_memberships(tier_id);
CREATE INDEX idx_user_memberships_active ON public.user_memberships(user_id, is_active) WHERE is_active = true;