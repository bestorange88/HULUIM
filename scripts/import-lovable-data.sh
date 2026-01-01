#!/bin/bash

# Lovable Cloud 数据导入脚本
# 在自托管服务器上执行此脚本导入数据

echo "=== 开始导入 Lovable Cloud 数据 ==="

cd /opt/supabase/docker

# 导入基础配置数据
docker exec -i supabase-db psql -U postgres -d postgres << 'EOSQL'

-- ============================================
-- 1. 清理现有数据（可选，如果需要全新导入）
-- ============================================
-- 注意：如果要保留现有数据，注释掉以下删除语句

-- TRUNCATE TABLE messages CASCADE;
-- TRUNCATE TABLE conversation_participants CASCADE;
-- TRUNCATE TABLE conversations CASCADE;
-- TRUNCATE TABLE friendships CASCADE;
-- TRUNCATE TABLE wallets CASCADE;
-- TRUNCATE TABLE user_points CASCADE;
-- TRUNCATE TABLE profiles CASCADE;

-- ============================================
-- 2. 导入平台设置
-- ============================================
INSERT INTO platform_settings (key, value, type, description) VALUES
('platform_name', '睿信', 'text', '平台名称'),
('platform_logo', '/logo.png', 'text', '平台Logo URL'),
('platform_description', '安全可靠的即时通讯平台', 'text', '平台描述'),
('enable_registration', 'true', 'boolean', '是否允许注册'),
('enable_red_envelope', 'true', 'boolean', '是否启用红包功能'),
('enable_transfer', 'true', 'boolean', '是否启用转账功能'),
('enable_wallet', 'true', 'boolean', '是否启用钱包功能'),
('enable_wallet_cny', 'true', 'boolean', '启用人民币充提'),
('enable_wallet_usdt', 'false', 'boolean', '启用USDT充提'),
('min_transfer_amount', '1', 'number', '最小转账金额'),
('max_transfer_amount', '10000', 'number', '最大转账金额'),
('official_website_url', 'https://www.ypkfjt.com/', 'text', '官网链接'),
('fiat_bank_name', '请联系在线客服', 'text', '法币收款银行名称'),
('fiat_bank_holder', '请联系在线客服', 'text', '法币收款银行账户名'),
('fiat_bank_account', '请联系在线客服', 'text', '法币收款银行账号'),
('checkin_day_day1', '1', 'number', '连续签到第1天奖励积分'),
('checkin_day_day2', '2', 'number', '连续签到第2天奖励积分'),
('checkin_day_day3', '3', 'number', '连续签到第3天奖励积分'),
('checkin_day_day4', '4', 'number', '连续签到第4天奖励积分'),
('checkin_day_day5', '5', 'number', '连续签到第5天奖励积分'),
('checkin_day_day6', '8', 'number', '连续签到第6天奖励积分'),
('checkin_day_day7', '10', 'number', '连续签到第7天奖励积分'),
('checkin_multiplier_gold', '1', 'number', '黄金会员签到倍数'),
('checkin_multiplier_diamond', '1', 'number', '钻石会员签到倍数'),
('checkin_multiplier_elite', '1', 'number', '至尊会员签到倍数')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

-- ============================================
-- 3. 导入管理员账号
-- ============================================
INSERT INTO admin_accounts (id, username, password_hash, totp_enabled, totp_secret, created_at, updated_at)
VALUES (
  '1a69e936-0347-4c3e-b0c1-22e38b57ef8b',
  'admin',
  '$2a$06$c8z7AuP.DFTBmldHU6KGPOLjoKBikkWe9txp7Odj0SIjs3s26f3QO',
  false,
  'ZJ2DRO6NM2GSVZKUXWZJRCBPBLM3JM5R',
  '2025-11-22 18:40:41.771759+00',
  '2025-12-04 01:16:26.672533+00'
) ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;

SELECT '平台设置和管理员账号导入完成!' as status;

EOSQL

echo ""
echo "=== 基础配置导入完成 ==="
echo ""
echo "接下来需要导入用户数据（profiles, wallets等）"
echo "请从 Lovable Cloud 控制台导出用户数据CSV文件"
echo ""
