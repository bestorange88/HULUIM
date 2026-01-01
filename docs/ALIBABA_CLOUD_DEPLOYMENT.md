# Alo生态 阿里云国际版部署方案

## 服务器架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户请求                                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    阿里云 SLB 负载均衡                            │
│                   (HTTP/HTTPS 入口)                              │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   主服务器       │ │   从服务器 1     │ │   从服务器 2     │
│   8核16G        │ │   4核8G         │ │   4核8G         │
│   100M带宽      │ │   30M带宽       │ │   30M带宽       │
│                 │ │                 │ │                 │
│ - Nginx         │ │ - Nginx         │ │ - Nginx         │
│ - Node.js       │ │ - Node.js       │ │ - Node.js       │
│ - PM2           │ │ - PM2           │ │ - PM2           │
│ - Redis主节点   │ │ - Redis从节点   │ │ - 备用服务      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (Lovable Cloud)                      │
│              数据库 / 认证 / 存储 / Edge Functions                │
└─────────────────────────────────────────────────────────────────┘
```

## 服务器角色分配

| 服务器 | 配置 | 角色 | 职责 |
|--------|------|------|------|
| 主服务器 | 8核16G/100M | Master | Nginx主节点、应用主节点、Redis主节点、SSL证书、静态资源 |
| 从服务器1 | 4核8G/30M | Worker-1 | Nginx从节点、应用从节点、Redis从节点 |
| 从服务器2 | 4核8G/30M | Worker-2 | Nginx从节点、应用从节点、热备份 |

---

## 第一部分：服务器基础配置

### 1.1 所有服务器通用配置

在三台服务器上都执行以下命令：

```bash
# 1. 更新系统
sudo dnf update -y
sudo dnf install -y epel-release

# 2. 安装基础工具
sudo dnf install -y git wget curl vim htop net-tools firewalld

# 3. 设置主机名（分别在三台服务器执行）
# 主服务器
sudo hostnamectl set-hostname alo-master

# 从服务器1
sudo hostnamectl set-hostname alo-worker-1

# 从服务器2
sudo hostnamectl set-hostname alo-worker-2

# 4. 配置hosts文件（替换为实际内网IP）
sudo vim /etc/hosts
# 添加以下内容：
# 172.16.0.10 alo-master
# 172.16.0.11 alo-worker-1
# 172.16.0.12 alo-worker-2

# 5. 配置防火墙
sudo systemctl start firewalld
sudo systemctl enable firewalld

# 开放必要端口
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=22/tcp
sudo firewall-cmd --permanent --add-port=6379/tcp  # Redis
sudo firewall-cmd --permanent --add-port=3000/tcp  # Node.js
sudo firewall-cmd --reload

# 6. 禁用SELinux（或配置策略）
sudo setenforce 0
sudo sed -i 's/SELINUX=enforcing/SELINUX=disabled/g' /etc/selinux/config

# 7. 优化系统参数
sudo vim /etc/sysctl.conf
# 添加以下内容：
```

```ini
# /etc/sysctl.conf 优化配置
# 网络优化
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 10
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_probes = 3
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.ip_local_port_range = 1024 65535

# 文件描述符
fs.file-max = 2097152
fs.nr_open = 2097152

# 内存优化
vm.swappiness = 10
vm.dirty_ratio = 60
vm.dirty_background_ratio = 5
```

```bash
# 应用配置
sudo sysctl -p

# 8. 配置文件描述符限制
sudo vim /etc/security/limits.conf
# 添加以下内容：
```

```
* soft nofile 1048576
* hard nofile 1048576
* soft nproc 65535
* hard nproc 65535
root soft nofile 1048576
root hard nofile 1048576
```

### 1.2 安装 Node.js（所有服务器）

```bash
# 安装 Node.js 20.x LTS
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# 验证安装
node -v  # 应显示 v20.x.x
npm -v

# 安装 PM2 进程管理器
sudo npm install -g pm2

# 配置 PM2 开机自启
pm2 startup systemd
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
```

### 1.3 安装 Nginx（所有服务器）

```bash
# 安装 Nginx
sudo dnf install -y nginx

