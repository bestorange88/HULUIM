#!/bin/bash
#===============================================================================
# Alo生态 一键部署脚本
# 支持: CentOS 8 / AlmaLinux 8 / Rocky Linux 8
# 用法: curl -fsSL https://your-domain.com/deploy.sh | bash
#       或: bash deploy-all-in-one.sh
#===============================================================================

set -e

#===============================================================================
# 配置区域 - 请根据实际情况修改
#===============================================================================
# 应用配置
APP_NAME="alo"
APP_DIR="/var/www/alo"
APP_PORT=3000
DOMAIN="your-domain.com"  # 修改为你的域名

# Git仓库（如果使用Git部署）
GIT_REPO=""  # 留空则使用本地上传方式
GIT_BRANCH="main"

# Supabase配置（从Lovable Cloud获取）
SUPABASE_URL="https://fziwcnrrojazlalccwpe.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXdjbnJyb2phemxhbGNjd3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NjY2NjgsImV4cCI6MjA3NzA0MjY2OH0.0Gr1kSthwScLb6Fj8uFsrnNbW8g_xb7w06w3zo9tv6Y"
SUPABASE_PROJECT_ID="fziwcnrrojazlalccwpe"

# Redis配置
REDIS_PASSWORD="Alo@Redis2024!"  # 请修改为强密码

# 服务器角色: master / worker
SERVER_ROLE="master"

# 主服务器IP（worker节点需要配置）
MASTER_IP=""

# PM2实例数（master=4, worker=2）
PM2_INSTANCES=4

#===============================================================================
# 颜色定义
#===============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

#===============================================================================
# 辅助函数
#===============================================================================
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}[STEP]${NC} $1"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要root权限运行"
        log_info "请使用: sudo bash $0"
        exit 1
    fi
}

get_server_ip() {
    # 获取公网IP
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "unknown")
    # 获取内网IP
    PRIVATE_IP=$(hostname -I | awk '{print $1}')
    log_info "公网IP: $PUBLIC_IP"
    log_info "内网IP: $PRIVATE_IP"
}

#===============================================================================
# 交互式配置
#===============================================================================
interactive_config() {
    echo -e "\n${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}           ${GREEN}Alo生态 一键部署脚本${NC}                              ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}\n"

    # 服务器角色
    echo -e "${YELLOW}请选择服务器角色:${NC}"
    echo "  1) master - 主服务器 (Nginx主节点 + Redis主节点 + 应用)"
    echo "  2) worker - 从服务器 (Nginx从节点 + 应用)"
    read -p "请输入选项 [1/2] (默认: 1): " role_choice
    case $role_choice in
        2) SERVER_ROLE="worker"; PM2_INSTANCES=2 ;;
        *) SERVER_ROLE="master"; PM2_INSTANCES=4 ;;
    esac
    log_info "服务器角色: $SERVER_ROLE"

    # 如果是worker，需要主服务器IP
    if [[ "$SERVER_ROLE" == "worker" ]]; then
        read -p "请输入主服务器内网IP: " MASTER_IP
        if [[ -z "$MASTER_IP" ]]; then
            log_error "Worker节点必须配置主服务器IP"
            exit 1
        fi
    fi

    # 域名配置
    read -p "请输入域名 (留空使用IP访问): " input_domain
    if [[ -n "$input_domain" ]]; then
        DOMAIN="$input_domain"
    fi

    # Redis密码
    read -p "请输入Redis密码 (默认: $REDIS_PASSWORD): " input_redis_pwd
    if [[ -n "$input_redis_pwd" ]]; then
        REDIS_PASSWORD="$input_redis_pwd"
    fi

    # 确认配置
    echo -e "\n${YELLOW}═══════════════ 配置确认 ═══════════════${NC}"
    echo "服务器角色: $SERVER_ROLE"
    echo "PM2实例数: $PM2_INSTANCES"
    echo "域名: $DOMAIN"
    echo "Redis密码: ${REDIS_PASSWORD:0:3}***"
    [[ "$SERVER_ROLE" == "worker" ]] && echo "主服务器IP: $MASTER_IP"
    echo -e "${YELLOW}════════════════════════════════════════${NC}\n"

    read -p "确认以上配置? [Y/n]: " confirm
    if [[ "$confirm" =~ ^[Nn] ]]; then
        log_warn "已取消部署"
        exit 0
    fi
}

