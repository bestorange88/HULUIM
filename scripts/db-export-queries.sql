-- Lovable Cloud 数据库导出脚本
-- 在 Lovable Cloud 的 SQL 编辑器中执行，或通过 API 导出

-- ============================================
-- 1. 基础配置表
-- ============================================

-- platform_settings
SELECT * FROM platform_settings;

-- membership_tiers
SELECT * FROM membership_tiers;

-- avatar_frames
SELECT * FROM avatar_frames;

-- sensitive_words
SELECT * FROM sensitive_words;

-- referral_settings
SELECT * FROM referral_settings;

-- ============================================
-- 2. 用户相关表
-- ============================================

-- profiles (注意：需要先在 auth.users 中创建用户)
SELECT * FROM profiles;

-- wallets
SELECT * FROM wallets;

-- user_points
SELECT * FROM user_points;

-- user_memberships
SELECT * FROM user_memberships;

-- bank_cards
SELECT * FROM bank_cards;

-- shipping_addresses
SELECT * FROM shipping_addresses;

-- real_name_verifications
SELECT * FROM real_name_verifications;

-- ============================================
-- 3. 社交相关表
-- ============================================

-- friendships
SELECT * FROM friendships;

-- friend_groups
SELECT * FROM friend_groups;

-- friend_group_members
SELECT * FROM friend_group_members;

-- conversations
SELECT * FROM conversations;

-- conversation_participants
SELECT * FROM conversation_participants;

-- conversation_settings
SELECT * FROM conversation_settings;

-- conversation_groups
SELECT * FROM conversation_groups;

-- conversation_group_members
SELECT * FROM conversation_group_members;

-- messages (可能数据量大，考虑分批)
SELECT * FROM messages ORDER BY created_at DESC LIMIT 100000;

-- group_invites
SELECT * FROM group_invites;

-- group_join_requests
SELECT * FROM group_join_requests;

-- ============================================
-- 4. 财务相关表
-- ============================================

-- transactions
SELECT * FROM transactions;

-- point_transactions
SELECT * FROM point_transactions;

-- crypto_transactions
SELECT * FROM crypto_transactions;

-- red_envelopes
SELECT * FROM red_envelopes;

-- red_envelope_claims
SELECT * FROM red_envelope_claims;

-- transfers
SELECT * FROM transfers;

-- ============================================
-- 5. 内容相关表
-- ============================================

-- moments
SELECT * FROM moments;

-- moment_likes
SELECT * FROM moment_likes;

-- moment_comments
SELECT * FROM moment_comments;

-- news_articles
SELECT * FROM news_articles;

-- articles
SELECT * FROM articles;

-- ============================================
-- 6. 积分商城相关表
-- ============================================

-- point_products
SELECT * FROM point_products;

-- point_orders
SELECT * FROM point_orders;

-- daily_check_ins
SELECT * FROM daily_check_ins;

-- lucky_draws
SELECT * FROM lucky_draws;

-- ============================================
-- 7. 管理员相关表
-- ============================================

-- admin_accounts
SELECT * FROM admin_accounts;

-- admin_sessions (可以不迁移，会自动重新创建)
-- SELECT * FROM admin_sessions;

-- admin_audit_logs
SELECT * FROM admin_audit_logs;

-- admin_gifts
SELECT * FROM admin_gifts;

-- customer_service_accounts
SELECT * FROM customer_service_accounts;

-- system_messages
SELECT * FROM system_messages;

-- user_feedbacks
SELECT * FROM user_feedbacks;

-- ============================================
-- 8. 通话相关表
-- ============================================

-- call_invitations
SELECT * FROM call_invitations;

-- ============================================
-- 9. 其他表
-- ============================================

-- referrals
SELECT * FROM referrals;

-- referral_rewards
SELECT * FROM referral_rewards;

-- message_favorites
SELECT * FROM message_favorites;

-- user_deleted_messages
SELECT * FROM user_deleted_messages;
