-- 修复RLS权限策略：移除过度宽松的跨用户修改权限

-- 1. 删除profiles表的过度宽松策略
DROP POLICY IF EXISTS "Authenticated can update all profiles" ON public.profiles;

-- 2. 删除wallets表的过度宽松策略（如果存在）
DROP POLICY IF EXISTS "Authenticated can update all wallets" ON public.wallets;
DROP POLICY IF EXISTS "Authenticated can view all wallets" ON public.wallets;

-- 3. 确保profiles表有正确的用户自己修改的策略（如果不存在则创建）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile"
            ON public.profiles
            FOR UPDATE
            TO authenticated
            USING (auth.uid() = id)
            WITH CHECK (auth.uid() = id);
    END IF;
END $$;

-- 4. 确保wallets表有正确的RLS策略
-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.wallets;

-- 创建正确的wallets表RLS策略
CREATE POLICY "Users can view their own wallet"
    ON public.wallets
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet"
    ON public.wallets
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet"
    ON public.wallets
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 5. 为管理员操作保留service role访问权限
-- 管理员通过edge functions使用service role key进行操作，不需要额外的RLS策略

-- 6. 添加注释说明
COMMENT ON POLICY "Users can view their own wallet" ON public.wallets IS 
'用户只能查看自己的钱包余额';

COMMENT ON POLICY "Users can update their own wallet" ON public.wallets IS 
'用户只能更新自己的钱包数据（仅限客户端允许的字段）';

COMMENT ON POLICY "Users can insert their own wallet" ON public.wallets IS 
'用户只能创建自己的钱包记录';

COMMENT ON POLICY "Users can update their own profile" ON public.profiles IS 
'用户只能修改自己的个人资料';