# 启动并设置开机自启
sudo systemctl start nginx
sudo systemctl enable nginx

# 验证
sudo nginx -v
```

---

## 第二部分：主服务器配置

### 2.1 安装配置 Redis（主服务器）

```bash
# 安装 Redis
sudo dnf install -y redis

# 配置 Redis
sudo vim /etc/redis.conf
```

```ini
# /etc/redis.conf 关键配置
bind 0.0.0.0
port 6379
daemonize yes
supervised systemd

# 密码（请更改为强密码）
requirepass Alo@Redis2024!

# 内存限制（根据16G内存，分配4G给Redis）
maxmemory 4gb
maxmemory-policy allkeys-lru

# 持久化
appendonly yes
appendfsync everysec
save 900 1
save 300 10
save 60 10000

# 日志
loglevel notice
logfile /var/log/redis/redis.log
```

```bash
# 启动 Redis
sudo systemctl start redis
sudo systemctl enable redis

# 验证
redis-cli -a 'Alo@Redis2024!' ping  # 应返回 PONG
```

### 2.2 部署应用代码（主服务器）

```bash
# 创建应用目录
sudo mkdir -p /var/www/alo
sudo chown -R $USER:$USER /var/www/alo

# 克隆代码（使用你的Git仓库地址）
cd /var/www/alo
git clone https://github.com/your-repo/alo-app.git .

# 或者从本地上传
# scp -r ./dist root@主服务器IP:/var/www/alo/

# 安装依赖
npm install

# 创建环境变量文件
vim .env.production
```

```env
# .env.production
VITE_SUPABASE_URL=https://fziwcnrrojazlalccwpe.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXdjbnJyb2phemxhbGNjd3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NjY2NjgsImV4cCI6MjA3NzA0MjY2OH0.0Gr1kSthwScLb6Fj8uFsrnNbW8g_xb7w06w3zo9tv6Y
VITE_SUPABASE_PROJECT_ID=fziwcnrrojazlalccwpe
NODE_ENV=production
```

```bash
# 构建生产版本
npm run build

# 验证构建
ls -la dist/
```

### 2.3 配置 PM2 进程管理（主服务器）

```bash
# 创建 PM2 配置文件
vim /var/www/alo/ecosystem.config.js
```

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'alo-app',
      script: 'npx',
      args: 'serve -s dist -l 3000',
      cwd: '/var/www/alo',
      instances: 4,  // 主服务器使用4个实例
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/alo-error.log',
      out_file: '/var/log/pm2/alo-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true
    }
  ]
};
```

```bash
# 安装 serve
npm install -g serve

# 创建日志目录
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/log/pm2

# 启动应用
cd /var/www/alo
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 查看状态
pm2 status
pm2 logs
```

### 2.4 配置 Nginx（主服务器）

```bash
# 创建 Nginx 配置
sudo vim /etc/nginx/conf.d/alo.conf
```

```nginx
# /etc/nginx/conf.d/alo.conf

# 上游服务器组
upstream alo_backend {
    least_conn;
    server 127.0.0.1:3000 weight=3;           # 本机
    server 172.16.0.11:3000 weight=2 backup;  # Worker-1
    server 172.16.0.12:3000 weight=2 backup;  # Worker-2
    keepalive 32;
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Let's Encrypt 验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS 主服务
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL 证书配置（先使用自签名，后续替换为正式证书）
    ssl_certificate /etc/nginx/ssl/alo.crt;
    ssl_certificate_key /etc/nginx/ssl/alo.key;
    
    # SSL 优化
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;
    
    # 静态资源缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
        root /var/www/alo/dist;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # 主应用
    location / {
        proxy_pass http://alo_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    # 健康检查
    location /health {
        access_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }
    
    # 日志
    access_log /var/log/nginx/alo_access.log;
    error_log /var/log/nginx/alo_error.log;
}
```

