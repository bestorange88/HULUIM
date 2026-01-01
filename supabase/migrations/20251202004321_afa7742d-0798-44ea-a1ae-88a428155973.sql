-- 修复articles表的权限问题
-- Articles管理页面需要完整的CRUD权限

-- 删除可能冲突的策略
DROP POLICY IF EXISTS "Service role can manage articles" ON articles;

-- 创建新的authenticated权限策略
CREATE POLICY "Authenticated can view all articles"
ON articles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert articles"
ON articles
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update articles"
ON articles
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete articles"
ON articles
FOR DELETE
TO authenticated
USING (true);