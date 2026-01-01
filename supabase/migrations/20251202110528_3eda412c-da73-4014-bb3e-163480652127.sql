-- 创建管理员审计日志表
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_username TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 为审计日志表创建索引
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON public.admin_audit_logs(admin_username);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);

-- 启用 RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS 策略：管理员可以查看所有审计日志
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_logs FOR SELECT
USING (true);

-- 创建审计日志记录函数
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_admin_username TEXT,
  p_action TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_logs (
    admin_username,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_admin_username,
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    p_ip_address,
    p_user_agent
  );
END;
$$;

-- 添加注释
COMMENT ON TABLE public.admin_audit_logs IS '管理员操作审计日志表';
COMMENT ON COLUMN public.admin_audit_logs.admin_username IS '操作管理员用户名';
COMMENT ON COLUMN public.admin_audit_logs.action IS '操作类型';
COMMENT ON COLUMN public.admin_audit_logs.resource_type IS '资源类型';
COMMENT ON COLUMN public.admin_audit_logs.resource_id IS '资源ID';
COMMENT ON COLUMN public.admin_audit_logs.details IS '操作详情（JSON格式）';
COMMENT ON COLUMN public.admin_audit_logs.ip_address IS '操作IP地址';
COMMENT ON COLUMN public.admin_audit_logs.user_agent IS '客户端User-Agent';
COMMENT ON COLUMN public.admin_audit_logs.created_at IS '操作时间';