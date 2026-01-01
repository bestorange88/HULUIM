#!/bin/bash

#===========================================
# Alo生态 - Supabase 自托管一键部署脚本
# 支持: CentOS 8 / AlmaLinux 8 / Rocky Linux 8
# 作用: 部署完整的 Supabase 后端服务
#===========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置变量
SUPABASE_DIR="/opt/supabase"
DOMAIN=""
API_DOMAIN=""
POSTGRES_PASSWORD=""
JWT_SECRET=""

# 日志函数
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# 检查 root 权限
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要 root 权限运行"
        log_info "请使用: sudo $0"
        exit 1
    fi
}

# 生成随机密码
generate_password() {
    openssl rand -base64 32 | tr -d '/+=' | head -c 32
}

# 生成 JWT Secret
generate_jwt_secret() {
    openssl rand -base64 64 | tr -d '/+=' | head -c 64
}

# 安装基础依赖
install_base_deps() {
    log_step "安装基础依赖..."
    
    # 安装 Git
    if ! command -v git &> /dev/null; then
        yum install -y git
        log_info "Git 安装完成"
    else
        log_info "Git 已安装，跳过"
    fi
    
    # 安装 OpenSSL (用于生成密钥和证书)
    if ! command -v openssl &> /dev/null; then
        yum install -y openssl
        log_info "OpenSSL 安装完成"
    fi
    
    # 安装常用工具
    yum install -y curl wget vim-enhanced
    
    log_info "基础依赖安装完成"
}

# 交互式配置
interactive_config() {
    echo ""
    echo "============================================"
    echo "       Alo生态 Supabase 后端部署配置"
    echo "============================================"
    echo ""
    
    # 域名配置
    read -p "请输入前端域名 (例: alo.example.com): " DOMAIN
    if [[ -z "$DOMAIN" ]]; then
        log_error "域名不能为空"
        exit 1
    fi
    
    read -p "请输入 API 域名 (默认: api.$DOMAIN): " API_DOMAIN
    API_DOMAIN=${API_DOMAIN:-"api.$DOMAIN"}
    
    # 数据库密码
    read -p "请输入 PostgreSQL 密码 (留空自动生成): " POSTGRES_PASSWORD
    if [[ -z "$POSTGRES_PASSWORD" ]]; then
        POSTGRES_PASSWORD=$(generate_password)
        log_info "已自动生成 PostgreSQL 密码: $POSTGRES_PASSWORD"
    fi
    
    # JWT Secret
    JWT_SECRET=$(generate_jwt_secret)
    log_info "已自动生成 JWT Secret"
    
    # 确认配置
    echo ""
    echo "============================================"
    echo "              配置确认"
    echo "============================================"
    echo "前端域名: $DOMAIN"
    echo "API 域名: $API_DOMAIN"
    echo "PostgreSQL 密码: $POSTGRES_PASSWORD"
    echo "============================================"
    echo ""
    
    read -p "确认以上配置？(y/n): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log_warn "用户取消部署"
        exit 0
    fi
}

# 安装 Docker
install_docker() {
    log_step "安装 Docker..."
    
    if command -v docker &> /dev/null; then
        log_info "Docker 已安装，跳过"
        return
    fi
    
    # 安装依赖
    yum install -y yum-utils device-mapper-persistent-data lvm2
    
    # 添加 Docker 仓库
    yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    
    # 安装 Docker
    yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # 启动 Docker
    systemctl start docker
    systemctl enable docker
    
    log_info "Docker 安装完成"
}

# 安装 Nginx
install_nginx() {
    log_step "安装 Nginx..."
    
    if command -v nginx &> /dev/null; then
        log_info "Nginx 已安装，跳过"
        return
    fi
    
    yum install -y nginx
    systemctl start nginx
    systemctl enable nginx
    
    log_info "Nginx 安装完成"
}

