-- Lovable Cloud 完整数据导出
-- 此文件可直接导入到自托管 Supabase
-- 执行: docker exec -i supabase-db psql -U postgres -d postgres < this_file.sql

-- 禁用触发器和外键检查
SET session_replication_role = replica;

-- ========================================
-- 1. 平台设置 (platform_settings)
-- ========================================
DELETE FROM public.platform_settings WHERE 1=1;
INSERT INTO public.platform_settings (id, key, value, type, description, updated_at) VALUES
('a85233e0-2d63-4b5d-8b61-42a94d88888d', 'platform_name', '睿信', 'text', '平台名称', NOW()),
('7201b9f0-a593-4f67-9205-589f75a2556f', 'platform_logo', '/logo.png', 'text', '平台Logo URL', NOW()),
('78559666-76e2-49be-b3dd-60da6828015e', 'platform_description', '安全可靠的即时通讯平台', 'text', '平台描述', NOW()),
('e643b3f7-0a3c-4885-8e5b-c0f64c7c9063', 'enable_registration', 'true', 'boolean', '是否允许注册', NOW()),
('5f7f633f-1b0e-41ea-a4c9-a35324ae440a', 'enable_red_envelope', 'true', 'boolean', '是否启用红包功能', NOW()),
('d7ddac6f-4a87-4c17-b8fc-2f18d971570d', 'fiat_bank_holder', '请联系在线客服', 'text', '法币收款银行账户名', NOW()),
('5fcf66ee-ce38-4952-8d0c-b3b609611c2d', 'fiat_wechat_qrcode', '', 'text', '微信收款二维码URL', NOW()),
('162f7de7-6a4b-42c9-be6d-198822093b77', 'fiat_alipay_qrcode', '', 'text', '支付宝收款二维码URL', NOW()),
('8237a542-da97-403e-8a30-c651044adc56', 'usdt_trc20_address', '', 'text', 'USDT TRC20收款地址', NOW()),
('f624656c-9611-4573-8966-73900acb4d52', 'usdt_exchange_rate', '7.2', 'text', 'USDT兑换人民币汇率', NOW()),
('e227dc3e-a4c9-4f19-bdab-dc5cf17c3d80', 'enable_transfer', 'true', 'boolean', '是否启用转账功能', NOW()),
('c48a7a0a-c3b9-4e33-b4c2-ba1c88f50de5', 'min_transfer_amount', '1', 'number', '最小转账金额', NOW()),
('8d9c6df3-1cb3-4b45-89f6-cadbb5168806', 'max_transfer_amount', '10000', 'number', '最大转账金额', NOW()),
('24912c85-7ecc-4ebd-9f66-aec10f4c39bc', 'official_website_url', 'https://www.ypkfjt.com/', 'text', '官网链接', NOW()),
('61878dd8-eec6-477d-9f92-102f4d71380e', 'enable_wallet', 'true', 'boolean', '是否启用钱包功能', NOW()),
('6a4d6b19-c660-4b59-ab8b-77e8c497fb62', 'enable_wallet_cny', 'true', 'boolean', '启用人民币充提', NOW()),
('0bdf6295-d523-4b74-8596-62e59042ae05', 'enable_wallet_usdt', 'false', 'boolean', '启用USDT充提', NOW()),
('592ced9f-311b-416f-8776-ff55730f21bf', 'checkin_day_day1', '1', 'number', '连续签到第1天奖励积分', NOW()),
('340c473f-a66c-4b1f-a687-1bf41516c7f7', 'checkin_day_day2', '2', 'number', '连续签到第2天奖励积分', NOW()),
('c46f5d27-793f-4bae-9e8b-2cfca0afdb19', 'checkin_day_day3', '3', 'number', '连续签到第3天奖励积分', NOW()),
('5a28da14-b63a-406d-b649-289608a1cc86', 'checkin_day_day4', '4', 'number', '连续签到第4天奖励积分', NOW()),
('dca98fa7-7a0e-4b2e-be4a-eb3fb1d4dfe7', 'checkin_day_day5', '5', 'number', '连续签到第5天奖励积分', NOW()),
('a2a4ce3d-b2d8-4e3b-8d14-14f5baa016c0', 'checkin_day_day6', '8', 'number', '连续签到第6天奖励积分', NOW()),
('1c7eeeb6-ca19-401e-9d72-c78929c7fc90', 'checkin_day_day7', '10', 'number', '连续签到第7天奖励积分', NOW()),
('3afbcd44-ecde-49d4-a31b-b25c39161676', 'checkin_multiplier_gold', '1', 'number', '黄金会员签到倍数', NOW()),
('31df644c-654c-482f-bf1f-580c3f98ca20', 'checkin_multiplier_diamond', '1', 'number', '钻石会员签到倍数', NOW()),
('9c1fbbcd-aca6-43c9-bf7a-158c00386399', 'checkin_multiplier_elite', '1', 'number', '至尊会员签到倍数', NOW()),
('439c0f44-4140-41d7-a797-ce5595b0dcfd', 'fiat_bank_name', '请联系在线客服', 'text', '法币收款银行名称', NOW()),
('03936d05-992a-4e35-8367-494e280d9b44', 'fiat_bank_account', '请联系在线客服', 'text', '法币收款银行账号', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ========================================
-- 2. 管理员账户 (admin_accounts)
-- ========================================
INSERT INTO public.admin_accounts (id, username, password_hash, totp_enabled, totp_secret, created_at, updated_at) VALUES
('1a69e936-0347-4c3e-b0c1-22e38b57ef8b', 'admin', '$2a$06$c8z7AuP.DFTBmldHU6KGPOLjoKBikkWe9txp7Odj0SIjs3s26f3QO', false, 'ZJ2DRO6NM2GSVZKUXWZJRCBPBLM3JM5R', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- 3. 积分商品 (point_products)
-- ========================================
INSERT INTO public.point_products (id, name, description, points_required, type, category, image_url, stock, is_active, sort_order, created_at, updated_at) VALUES
('e0c1b7e0-1111-4a1a-8888-000000000001', '话费充值10元', '手机话费充值10元', 100, 'virtual', '话费充值', NULL, NULL, true, 1, NOW(), NOW()),
('e0c1b7e0-1111-4a1a-8888-000000000002', '话费充值50元', '手机话费充值50元', 450, 'virtual', '话费充值', NULL, NULL, true, 2, NOW(), NOW()),
('e0c1b7e0-1111-4a1a-8888-000000000003', '话费充值100元', '手机话费充值100元', 850, 'virtual', '话费充值', NULL, NULL, true, 3, NOW(), NOW()),
('e0c1b7e0-1111-4a1a-8888-000000000004', '电费充值50元', '家庭电费充值50元', 480, 'virtual', '生活缴费', NULL, NULL, true, 4, NOW(), NOW()),
('e0c1b7e0-1111-4a1a-8888-000000000005', '水费充值50元', '家庭水费充值50元', 480, 'virtual', '生活缴费', NULL, NULL, true, 5, NOW(), NOW()),
('e0c1b7e0-1111-4a1a-8888-000000000006', '保险服务咨询', '专业保险顾问一对一咨询', 200, 'virtual', '保险服务', NULL, NULL, true, 6, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 重新启用触发器
SET session_replication_role = DEFAULT;

-- ========================================
-- 导入完成
-- ========================================
DO $$ BEGIN RAISE NOTICE '基础配置导入完成！'; END $$;
