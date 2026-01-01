# 🚀 Alo生态 - 多服务器部署架构方案

## 📋 目录
- [架构概述](#架构概述)
- [服务器配置方案](#服务器配置方案)
- [阿里云产品配置](#阿里云产品配置)
- [安全防护体系](#安全防护体系)
- [部署流程](#部署流程)
- [监控运维](#监控运维)
- [成本预算](#成本预算)

---

## 🏗️ 架构概述

### 整体架构图

```
                        [用户端]
                           ↓
                    [阿里云 DDoS 防护]
                           ↓
                    [阿里云 WAF 防火墙]
                           ↓
                    [阿里云 SLB 负载均衡]
                     /              \
            [应用服务器1]      [应用服务器2]
                     \              /
                           ↓
                  [Lovable Cloud 后端]
                  (Supabase 托管)
                           ↓
                    [阿里云 OSS 存储]
```

### 三层架构设计

#### 1️⃣ 接入层（边缘安全）
- **DDoS 高防**：防御分布式拒绝服务攻击
- **WAF 应用防火墙**：防御 SQL 注入、XSS 等 Web 攻击
- **SSL/TLS 加密**：全站 HTTPS 加密传输
- **负载均衡 SLB**：流量分发和健康检查

#### 2️⃣ 应用层（业务服务）
- **应用服务器集群**：2 台 ECS 实例部署前端静态资源
- **Nginx 服务器**：静态资源托管 + 反向代理
- **自动扩缩容**：根据负载自动调整资源

#### 3️⃣ 数据层（后端服务）
- **Lovable Cloud (Supabase)**：托管数据库 + Edge Functions + 认证
- **阿里云 OSS**：媒体文件存储（头像、聊天图片、视频等）
- **CDN 加速**：静态资源全球加速

---

## 💻 服务器配置方案

### 方案一：小规模标准配置（推荐）

#### 服务器 1：主应用服务器
- **配置**：阿里云 ECS ecs.c6.large
- **规格**：2核4G
- **带宽**：5M 固定带宽
- **系统盘**：40GB ESSD 云盘
- **数据盘**：100GB ESSD 云盘
- **操作系统**：Ubuntu 22.04 LTS
- **用途**：部署 Nginx + 前端静态资源 + 反向代理

#### 服务器 2：备用应用服务器
- **配置**：阿里云 ECS ecs.c6.large
- **规格**：2核4G
- **带宽**：5M 固定带宽
- **系统盘**：40GB ESSD 云盘
- **数据盘**：100GB ESSD 云盘
- **操作系统**：Ubuntu 22.04 LTS
- **用途**：负载均衡 + 灾备切换

### 服务配置

| 服务组件 | 版本要求 | 部署位置 |
|---------|---------|---------|
| Nginx | 1.24+ | 服务器 1、2 |
| Node.js | 18.x LTS | 本地构建 |
| PM2 | 5.x | 服务器 1、2 |
| Docker | 24.x | 可选 |

---

## ☁️ 阿里云产品配置

### 1. DDoS 高防（DDoS 防护基础版）

```bash
# 配置参数
防护带宽：20Gbps（基础版免费额度）
清洗阈值：5Gbps
弹性防护：开启（按量付费）
防护域名：yourdomain.com
回源 IP：SLB 公网 IP

# 防护规则
- 开启 CC 防护
- 开启黑洞策略
- 配置区域封禁（根据业务需要）
```

### 2. Web 应用防火墙（WAF）

```bash
# 基础配置
版本：WAF Pro 版
域名数量：1 个主域名
带宽规格：50M
QPS 规格：5000

# 防护规则配置
## 核心规则组
- SQL 注入防护（高级模式）
- XSS 跨站脚本防护（高级模式）
- 文件上传防护（限制类型：jpg,png,jpeg,gif,mp4,mp3）
- WebShell 防护
- CSRF 防护

## 自定义规则
# 1. 限制单 IP 访问频率
if (request_rate > 100/min) {
  action: 人机验证
}

# 2. 敏感路径保护
path in ['/superadmin', '/api/admin'] {
  require: IP 白名单 or 人机验证
}

# 3. 接口防刷
path: /api/send-sms-code {
  rate_limit: 5/5min per IP
  action: 拦截
}

## IP 黑名单管理
- 开启自动封禁（异常行为）
- 手动封禁恶意 IP
- 封禁时长：24 小时

## 区域访问控制
允许区域：中国大陆
可选允许：港澳台、东南亚
拦截区域：其他
```

### 3. 负载均衡（SLB）

```bash
# 实例配置
类型：应用型负载均衡 ALB
规格：标准版 I
公网带宽：10M 按量付费
可用区：多可用区部署（华东1区 可用区B、可用区C）

# 监听器配置
## HTTPS 监听器（端口 443）
协议：HTTPS
端口：443
SSL 证书：配置域名证书
后端协议：HTTP
健康检查：HTTP /health 路径
健康检查间隔：2秒
健康阈值：3次
不健康阈值：3次

## HTTP 监听器（端口 80）
协议：HTTP
端口：80
转发规则：重定向到 HTTPS 443

# 后端服务器组
服务器 1：内网 IP + 端口 80 + 权重 100
服务器 2：内网 IP + 端口 80 + 权重 100

# 会话保持
类型：Cookie 植入
Cookie 名称：ALBLB_COOKIE
超时时间：1800秒
```

### 4. 对象存储（OSS）

```bash
# Bucket 配置
Bucket 名称：alo-media-production
存储类型：标准存储
读写权限：私有（通过签名 URL 访问）
区域：华东1（杭州）
版本控制：开启
加密方式：服务端加密 AES256

# 目录结构
alo-media-production/
├── avatars/           # 用户头像
├── chat-images/       # 聊天图片
├── chat-files/        # 聊天文件
├── verification/      # 实名认证文件
└── admin/            # 管理员上传

# 访问控制
- 签名 URL 有效期：1小时
- Referer 白名单：yourdomain.com
- 防盗链：开启
- 跨域规则：
  * 来源：https://yourdomain.com
  * 方法：GET, POST, PUT, DELETE
  * 允许 Headers：*
  * 暴露 Headers：ETag

# 生命周期管理
- 聊天图片/文件：90 天后转低频存储
- 实名认证文件：永久保存
- 临时文件：30 天后删除

# CDN 加速
- 开启 OSS 对象存储 CDN
- 加速域名：cdn.yourdomain.com
- 回源配置：私有 Bucket 回源
- HTTPS 配置：强制 HTTPS
- 缓存规则：
  * 图片文件：7 天
  * 视频文件：30 天
  * 其他文件：1 天
```

### 5. 云监控与日志

```bash
# 云监控 CloudMonitor
监控指标：
- ECS CPU 利用率 > 80% 告警
- ECS 内存使用率 > 85% 告警
- ECS 磁盘使用率 > 80% 告警
- SLB 健康检查失败告警
- WAF 攻击次数 > 100/分钟告警

告警方式：
- 短信通知：紧急告警
- 邮件通知：所有告警
- 钉钉机器人：实时告警

# 日志服务 SLS
## 访问日志
- SLB 访问日志：保留 30 天
- WAF 访问日志：保留 90 天
- Nginx 访问日志：保留 7 天

## 应用日志
- 应用错误日志：保留 30 天
- 系统日志：保留 7 天

## 安全审计日志
- 管理员操作日志：保留 180 天
- 敏感操作日志：保留 365 天
- 登录日志：保留 90 天
```

---

## 🔒 安全防护体系

### 1. 传输层安全

#### SSL/TLS 配置

```nginx
# Nginx SSL 配置（/etc/nginx/nginx.conf）
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL 证书
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # SSL 协议和加密套件
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    
    # SSL 会话缓存
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # 其他安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://fziwcnrrojazlalccwpe.supabase.co https://ai.gateway.lovable.dev;" always;
    
    location / {
        root /var/www/alo/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 2. 应用层安全

#### 访问控制配置

```nginx
# 管理后台 IP 白名单
location /superadmin {
    # 允许的办公室 IP
    allow 123.123.123.123;
    allow 124.124.124.124;
    
    # 拒绝其他所有
    deny all;
    
    # 或启用 HTTP Basic Auth
    auth_basic "Admin Area";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    root /var/www/alo/dist;
    try_files $uri $uri/ /index.html;
}

# API 接口限流
location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    limit_req_status 429;
    
    # 如果是代理到后端
    proxy_pass https://fziwcnrrojazlalccwpe.supabase.co;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# 限流配置
http {
    # 接口限流：每 IP 每秒 10 个请求
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    
    # 连接限制：每 IP 最多 10 个并发连接
    limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
    limit_conn conn_limit 10;
}
```

### 3. 数据安全

#### 敏感数据加密

```javascript
// 数据库敏感字段加密（Edge Function 示例）
import { createClient } from '@supabase/supabase-js';

// 使用 AES-256-GCM 加密敏感数据
async function encryptSensitiveData(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(Deno.env.get('ENCRYPTION_KEY')!),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(data)
  );
  
  // 将 IV 和加密数据组合
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// 实名认证信息加密存储
async function storeVerificationData(userId: string, idCardNumber: string) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const encryptedIdCard = await encryptSensitiveData(idCardNumber);
  
  await supabase
    .from('real_name_verifications')
    .insert({
      user_id: userId,
      id_card_number: encryptedIdCard, // 加密存储
    });
}
```

#### 文件上传安全

```nginx
# 文件上传大小限制
client_max_body_size 10M;

# 禁止执行上传目录中的脚本
location ~* ^/uploads/.*\.(php|php5|sh|pl|py)$ {
    deny all;
}

# 仅允许特定类型文件
location /api/upload {
    # 文件类型验证在应用层处理
    limit_req zone=upload_limit burst=5 nodelay;
    proxy_pass https://fziwcnrrojazlalccwpe.supabase.co;
}
```

### 4. 访问审计

#### 管理员操作日志

```sql
-- 创建审计日志表
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_username TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 仅管理员可查看
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_logs FOR SELECT
USING (true);

-- 创建审计日志记录函数
CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_username TEXT,
  p_action TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_logs (
    admin_username,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_admin_username,
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    p_ip_address,
    p_user_agent
  );
END;
$$;
```

### 5. 备份与恢复

#### 数据库备份策略

```bash
# Lovable Cloud (Supabase) 自动备份
- 每日自动备份：保留 7 天
- 每周备份：保留 4 周
- 每月备份：保留 3 个月

# 手动备份流程
1. 使用 Supabase Dashboard 创建快照
2. 导出关键数据表到 OSS
3. 验证备份完整性

# 恢复流程
1. 评估数据丢失范围
2. 从最近备份点恢复
3. 应用增量日志（如有）
4. 验证数据一致性
5. 切换服务
```

#### 应用文件备份

```bash
# 每日备份脚本
#!/bin/bash

BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d_%H%M%S)
OSS_BUCKET="oss://alo-backup"

# 备份应用文件
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/alo

# 备份 Nginx 配置
tar -czf $BACKUP_DIR/nginx_$DATE.tar.gz /etc/nginx

# 上传到 OSS
ossutil cp $BACKUP_DIR/app_$DATE.tar.gz $OSS_BUCKET/app/
ossutil cp $BACKUP_DIR/nginx_$DATE.tar.gz $OSS_BUCKET/nginx/

# 清理本地 7 天前的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

---

## 📦 部署流程

### 前置准备

```bash
# 1. 本地环境准备
- Node.js 18.x LTS
- npm or pnpm
- Git

# 2. 阿里云账号准备
- 实名认证
- 开通所需服务
- 配置支付方式

# 3. 域名准备
- 域名已备案
- SSL 证书申请完成
- DNS 解析准备就绪
```

### 步骤 1：构建应用

```bash
# 克隆代码仓库
git clone <your-repo-url>
cd alo-ecosystem

# 安装依赖
npm install

# 配置环境变量（.env.production）
cat > .env.production << EOF
VITE_SUPABASE_URL=https://fziwcnrrojazlalccwpe.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
VITE_SUPABASE_PROJECT_ID=fziwcnrrojazlalccwpe
EOF

# 构建生产版本
npm run build

# 构建产物在 dist/ 目录
```

### 步骤 2：服务器初始化

```bash
# 连接到服务器
ssh root@<server-ip>

# 更新系统
apt update && apt upgrade -y

# 安装必要软件
apt install -y nginx certbot python3-certbot-nginx

# 创建应用目录
mkdir -p /var/www/alo
chown -R www-data:www-data /var/www/alo

# 配置防火墙
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

### 步骤 3：部署应用

```bash
# 方式 A：直接上传
scp -r dist/* root@<server-ip>:/var/www/alo/

# 方式 B：使用 Git（推荐）
cd /var/www/alo
git clone <your-repo-url> .
npm install
npm run build
cp -r dist/* /var/www/alo/
```

### 步骤 4：配置 Nginx

```bash
# 创建 Nginx 配置文件
cat > /etc/nginx/sites-available/alo << 'EOF'
# 限流配置
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

server {
    listen 80;
    server_name yourdomain.com;
    
    # 临时配置，用于 SSL 证书验证
    location /.well-known/acme-challenge/ {
        root /var/www/alo;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL 证书（certbot 自动生成后会更新这里）
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # 安全头
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # 静态文件
    location / {
        root /var/www/alo/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # 管理后台 IP 白名单
    location /superadmin {
        # TODO: 配置允许的 IP
        # allow 123.123.123.123;
        # deny all;
        
        root /var/www/alo/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # 连接限制
    limit_conn conn_limit 10;
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
}
EOF

# 启用配置
ln -s /etc/nginx/sites-available/alo /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 步骤 5：申请 SSL 证书

```bash
# 使用 Certbot 自动申请 Let's Encrypt 证书
certbot --nginx -d yourdomain.com

# 设置自动续期
systemctl enable certbot.timer
systemctl start certbot.timer

# 测试续期
certbot renew --dry-run
```

### 步骤 6：配置负载均衡

```bash
# 在阿里云控制台配置 SLB
1. 创建应用型负载均衡实例
2. 添加 HTTPS 监听器（端口 443）
3. 上传 SSL 证书
4. 配置后端服务器组
   - 添加服务器 1 和服务器 2
   - 权重各设为 100
5. 配置健康检查
   - 路径：/health
   - 间隔：2秒
   - 超时：5秒
6. 测试负载均衡

# 在两台服务器上添加健康检查端点
cat > /var/www/alo/dist/health << 'EOF'
OK
EOF
```

### 步骤 7：配置 OSS

```bash
# 1. 创建 OSS Bucket（在阿里云控制台）
Bucket 名称：alo-media-production
存储类型：标准存储
读写权限：私有
区域：华东1

# 2. 配置 CORS 规则
来源：https://yourdomain.com
方法：GET, POST, PUT, DELETE
允许 Headers：*

# 3. 配置跨域访问（在前端代码中使用签名 URL）
# 已在 Supabase Storage 中实现

# 4. 绑定 CDN 加速域名
cdn.yourdomain.com -> OSS Bucket
```

### 步骤 8：配置安全防护

```bash
# 1. DDoS 高防配置
- 访问阿里云 DDoS 控制台
- 添加防护域名：yourdomain.com
- 配置回源 IP：SLB 公网 IP
- 启用 CC 防护

# 2. WAF 配置
- 访问阿里云 WAF 控制台
- 添加防护域名：yourdomain.com
- 启用防护规则：
  * SQL 注入
  * XSS
  * 文件上传
  * WebShell
- 配置自定义规则（频率限制、IP 黑名单）

# 3. 云监控配置
- 创建告警规则
- 配置通知方式（短信、邮件）
- 设置告警阈值
```

### 步骤 9：验证部署

```bash
# 1. 检查服务状态
systemctl status nginx

# 2. 检查 SSL 证书
curl -I https://yourdomain.com

# 3. 检查负载均衡
# 多次访问，观察日志是否轮询到不同服务器
tail -f /var/log/nginx/access.log

# 4. 检查健康检查
curl https://yourdomain.com/health

# 5. 压力测试
ab -n 1000 -c 10 https://yourdomain.com/

# 6. 功能测试
- 用户注册登录
- 发送消息
- 上传文件
- 管理员后台
```

---

## 📊 监控运维

### 日常监控检查清单

```bash
# 每日检查（自动化脚本）
#!/bin/bash

# 1. 服务器状态
echo "=== Server Status ==="
uptime
free -h
df -h

# 2. Nginx 状态
systemctl status nginx

# 3. 访问日志分析
echo "=== Top 10 访问 IP ==="
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10

echo "=== HTTP 状态码分布 ==="
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn

# 4. 错误日志检查
echo "=== Recent Errors ==="
tail -n 50 /var/log/nginx/error.log

# 5. 性能指标
echo "=== Load Average ==="
cat /proc/loadavg

echo "=== Active Connections ==="
netstat -an | grep :443 | wc -l

# 发送报告到管理员
# mail -s "Daily Server Report" admin@yourdomain.com < report.txt
```

### 性能优化建议

```nginx
# Nginx 性能优化配置
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    use epoll;
    worker_connections 4096;
    multi_accept on;
}

http {
    # Keepalive 优化
    keepalive_timeout 65;
    keepalive_requests 100;
    
    # 文件缓存
    open_file_cache max=10000 inactive=60s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
    
    # Sendfile
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
```

### 故障处理流程

```bash
# 服务器宕机处理
1. SLB 自动将流量切换到健康服务器
2. 收到告警通知
3. 登录故障服务器排查
4. 查看系统日志：journalctl -xe
5. 查看应用日志：tail -f /var/log/nginx/error.log
6. 修复问题后重启服务：systemctl restart nginx
7. 验证服务恢复：curl https://yourdomain.com/health
8. 记录故障原因和处理过程

# 数据库问题处理
1. 检查 Lovable Cloud 后端状态
2. 查看数据库监控指标
3. 检查慢查询日志
4. 必要时联系 Lovable Cloud 支持
5. 实施数据库恢复计划（如需要）

# 攻击应急响应
1. 确认攻击类型（DDoS、CC、SQL 注入等）
2. 查看 WAF 和 DDoS 防护日志
3. 加固防护规则
4. 封禁恶意 IP
5. 联系阿里云技术支持
6. 事后分析和总结
```

---

## 💰 成本预算

### 月度成本明细（小规模方案）

| 服务项目 | 配置 | 月费用（元） | 备注 |
|---------|------|------------|------|
| **ECS 云服务器 ×2** | ecs.c6.large 2核4G | 300 × 2 = 600 | 包年更优惠 |
| **SLB 负载均衡** | 标准版 I | 150 | 按规格计费 |
| **WAF 应用防火墙** | Pro 版 | 3880/年 ≈ 323 | 年付优惠 |
| **DDoS 高防** | 基础版 20G | 免费 | 超出按量付费 |
| **OSS 对象存储** | 100GB 存储 + CDN | 150 | 含 CDN 流量 |
| **SSL 证书** | Let's Encrypt | 0 | 免费证书 |
| **云监控** | 基础版 | 0 | 免费额度 |
| **日志服务 SLS** | 10GB/日 | 100 | 按量计费 |
| **Lovable Cloud** | Supabase 托管 | $25/月 ≈ 180 | 已包含 |
| **域名** | .com 域名 | 55/年 ≈ 5 | 年付 |
| **带宽** | 10M 固定 | 200 | 按需调整 |
| **备份存储** | OSS 备份 50GB | 20 | 冷备份 |
| **预留费用** | 突发流量、弹性扩容 | 200 | 应急预算 |

**月度总成本：~1,828 元**  
**年度总成本：~21,936 元**

### 成本优化建议

```bash
# 1. 购买包年套餐
- ECS 包年：优惠 15-20%
- WAF 年付：比月付便宜 20%
- 总节省：~300 元/月

# 2. 使用抢占式实例（测试环境）
- 测试服务器可用抢占式实例
- 节省 50-70% 成本

# 3. OSS 生命周期管理
- 旧文件自动转低频存储
- 临时文件自动删除
- 节省 30-40% 存储成本

# 4. CDN 流量优化
- 开启智能压缩
- 配置合理缓存策略
- 节省 20-30% CDN 费用

# 优化后月度成本：~1,500 元
```

### 扩容方案（业务增长时）

```bash
# 5-10 万在线用户配置
服务器：4 台 ECS ecs.c6.xlarge (4核8G)
负载均衡：高级版 II
WAF：企业版
月度成本：~5,000 元

# 10 万+在线用户配置
服务器：6-8 台 ECS + 自动扩缩容
负载均衡：高级版 III + 跨区域
WAF：旗舰版
月度成本：~12,000 元

# 按需扩容策略
- CPU > 70% 持续 5 分钟：自动扩容
- 流量突增：临时开启弹性 IP
- 大促活动：提前扩容 + 预热 CDN
```

---

## 📝 附录

### A. 常用命令速查

```bash
# Nginx 管理
systemctl start nginx
systemctl stop nginx
systemctl restart nginx
systemctl reload nginx
nginx -t                    # 测试配置
nginx -s reload             # 重载配置

# SSL 证书管理
certbot renew              # 更新证书
certbot certificates       # 查看证书
certbot delete --cert-name yourdomain.com

# 日志查看
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
journalctl -u nginx -f     # systemd 日志

# 性能分析
top                        # 实时进程
htop                       # 更友好的 top
iotop                      # 磁盘 IO
iftop                      # 网络流量
```

### B. 故障排查清单

```bash
# 1. 服务无法访问
□ 检查 Nginx 服务状态
□ 检查防火墙规则
□ 检查 SLB 健康检查
□ 检查 DNS 解析
□ 检查 SSL 证书有效期

# 2. 性能缓慢
□ 检查服务器负载
□ 检查数据库慢查询
□ 检查网络带宽
□ 分析 Nginx 日志
□ 检查 CDN 缓存命中率

# 3. 频繁攻击
□ 查看 WAF 防护日志
□ 检查异常 IP 访问
□ 启用 CC 防护
□ 加固访问规则
□ 联系阿里云支持

# 4. 数据库问题
□ 检查连接数
□ 查看慢查询
□ 检查磁盘空间
□ 检查备份状态
□ 查看错误日志
```

### C. 安全检查清单

```bash
# 每月安全检查
□ 更新系统补丁
□ 检查异常登录
□ 审查管理员操作日志
□ 检查 SSL 证书有效期
□ 验证备份完整性
□ 检查防火墙规则
□ 更新 WAF 规则
□ 检查敏感数据加密
□ 审查用户权限
□ 漏洞扫描
```

### D. 联系支持

```bash
# 阿里云技术支持
工单系统：https://workorder.console.aliyun.com/
电话支持：95187
在线客服：阿里云控制台右下角

# Lovable Cloud 支持
文档：https://docs.lovable.dev
Discord：https://discord.gg/lovable

# 紧急联系
技术负责人：[填写联系方式]
运维负责人：[填写联系方式]
```

---

## ✅ 部署检查表

### 上线前检查

- [ ] 域名备案完成
- [ ] SSL 证书配置正确
- [ ] 所有服务器部署完成
- [ ] 负载均衡配置测试通过
- [ ] DDoS 防护已启用
- [ ] WAF 规则已配置
- [ ] OSS 存储已配置
- [ ] CDN 加速已开启
- [ ] 数据库备份已设置
- [ ] 监控告警已配置
- [ ] 压力测试通过
- [ ] 安全扫描通过
- [ ] 日志收集正常
- [ ] 应急预案已制定

### 上线后验证

- [ ] 网站正常访问
- [ ] HTTPS 正常工作
- [ ] 用户注册登录正常
- [ ] 消息收发正常
- [ ] 文件上传下载正常
- [ ] 管理后台正常
- [ ] 负载均衡轮询正常
- [ ] 健康检查通过
- [ ] 监控数据正常
- [ ] 告警通知正常

---

**最后更新：** 2024-12-02  
**版本：** 1.0.0  
**适用范围：** 小规模部署（3-5万在线用户）
