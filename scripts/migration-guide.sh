#!/bin/bash

# Lovable Cloud 到 Self-Hosted Supabase 数据迁移指南
# ================================================

echo "=== Supabase 数据迁移指南 ==="
echo ""
echo "由于 Lovable Cloud 的数据需要通过 API 导出，请按以下步骤操作："
echo ""

# ============================================
# 方法1: 使用 pg_dump 直接导出（推荐）
# ============================================
echo "方法1: 使用 Supabase CLI + pg_dump（需要数据库连接字符串）"
echo ""
echo "1. 安装 Supabase CLI:"
echo "   npm install -g supabase"
echo ""
echo "2. 获取 Lovable Cloud 数据库连接字符串:"
echo "   - 在 Lovable 项目设置中查找数据库连接信息"
echo "   - 格式: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
echo ""
echo "3. 导出数据:"
echo '   pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \\'
echo '     --data-only \\'
echo '     --exclude-schema=auth \\'
echo '     --exclude-schema=storage \\'
echo '     --exclude-schema=supabase_functions \\'
echo '     --exclude-schema=realtime \\'
echo '     --exclude-schema=_realtime \\'
echo '     --exclude-schema=extensions \\'
echo '     --exclude-schema=vault \\'
echo '     > lovable_data_export.sql'
echo ""

# ============================================
# 方法2: 通过 Supabase Studio 导出
# ============================================
echo "方法2: 通过 Supabase Studio 手动导出"
echo ""
echo "1. 打开 Lovable Cloud Backend 界面"
echo "2. 进入 Table Editor"
echo "3. 选择每个表，点击 Export to CSV"
echo "4. 然后使用 psql 或 COPY 命令导入"
echo ""

# ============================================
# 方法3: 使用 Node.js 脚本通过 API 导出
# ============================================
echo "方法3: 使用 JavaScript API 导出（适合小数据量）"
echo ""
echo "运行以下脚本导出数据（需要安装 Node.js）:"
echo "   node scripts/export-lovable-data.js"
echo ""

echo "=== 完成导出后 ==="
echo ""
echo "将导出的 SQL 文件上传到服务器，然后执行:"
echo "   docker exec -i supabase-db psql -U postgres -d postgres < lovable_data_export.sql"
echo ""
