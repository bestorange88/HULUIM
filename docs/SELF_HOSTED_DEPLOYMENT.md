# Alo生态 自建服务器完整部署指南

本指南帮助你将 Alo生态 完整部署到自建服务器，包括前端和后端（Supabase 自托管）。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      负载均衡 (Nginx)                        │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   前端静态    │   │  Supabase API   │   │  Edge Functions │
│   (Nginx)     │   │   (Kong/REST)   │   │    (Deno)       │
└───────────────┘   └─────────────────┘   └─────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  PostgreSQL   │   │     Redis       │   │  文件存储(S3)   │
│   (主数据库)   │   │   (缓存/队列)    │   │   (MinIO)      │
└───────────────┘   └─────────────────┘   └─────────────────┘
```

## 服务器要求

### 最小配置（测试/小规模）
- CPU: 4核
- 内存: 8GB
- 硬盘: 100GB SSD
- 带宽: 10Mbps

### 推荐配置（生产/中等规模 ~10万用户）
- CPU: 16核
- 内存: 32GB
- 硬盘: 500GB SSD
- 带宽: 100Mbps

### 高并发配置（百万级用户）
需要多台服务器集群：
- 2-3台 应用服务器
- 1台 数据库主服务器 + 2台从服务器
- 1台 Redis 集群
- 独立存储服务器或对象存储服务

## 快速开始

### 方式一：使用一键部署脚本

```bash
# 下载部署脚本
curl -O https://raw.githubusercontent.com/your-repo/scripts/supabase-deploy.sh

# 添加执行权限
chmod +x supabase-deploy.sh

# 执行部署
sudo ./supabase-deploy.sh
```

### 方式二：手动部署

## 第一步：安装 Docker 和 Docker Compose

```bash
# CentOS/AlmaLinux/Rocky Linux
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
docker compose version
```

## 第二步：部署 Supabase 自托管

```bash
# 创建工作目录
mkdir -p /opt/supabase && cd /opt/supabase

# 克隆 Supabase 官方 Docker 配置
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# 复制环境变量模板
cp .env.example .env
```

### 配置 .env 文件

编辑 `/opt/supabase/supabase/docker/.env`：

```bash
############
# Secrets
############
# 生成强密码: openssl rand -base64 32

# PostgreSQL 密码
POSTGRES_PASSWORD=your_secure_postgres_password

# JWT 密钥 (必须足够长)
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long

# Anon Key (用于前端)
ANON_KEY=生成的anon_key

# Service Role Key (用于后端)
SERVICE_ROLE_KEY=生成的service_role_key

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# API
############
SITE_URL=https://your-domain.com
API_EXTERNAL_URL=https://api.your-domain.com

############
# Auth
############
GOTRUE_SITE_URL=https://your-domain.com
GOTRUE_JWT_EXP=3600
GOTRUE_DISABLE_SIGNUP=false

# SMTP 配置 (用于邮件验证)
GOTRUE_SMTP_HOST=smtp.example.com
GOTRUE_SMTP_PORT=587
GOTRUE_SMTP_USER=your-smtp-user
GOTRUE_SMTP_PASS=your-smtp-password
GOTRUE_SMTP_SENDER_NAME=Alo生态

############
# Storage
############
STORAGE_BACKEND=file
FILE_SIZE_LIMIT=52428800
```

### 生成 JWT Keys

```bash
# 安装 JWT 生成工具
npm install -g @supabase/cli

# 或使用在线工具生成
# https://supabase.com/docs/guides/self-hosting#generate-api-keys
```

### 启动 Supabase

```bash
cd /opt/supabase/supabase/docker
docker compose up -d
```

### 验证服务

```bash
# 检查所有容器状态
docker compose ps

# 应该看到以下服务运行中:
# - supabase-db (PostgreSQL)
# - supabase-kong (API Gateway)
# - supabase-auth (GoTrue)
# - supabase-rest (PostgREST)
# - supabase-realtime
# - supabase-storage
# - supabase-meta
# - supabase-functions (Edge Functions)
```

## 第三步：导入数据库结构

将 Lovable Cloud 的数据库结构导出并导入到自建服务器：

```bash
# 连接到 PostgreSQL
docker exec -it supabase-db psql -U postgres