# 部署 Supabase
deploy_supabase() {
    log_step "部署 Supabase..."
    
    # 创建目录
    mkdir -p $SUPABASE_DIR
    cd $SUPABASE_DIR
    
    # 克隆 Supabase Docker 配置
    if [[ ! -d "supabase" ]]; then
        git clone --depth 1 https://github.com/supabase/supabase
    fi
    
    cd supabase/docker
    
    # 生成 API Keys
    log_info "生成 API Keys..."
    
    # 使用 JWT Secret 生成 anon 和 service_role keys
    # 这里使用简化方式，实际生产建议使用官方工具
    ANON_KEY=$(echo -n "{\"role\":\"anon\",\"iss\":\"supabase\",\"iat\":$(date +%s),\"exp\":$(($(date +%s) + 315360000))}" | base64 | tr -d '\n')
    SERVICE_ROLE_KEY=$(echo -n "{\"role\":\"service_role\",\"iss\":\"supabase\",\"iat\":$(date +%s),\"exp\":$(($(date +%s) + 315360000))}" | base64 | tr -d '\n')
    
    # 创建 .env 文件
    cat > .env << EOF
############
# Secrets - 请妥善保管这些密钥
############

POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# API URLs
############
SITE_URL=https://$DOMAIN
API_EXTERNAL_URL=https://$API_DOMAIN
SUPABASE_PUBLIC_URL=https://$API_DOMAIN

############
# Kong
############
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

############
# GoTrue (Auth)
############
GOTRUE_SITE_URL=https://$DOMAIN
GOTRUE_URI_ALLOW_LIST=*
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_JWT_ADMIN_ROLES=service_role
GOTRUE_JWT_AUD=authenticated
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_JWT_EXP=3600
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_EXTERNAL_PHONE_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=true

# SMS 配置 (可选，如需短信验证)
# GOTRUE_SMS_PROVIDER=twilio
# GOTRUE_SMS_TWILIO_ACCOUNT_SID=
# GOTRUE_SMS_TWILIO_AUTH_TOKEN=
# GOTRUE_SMS_TWILIO_MESSAGE_SERVICE_SID=

############
# Studio
############
STUDIO_DEFAULT_ORGANIZATION=Alo生态
STUDIO_DEFAULT_PROJECT=alo-app
STUDIO_PORT=3000
SUPABASE_PUBLIC_URL=https://$API_DOMAIN

############
# Storage
############
STORAGE_BACKEND=file
FILE_SIZE_LIMIT=52428800
GLOBAL_S3_BUCKET=supabase-storage

############
# Realtime
############
REALTIME_IP_VERSION=IPv4

############
# Functions
############
FUNCTIONS_VERIFY_JWT=false

############
# Logs
############
LOGFLARE_LOGGER_BACKEND_API_KEY=your-super-secret-and-long-logflare-key

############
# Analytics
############
ENABLE_ANALYTICS=false
EOF

    log_info ".env 配置文件已创建"
    
    # 启动 Supabase
    log_info "启动 Supabase 服务..."
    docker compose pull
    docker compose up -d
    
    # 等待服务启动
    log_info "等待服务启动 (约30秒)..."
    sleep 30
    
    # 检查服务状态
    docker compose ps
    
    log_info "Supabase 部署完成"
}

# 配置 Nginx
configure_nginx() {
    log_step "配置 Nginx..."
    
    # 创建 SSL 目录
    mkdir -p /etc/nginx/ssl
    
    # 生成自签名证书 (生产环境请使用正式证书)
    if [[ ! -f "/etc/nginx/ssl/$DOMAIN.crt" ]]; then
        log_info "生成自签名 SSL 证书..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/$DOMAIN.key \
            -out /etc/nginx/ssl/$DOMAIN.crt \
            -subj "/CN=$DOMAIN"
        
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/$API_DOMAIN.key \
            -out /etc/nginx/ssl/$API_DOMAIN.crt \
            -subj "/CN=$API_DOMAIN"
    fi
    
    # 创建 Nginx 配置
    cat > /etc/nginx/conf.d/alo-supabase.conf << EOF
# Alo生态 - Supabase API 反向代理
# 生成时间: $(date)

# API 服务 (Supabase)
server {
    listen 80;
    server_name $API_DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $API_DOMAIN;

    ssl_certificate /etc/nginx/ssl/$API_DOMAIN.crt;
    ssl_certificate_key /etc/nginx/ssl/$API_DOMAIN.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 客户端最大请求体
    client_max_body_size 50M;

    # API 代理
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket 支持
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        
        # CORS
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "authorization, x-client-info, apikey, content-type" always;
        
        if (\$request_method = OPTIONS) {
            return 204;
        }
    }
}

# Supabase Studio (管理界面)
server {
    listen 443 ssl http2;
    server_name studio.$DOMAIN;

    ssl_certificate /etc/nginx/ssl/$DOMAIN.crt;
    ssl_certificate_key /etc/nginx/ssl/$DOMAIN.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

    # 测试配置
    nginx -t
    
    # 重载 Nginx
    systemctl reload nginx
    
    log_info "Nginx 配置完成"
}

