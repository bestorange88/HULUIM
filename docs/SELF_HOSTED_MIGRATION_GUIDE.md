# 自托管迁移完整教程

## 目录
1. [前端配置](#1-前端配置)
2. [数据导出与导入](#2-数据导出与导入)
3. [Edge Functions 部署](#3-edge-functions-部署)
4. [验证与测试](#4-验证与测试)

---

## 1. 前端配置

### 1.1 创建前端环境配置文件

在项目根目录创建 `.env.production` 文件：

```bash
# 自托管后端配置
VITE_SUPABASE_URL=http://您的服务器IP:8000
VITE_SUPABASE_PUBLISHABLE_KEY=您的anon_key
VITE_SUPABASE_PROJECT_ID=self-hosted
```

**获取 anon_key:**
```bash
# 在服务器上查看
cat /opt/supabase/docker/.env | grep ANON_KEY
```

默认的 anon_key 是:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
```

### 1.2 修改 Supabase 客户端配置

编辑 `src/integrations/supabase/client.ts`：

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// 自托管后端配置
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "http://您的服务器IP:8000";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "您的anon_key";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

### 1.3 构建前端

```bash
# 本地构建
npm run build

# 构建产物在 dist/ 目录
```

### 1.4 部署前端到服务器

**方式一：使用 SCP 上传**
```bash
# 在本地执行
scp -r dist/* root@您的服务器IP:/www/wwwroot/您的网站目录/
```

**方式二：通过宝塔面板上传**
1. 登录宝塔面板
2. 进入 文件 -> /www/wwwroot/您的网站目录/
3. 上传 dist 目录中的所有文件

### 1.5 配置 Nginx

在宝塔面板中配置网站 Nginx：

```nginx
server {
    listen 80;
    server_name 您的域名或IP;
    root /www/wwwroot/您的网站目录;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理到 Supabase
    location /rest/ {
        proxy_pass http://127.0.0.1:8000/rest/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /auth/ {
        proxy_pass http://127.0.0.1:8000/auth/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /storage/ {
        proxy_pass http://127.0.0.1:8000/storage/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    location /realtime/ {
        proxy_pass http://127.0.0.1:8000/realtime/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /functions/ {
        proxy_pass http://127.0.0.1:8000/functions/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 2. 数据导出与导入

### 2.1 从 Lovable Cloud 导出数据

#### 方法一：使用 Supabase CLI（推荐）

```bash
# 1. 安装 Supabase CLI
npm install -g supabase

# 2. 登录 Supabase
supabase login

# 3. 链接到项目
supabase link --project-ref fziwcnrrojazlalccwpe

# 4. 导出数据库
supabase db dump --data-only > lovable_data.sql
```

#### 方法二：使用 pg_dump

```bash
# 获取数据库连接字符串（在 Lovable 项目设置中查看）
# 格式: postgresql://postgres:[PASSWORD]@db.fziwcnrrojazlalccwpe.supabase.co:5432/postgres

pg_dump "postgresql://postgres:您的密码@db.fziwcnrrojazlalccwpe.supabase.co:5432/postgres" \
  --data-only \
  --no-owner \
  --no-privileges \
  -f lovable_data.sql
```

#### 方法三：通过 API 导出（适合小数据量）

创建 `export-data.js` 文件：

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://fziwcnrrojazlalccwpe.supabase.co',
  '您的service_role_key'  // 在 Lovable 项目设置中获取
);

const tables = [
  'profiles',
  'conversations',
  'conversation_participants',
  'messages',
  'friendships',
  'wallets',
  'transactions',
  'user_points',
  'daily_check_ins',
  'red_envelopes',
  'red_envelope_claims',
  'transfers',
  'real_name_verifications',
  'crypto_transactions',
  'bank_cards',
  'shipping_addresses',
  'point_products',
  'point_orders',
  'point_transactions',
  'moments',
  'moment_likes',
  'moment_comments',
  'lucky_draws',
  'user_memberships',
  'group_invites',
  'group_join_requests',
  'referrals',
  'news_articles',
  'customer_service_accounts',
  'admin_gifts',
  'sensitive_words',
  'system_messages',
  'message_favorites',
  'friend_groups',
  'friend_group_members',
  'conversation_settings',
  'referral_rewards'
];

async function exportData() {
  const allData = {};
  
  for (const table of tables) {
    console.log(`Exporting ${table}...`);
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`Error exporting ${table}:`, error.message);
      allData[table] = [];
    } else {
      allData[table] = data || [];
      console.log(`  - ${data?.length || 0} rows`);
    }
  }
  
  fs.writeFileSync('lovable_export.json', JSON.stringify(allData, null, 2));
  console.log('Export complete: lovable_export.json');
}

exportData();
```

运行导出：
```bash
node export-data.js
```

### 2.2 导入数据到自托管数据库

#### 如果使用 SQL 文件导出：

```bash
# 上传 SQL 文件到服务器
scp lovable_data.sql root@您的服务器IP:/opt/supabase/docker/

# 导入数据
docker exec -i supabase-db psql -U postgres -d postgres < /opt/supabase/docker/lovable_data.sql
```

#### 如果使用 JSON 导出：

创建 `import-data.js` 文件：

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// 自托管 Supabase 配置
const supabase = createClient(
  'http://您的服务器IP:8000',
  '您的service_role_key'  // 从 /opt/supabase/docker/.env 获取 SERVICE_ROLE_KEY
);

const data = JSON.parse(fs.readFileSync('lovable_export.json', 'utf8'));

// 定义导入顺序（考虑外键依赖）
const importOrder = [
  'profiles',  // 先导入用户
  'wallets',
  'user_points',
  'conversations',
  'conversation_participants',
  'messages',
  'friendships',
  'friend_groups',
  'friend_group_members',
  'transactions',
  'daily_check_ins',
  'red_envelopes',
  'red_envelope_claims',
  'transfers',
  'real_name_verifications',
  'crypto_transactions',
  'bank_cards',
  'shipping_addresses',
  'point_products',
  'point_orders',
  'point_transactions',
  'moments',
  'moment_likes',
  'moment_comments',
  'lucky_draws',
  'user_memberships',
  'group_invites',
  'group_join_requests',
  'referrals',
  'news_articles',
  'customer_service_accounts',
  'admin_gifts',
  'sensitive_words',
  'system_messages',
  'message_favorites',
  'conversation_settings',
  'referral_rewards'
];

async function importData() {
  for (const table of importOrder) {
    const rows = data[table];
    if (!rows || rows.length === 0) {
      console.log(`Skipping ${table} (no data)`);
      continue;
    }
    
    console.log(`Importing ${table} (${rows.length} rows)...`);
    
    // 分批导入（每批 100 条）
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase.from(table).upsert(batch, { 
        onConflict: 'id',
        ignoreDuplicates: true 
      });
      
      if (error) {
        console.error(`  Error: ${error.message}`);
      } else {
        console.log(`  Imported ${Math.min(i + 100, rows.length)}/${rows.length}`);
      }
    }
  }
  
  console.log('Import complete!');
}

importData();
```

运行导入：
```bash
node import-data.js
```

### 2.3 迁移 Auth 用户

Auth 用户需要单独迁移：

```bash
# 在 Lovable Cloud 数据库执行（通过 Supabase Dashboard 或 CLI）
SELECT id, email, encrypted_password, email_confirmed_at, 
       phone, phone_confirmed_at, raw_user_meta_data, 
       created_at, updated_at
FROM auth.users;
```

导出后，在自托管数据库导入：

```bash
docker exec -i supabase-db psql -U postgres -d postgres << 'EOSQL'
-- 插入 auth.users（示例）
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, 
                        phone, phone_confirmed_at, raw_user_meta_data, 
                        created_at, updated_at, instance_id, aud, role)
VALUES 
  ('用户UUID', 'user@example.com', '加密密码', now(), 
   '+8613800138000', now(), '{"username": "user1"}',
   now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
EOSQL
```

---

## 3. Edge Functions 部署

### 3.1 复制 Edge Functions 到服务器

```bash
# 将 supabase/functions 目录上传到服务器
scp -r supabase/functions root@您的服务器IP:/opt/supabase/docker/volumes/functions/
```

### 3.2 配置 Edge Functions 环境变量

在服务器上编辑 `/opt/supabase/docker/.env`，添加所需的密钥：

```bash
# SMS 服务
SMSBAO_USERNAME=您的短信宝用户名
SMSBAO_API_KEY=您的短信宝API密钥

# AI 服务（可选）
OPENAI_API_KEY=您的OpenAI密钥

# TURN 服务器
METERED_TURN_API_KEY=您的TURN服务器密钥
```

### 3.3 重启 Edge Functions 服务

```bash
cd /opt/supabase/docker
docker compose restart supabase-edge-functions
```

### 3.4 验证 Edge Functions

```bash
# 测试调用
curl http://您的服务器IP:8000/functions/v1/admin-auth \
  -H "Authorization: Bearer 您的anon_key" \
  -H "Content-Type: application/json" \
  -d '{"action": "verify"}'
```

---

## 4. 验证与测试

### 4.1 检查服务状态

```bash
# 查看所有容器状态
docker ps

# 应该看到以下服务都在运行：
# - supabase-db
# - supabase-kong
# - supabase-auth
# - supabase-rest
# - supabase-realtime
# - supabase-storage
# - supabase-edge-functions
# - supabase-studio
```

### 4.2 测试 API 连接

```bash
# 测试 REST API
curl http://您的服务器IP:8000/rest/v1/profiles?limit=1 \
  -H "apikey: 您的anon_key"

# 测试 Auth API
curl http://您的服务器IP:8000/auth/v1/settings \
  -H "apikey: 您的anon_key"
```

### 4.3 测试前端

1. 访问您的网站
2. 尝试注册新用户
3. 尝试登录
4. 检查聊天功能
5. 检查钱包功能

### 4.4 常见问题排查

#### 问题：API 连接失败
```bash
# 检查 Kong 日志
docker logs supabase-kong --tail 50

# 检查防火墙
firewall-cmd --list-ports
firewall-cmd --add-port=8000/tcp --permanent
firewall-cmd --reload
```

#### 问题：认证失败
```bash
# 检查 Auth 服务日志
docker logs supabase-auth --tail 50

# 确认 JWT Secret 一致
cat /opt/supabase/docker/.env | grep JWT_SECRET
```

#### 问题：Realtime 不工作
```bash
# 检查 Realtime 服务日志
docker logs realtime-dev.supabase-realtime --tail 50

# 确保 WebSocket 端口开放
firewall-cmd --add-port=4000/tcp --permanent
firewall-cmd --reload
```

---

## 附录：快速命令参考

```bash
# 重启所有服务
cd /opt/supabase/docker && docker compose restart

# 查看日志
docker logs supabase-db --tail 100
docker logs supabase-auth --tail 100
docker logs supabase-kong --tail 100

# 进入数据库
docker exec -it supabase-db psql -U postgres -d postgres

# 备份数据库
docker exec supabase-db pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql

# 恢复数据库
docker exec -i supabase-db psql -U postgres -d postgres < backup_20241205.sql
```
