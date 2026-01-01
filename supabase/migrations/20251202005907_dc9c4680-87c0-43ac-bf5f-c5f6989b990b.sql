-- 为 real_name_verifications 表添加外键关系和必要的 RLS 策略

-- 1. 添加外键关系到 profiles 表
ALTER TABLE public.real_name_verifications
  DROP CONSTRAINT IF EXISTS real_name_verifications_user_id_fkey;

ALTER TABLE public.real_name_verifications
  ADD CONSTRAINT real_name_verifications_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- 2. 确保 real_name_verifications 表启用了 RLS
ALTER TABLE public.real_name_verifications ENABLE ROW LEVEL SECURITY;

-- 3. 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Authenticated users can view all verifications" ON public.real_name_verifications;
DROP POLICY IF EXISTS "Users can view their own verification" ON public.real_name_verifications;
DROP POLICY IF EXISTS "Users can insert their own verification" ON public.real_name_verifications;
DROP POLICY IF EXISTS "Users can update their own verification" ON public.real_name_verifications;

-- 4. 创建新的 RLS 策略
-- 管理员（通过认证）可以查看所有实名认证记录
CREATE POLICY "Authenticated can view all verifications"
  ON public.real_name_verifications
  FOR SELECT
  TO authenticated
  USING (true);

-- 用户可以查看自己的实名认证记录
CREATE POLICY "Users can view own verification"
  ON public.real_name_verifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以创建自己的实名认证记录
CREATE POLICY "Users can insert own verification"
  ON public.real_name_verifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的实名认证记录（仅在审核前）
CREATE POLICY "Users can update own verification"
  ON public.real_name_verifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

-- 管理员可以更新任何实名认证记录（用于审核）
CREATE POLICY "Authenticated can update verifications"
  ON public.real_name_verifications
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. 添加注释
COMMENT ON CONSTRAINT real_name_verifications_user_id_fkey ON public.real_name_verifications IS
'关联到用户档案表，用于查询用户基本信息';

COMMENT ON POLICY "Authenticated can view all verifications" ON public.real_name_verifications IS
'认证用户（包括管理员）可以查看所有实名认证记录';

COMMENT ON POLICY "Users can view own verification" ON public.real_name_verifications IS
'用户可以查看自己的实名认证记录';

COMMENT ON POLICY "Users can insert own verification" ON public.real_name_verifications IS
'用户可以提交自己的实名认证申请';

COMMENT ON POLICY "Users can update own verification" ON public.real_name_verifications IS
'用户可以更新待审核的实名认证记录';

COMMENT ON POLICY "Authenticated can update verifications" ON public.real_name_verifications IS
'管理员可以审核和更新实名认证记录';