```bash
# 创建 SSL 目录和自签名证书（临时用）
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/alo.key \
    -out /etc/nginx/ssl/alo.crt \
    -subj "/C=CN/ST=Fujian/L=Fuzhou/O=Alo/CN=your-domain.com"

# 创建 Let's Encrypt 验证目录
sudo mkdir -p /var/www/certbot

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

---

## 第三部分：从服务器配置

### 3.1 从服务器1 - Redis从节点配置

```bash
# 安装 Redis
sudo dnf install -y redis

# 配置 Redis 从节点
sudo vim /etc/redis.conf
```

```ini
# /etc/redis.conf 从节点配置
bind 0.0.0.0
port 6379
daemonize yes
supervised systemd

# 主节点配置
replicaof 172.16.0.10 6379
masterauth Alo@Redis2024!

# 本机密码
requirepass Alo@Redis2024!

# 内存限制（4G内存分配2G给Redis）
maxmemory 2gb
maxmemory-policy allkeys-lru

# 只读模式
replica-read-only yes
```

```bash
sudo systemctl start redis
sudo systemctl enable redis

# 验证主从复制
redis-cli -a 'Alo@Redis2024!' info replication
```

### 3.2 从服务器应用部署（从服务器1和2）

```bash
# 创建应用目录
sudo mkdir -p /var/www/alo
sudo chown -R $USER:$USER /var/www/alo

# 同步代码（从主服务器）
rsync -avz --delete root@172.16.0.10:/var/www/alo/dist/ /var/www/alo/dist/
rsync -avz root@172.16.0.10:/var/www/alo/package.json /var/www/alo/
rsync -avz root@172.16.0.10:/var/www/alo/.env.production /var/www/alo/

# 安装依赖
cd /var/www/alo
npm install --production

