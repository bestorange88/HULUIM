-- 添加消息状态和编辑相关字段
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'read', 'failed')),
ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS read_by jsonb DEFAULT '[]'::jsonb;

-- 添加索引以提高搜索性能
CREATE INDEX IF NOT EXISTS idx_messages_content_search ON public.messages USING gin(to_tsvector('simple', content));
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at DESC);

-- 创建更新消息状态的函数
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(p_conversation_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messages
  SET 
    status = 'read',
    read_by = CASE 
      WHEN read_by ? p_user_id::text THEN read_by
      ELSE jsonb_set(read_by, array[jsonb_array_length(read_by)::text], to_jsonb(p_user_id::text))
    END,
    updated_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_id != p_user_id
    AND status = 'sent';
END;
$$;