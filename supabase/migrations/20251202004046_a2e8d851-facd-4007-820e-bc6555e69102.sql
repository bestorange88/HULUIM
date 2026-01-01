-- 修复profiles表的RLS策略，允许管理后台读取所有用户数据
-- 删除冲突的策略
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;

-- 创建新的简化策略：已认证用户可以查看所有profiles
CREATE POLICY "Authenticated can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (true);