#===============================================================================
# 系统基础配置
#===============================================================================
setup_system() {
    log_step "配置系统环境"

    # 更新系统
    log_info "更新系统包..."
    dnf update -y -q
    dnf install -y -q epel-release

    # 安装基础工具
    log_info "安装基础工具..."
    dnf install -y -q git wget curl vim htop net-tools firewalld tar gzip unzip

    # 设置主机名
    if [[ "$SERVER_ROLE" == "master" ]]; then
        hostnamectl set-hostname alo-master
    else
        hostnamectl set-hostname alo-worker
    fi

    # 配置防火墙
    log_info "配置防火墙..."
    systemctl start firewalld 2>/dev/null || true
    systemctl enable firewalld 2>/dev/null || true
    firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=443/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=22/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=3000/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=6379/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true

    # 禁用SELinux
    setenforce 0 2>/dev/null || true
    sed -i 's/SELINUX=enforcing/SELINUX=disabled/g' /etc/selinux/config 2>/dev/null || true

    # 系统优化
    log_info "优化系统参数..."
    cat > /etc/sysctl.d/99-alo.conf << 'EOF'
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
EOF
    sysctl -p /etc/sysctl.d/99-alo.conf 2>/dev/null || true

    # 文件描述符限制
    cat > /etc/security/limits.d/99-alo.conf << 'EOF'
* soft nofile 1048576
* hard nofile 1048576
* soft nproc 65535
* hard nproc 65535
root soft nofile 1048576
root hard nofile 1048576
EOF

    log_info "系统配置完成"
}

#===============================================================================
# 安装 Node.js
#===============================================================================
install_nodejs() {
    log_step "安装 Node.js 20.x LTS"

    if command -v node &> /dev/null; then
        NODE_VER=$(node -v)
        log_info "Node.js 已安装: $NODE_VER"
        if [[ "$NODE_VER" == v20* ]]; then
            log_info "版本正确，跳过安装"
            return
        fi
    fi

    log_info "安装 Node.js 20.x..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y -q nodejs

    log_info "Node.js 版本: $(node -v)"
    log_info "NPM 版本: $(npm -v)"

    # 安装全局工具
    log_info "安装 PM2 和 serve..."
    npm install -g pm2 serve --silent

    # 配置PM2开机自启
    pm2 startup systemd -u root --hp /root 2>/dev/null || true

    log_info "Node.js 安装完成"
}

#===============================================================================
# 安装 Nginx
#===============================================================================
install_nginx() {
    log_step "安装 Nginx"

    if command -v nginx &> /dev/null; then
        log_info "Nginx 已安装: $(nginx -v 2>&1)"
    else
        log_info "安装 Nginx..."
        dnf install -y -q nginx
    fi

    systemctl start nginx
    systemctl enable nginx

    log_info "Nginx 安装完成"
}

