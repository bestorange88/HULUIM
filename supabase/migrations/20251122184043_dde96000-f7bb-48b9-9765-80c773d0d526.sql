-- 创建管理员账户表
CREATE TABLE IF NOT EXISTS public.admin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  totp_secret TEXT,
  totp_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 插入默认管理员账号（密码：Aa112211）
-- 使用 pgcrypto 扩展进行密码加密
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public.admin_accounts (username, password_hash)
VALUES ('admin', crypt('Aa112211', gen_salt('bf')))
ON CONFLICT (username) DO NOTHING;

-- 修改 crypto_transactions 表，添加审核相关字段
ALTER TABLE public.crypto_transactions
ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- 创建审核状态索引
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_review_status 
ON public.crypto_transactions(review_status);

-- 启用 RLS
ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;

-- 管理员账户的 RLS 策略（只允许通过 edge function 访问）
CREATE POLICY "Service role can manage admin accounts"
ON public.admin_accounts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 更新 crypto_transactions 的 RLS 策略
CREATE POLICY "Admins can view all crypto transactions"
ON public.crypto_transactions
FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Admins can update crypto transaction reviews"
ON public.crypto_transactions
FOR UPDATE
TO service_role
USING (true);

-- 创建更新时间触发器
CREATE TRIGGER update_admin_accounts_updated_at
BEFORE UPDATE ON public.admin_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();