# 或使用 psql 客户端
psql -h localhost -p 5432 -U postgres -d postgres
```

### 导入表结构

将项目中 `supabase/migrations/` 文件夹的所有 SQL 文件按顺序执行。

## 第四步：部署 Edge Functions

Edge Functions 需要 Deno runtime：

```bash
# 创建 Edge Functions 目录
mkdir -p /opt/supabase/functions

# 复制项目中的 Edge Functions
cp -r /path/to/your/project/supabase/functions/* /opt/supabase/functions/

# 配置 Edge Functions 环境变量
cat > /opt/supabase/functions/.env << EOF
SUPABASE_URL=http://kong:8000
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
LOVABLE_API_KEY=your_lovable_api_key
SMSBAO_USERNAME=your_smsbao_username
SMSBAO_API_KEY=your_smsbao_api_key
EOF
```

## 第五步：配置 Nginx 反向代理

```nginx
# /etc/nginx/conf.d/alo.conf

# 前端
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/your-domain.com.crt;
    ssl_certificate_key /etc/nginx/ssl/your-domain.com.key;

    root /www/wwwroot/alo/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Supabase API
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/nginx/ssl/api.your-domain.com.crt;
    ssl_certificate_key /etc/nginx/ssl/api.your-domain.com.key;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持
        proxy_read_timeout 86400;
    }
}
```

## 第六步：修改前端配置

更新项目 `.env` 文件指向自建服务器：

```bash
VITE_SUPABASE_URL=https://api.your-domain.com
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_PROJECT_ID=self-hosted
```

重新构建前端：

```bash
npm run build
```

## 第七步：数据迁移

### 从 Lovable Cloud 导出数据

由于 Lovable Cloud 不提供直接数据库访问，需要通过 API 导出数据：

```javascript
// 数据导出脚本示例
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'your-lovable-cloud-url',
  'your-service-role-key'
);

async function exportTable(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*');
  
  if (error) throw error;
  
  // 保存到 JSON 文件
  const fs = require('fs');
  fs.writeFileSync(`${tableName}.json`, JSON.stringify(data, null, 2));
}

// 导出所有表
const tables = [
  'profiles', 'conversations', 'messages', 'friendships',
  'wallets', 'transactions', 'user_points', 'point_transactions'
  // ... 其他表
];

tables.forEach(exportTable);
```

### 导入到自建服务器

```javascript
// 数据导入脚本
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://api.your-domain.com',
  'your_service_role_key'
);

async function importTable(tableName) {
  const data = JSON.parse(fs.readFileSync(`${tableName}.json`, 'utf8'));
  
  const { error } = await supabase
    .from(tableName)
    .upsert(data);
  
  if (error) throw error;
  console.log(`Imported ${data.length} rows to ${tableName}`);
}
```

## 监控和维护

### 日志查看

```bash
# 查看所有服务日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f supabase-db
docker compose logs -f supabase-auth
```

### 备份

```bash
# 数据库备份
docker exec supabase-db pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql

# 定时备份 (添加到 crontab)
0 2 * * * docker exec supabase-db pg_dump -U postgres postgres | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz
```

### 性能优化

```bash
# PostgreSQL 配置优化 (编辑 postgresql.conf)
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 64MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 10485kB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
max_parallel_maintenance_workers = 2
```

## 常见问题

### Q: Edge Functions 无法访问？
确保 Deno runtime 正确配置，检查函数文件权限。

### Q: 实时订阅不工作？
检查 WebSocket 代理配置，确保 Nginx 正确转发 Upgrade 头。

### Q: 文件上传失败？
检查存储后端配置和文件大小限制。

## 高可用部署

对于百万级用户，建议：

1. **数据库主从复制** - 读写分离
2. **Redis 集群** - 缓存热点数据
3. **多实例 API 服务** - 负载均衡
4. **CDN** - 静态资源加速
5. **对象存储** - 使用 MinIO 或阿里云 OSS

详细的高可用架构部署请参考 `HIGH_AVAILABILITY_DEPLOYMENT.md`。