#===============================================================================
# 安装配置 Redis
#===============================================================================
install_redis() {
    log_step "安装配置 Redis"

    if command -v redis-server &> /dev/null; then
        log_info "Redis 已安装"
    else
        log_info "安装 Redis..."
        dnf install -y -q redis
    fi

    # 配置Redis
    log_info "配置 Redis..."
    
    if [[ "$SERVER_ROLE" == "master" ]]; then
        # 主节点配置
        cat > /etc/redis.conf << EOF
bind 0.0.0.0
port 6379
daemonize yes
supervised systemd
requirepass $REDIS_PASSWORD
maxmemory 4gb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
save 900 1
save 300 10
save 60 10000
loglevel notice
logfile /var/log/redis/redis.log
dir /var/lib/redis
EOF
    else
        # 从节点配置
        cat > /etc/redis.conf << EOF
bind 0.0.0.0
port 6379
daemonize yes
supervised systemd
replicaof $MASTER_IP 6379
masterauth $REDIS_PASSWORD
requirepass $REDIS_PASSWORD
maxmemory 2gb
maxmemory-policy allkeys-lru
replica-read-only yes
loglevel notice
logfile /var/log/redis/redis.log
dir /var/lib/redis
EOF
    fi

    # 创建日志目录
    mkdir -p /var/log/redis
    chown redis:redis /var/log/redis

    systemctl restart redis
    systemctl enable redis

    # 验证
    sleep 2
    if redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q "PONG"; then
        log_info "Redis 运行正常"
    else
        log_warn "Redis 可能未正常启动，请检查日志"
    fi
}

#===============================================================================
# 部署应用代码
#===============================================================================
deploy_app() {
    log_step "部署应用代码"

    # 创建目录
    mkdir -p $APP_DIR
    mkdir -p /var/log/pm2
    mkdir -p /var/www/backups

    cd $APP_DIR

    if [[ -n "$GIT_REPO" ]]; then
        # Git方式部署
        log_info "从Git仓库拉取代码..."
        if [[ -d ".git" ]]; then
            git fetch origin
            git reset --hard origin/$GIT_BRANCH
        else
            git clone -b $GIT_BRANCH $GIT_REPO .
        fi
    else
        # 检查是否有dist目录
        if [[ ! -d "dist" ]]; then
            log_warn "未找到dist目录"
            log_info "请通过以下方式上传构建后的代码:"
            echo ""
            echo "  方式1: scp上传"
            echo "    scp -r ./dist root@$(hostname -I | awk '{print $1}'):$APP_DIR/"
            echo ""
            echo "  方式2: rsync同步"
            echo "    rsync -avz ./dist/ root@$(hostname -I | awk '{print $1}'):$APP_DIR/dist/"
            echo ""
            log_info "上传完成后，重新运行此脚本"
            
            # 创建占位文件
            mkdir -p dist
            echo "<h1>Alo生态 - 等待部署</h1><p>请上传构建后的dist目录</p>" > dist/index.html
        fi
    fi

    # 创建环境变量文件
    log_info "创建环境变量文件..."
    cat > $APP_DIR/.env.production << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_ANON_KEY
VITE_SUPABASE_PROJECT_ID=$SUPABASE_PROJECT_ID
NODE_ENV=production
EOF

    # 创建PM2配置
    log_info "创建PM2配置..."
    cat > $APP_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'npx',
    args: 'serve -s dist -l $APP_PORT',
    cwd: '$APP_DIR',
    instances: $PM2_INSTANCES,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '${SERVER_ROLE == "master" && "2G" || "1G"}',
    env: {
      NODE_ENV: 'production',
      PORT: $APP_PORT
    },
    error_file: '/var/log/pm2/$APP_NAME-error.log',
    out_file: '/var/log/pm2/$APP_NAME-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  }]
};
EOF

    # 启动应用
    log_info "启动应用..."
    cd $APP_DIR
    pm2 delete $APP_NAME 2>/dev/null || true
    pm2 start ecosystem.config.js
    pm2 save

    log_info "应用部署完成"
}

