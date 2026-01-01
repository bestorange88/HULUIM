-- 创建实名认证表
CREATE TABLE IF NOT EXISTS public.real_name_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  real_name TEXT NOT NULL,
  id_card_number TEXT NOT NULL,
  id_card_front_url TEXT,
  id_card_back_url TEXT,
  face_video_url TEXT,
  face_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_verification UNIQUE(user_id),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- 添加索引
CREATE INDEX idx_real_name_verifications_user_id ON public.real_name_verifications(user_id);
CREATE INDEX idx_real_name_verifications_status ON public.real_name_verifications(status);

-- 启用RLS
ALTER TABLE public.real_name_verifications ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能查看自己的认证信息
CREATE POLICY "Users can view their own verification"
  ON public.real_name_verifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 策略：用户可以创建自己的认证申请
CREATE POLICY "Users can create their own verification"
  ON public.real_name_verifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS 策略：用户可以更新自己的待审核认证
CREATE POLICY "Users can update pending verification"
  ON public.real_name_verifications
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

-- 更新profiles表，添加实名认证状态字段
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_real_name_verified BOOLEAN DEFAULT false;

-- 创建触发器函数：自动更新实名认证状态
CREATE OR REPLACE FUNCTION public.update_profile_verification_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE public.profiles
    SET is_real_name_verified = true
    WHERE id = NEW.user_id;
  ELSIF NEW.status != 'approved' AND OLD.status = 'approved' THEN
    UPDATE public.profiles
    SET is_real_name_verified = false
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS on_verification_status_change ON public.real_name_verifications;
CREATE TRIGGER on_verification_status_change
  AFTER INSERT OR UPDATE ON public.real_name_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_verification_status();

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION public.update_real_name_verifications_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_real_name_verifications_timestamp ON public.real_name_verifications;
CREATE TRIGGER update_real_name_verifications_timestamp
  BEFORE UPDATE ON public.real_name_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_real_name_verifications_updated_at();

-- 创建存储桶用于存储认证资料
INSERT INTO storage.buckets (id, name, public) 
VALUES ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 存储策略：用户可以上传自己的认证文件
CREATE POLICY "Users can upload their verification documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'verification-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 存储策略：用户可以查看自己的认证文件
CREATE POLICY "Users can view their verification documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'verification-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 存储策略：用户可以删除自己的认证文件
CREATE POLICY "Users can delete their verification documents"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'verification-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );