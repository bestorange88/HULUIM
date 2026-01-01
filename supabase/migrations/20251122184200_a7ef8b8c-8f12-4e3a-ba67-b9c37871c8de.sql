-- 创建密码验证函数
CREATE OR REPLACE FUNCTION public.verify_password(p_username TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT password_hash INTO stored_hash
  FROM public.admin_accounts
  WHERE username = p_username;
  
  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN stored_hash = crypt(p_password, stored_hash);
END;
$$;

-- 创建密码更新函数
CREATE OR REPLACE FUNCTION public.update_admin_password(p_username TEXT, p_new_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.admin_accounts
  SET password_hash = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE username = p_username;
END;
$$;