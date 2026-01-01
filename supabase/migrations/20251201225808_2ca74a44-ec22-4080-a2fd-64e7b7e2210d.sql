-- 创建消息收藏表
CREATE TABLE IF NOT EXISTS public.message_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

-- 启用RLS
ALTER TABLE public.message_favorites ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "用户可以查看自己的收藏" 
ON public.message_favorites 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "用户可以添加收藏" 
ON public.message_favorites 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可以删除自己的收藏" 
ON public.message_favorites 
FOR DELETE 
USING (auth.uid() = user_id);

-- 创建索引提高查询性能
CREATE INDEX idx_message_favorites_user_id ON public.message_favorites(user_id);
CREATE INDEX idx_message_favorites_created_at ON public.message_favorites(created_at DESC);