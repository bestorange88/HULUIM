/**
 * 数据迁移脚本 - 从 Lovable Cloud 导出数据
 * 
 * 使用方法：
 * 1. 在服务器上运行: node migrate-data.js
 * 2. 脚本会自动生成 SQL 导入文件
 */

const https = require('https');

// Lovable Cloud 配置
const LOVABLE_URL = 'https://fziwcnrrojazlalccwpe.supabase.co';
const LOVABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXdjbnJyb2phemxhbGNjd3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NjY2NjgsImV4cCI6MjA3NzA0MjY2OH0.0Gr1kSthwScLb6Fj8uFsrnNbW8g_xb7w06w3zo9tv6Y';

async function fetchTable(tableName, select = '*', limit = 10000) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${LOVABLE_URL}/rest/v1/${tableName}`);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', limit.toString());
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': LOVABLE_KEY,
        'Authorization': `Bearer ${LOVABLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.log(`    HTTP ${res.statusCode}: ${data.substring(0, 100)}`);
            resolve([]);
            return;
          }
          const parsed = JSON.parse(data);
          resolve(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          console.log(`    解析错误: ${e.message}`);
          resolve([]);
        }
      });
    });
    req.on('error', (e) => {
      console.log(`    请求错误: ${e.message}`);
      resolve([]);
    });
    req.end();
  });
}

function escapeSQL(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generateInsert(table, rows, conflictColumn = 'id') {
  if (!rows || rows.length === 0) return '';
  
  const columns = Object.keys(rows[0]);
  const values = rows.map(row => 
    `(${columns.map(col => escapeSQL(row[col])).join(', ')})`
  ).join(',\n');
  
  return `INSERT INTO public.${table} (${columns.join(', ')}) VALUES\n${values}\nON CONFLICT (${conflictColumn}) DO NOTHING;\n\n`;
}

async function main() {
  console.log('开始从 Lovable Cloud 导出数据...\n');
  console.log('注意：按依赖顺序导出，先导出被引用的表\n');
  
  const fs = require('fs');
  
  // 先禁用外键约束，最后启用
  let sql = `-- Lovable Cloud 数据导出
-- 生成时间: ${new Date().toISOString()}

-- 临时禁用触发器
SET session_replication_role = replica;

`;

  // 按依赖顺序排列的表（被依赖的表在前）
  const tables = [
    // 1. 基础配置表（无外键依赖）
    { name: 'platform_settings', conflict: 'key' },
    { name: 'admin_accounts', conflict: 'id' },
    { name: 'membership_tiers', conflict: 'id' },
    { name: 'avatar_frames', conflict: 'id' },
    { name: 'sensitive_words', conflict: 'id' },
    { name: 'referral_settings', conflict: 'id' },
    { name: 'point_products', conflict: 'id' },
    { name: 'news_articles', conflict: 'id' },
    { name: 'articles', conflict: 'id' },
    
    // 2. 用户表（profiles 是核心，很多表依赖它）
    { name: 'profiles', conflict: 'id' },
    
    // 3. 依赖 profiles 的表
    { name: 'wallets', conflict: 'id' },
    { name: 'user_points', conflict: 'id' },
    { name: 'customer_service_accounts', conflict: 'id' },
    { name: 'bank_cards', conflict: 'id' },
    { name: 'shipping_addresses', conflict: 'id' },
    { name: 'real_name_verifications', conflict: 'id' },
    { name: 'user_memberships', conflict: 'id' },
    { name: 'daily_check_ins', conflict: 'id' },
    { name: 'lucky_draws', conflict: 'id' },
    { name: 'moments', conflict: 'id' },
    { name: 'referrals', conflict: 'id' },
    { name: 'referral_rewards', conflict: 'id' },
    
    // 4. 社交关系表
    { name: 'friendships', conflict: 'id' },
    { name: 'friend_groups', conflict: 'id' },
    { name: 'friend_group_members', conflict: 'id' },
    
    // 5. 会话相关表
    { name: 'conversations', conflict: 'id' },
    { name: 'conversation_participants', conflict: 'id' },
    { name: 'conversation_settings', conflict: 'id' },
    { name: 'conversation_groups', conflict: 'id' },
    { name: 'conversation_group_members', conflict: 'id' },
    { name: 'group_invites', conflict: 'id' },
    { name: 'group_join_requests', conflict: 'id' },
    
    // 6. 消息表
    { name: 'messages', conflict: 'id' },
    { name: 'message_favorites', conflict: 'id' },
    { name: 'user_deleted_messages', conflict: 'id' },
    
    // 7. 财务相关表
    { name: 'transactions', conflict: 'id' },
    { name: 'crypto_transactions', conflict: 'id' },
    { name: 'red_envelopes', conflict: 'id' },
    { name: 'red_envelope_claims', conflict: 'id' },
    { name: 'transfers', conflict: 'id' },
    
    // 8. 积分商城表
    { name: 'point_transactions', conflict: 'id' },
    { name: 'point_orders', conflict: 'id' },
    
    // 9. 其他表
    { name: 'moment_likes', conflict: 'id' },
    { name: 'moment_comments', conflict: 'id' },
    { name: 'call_invitations', conflict: 'id' },
    { name: 'system_messages', conflict: 'id' },
    { name: 'admin_audit_logs', conflict: 'id' },
    { name: 'admin_gifts', conflict: 'id' },
    { name: 'sms_verification_codes', conflict: 'id' },
  ];
  
  let totalRows = 0;
  
  for (const table of tables) {
    process.stdout.write(`导出 ${table.name}... `);
    const data = await fetchTable(table.name);
    
    if (data && data.length > 0) {
      sql += `-- ${table.name}: ${data.length} 行\n`;
      sql += generateInsert(table.name, data, table.conflict);
      console.log(`✓ ${data.length}行`);
      totalRows += data.length;
    } else {
      console.log(`- 无数据`);
    }
  }
  
  // 重新启用触发器
  sql += `
-- 重新启用触发器
SET session_replication_role = DEFAULT;
`;

  const filename = 'lovable_export.sql';
  fs.writeFileSync(filename, sql);
  
  console.log(`\n========================================`);
  console.log(`导出完成！共 ${totalRows} 行数据`);
  console.log(`文件: ${filename}`);
  console.log(`========================================\n`);
  console.log(`执行导入命令:`);
  console.log(`docker exec -i supabase-db psql -U postgres -d postgres < ${filename}`);
}

main().catch(console.error);
