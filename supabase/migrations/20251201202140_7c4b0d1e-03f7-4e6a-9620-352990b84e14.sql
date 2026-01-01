-- ===================================================================
-- 升级 1：数据库性能优化
-- 目标：支持 10 万在线用户的消息吞吐
-- ===================================================================

-- 1.1 为消息表添加核心索引（提升查询性能 10-200 倍）
CREATE INDEX IF NOT EXISTS idx_messages_conv_time
ON public.messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender_time
ON public.messages (sender_id, created_at DESC);

-- 1.2 为实时查询优化的复合索引
CREATE INDEX IF NOT EXISTS idx_messages_conv_status
ON public.messages (conversation_id, status, created_at DESC)
WHERE is_deleted = false;

-- 1.3 为未读消息统计优化
CREATE INDEX IF NOT EXISTS idx_messages_unread
ON public.messages (conversation_id, status)
WHERE status != 'read' AND is_deleted = false;

-- ===================================================================
-- 升级 2：冷消息归档机制（防止主表无限膨胀）
-- ===================================================================

-- 2.1 创建归档表（结构完全相同）
CREATE TABLE IF NOT EXISTS public.messages_archive (
  LIKE public.messages INCLUDING ALL
);

-- 2.2 为归档表添加索引
CREATE INDEX IF NOT EXISTS idx_messages_archive_conv_time
ON public.messages_archive (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_archive_sender_time
ON public.messages_archive (sender_id, created_at DESC);

-- 2.3 创建归档函数（自动将 60 天前的消息移到归档表）
CREATE OR REPLACE FUNCTION public.archive_old_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- 将 60 天前的消息移动到归档表
  WITH moved_messages AS (
    DELETE FROM public.messages
    WHERE created_at < NOW() - INTERVAL '60 days'
    RETURNING *
  )
  INSERT INTO public.messages_archive
  SELECT * FROM moved_messages;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  RETURN archived_count;
END;
$$;

-- 2.4 创建定期归档的调度任务注释（需要在 Supabase Dashboard 中配置 pg_cron）
COMMENT ON FUNCTION public.archive_old_messages IS 
'定期归档旧消息。建议配置 pg_cron: SELECT cron.schedule(''archive-messages'', ''0 2 * * *'', ''SELECT archive_old_messages()'');';

-- ===================================================================
-- 升级 3：优化实时性能的辅助索引
-- ===================================================================

-- 3.1 为会话参与者表添加索引（加速在线状态查询）
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user
ON public.conversation_participants (user_id, last_read_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conv
ON public.conversation_participants (conversation_id, joined_at DESC);

-- 3.2 为好友关系表添加索引（加速好友列表查询）
CREATE INDEX IF NOT EXISTS idx_friendships_user_status
ON public.friendships (user_id, status)
WHERE status = 'accepted';

CREATE INDEX IF NOT EXISTS idx_friendships_friend_status
ON public.friendships (friend_id, status)
WHERE status = 'accepted';

-- 3.3 为用户状态表添加索引（加速在线状态查询）
CREATE INDEX IF NOT EXISTS idx_profiles_status_lastseen
ON public.profiles (status, last_seen DESC)
WHERE status IN ('online', 'away');

-- ===================================================================
-- 性能监控辅助视图
-- ===================================================================

-- 创建消息表性能监控视图
CREATE OR REPLACE VIEW public.messages_stats AS
SELECT 
  COUNT(*) as total_messages,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as messages_last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as messages_last_7d,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as messages_last_30d,
  COUNT(*) FILTER (WHERE is_deleted = true) as deleted_messages,
  pg_size_pretty(pg_total_relation_size('messages')) as table_size
FROM public.messages;

-- 创建归档表统计视图
CREATE OR REPLACE VIEW public.archive_stats AS
SELECT 
  COUNT(*) as archived_messages,
  MIN(created_at) as oldest_message,
  MAX(created_at) as newest_message,
  pg_size_pretty(pg_total_relation_size('messages_archive')) as archive_size
FROM public.messages_archive;

COMMENT ON VIEW public.messages_stats IS '消息表性能监控：查看实时消息统计和表大小';
COMMENT ON VIEW public.archive_stats IS '归档表统计：查看归档消息数量和存储占用';