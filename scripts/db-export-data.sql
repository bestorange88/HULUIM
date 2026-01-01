-- ============================================
-- Alo生态 完整数据库迁移脚本
-- 生成时间: 2025-12-05
-- ============================================
-- 使用方法:
-- docker exec -i supabase-db psql -U postgres -d postgres < db-export-data.sql
-- ============================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 创建枚举类型 (如果不存在)
DO $$ BEGIN CREATE TYPE conversation_type AS ENUM ('direct', 'group'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE message_type AS ENUM ('text', 'image', 'voice', 'video', 'file', 'red_envelope', 'transfer', 'system', 'call'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE group_member_role AS ENUM ('owner', 'admin', 'member'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE app_role AS ENUM ('admin', 'user'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================
-- 创建所有表结构
-- ============================================

-- 用户资料表
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    display_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    status TEXT DEFAULT 'offline',
    gender TEXT,
    birth_date DATE,
    phone VARCHAR,
    is_real_name_verified BOOLEAN DEFAULT false,
    is_muted BOOLEAN DEFAULT false,
    muted_until TIMESTAMPTZ,
    muted_reason TEXT,
    is_customer_service BOOLEAN DEFAULT false,
    transaction_password_hash TEXT,
    invite_code TEXT UNIQUE,
    referred_by_code TEXT,
    avatar_frame TEXT DEFAULT 'none',
    user_id TEXT UNIQUE,
    last_seen TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 钱包表
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    balance NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 会话表
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type conversation_type NOT NULL DEFAULT 'direct',
    name TEXT,
    avatar_url TEXT,
    description TEXT,
    announcement TEXT,
    announcement_updated_at TIMESTAMPTZ,
    group_note TEXT,
    require_approval BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{"mute_all": false, "allow_member_invite": true, "allow_member_edit_info": false}',
    tags JSONB DEFAULT '[]',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 会话参与者表
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role group_member_role DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT now(),
    last_read_at TIMESTAMPTZ
);

-- 消息表
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    type message_type DEFAULT 'text',
    media_url TEXT,
    status TEXT DEFAULT 'sent',
    is_edited BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    read_by JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 好友关系表
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    friend_id UUID NOT NULL,
    status friendship_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, friend_id)
);

-- 交易记录表
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    balance_before NUMERIC NOT NULL,
    balance_after NUMERIC NOT NULL,
    status TEXT DEFAULT 'completed',
    description TEXT,
    reference_type TEXT,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- USDT交易表
CREATE TABLE IF NOT EXISTS public.crypto_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    usdt_amount NUMERIC NOT NULL,
    trc20_address TEXT NOT NULL,
    tx_hash TEXT,
    status TEXT DEFAULT 'pending',
    review_status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    notes TEXT,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 红包表
CREATE TABLE IF NOT EXISTS public.red_envelopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    remaining_amount NUMERIC NOT NULL,
    quantity INTEGER DEFAULT 1,
    remaining_quantity INTEGER NOT NULL,
    message TEXT,
    designated_user_id UUID,
    status TEXT DEFAULT 'active',
    expire_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 红包领取表
CREATE TABLE IF NOT EXISTS public.red_envelope_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    red_envelope_id UUID NOT NULL,
    user_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    claimed_at TIMESTAMPTZ DEFAULT now()
);

-- 转账表
CREATE TABLE IF NOT EXISTS public.transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending',
    expire_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 用户积分表
CREATE TABLE IF NOT EXISTS public.user_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    balance NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 积分交易表
CREATE TABLE IF NOT EXISTS public.point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    balance_before NUMERIC NOT NULL,
    balance_after NUMERIC NOT NULL,
    description TEXT,
    reference_type TEXT,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 每日签到表
CREATE TABLE IF NOT EXISTS public.daily_check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    check_in_date DATE DEFAULT CURRENT_DATE,
    consecutive_days INTEGER DEFAULT 1,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, check_in_date)
);

-- 积分商品表
CREATE TABLE IF NOT EXISTS public.point_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    category TEXT NOT NULL,
    type TEXT NOT NULL,
    points_required NUMERIC NOT NULL,
    stock INTEGER,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 积分订单表
CREATE TABLE IF NOT EXISTS public.point_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    product_id UUID NOT NULL,
    points_spent NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    shipping_address TEXT,
    contact_info TEXT,
    tracking_number TEXT,
    admin_notes TEXT,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 会员等级表