# 创建 PM2 配置
vim /var/www/alo/ecosystem.config.js
```

```javascript
// ecosystem.config.js - 从服务器配置
module.exports = {
  apps: [
    {
      name: 'alo-app',
      script: 'npx',
      args: 'serve -s dist -l 3000',
      cwd: '/var/www/alo',
      instances: 2,  // 从服务器使用2个实例
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
```

```bash
# 安装 serve 并启动
npm install -g serve
pm2 start ecosystem.config.js
pm2 save
```

### 3.3 从服务器 Nginx 配置

```bash
sudo vim /etc/nginx/conf.d/alo.conf
```

```nginx
# /etc/nginx/conf.d/alo.conf - 从服务器

server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /health {
        access_log off;
        return 200 'OK';
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 第四部分：阿里云服务配置

### 4.1 负载均衡 SLB 配置

1. **登录阿里云控制台** → 负载均衡 SLB

2. **创建实例**：
   - 地域：选择与ECS相同地域
   - 实例类型：性能保障型
   - 规格：slb.s2.small（适合20,000并发）
   - 网络类型：公网

3. **配置监听**：

```
HTTP 监听:
- 前端协议: HTTP
- 前端端口: 80
- 后端协议: HTTP  
- 后端端口: 80
- 调度算法: 加权轮询
- 会话保持: 开启（Cookie植入）

HTTPS 监听:
- 前端协议: HTTPS
- 前端端口: 443
- 后端协议: HTTP
- 后端端口: 80
- SSL证书: 选择已上传的证书
- 调度算法: 加权轮询
```

4. **添加后端服务器**：

| 服务器 | 端口 | 权重 |
|--------|------|------|
| 主服务器 | 80 | 100 |
| 从服务器1 | 80 | 60 |
| 从服务器2 | 80 | 60 |

5. **健康检查配置**：

```
检查协议: HTTP
检查端口: 80
检查路径: /health
正常状态码: http_2xx
检查间隔: 5秒
超时时间: 3秒
不健康阈值: 3次
健康阈值: 2次
```

### 4.2 WAF 防火墙配置

1. **开通 Web应用防火墙**

2. **添加防护域名**：
   - 域名：your-domain.com
   - 协议：HTTPS
   - 源站地址：SLB IP地址
   - 源站端口：80

3. **防护配置**：

```
Web入侵防护: 开启（严格模式）
CC防护: 开启
  - 单IP访问频率: 500次/分钟
  - 全局频率: 10000次/分钟
爬虫防护: 开启
扫描防护: 开启
```

### 4.3 DDoS 防护配置

1. **DDoS高防IP**（可选，根据需要）：
   - 清洗阈值：5Gbps
   - CC防护：10000 QPS

2. **基础DDoS防护**（默认开启）：
   - 阈值：5Gbps

### 4.4 OSS 对象存储配置

```bash
# 创建 Bucket（用于静态资源CDN加速）
Bucket名称: alo-static-assets
地域: 与ECS相同
存储类型: 标准存储
读写权限: 公共读

# 跨域设置 CORS
允许来源: https://your-domain.com
允许方法: GET, HEAD
允许头: *
缓存时间: 3600
```

### 4.5 CDN 配置

1. **添加加速域名**：
   - 加速域名：static.your-domain.com
   - 业务类型：图片小文件
   - 源站类型：OSS域名

2. **缓存配置**：

```
目录: /assets/
缓存时间: 30天

文件后缀: jpg,jpeg,png,gif,ico,css,js,woff,woff2
缓存时间: 30天
```

---

## 第五部分：SSL证书配置

### 5.1 申请免费证书（Let's Encrypt）

```bash
# 主服务器安装 Certbot
sudo dnf install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 自动续期测试
sudo certbot renew --dry-run

# 设置自动续期定时任务
sudo crontab -e
# 添加：
0 0 1 * * /usr/bin/certbot renew --quiet
```

### 5.2 使用阿里云免费证书

1. 登录阿里云 → SSL证书服务
2. 申请免费DV证书
3. 验证域名所有权
4. 下载证书（Nginx格式）
5. 上传到服务器：

```bash
sudo mkdir -p /etc/nginx/ssl
sudo vim /etc/nginx/ssl/your-domain.pem   # 粘贴证书内容
sudo vim /etc/nginx/ssl/your-domain.key   # 粘贴私钥内容

# 更新 Nginx 配置
sudo vim /etc/nginx/conf.d/alo.conf
# 修改：
# ssl_certificate /etc/nginx/ssl/your-domain.pem;
# ssl_certificate_key /etc/nginx/ssl/your-domain.key;

sudo nginx -t
sudo systemctl reload nginx
```

---

## 第六部分：自动化部署脚本

### 6.1 创建部署脚本

```bash
# 主服务器创建部署脚本
vim /var/www/alo/deploy.sh
```

```bash
#!/bin/bash
# Alo生态 自动化部署脚本

set -e

# 配置
APP_DIR="/var/www/alo"
BACKUP_DIR="/var/www/backups"
WORKERS=("172.16.0.11" "172.16.0.12")
LOG_FILE="/var/log/alo-deploy.log"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a $LOG_FILE
    exit 1
}

# 备份当前版本
backup() {
    log "备份当前版本..."
    mkdir -p $BACKUP_DIR
    BACKUP_NAME="alo-$(date '+%Y%m%d-%H%M%S').tar.gz"
    tar -czf "$BACKUP_DIR/$BACKUP_NAME" -C $APP_DIR dist package.json
    log "备份完成: $BACKUP_NAME"
}

# 拉取最新代码
pull_code() {
    log "拉取最新代码..."
    cd $APP_DIR
    git fetch origin
    git reset --hard origin/main
}

# 安装依赖并构建
build() {
    log "安装依赖..."
    cd $APP_DIR
    npm ci
    
    log "构建应用..."
    npm run build
    
    if [ ! -d "$APP_DIR/dist" ]; then
        error "构建失败: dist目录不存在"
    fi
}

# 同步到从服务器
sync_workers() {
    log "同步到从服务器..."
    for worker in "${WORKERS[@]}"; do
        log "同步到 $worker..."
        rsync -avz --delete $APP_DIR/dist/ root@$worker:$APP_DIR/dist/
        rsync -avz $APP_DIR/package.json root@$worker:$APP_DIR/
        rsync -avz $APP_DIR/.env.production root@$worker:$APP_DIR/
        ssh root@$worker "cd $APP_DIR && npm install --production && pm2 reload all"
    done
}

# 重启本机服务
restart_local() {
    log "重启本机服务..."
    cd $APP_DIR
    pm2 reload all
}

# 健康检查
health_check() {
    log "执行健康检查..."
    sleep 5
    
    if curl -s http://localhost:3000/health | grep -q "OK"; then
        log "本机健康检查通过"
    else
        error "本机健康检查失败"
    fi
    
    for worker in "${WORKERS[@]}"; do
        if curl -s http://$worker:80/health | grep -q "OK"; then
            log "$worker 健康检查通过"
        else
            log "${YELLOW}警告: $worker 健康检查失败${NC}"
        fi
    done
}

# 主流程
main() {
    log "========== 开始部署 =========="
    backup
    pull_code
    build
    sync_workers
    restart_local
    health_check
    log "========== 部署完成 =========="
}

# 执行
main "$@"
```

```bash
chmod +x /var/www/alo/deploy.sh
```

### 6.2 创建回滚脚本

```bash
vim /var/www/alo/rollback.sh
```

```bash
#!/bin/bash
# 回滚脚本

BACKUP_DIR="/var/www/backups"
APP_DIR="/var/www/alo"
WORKERS=("172.16.0.11" "172.16.0.12")

# 列出备份
echo "可用备份:"
ls -lt $BACKUP_DIR/*.tar.gz | head -10

read -p "请输入要回滚的备份文件名: " BACKUP_FILE

if [ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    echo "备份文件不存在"
    exit 1
fi

# 解压备份
echo "回滚到 $BACKUP_FILE..."
cd $APP_DIR
rm -rf dist
tar -xzf "$BACKUP_DIR/$BACKUP_FILE"

# 同步到从服务器
for worker in "${WORKERS[@]}"; do
    rsync -avz --delete $APP_DIR/dist/ root@$worker:$APP_DIR/dist/
    ssh root@$worker "pm2 reload all"
done

# 重启本机
pm2 reload all

echo "回滚完成"
```

```bash
chmod +x /var/www/alo/rollback.sh
```

---

## 第七部分：监控与日志

### 7.1 配置日志轮转

```bash
sudo vim /etc/logrotate.d/alo
```

```
/var/log/nginx/alo*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 640 nginx nginx
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}

/var/log/pm2/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 root root
}
```

### 7.2 设置阿里云监控

1. **CloudMonitor 配置**：
   - 安装云监控插件：
   
```bash
# 所有服务器执行
ARGUS_VERSION=3.5.9 /bin/bash -c "$(curl -sS https://cms-agent-cn-hangzhou.oss-cn-hangzhou-internal.aliyuncs.com/Argus/agent_install_china.sh)"
```

2. **配置报警规则**：

| 指标 | 阈值 | 持续时间 | 级别 |
|------|------|----------|------|
| CPU使用率 | >80% | 5分钟 | 警告 |
| 内存使用率 | >85% | 5分钟 | 警告 |
| 磁盘使用率 | >85% | 5分钟 | 紧急 |
| 5xx错误率 | >1% | 3分钟 | 紧急 |
| 响应时间 | >2000ms | 5分钟 | 警告 |

### 7.3 PM2 监控

```bash
# 安装 PM2 监控模块
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 30

# 查看实时监控
pm2 monit

# 生成监控报告
pm2 report
```

---

## 第八部分：安全加固

### 8.1 SSH 安全配置

```bash
sudo vim /etc/ssh/sshd_config
```

```
# 禁用密码登录（配置好密钥后）
PasswordAuthentication no

# 禁用root直接登录
PermitRootLogin prohibit-password

# 限制登录用户
AllowUsers deploy admin

# 修改默认端口
Port 22022

# 超时设置
ClientAliveInterval 300
ClientAliveCountMax 2
```

```bash
# 防火墙更新
sudo firewall-cmd --permanent --remove-port=22/tcp
sudo firewall-cmd --permanent --add-port=22022/tcp
sudo firewall-cmd --reload

sudo systemctl restart sshd
```

### 8.2 Fail2Ban 防护

```bash
sudo dnf install -y fail2ban

sudo vim /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
banaction = firewallcmd-ipset

[sshd]
enabled = true
port = 22022

[nginx-http-auth]
enabled = true

[nginx-botsearch]
enabled = true
```

```bash
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### 8.3 定期安全检查脚本

```bash
vim /root/security-check.sh
```

```bash
#!/bin/bash
# 安全检查脚本

echo "===== 安全检查报告 $(date) ====="

echo -e "\n--- 登录失败记录 ---"
lastb | head -20

echo -e "\n--- 当前登录用户 ---"
who

echo -e "\n--- 开放端口 ---"
ss -tuln

echo -e "\n--- 异常进程 ---"
ps aux --sort=-%cpu | head -10

echo -e "\n--- 磁盘使用 ---"
df -h

echo -e "\n--- 内存使用 ---"
free -h

echo -e "\n--- Fail2Ban 状态 ---"
fail2ban-client status
```

```bash
chmod +x /root/security-check.sh

# 设置定时执行
crontab -e
# 添加：每天8点执行
0 8 * * * /root/security-check.sh >> /var/log/security-check.log 2>&1
```

---

## 第九部分：维护与运维

### 9.1 日常维护命令

```bash
# 查看服务状态
systemctl status nginx
pm2 status
redis-cli -a 'Alo@Redis2024!' info

# 查看日志
tail -f /var/log/nginx/alo_access.log
tail -f /var/log/nginx/alo_error.log
pm2 logs

# 查看系统资源
htop
iotop
nethogs

# 清理缓存
sudo sync; echo 3 > /proc/sys/vm/drop_caches
redis-cli -a 'Alo@Redis2024!' FLUSHDB
```

### 9.2 常见问题排查

```bash
# 检查 Nginx 配置
sudo nginx -t
sudo nginx -T | grep -A10 "upstream"

# 检查端口占用
ss -tuln | grep -E '80|443|3000|6379'

# 检查进程
ps aux | grep -E 'nginx|node|redis'

# 检查网络连接
netstat -anp | grep ESTABLISHED | wc -l

# 检查负载
uptime
cat /proc/loadavg
```

### 9.3 紧急恢复流程

```bash
# 1. 快速重启所有服务
sudo systemctl restart nginx
pm2 restart all
sudo systemctl restart redis

# 2. 如果服务器无响应，强制重启
sudo reboot

# 3. 回滚到上一版本
/var/www/alo/rollback.sh

# 4. 切换到备用服务器（在SLB中调整权重）
# 阿里云控制台 → SLB → 后端服务器 → 调整权重
```

---

## 第十部分：成本预估

### 月度费用预估（阿里云国际版）

| 服务 | 规格 | 费用/月 (USD) |
|------|------|---------------|
| ECS主服务器 | 8核16G/100M | ~$150 |
| ECS从服务器×2 | 4核8G/30M | ~$120 |
| SLB负载均衡 | 按量付费 | ~$30 |
| WAF防火墙 | 基础版 | ~$50 |
| OSS存储 | 100GB | ~$5 |
| CDN流量 | 500GB | ~$30 |
| SSL证书 | 免费 | $0 |
| 域名 | .com | ~$1 |
| **总计** | | **~$386/月** |

---

## 检查清单

### 部署前检查
- [ ] 三台服务器已开通并能互相访问
- [ ] 域名已解析到SLB公网IP
- [ ] SSL证书已申请
- [ ] 阿里云安全组已配置

### 部署后检查
- [ ] 所有服务正常运行（Nginx、PM2、Redis）
- [ ] HTTPS访问正常
- [ ] 负载均衡健康检查通过
- [ ] 监控告警已配置
- [ ] 自动备份已启用
- [ ] 防火墙规则已验证

---

## 联系与支持

如有问题，请检查：
1. 阿里云控制台 → 日志服务
2. 服务器 `/var/log/nginx/alo_error.log`
3. PM2 日志 `pm2 logs`
4. Redis日志 `/var/log/redis/redis.log`
