-- 补充管理后台的写权限
-- 管理后台需要能够更新平台设置和插入交易记录

-- 1. platform_settings - 允许authenticated用户更新平台设置
CREATE POLICY "Authenticated can update settings"
ON platform_settings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. transactions - 允许authenticated用户插入交易记录（如管理员加减款）
CREATE POLICY "Authenticated can insert transactions"
ON transactions
FOR INSERT
TO authenticated
WITH CHECK (true);