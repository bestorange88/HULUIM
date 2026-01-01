#!/bin/bash

# ============================================
# Alo生态 - 宝塔面板部署脚本
# 适用于已安装宝塔面板的服务器
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# ============================================
# 配置区域 - 请根据实际情况修改
# ============================================
APP_DIR="/www/wwwroot/glide-com-main"
DOMAIN="your-domain.com"  # 修改为你的域名
PORT=3000

# Supabase 配置 (从 Lovable Cloud 获取)
SUPABASE_URL="https://fziwcnrrojazlalccwpe.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXdjbnJyb2phemxhbGNjd3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NjY2NjgsImV4cCI6MjA3NzA0MjY2OH0.0Gr1kSthwScLb6Fj8uFsrnNbW8g_xb7w06w3zo9tv6Y"

# ============================================
# 检查运行环境
# ============================================
check_environment() {
    log_step "检查运行环境..."
    
    # 检查是否为 root
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 root 用户运行此脚本"
        exit 1
    fi
    
    # 检查宝塔是否安装
    if [ ! -d "/www/server/panel" ]; then
        log_error "未检测到宝塔面板，此脚本仅适用于宝塔环境"
        exit 1
    fi
    
    # 检查项目目录
    if [ ! -d "$APP_DIR" ]; then
        log_error "项目目录不存在: $APP_DIR"
        exit 1
    fi
    
    log_info "环境检查通过"
}

# ============================================
# 安装 Node.js
# ============================================
install_nodejs() {
    log_step "检查 Node.js 环境..."
    
    # 检查是否已安装 Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        log_info "Node.js 已安装: $NODE_VERSION"
        
        # 检查版本是否 >= 18
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
        if [ "$MAJOR_VERSION" -lt 18 ]; then
            log_warn "Node.js 版本过低，需要 >= 18.x"
            install_node_manually
        fi
    else
        install_node_manually
    fi
    
    # 安装 PM2
    if ! command -v pm2 &> /dev/null; then
        log_info "安装 PM2..."
        npm install -g pm2
    fi
    
    # 安装 serve (用于静态文件服务)
    if ! command -v serve &> /dev/null; then
        log_info "安装 serve..."
        npm install -g serve
    fi
}

install_node_manually() {
    log_info "安装 Node.js 20.x..."
    
    # 使用 NodeSource 安装
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
    
    # 验证安装
    node -v
    npm -v
    
    log_info "Node.js 安装完成"
}

# ============================================
# 配置项目环境
# ============================================
setup_project() {
    log_step "配置项目环境..."
    
    cd "$APP_DIR"
    
    # 创建 .env.production 文件
    cat > .env.production << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_ANON_KEY
VITE_SUPABASE_PROJECT_ID=fziwcnrrojazlalccwpe
EOF
    
    log_info "环境配置文件已创建"
}

# ============================================
# 构建项目
# ============================================
build_project() {
    log_step "构建项目..."
    
    cd "$APP_DIR"
    
    # 安装依赖
    log_info "安装项目依赖..."
    npm install --legacy-peer-deps
    
    # 构建
    log_info "构建生产版本..."
    npm run build
    
    if [ ! -d "$APP_DIR/dist" ]; then
        log_error "构建失败，dist 目录不存在"
        exit 1
    fi
    
    log_info "项目构建完成"
}

# ============================================
# 配置 PM2
# ============================================
setup_pm2() {
    log_step "配置 PM2 服务..."
    
    cd "$APP_DIR"
    
    # 创建 PM2 配置文件 (使用 .cjs 扩展名避免 ES module 冲突)
    cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: 'alo-web',
    script: 'serve',
    args: '-s dist -l $PORT',
    cwd: '$APP_DIR',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PM2_SERVE_PATH: '$APP_DIR/dist',
      PM2_SERVE_PORT: $PORT,
      PM2_SERVE_SPA: 'true'
    }
  }]
};
EOF
    
    # 停止旧进程
    pm2 delete alo-web 2>/dev/null || true
    
    # 启动服务
    pm2 start ecosystem.config.cjs
    pm2 save
    
    # 设置开机启动
    pm2 startup systemd -u root --hp /root 2>/dev/null || true
    
    log_info "PM2 服务配置完成"
}

# ============================================
# 生成 Nginx 配置
# ============================================
generate_nginx_config() {
    log_step "生成 Nginx 配置..."
    
    NGINX_CONF="/www/server/panel/vhost/nginx/${DOMAIN}.conf"
    
    cat > /tmp/alo_nginx.conf << EOF
# Alo生态 Nginx 配置
# 请在宝塔面板中创建网站后，将以下配置添加到网站配置中

server {
    listen 80;
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL 配置 (使用宝塔申请的证书)
    # ssl_certificate    /www/server/panel/vhost/cert/$DOMAIN/fullchain.pem;
    # ssl_certificate_key    /www/server/panel/vhost/cert/$DOMAIN/privkey.pem;
    
    # 根目录指向 dist
    root $APP_DIR/dist;
    index index.html;
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # SPA 路由支持
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # API 代理 (如果需要)
    # location /api/ {
    #     proxy_pass http://127.0.0.1:$PORT/;
    #     proxy_set_header Host \$host;
    #     proxy_set_header X-Real-IP \$remote_addr;
    # }
    
    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }
    
    # 访问日志
    access_log /www/wwwlogs/${DOMAIN}.log;
    error_log /www/wwwlogs/${DOMAIN}.error.log;
}
EOF
    
    log_info "Nginx 配置已生成到: /tmp/alo_nginx.conf"
    echo ""
    cat /tmp/alo_nginx.conf
    echo ""
}

# ============================================
# 创建管理脚本
# ============================================
create_management_scripts() {
    log_step "创建管理脚本..."
    
    # 更新部署脚本
    cat > /usr/local/bin/alo-update << 'EOF'
#!/bin/bash
cd /www/wwwroot/glide-com-main
echo "拉取最新代码..."
git pull origin main 2>/dev/null || echo "非 Git 仓库，跳过拉取"
echo "安装依赖..."
npm install --legacy-peer-deps
echo "构建项目..."
npm run build
echo "重启服务..."
pm2 restart alo-web
echo "更新完成!"
EOF
    chmod +x /usr/local/bin/alo-update
    
    # 状态检查脚本
    cat > /usr/local/bin/alo-status << 'EOF'
#!/bin/bash
echo "========== PM2 状态 =========="
pm2 status
echo ""
echo "========== 端口监听 =========="
netstat -tlnp | grep -E ":(80|443|3000)"
echo ""
echo "========== 磁盘使用 =========="
df -h /www
echo ""
echo "========== 内存使用 =========="
free -h
EOF
    chmod +x /usr/local/bin/alo-status
    
    # 日志查看脚本
    cat > /usr/local/bin/alo-logs << 'EOF'
#!/bin/bash
case "$1" in
    pm2)
        pm2 logs alo-web --lines 100
        ;;
    nginx)
        tail -f /www/wwwlogs/*.log
        ;;
    *)
        echo "用法: alo-logs [pm2|nginx]"
        ;;
esac
EOF
    chmod +x /usr/local/bin/alo-logs
    
    log_info "管理脚本已创建"
}

# ============================================
# 完成部署
# ============================================
finish_deploy() {
    echo ""
    echo "============================================"
    echo -e "${GREEN}部署完成!${NC}"
    echo "============================================"
    echo ""
    echo "项目目录: $APP_DIR"
    echo "构建目录: $APP_DIR/dist"
    echo ""
    echo -e "${YELLOW}接下来请在宝塔面板中操作:${NC}"
    echo "1. 网站 → 添加站点 → 域名填写: $DOMAIN"
    echo "2. 根目录设置为: $APP_DIR/dist"
    echo "3. 网站设置 → 配置文件 → 添加以下内容到 server 块:"
    echo ""
    echo "   location / {"
    echo "       try_files \$uri \$uri/ /index.html;"
    echo "   }"
    echo ""
    echo "4. 申请 SSL 证书 (网站设置 → SSL → Let's Encrypt)"
    echo ""
    echo -e "${BLUE}管理命令:${NC}"
    echo "  alo-update  - 更新部署"
    echo "  alo-status  - 查看状态"
    echo "  alo-logs    - 查看日志"
    echo ""
    echo -e "${GREEN}完整 Nginx 配置参考已保存到: /tmp/alo_nginx.conf${NC}"
    echo "============================================"
}

# ============================================
# 主流程
# ============================================
main() {
    echo "============================================"
    echo "   Alo生态 - 宝塔面板部署脚本"
    echo "============================================"
    echo ""
    
    # 询问域名
    read -p "请输入您的域名 (默认: $DOMAIN): " input_domain
    if [ -n "$input_domain" ]; then
        DOMAIN=$input_domain
    fi
    
    echo ""
    echo "部署配置:"
    echo "  项目目录: $APP_DIR"
    echo "  域名: $DOMAIN"
    echo "  端口: $PORT"
    echo ""
    read -p "确认开始部署? (y/n): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "已取消"
        exit 0
    fi
    
    check_environment
    install_nodejs
    setup_project
    build_project
    setup_pm2
    generate_nginx_config
    create_management_scripts
    finish_deploy
}

# 运行
main "$@"