# 创建管理脚本
create_management_scripts() {
    log_step "创建管理脚本..."
    
    # Supabase 状态检查
    cat > /usr/local/bin/supabase-status << 'EOF'
#!/bin/bash
cd /opt/supabase/supabase/docker
echo "========== Supabase 服务状态 =========="
docker compose ps
echo ""
echo "========== 资源使用 =========="
docker stats --no-stream
EOF
    chmod +x /usr/local/bin/supabase-status
    
    # Supabase 日志查看
    cat > /usr/local/bin/supabase-logs << 'EOF'
#!/bin/bash
cd /opt/supabase/supabase/docker
service=${1:-""}
if [[ -z "$service" ]]; then
    docker compose logs -f --tail=100
else
    docker compose logs -f --tail=100 $service
fi
EOF
    chmod +x /usr/local/bin/supabase-logs
    
    # Supabase 重启
    cat > /usr/local/bin/supabase-restart << 'EOF'
#!/bin/bash
cd /opt/supabase/supabase/docker
echo "重启 Supabase 服务..."
docker compose restart
echo "完成"
EOF
    chmod +x /usr/local/bin/supabase-restart
    
    # 数据库备份
    cat > /usr/local/bin/supabase-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/supabase/backups"
mkdir -p $BACKUP_DIR
BACKUP_FILE="$BACKUP_DIR/db_$(date +%Y%m%d_%H%M%S).sql.gz"
echo "备份数据库到: $BACKUP_FILE"
docker exec supabase-db pg_dump -U postgres postgres | gzip > $BACKUP_FILE
echo "备份完成: $(ls -lh $BACKUP_FILE)"
# 保留最近 7 天的备份
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
EOF
    chmod +x /usr/local/bin/supabase-backup
    
    log_info "管理脚本创建完成"
}

# 配置定时任务
setup_cron() {
    log_step "配置定时备份..."
    
    # 每天凌晨 2 点备份
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/supabase-backup") | crontab -
    
    log_info "定时备份已配置 (每天 02:00)"
}

# 保存配置信息
save_credentials() {
    log_step "保存配置信息..."
    
    CREDS_FILE="/opt/supabase/credentials.txt"
    
    cat > $CREDS_FILE << EOF
============================================
       Alo生态 Supabase 配置信息
       生成时间: $(date)
============================================

【重要】请妥善保管此文件，不要泄露！

============================================
域名配置
============================================
前端域名: https://$DOMAIN
API 域名: https://$API_DOMAIN
Studio: https://studio.$DOMAIN

============================================
数据库
============================================
主机: localhost
端口: 5432
用户名: postgres
密码: $POSTGRES_PASSWORD
数据库: postgres

============================================
API Keys (前端使用)
============================================
VITE_SUPABASE_URL=https://$API_DOMAIN
VITE_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY

============================================
Service Role Key (后端使用，请勿泄露)
============================================
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

============================================
JWT Secret
============================================
JWT_SECRET=$JWT_SECRET

============================================
管理命令
============================================
查看状态: supabase-status
查看日志: supabase-logs [服务名]
重启服务: supabase-restart
备份数据: supabase-backup

============================================
EOF

    chmod 600 $CREDS_FILE
    log_info "配置信息已保存到: $CREDS_FILE"
}

# 完成部署
finish_deploy() {
    echo ""
    echo "============================================"
    echo -e "${GREEN}       Supabase 后端部署完成！${NC}"
    echo "============================================"
    echo ""
    echo "访问地址:"
    echo "  - API: https://$API_DOMAIN"
    echo "  - Studio: https://studio.$DOMAIN"
    echo ""
    echo "前端配置 (.env):"
    echo "  VITE_SUPABASE_URL=https://$API_DOMAIN"
    echo "  VITE_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY"
    echo ""
    echo "管理命令:"
    echo "  supabase-status  - 查看服务状态"
    echo "  supabase-logs    - 查看日志"
    echo "  supabase-restart - 重启服务"
    echo "  supabase-backup  - 备份数据库"
    echo ""
    echo "配置文件: /opt/supabase/credentials.txt"
    echo ""
    echo "============================================"
    echo -e "${YELLOW}重要提示:${NC}"
    echo "1. 请将 credentials.txt 中的配置保存到安全位置"
    echo "2. 生产环境请替换自签名证书为正式 SSL 证书"
    echo "3. 配置防火墙只开放必要端口 (80, 443)"
    echo "4. 定期检查和更新 Supabase 版本"
    echo "============================================"
}

# 主函数
main() {
    echo ""
    echo "============================================"
    echo "    Alo生态 Supabase 自托管一键部署"
    echo "============================================"
    echo ""
    
    check_root
    interactive_config
    
    log_info "开始部署..."
    
    install_base_deps
    install_docker
    install_nginx
    deploy_supabase
    configure_nginx
    create_management_scripts
    setup_cron
    save_credentials
    finish_deploy
}

# 执行主函数
main
