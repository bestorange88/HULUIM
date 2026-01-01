# Alo IM 功能缺陷 & 体验优化 变更日志 (v1)

## 版本信息
- 版本: v1.0.0
- 日期: 2025-12-08
- 代码根目录: /www/wwwroot/alo-app

---

## 任务 1: 强制使用付费TURN中继服务器 (已完成)

### 修改文件
- `src/components/call/CallInterface.tsx`

### 变更内容
1. 移除所有免费TURN服务器回退代码（openrelay.metered.ca）
2. 将 `iceTransportPolicy` 从 `'all'` 改为 `'relay'`，强制使用中继连接
3. 当获取付费TURN凭证失败时，直接抛出错误并显示提示"无法连接通话服务器"，不再回退到免费服务器

### 验收结果
- WebRTC连接只使用付费TURN中继服务器
- 不再自动退回到免费公共中继

---

## 任务 2: 群聊禁言功能修复 (已完成)

### 修改文件
- `src/components/chat/ChatArea.tsx`

### 变更内容
1. 添加三个状态变量：`isMuted`, `isGroupMuteAll`, `muteMessage`
2. 在 `fetchConversationInfo` 中添加禁言状态获取逻辑：
   - 检查用户个人 `is_muted` 状态（从 `conversation_participants` 表）
   - 检查群级别 `mute_all` 设置（从 `conversation` 表）
   - 处理禁言时长过期逻辑
3. 在 `handleSendMessage` 中添加禁言检查，阻止被禁言用户发送消息
4. 添加UI显示禁言状态提示信息

### 验收结果
- 群管理开启「全员禁言」后，非管理员/群主无法发送消息
- 对单个用户「单独禁言」后，该用户在该群内无法发言
- 刷新页面后禁言状态仍然生效

---

## 任务 3: 手机端对话框顶部标题栏固定 (已完成)

### 修改文件
- `src/components/chat/ChatArea.tsx`

### 变更内容
1. 为聊天页面顶部标题栏添加 `sticky top-0` 定位
2. 配合现有的 `flex-shrink-0` 和 `safe-area-top` 确保键盘弹出时标题栏固定

### 验收结果
- 手机端打开软键盘输入消息时，顶部标题栏始终固定在屏幕顶部可见
- 输入框/消息区域在键盘上方，正常可滚动

---

## 任务 4: 会员编辑同步 (已验证)

### 检查文件
- `src/pages/admin/MembershipTiers.tsx` (管理后台会员等级页面)
- `src/pages/MembershipPurchase.tsx` (前端会员中心页面)

### 验证结果
1. 管理后台会员等级页面正确保存到 `membership_tiers` 表
2. 前端会员中心页面从数据库读取最新数据
3. 两个页面都使用Supabase直接操作，同步自动完成
4. 管理页面有正确的错误处理和成功提示

---

## 任务 5: 后台用户来源区分 (已完成)

### 修改文件
- `src/pages/admin/Users.tsx`

### 变更内容
1. 在用户列表表头添加「用户来源」列
2. 在用户列表表格中添加用户来源显示：
   - 蓝色标签「后台创建」：用户名以 `test_` 开头或包含 `internal`
   - 绿色标签「用户注册」：其他用户

### 验收结果
- 管理后台用户列表中可以一眼看出哪些是运营手动添加的帐号，哪些是用户真实注册的

---

## 任务 6: 语音/视频通话只使用付费中继 (已完成)

### 修改文件
- `src/components/call/CallInterface.tsx`
- `src/contexts/CallContext.tsx`

### 变更内容
1. 强制只使用付费TURN中继服务器，移除所有免费服务器回退代码
2. 将 `iceTransportPolicy` 改为 `'relay'` 强制使用中继
3. 在发起通话前检查对方的在线状态，如果对方可能不在线则显示提示

### 验收结果
- 语音/视频通话的WebRTC连接只走付费中继/TURN服务器
- 不再自动退回到免费公共中继

---

## 任务 7: 扫码器兼容性 & 相册二维码识别 (已完成)

### 修改文件
- `src/pages/ScanQRCode.tsx`

### 变更内容
1. 添加视频约束配置，使用较低分辨率提高兼容性：
   - `width: { ideal: 640, max: 1280 }`
   - `height: { ideal: 480, max: 720 }`
2. 相册二维码识别功能已存在并正常工作：
   - 原生端使用 MLKit 的 `readBarcodesFromImage`
   - Web端使用 `Html5Qrcode` 的 `scanFile` + Canvas 兜底方案

### 验收结果
- 在尽量多的手机上能正常拉起摄像头并识别二维码
- 即使摄像头分辨率较高也不会因为画面过大导致识别失败
- 可以从本地相册选择二维码图片进行识别

---

## 备注

### 视频通话信令问题
发现自托管Supabase的 `/realtime/v1/api/broadcast` 端点返回404错误。这是服务器端配置问题，需要检查：
1. Supabase Realtime服务配置
2. nginx/反向代理是否正确转发 `/realtime/v1/api/*` 路径到Realtime服务
3. broadcast功能是否已启用

### 备份文件
- `/www/wwwroot/alo-app/src/components/call/CallInterface.tsx.backup`
- `/www/wwwroot/alo-app/src/contexts/CallContext.tsx.backup`

---

---

## 任务 4.1：会员补差价升级逻辑（2025-12-08）

### 新增功能

1. **Edge Function: calculate-membership-upgrade**
   - 位置：supabase/functions/calculate-membership-upgrade/index.ts
   - 功能：计算用户升级会员等级时需要支付的差价
   - 返回：当前等级、目标等级、原价、差价、是否允许升级

2. **前端会员中心升级价格展示**
   - 文件：src/pages/MembershipPurchase.tsx
   - 修改内容：
     - 添加 currentMembership、upgradeInfo、loadingUpgrade 状态变量
     - 加载用户当前会员等级信息
     - 点击购买时调用 Edge Function 计算差价
     - 确认对话框显示：当前等级、原价（划线）、补差价金额
     - 支付时使用计算后的差价金额而非原价

3. **文档更新**
   - 新增：docs/MEMBERSHIP_RULES.md - 会员等级规则文档
   - 包含补差价升级规则的详细说明

### 规则说明

- 首次购买：支付目标等级完整价格
- 升级购买：只需支付「新等级价格 - 当前等级价格」的差额
- 不允许降级：目标等级价格 ≤ 当前等级价格时，禁止购买
- 等级判定：根据 sort_order 字段判断等级高低

---

## 视频通话修复（2025-12-08）

### 问题描述

视频通话接听后无法连接，控制台显示 /realtime/v1/api/broadcast 返回 404 错误。

### 根本原因

Kong API 网关配置错误，将 /realtime/v1/ 路径路由到 http://realtime:4000/socket，导致 /realtime/v1/api/broadcast 被路由到不存在的 http://realtime:4000/socket/api/broadcast。

### 修复方案

更新 /opt/supabase/volumes/kong/kong.yml 配置文件：
- 将 url: http://realtime:4000/socket 改为 url: http://realtime:4000
- 重启 Kong 服务使配置生效

### 验证结果

broadcast 端点现在返回 422（参数验证错误）而非 404，说明路由已正确工作。
