-- 修复管理后台数据访问权限问题
-- 这些表的现有策略只允许查看激活的数据，管理后台需要查看所有数据

-- 1. avatar_frames - 允许authenticated用户查看所有头像框（包括未激活的）
CREATE POLICY "Authenticated can view all avatar frames"
ON avatar_frames
FOR SELECT
TO authenticated
USING (true);

-- 2. platform_settings - 允许authenticated用户查看所有平台设置
CREATE POLICY "Authenticated can view all settings"
ON platform_settings
FOR SELECT
TO authenticated  
USING (true);

-- 3. point_products - 允许authenticated用户查看所有积分商品（包括未激活的）
CREATE POLICY "Authenticated can view all point products"
ON point_products
FOR SELECT
TO authenticated
USING (true);