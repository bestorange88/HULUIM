-- 修复视图的安全问题：移除 SECURITY DEFINER，改为普通视图并添加 RLS

-- 删除旧的视图
DROP VIEW IF EXISTS public.messages_stats;
DROP VIEW IF EXISTS public.archive_stats;

-- 重新创建为普通视图（不使用 SECURITY DEFINER）
CREATE VIEW public.messages_stats AS
SELECT 
  COUNT(*) as total_messages,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as messages_last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as messages_last_7d,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as messages_last_30d,
  COUNT(*) FILTER (WHERE is_deleted = true) as deleted_messages,
  pg_size_pretty(pg_total_relation_size('messages')) as table_size
FROM public.messages;

CREATE VIEW public.archive_stats AS
SELECT 
  COUNT(*) as archived_messages,
  MIN(created_at) as oldest_message,
  MAX(created_at) as newest_message,
  pg_size_pretty(pg_total_relation_size('messages_archive')) as archive_size
FROM public.messages_archive;

-- 为归档表添加 RLS 策略（与主表一致）
ALTER TABLE public.messages_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations"
ON public.messages_archive FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = messages_archive.conversation_id
    AND conversation_participants.user_id = auth.uid()
  )
);

COMMENT ON VIEW public.messages_stats IS '消息表性能监控：查看实时消息统计和表大小';
COMMENT ON VIEW public.archive_stats IS '归档表统计：查看归档消息数量和存储占用';