CREATE TABLE IF NOT EXISTS public.membership_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    benefits JSONB DEFAULT '[]',
    withdrawal_minimum NUMERIC DEFAULT 0,
    daily_check_in_bonus INTEGER DEFAULT 10,
    daily_draw_tickets INTEGER DEFAULT 3,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 用户会员表
CREATE TABLE IF NOT EXISTS public.user_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tier_id UUID NOT NULL,
    purchased_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    payment_amount NUMERIC NOT NULL,
    payment_method TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 实名认证表
CREATE TABLE IF NOT EXISTS public.real_name_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    real_name TEXT NOT NULL,
    id_card_number TEXT NOT NULL,
    id_card_front_url TEXT,
    id_card_back_url TEXT,
    face_image_url TEXT,
    face_video_url TEXT,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 管理员账户表
CREATE TABLE IF NOT EXISTS public.admin_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    totp_enabled BOOLEAN DEFAULT false,
    totp_secret TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 管理员会话表
CREATE TABLE IF NOT EXISTS public.admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 管理员审计日志表
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_username TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 管理员礼物表
CREATE TABLE IF NOT EXISTS public.admin_gifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    gift_type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    admin_username TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 平台设置表
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    type TEXT DEFAULT 'text',
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 动态表
CREATE TABLE IF NOT EXISTS public.moments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    images JSONB,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 动态点赞表
CREATE TABLE IF NOT EXISTS public.moment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moment_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(moment_id, user_id)
);

-- 动态评论表
CREATE TABLE IF NOT EXISTS public.moment_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moment_id UUID NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 新闻文章表
CREATE TABLE IF NOT EXISTS public.news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    image_url TEXT,
    source TEXT NOT NULL,
    author TEXT,
    external_id TEXT,
    published_at TIMESTAMPTZ NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT now(),
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 敏感词表
CREATE TABLE IF NOT EXISTS public.sensitive_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word TEXT NOT NULL UNIQUE,
    category TEXT DEFAULT 'general',
    action TEXT DEFAULT 'block',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 系统消息表
CREATE TABLE IF NOT EXISTS public.system_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'announcement',
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 客服账户表
CREATE TABLE IF NOT EXISTS public.customer_service_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 头像边框表
CREATE TABLE IF NOT EXISTS public.avatar_frames (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    style_class TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    required_tier TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 文章表
CREATE TABLE IF NOT EXISTS public.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 抽奖记录表
CREATE TABLE IF NOT EXISTS public.lucky_draws (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    prize_type TEXT DEFAULT 'points',
    prize_amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 推荐关系表
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    referrer_id UUID NOT NULL,
    level INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 推荐奖励表
CREATE TABLE IF NOT EXISTS public.referral_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    referred_user_id UUID NOT NULL,
    level INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 推荐设置表
CREATE TABLE IF NOT EXISTS public.referral_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_enabled BOOLEAN DEFAULT true,
    require_approval BOOLEAN DEFAULT false,
    level_1_reward NUMERIC DEFAULT 10,
    level_2_reward NUMERIC DEFAULT 5,
    level_3_reward NUMERIC DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 银行卡表
CREATE TABLE IF NOT EXISTS public.bank_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    bank_name TEXT NOT NULL,
    card_number TEXT NOT NULL,
    cardholder_name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 收货地址表
CREATE TABLE IF NOT EXISTS public.shipping_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    receiver_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    province TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    detailed_address TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 短信验证码表
CREATE TABLE IF NOT EXISTS public.sms_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR NOT NULL,
    code VARCHAR NOT NULL,
    purpose TEXT NOT NULL,
    is_valid BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '10 minutes'),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 用户反馈表
CREATE TABLE IF NOT EXISTS public.user_feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    type TEXT DEFAULT 'feedback',
    content TEXT NOT NULL,
    contact_info TEXT,
    status TEXT DEFAULT 'pending',
    admin_response TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 用户角色表
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 群邀请链接表
CREATE TABLE IF NOT EXISTS public.group_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    created_by UUID NOT NULL,
    code TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ,
    max_uses INTEGER,
    use_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 群加入请求表
CREATE TABLE IF NOT EXISTS public.group_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    invite_code TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 通话邀请表
CREATE TABLE IF NOT EXISTS public.call_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    caller_id UUID NOT NULL,
    callee_id UUID NOT NULL,
    call_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 消息收藏表
CREATE TABLE IF NOT EXISTS public.message_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    message_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, message_id)
);

