/**
 * 批量注册压力测试脚本
 * 用法: node scripts/batch_register.cjs --count 1000 --concurrency 30
 */

const https = require("https");

// 配置
const CONFIG = {
  supabaseUrl: "https://api.1388.you",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzMzNDkwMDAwLCJleHAiOjIwNDkwNjYwMDB9.0el8_Clu2kCqyfrZPztQ0xtYmt2EGZGuCwyTclcx7kQ",
  totalUsers: 1000,
  concurrency: 30,
  delayBetweenBatches: 100,
};

// 解析命令行参数
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  if (args[i] === "--count") CONFIG.totalUsers = parseInt(args[i + 1]);
  if (args[i] === "--concurrency") CONFIG.concurrency = parseInt(args[i + 1]);
  if (args[i] === "--delay") CONFIG.delayBetweenBatches = parseInt(args[i + 1]);
}

// 统计
const stats = { success: 0, failed: 0, errors: [], startTime: null, endTime: null };

// 生成随机用户数据
function generateUser(index) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return {
    email: `test_${timestamp}_${index}_${random}@test.com`,
    password: "Test123456!",
    data: { username: `test_user_${timestamp}_${index}`, display_name: `测试用户${index}` },
  };
}

// 注册单个用户
function registerUser(user) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ email: user.email, password: user.password, data: user.data });
    const url = new URL(`${CONFIG.supabaseUrl}/auth/v1/signup`);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        apikey: CONFIG.supabaseAnonKey,
        Authorization: `Bearer ${CONFIG.supabaseAnonKey}`,
      },
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, email: user.email });
        } else {
          reject({ success: false, email: user.email, status: res.statusCode, error: data });
        }
      });
    });

    req.on("error", (e) => reject({ success: false, email: user.email, error: e.message }));
    req.setTimeout(30000, () => { req.destroy(); reject({ success: false, email: user.email, error: "Timeout" }); });
    req.write(postData);
    req.end();
  });
}

// 批量注册
async function batchRegister() {
  console.log("========================================");
  console.log("批量注册压力测试");
  console.log(`总用户数: ${CONFIG.totalUsers}`);
  console.log(`并发数: ${CONFIG.concurrency}`);
  console.log(`批次延迟: ${CONFIG.delayBetweenBatches}ms`);
  console.log("========================================\n");

  stats.startTime = Date.now();
  const users = Array.from({ length: CONFIG.totalUsers }, (_, i) => generateUser(i + 1));

  for (let i = 0; i < users.length; i += CONFIG.concurrency) {
    const batch = users.slice(i, i + CONFIG.concurrency);
    const batchNum = Math.floor(i / CONFIG.concurrency) + 1;
    const totalBatches = Math.ceil(users.length / CONFIG.concurrency);

    process.stdout.write(`\r批次 ${batchNum}/${totalBatches} - 成功: ${stats.success}, 失败: ${stats.failed}`);

    const results = await Promise.allSettled(batch.map((user) => registerUser(user)));
    results.forEach((result) => {
      if (result.status === "fulfilled") { stats.success++; }
      else { stats.failed++; if (stats.errors.length < 10) stats.errors.push(result.reason); }
    });

    if (i + CONFIG.concurrency < users.length) {
      await new Promise((r) => setTimeout(r, CONFIG.delayBetweenBatches));
    }
  }

  stats.endTime = Date.now();
  const duration = (stats.endTime - stats.startTime) / 1000;
  const rps = CONFIG.totalUsers / duration;

  console.log("\n\n========================================");
  console.log("测试完成!");
  console.log(`总耗时: ${duration.toFixed(2)}秒`);
  console.log(`成功: ${stats.success}`);
  console.log(`失败: ${stats.failed}`);
  console.log(`成功率: ${((stats.success / CONFIG.totalUsers) * 100).toFixed(2)}%`);
  console.log(`平均速率: ${rps.toFixed(2)} 注册/秒`);
  console.log("========================================");

  if (stats.errors.length > 0) {
    console.log("\n错误示例:");
    stats.errors.slice(0, 5).forEach((err, i) => console.log(`${i + 1}. ${err.email}: ${err.error || err.status}`));
  }
}

batchRegister().catch(console.error);
