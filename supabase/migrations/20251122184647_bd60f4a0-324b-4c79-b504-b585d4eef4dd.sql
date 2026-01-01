-- 创建敏感词表
CREATE TABLE IF NOT EXISTS public.sensitive_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  category TEXT DEFAULT 'general',
  action TEXT DEFAULT 'block', -- block: 阻止发送, replace: 替换为***
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 创建平台设置表
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  type TEXT DEFAULT 'text', -- text, number, boolean, json
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 插入默认平台设置
INSERT INTO public.platform_settings (key, value, type, description) VALUES
  ('platform_name', '睿信', 'text', '平台名称'),
  ('platform_logo', '/logo.png', 'text', '平台Logo URL'),
  ('platform_description', '安全可靠的即时通讯平台', 'text', '平台描述'),
  ('enable_registration', 'true', 'boolean', '是否允许注册'),
  ('enable_red_envelope', 'true', 'boolean', '是否启用红包功能'),
  ('enable_transfer', 'true', 'boolean', '是否启用转账功能'),
  ('min_transfer_amount', '1', 'number', '最小转账金额'),
  ('max_transfer_amount', '10000', 'number', '最大转账金额')
ON CONFLICT (key) DO NOTHING;

-- 启用 RLS
ALTER TABLE public.sensitive_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 敏感词表策略：只有管理员可以管理
CREATE POLICY "Admins can manage sensitive words"
ON public.sensitive_words
FOR ALL
USING (true)
WITH CHECK (true);

-- 平台设置表策略：所有人可以读取，只有管理员可以修改
CREATE POLICY "Everyone can read platform settings"
ON public.platform_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage platform settings"
ON public.platform_settings
FOR ALL
USING (true)
WITH CHECK (true);

-- 创建触发器自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sensitive_words_updated_at 
BEFORE UPDATE ON public.sensitive_words
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_settings_updated_at 
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();