-- 用户删除的消息表
CREATE TABLE IF NOT EXISTS public.user_deleted_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    message_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT now()
);

-- 会话设置表
CREATE TABLE IF NOT EXISTS public.conversation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    is_muted BOOLEAN DEFAULT false,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, conversation_id)
);

-- 好友分组表
CREATE TABLE IF NOT EXISTS public.friend_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 好友分组成员表
CREATE TABLE IF NOT EXISTS public.friend_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL,
    friend_id UUID NOT NULL,
    added_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(group_id, friend_id)
);

-- 会话分组表
CREATE TABLE IF NOT EXISTS public.conversation_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 会话分组成员表
CREATE TABLE IF NOT EXISTS public.conversation_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    added_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(group_id, conversation_id)
);

-- 消息归档表
CREATE TABLE IF NOT EXISTS public.messages_archive (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    type message_type DEFAULT 'text',
    media_url TEXT,
    status TEXT DEFAULT 'sent',
    is_edited BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    read_by JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_invite_code ON profiles(invite_code);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- 启用 Realtime (忽略错误如果已存在)
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_invitations;
EXCEPTION WHEN OTHERS THEN null; END $$;

-- ============================================
-- 基础配置数据
-- ============================================

-- 1. 管理员账户
INSERT INTO admin_accounts (id, username, password_hash, totp_enabled, totp_secret, created_at, updated_at) VALUES
('1a69e936-0347-4c3e-b0c1-22e38b57ef8b', 'admin', '$2a$06$c8z7AuP.DFTBmldHU6KGPOLjoKBikkWe9txp7Odj0SIjs3s26f3QO', false, 'ZJ2DRO6NM2GSVZKUXWZJRCBPBLM3JM5R', '2025-11-22 18:40:41.771759+00', '2025-12-04 01:16:26.672533+00')
ON CONFLICT (id) DO NOTHING;

-- 2. 会员等级
INSERT INTO membership_tiers (id, name, price, benefits, sort_order, is_active, withdrawal_minimum, daily_check_in_bonus, daily_draw_tickets, created_at, updated_at) VALUES
('4406b474-0854-4f1b-a330-90702197f5ff', '黄金会员', 1200, '["购物折扣", "专属头像框", "专属标签", "抽奖入场券"]', 1, true, 0, 0, 3, '2025-12-01 21:31:58.538544+00', '2025-12-01 21:31:58.538544+00'),
('bb1e6fe6-c1fd-46c9-8223-899dd060b381', '钻石会员', 6800, '["购物折扣", "专属头像框", "专属标签", "抽奖入场券"]', 2, true, 0, 0, 3, '2025-12-01 21:31:58.538544+00', '2025-12-01 21:31:58.538544+00'),
('76d65dca-ef13-41ad-a638-e462e4bcc054', '至尊会员', 18888, '["购物折扣", "专属头像框", "专属标签", "抽奖入场券"]', 3, true, 0, 0, 3, '2025-12-01 21:31:58.538544+00', '2025-12-01 21:31:58.538544+00')
ON CONFLICT (id) DO NOTHING;

-- 3. 头像边框
INSERT INTO avatar_frames (id, name, description, style_class, required_tier, sort_order, is_active, created_at) VALUES
('no-frame', '无边框', '默认无边框', 'none', NULL, 0, true, '2025-12-03 20:28:28.782396+00'),
('gold-classic', '经典金框', '简约大气的金色边框', 'gold-classic', 'gold', 1, true, '2025-12-03 20:28:28.782396+00'),
('gold-shine', '璀璨金光', '闪耀的金色光芒', 'gold-shine', 'gold', 2, true, '2025-12-03 20:28:28.782396+00'),
('gold-royal', '皇家金辉', '尊贵的皇家金框', 'gold-royal', 'gold', 3, true, '2025-12-03 20:28:28.782396+00'),
('diamond-ice', '冰晶钻石', '晶莹剔透的钻石光芒', 'diamond-ice', 'diamond', 4, true, '2025-12-03 20:28:28.782396+00'),
('diamond-crystal', '水晶之光', '闪烁的水晶边框', 'diamond-crystal', 'diamond', 5, true, '2025-12-03 20:28:28.782396+00'),
('diamond-aurora', '极光幻彩', '梦幻的极光效果', 'diamond-aurora', 'diamond', 6, true, '2025-12-03 20:28:28.782396+00'),
('elite-flame', '烈焰至尊', '燃烧的火焰边框', 'elite-flame', 'elite', 7, true, '2025-12-03 20:28:28.782396+00'),
('elite-galaxy', '银河星云', '神秘的星空效果', 'elite-galaxy', 'elite', 8, true, '2025-12-03 20:28:28.782396+00'),
('elite-supreme', '至尊荣耀', '最高荣耀的尊贵边框', 'elite-supreme', 'elite', 9, true, '2025-12-03 20:28:28.782396+00')
ON CONFLICT (id) DO NOTHING;

-- 4. 平台设置
INSERT INTO platform_settings (id, key, value, type, description, updated_at) VALUES
('a85233e0-2d63-4b5d-8b61-42a94d88888d', 'platform_name', 'Alo生态', 'text', '平台名称', now()),
('7201b9f0-a593-4f67-9205-589f75a2556f', 'platform_logo', '/logo.png', 'text', '平台Logo URL', now()),
('78559666-76e2-49be-b3dd-60da6828015e', 'platform_description', '安全可靠的即时通讯平台', 'text', '平台描述', now()),
('e643b3f7-0a3c-4885-8e5b-c0f64c7c9063', 'enable_registration', 'true', 'boolean', '是否允许注册', now()),
('5f7f633f-1b0e-41ea-a4c9-a35324ae440a', 'enable_red_envelope', 'true', 'boolean', '是否启用红包功能', now()),
('d7ddac6f-4a87-4c17-b8fc-2f18d971570d', 'fiat_bank_holder', '请联系在线客服', 'text', '法币收款银行账户名', now()),
('5fcf66ee-ce38-4952-8d0c-b3b609611c2d', 'fiat_wechat_qrcode', '', 'text', '微信收款二维码URL', now()),
('162f7de7-6a4b-42c9-be6d-198822093b77', 'fiat_alipay_qrcode', '', 'text', '支付宝收款二维码URL', now()),
('8237a542-da97-403e-8a30-c651044adc56', 'usdt_trc20_address', '', 'text', 'USDT TRC20收款地址', now()),
('f624656c-9611-4573-8966-73900acb4d52', 'usdt_exchange_rate', '7.2', 'text', 'USDT兑换人民币汇率', now()),
('e227dc3e-a4c9-4f19-bdab-dc5cf17c3d80', 'enable_transfer', 'true', 'boolean', '是否启用转账功能', now()),
('c48a7a0a-c3b9-4e33-b4c2-ba1c88f50de5', 'min_transfer_amount', '1', 'number', '最小转账金额', now()),
('8d9c6df3-1cb3-4b45-89f6-cadbb5168806', 'max_transfer_amount', '10000', 'number', '最大转账金额', now()),
('24912c85-7ecc-4ebd-9f66-aec10f4c39bc', 'official_website_url', 'https://www.ypkfjt.com/', 'text', '官网链接', now()),
('61878dd8-eec6-477d-9f92-102f4d71380e', 'enable_wallet', 'true', 'boolean', '是否启用钱包功能', now()),
('6a4d6b19-c660-4b59-ab8b-77e8c497fb62', 'enable_wallet_cny', 'true', 'boolean', '启用人民币充提', now()),
('0bdf6295-d523-4b74-8596-62e59042ae05', 'enable_wallet_usdt', 'false', 'boolean', '启用USDT充提', now()),
('592ced9f-311b-416f-8776-ff55730f21bf', 'checkin_day_day1', '1', 'number', '连续签到第1天奖励积分', now()),
('340c473f-a66c-4b1f-a687-1bf41516c7f7', 'checkin_day_day2', '2', 'number', '连续签到第2天奖励积分', now()),
('c46f5d27-793f-4bae-9e8b-2cfca0afdb19', 'checkin_day_day3', '3', 'number', '连续签到第3天奖励积分', now()),
('5a28da14-b63a-406d-b649-289608a1cc86', 'checkin_day_day4', '4', 'number', '连续签到第4天奖励积分', now()),
('dca98fa7-7a0e-4b2e-be4a-eb3fb1d4dfe7', 'checkin_day_day5', '5', 'number', '连续签到第5天奖励积分', now()),
('a2a4ce3d-b2d8-4e3b-8d14-14f5baa016c0', 'checkin_day_day6', '8', 'number', '连续签到第6天奖励积分', now()),
('1c7eeeb6-ca19-401e-9d72-c78929c7fc90', 'checkin_day_day7', '10', 'number', '连续签到第7天奖励积分', now()),
('3afbcd44-ecde-49d4-a31b-b25c39161676', 'checkin_multiplier_gold', '1', 'number', '黄金会员签到倍数', now()),
('31df644c-654c-482f-bf1f-580c3f98ca20', 'checkin_multiplier_diamond', '1', 'number', '钻石会员签到倍数', now()),
('9c1fbbcd-aca6-43c9-bf7a-158c00386399', 'checkin_multiplier_elite', '1', 'number', '至尊会员签到倍数', now()),
('439c0f44-4140-41d7-a797-ce5595b0dcfd', 'fiat_bank_name', '请联系在线客服', 'text', '法币收款银行名称', now()),
('03936d05-992a-4e35-8367-494e280d9b44', 'fiat_bank_account', '请联系在线客服', 'text', '法币收款银行账号', now())
ON CONFLICT (id) DO NOTHING;

-- 5. 积分商品
INSERT INTO point_products (id, name, description, points_required, category, type, sort_order, is_active, created_at, updated_at) VALUES
('955ea3ed-5a8c-4c26-81e7-6eb2c91b6806', '手机充值50元', '移动/联通/电信通用', 50, 'virtual', 'mobile_recharge', 1, true, '2025-12-01 21:41:30.056554+00', '2025-12-01 21:41:30.056554+00'),
('26a963df-1da3-487b-99ab-791ee5e92047', '手机充值100元', '移动/联通/电信通用', 100, 'virtual', 'mobile_recharge', 2, true, '2025-12-01 21:41:30.056554+00', '2025-12-01 21:41:30.056554+00'),
('b72c37d2-3269-4c52-9e83-21cd81ccdf10', '生活缴费代金券', '水电煤气通用券', 30, 'virtual', 'utilities', 3, true, '2025-12-01 21:41:30.056554+00', '2025-12-01 21:41:30.056554+00'),
('fe79cda4-73b2-4337-9092-531607b8d286', '交通出行券10元', '滴滴/高德打车券', 20, 'virtual', 'transport', 4, true, '2025-12-01 21:41:30.056554+00', '2025-12-01 21:41:30.056554+00'),
('6c3d7484-0bbe-4938-80e6-52d2af470510', '泰国青草膏', '清凉止痛 舒缓疲劳', 35, 'physical', 'gift', 5, true, '2025-12-01 21:41:30.056554+00', '2025-12-01 21:41:30.056554+00'),
('a8f7eeec-fc44-445a-b1c9-33cd36105efc', '百花蜂蜜500克盒装', '纯天然野生蜂蜜', 60, 'physical', 'gift', 6, true, '2025-12-01 21:41:30.056554+00', '2025-12-01 21:41:30.056554+00')
ON CONFLICT (id) DO NOTHING;

-- 6. 推荐设置
INSERT INTO referral_settings (id, is_enabled, level_1_reward, level_2_reward, level_3_reward, require_approval, created_at, updated_at) VALUES
('232f068c-520e-4d42-878d-93dc374bbd3f', true, 10.00, 5.00, 2.00, true, '2025-12-01 17:30:21.518691+00', '2025-12-01 17:30:21.518691+00')
ON CONFLICT (id) DO NOTHING;

-- 7. 敏感词
INSERT INTO sensitive_words (id, word, category, action, created_at, updated_at) VALUES
('82cefdd7-22a8-4b7c-a33a-dc4efd952149', '傻逼', 'violence', 'replace', '2025-11-25 20:36:14.444967+00', '2025-11-25 20:36:14.444967+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 注意：用户数据(profiles)需要先通过 auth.users 创建用户后才能导入
-- 以下数据需要在用户注册后手动关联或通过迁移脚本处理
-- ============================================

-- 完成提示
SELECT '基础配置数据导入完成！用户数据需要单独处理。' as status;