#===============================================================================
# 配置 Nginx
#===============================================================================
configure_nginx() {
    log_step "配置 Nginx"

    # 创建SSL目录
    mkdir -p /etc/nginx/ssl
    mkdir -p /var/www/certbot

    if [[ "$SERVER_ROLE" == "master" ]]; then
        # 主服务器Nginx配置
        log_info "配置主服务器Nginx..."
        
        # 生成自签名证书（临时用）
        if [[ ! -f /etc/nginx/ssl/alo.crt ]]; then
            log_info "生成自签名SSL证书..."
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout /etc/nginx/ssl/alo.key \
                -out /etc/nginx/ssl/alo.crt \
                -subj "/C=CN/ST=Fujian/L=Fuzhou/O=Alo/CN=$DOMAIN" 2>/dev/null
        fi

        cat > /etc/nginx/conf.d/alo.conf << EOF
# 上游服务器
upstream alo_backend {
    least_conn;
    server 127.0.0.1:$APP_PORT weight=3;
    keepalive 32;
}

# HTTP重定向
server {
    listen 80;
    server_name $DOMAIN _;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location /health {
        access_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }
    
    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name $DOMAIN _;
    
    ssl_certificate /etc/nginx/ssl/alo.crt;
    ssl_certificate_key /etc/nginx/ssl/alo.key;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;
    
    # 静态资源
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
        root $APP_DIR/dist;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # 主应用
    location / {
        proxy_pass http://alo_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # 健康检查
    location /health {
        access_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }
    
    access_log /var/log/nginx/alo_access.log;
    error_log /var/log/nginx/alo_error.log;
}
EOF
    else
        # 从服务器Nginx配置
        log_info "配置从服务器Nginx..."
        cat > /etc/nginx/conf.d/alo.conf << EOF
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location /health {
        access_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
EOF
    fi

    # 测试并重载配置
    nginx -t
    systemctl reload nginx

    log_info "Nginx 配置完成"
}

#===============================================================================
# 创建管理脚本
#===============================================================================
create_management_scripts() {
    log_step "创建管理脚本"

    # 部署更新脚本
    cat > /usr/local/bin/alo-deploy << 'SCRIPT'
#!/bin/bash
set -e
APP_DIR="/var/www/alo"
BACKUP_DIR="/var/www/backups"

echo "═══════════════════════════════════════"
echo "         Alo生态 部署更新"
echo "═══════════════════════════════════════"

# 备份
BACKUP_NAME="alo-$(date '+%Y%m%d-%H%M%S').tar.gz"
echo "[1/4] 备份当前版本..."
tar -czf "$BACKUP_DIR/$BACKUP_NAME" -C $APP_DIR dist 2>/dev/null || true
echo "      备份: $BACKUP_NAME"

# 构建（如果有源码）
if [[ -f "$APP_DIR/package.json" ]]; then
    echo "[2/4] 安装依赖..."
    cd $APP_DIR && npm ci --silent
    echo "[3/4] 构建应用..."
    npm run build
else
    echo "[2/4] 跳过依赖安装（无package.json）"
    echo "[3/4] 跳过构建（无源码）"
fi

# 重启
echo "[4/4] 重启服务..."
pm2 reload all
echo ""
echo "✓ 部署完成!"
SCRIPT
    chmod +x /usr/local/bin/alo-deploy

    # 回滚脚本
    cat > /usr/local/bin/alo-rollback << 'SCRIPT'
#!/bin/bash
BACKUP_DIR="/var/www/backups"
APP_DIR="/var/www/alo"

echo "可用备份:"
ls -lt $BACKUP_DIR/*.tar.gz 2>/dev/null | head -10

read -p "请输入备份文件名: " BACKUP_FILE
if [[ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]]; then
    echo "错误: 备份文件不存在"
    exit 1
fi

echo "回滚到 $BACKUP_FILE..."
cd $APP_DIR
rm -rf dist
tar -xzf "$BACKUP_DIR/$BACKUP_FILE"
pm2 reload all
echo "✓ 回滚完成!"
SCRIPT
    chmod +x /usr/local/bin/alo-rollback

    # 状态查看脚本
    cat > /usr/local/bin/alo-status << 'SCRIPT'
#!/bin/bash
echo "═══════════════════════════════════════"
echo "         Alo生态 系统状态"
echo "═══════════════════════════════════════"
echo ""
echo "── 服务状态 ──"
systemctl is-active nginx >/dev/null && echo "✓ Nginx: 运行中" || echo "✗ Nginx: 停止"
systemctl is-active redis >/dev/null && echo "✓ Redis: 运行中" || echo "✗ Redis: 停止"
pm2 pid alo >/dev/null 2>&1 && echo "✓ PM2/App: 运行中" || echo "✗ PM2/App: 停止"
echo ""
echo "── PM2 进程 ──"
pm2 list
echo ""
echo "── 系统资源 ──"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')%"
echo "内存: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "磁盘: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')"
echo ""
echo "── 健康检查 ──"
curl -s http://localhost/health && echo " (HTTP)" || echo "✗ HTTP检查失败"
SCRIPT
    chmod +x /usr/local/bin/alo-status

    # 日志查看脚本
    cat > /usr/local/bin/alo-logs << 'SCRIPT'
#!/bin/bash
case "$1" in
    nginx) tail -f /var/log/nginx/alo_*.log ;;
    pm2) pm2 logs ;;
    redis) tail -f /var/log/redis/redis.log ;;
    *) echo "用法: alo-logs [nginx|pm2|redis]" ;;
esac
SCRIPT
    chmod +x /usr/local/bin/alo-logs

    log_info "管理脚本创建完成"
    echo ""
    echo "可用命令:"
    echo "  alo-deploy   - 部署/更新应用"
    echo "  alo-rollback - 回滚到备份版本"
    echo "  alo-status   - 查看系统状态"
    echo "  alo-logs     - 查看日志 (nginx|pm2|redis)"
}

#===============================================================================
# 配置日志轮转
#===============================================================================
setup_logrotate() {
    log_step "配置日志轮转"

    cat > /etc/logrotate.d/alo << 'EOF'
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
}
EOF

    log_info "日志轮转配置完成"
}

#===============================================================================
# 完成部署
#===============================================================================
finish_deploy() {
    log_step "部署完成"

    get_server_ip

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}           ${CYAN}Alo生态 部署成功!${NC}                                 ${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}访问地址:${NC}"
    echo "  HTTP:  http://$PUBLIC_IP"
    echo "  HTTPS: https://$PUBLIC_IP (自签名证书)"
    [[ "$DOMAIN" != "your-domain.com" ]] && echo "  域名:  https://$DOMAIN"
    echo ""
    echo -e "${YELLOW}服务状态:${NC}"
    systemctl is-active nginx >/dev/null && echo "  ✓ Nginx 运行中" || echo "  ✗ Nginx 未运行"
    systemctl is-active redis >/dev/null && echo "  ✓ Redis 运行中" || echo "  ✗ Redis 未运行"
    pm2 pid alo >/dev/null 2>&1 && echo "  ✓ 应用 运行中" || echo "  ✗ 应用 未运行"
    echo ""
    echo -e "${YELLOW}管理命令:${NC}"
    echo "  alo-status   - 查看状态"
    echo "  alo-deploy   - 更新部署"
    echo "  alo-rollback - 回滚版本"
    echo "  alo-logs     - 查看日志"
    echo ""
    echo -e "${YELLOW}重要提示:${NC}"
    echo "  1. 请将dist目录上传到 $APP_DIR/dist"
    echo "  2. 配置正式SSL证书替换自签名证书"
    echo "  3. 配置域名DNS解析"
    echo "  4. 在阿里云控制台配置SLB负载均衡"
    echo ""
    echo -e "${GREEN}感谢使用 Alo生态 部署脚本!${NC}"
}

#===============================================================================
# 主函数
#===============================================================================
main() {
    check_root
    interactive_config
    setup_system
    install_nodejs
    install_nginx
    
    # 只有master和配置了MASTER_IP的worker才安装Redis
    if [[ "$SERVER_ROLE" == "master" ]] || [[ -n "$MASTER_IP" ]]; then
        install_redis
    fi
    
    deploy_app
    configure_nginx
    create_management_scripts
    setup_logrotate
    finish_deploy
}

# 运行
main "$@"
