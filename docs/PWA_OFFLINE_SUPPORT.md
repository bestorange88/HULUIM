# PWA 离线支持配置指南

## 概述

本应用使用 vite-plugin-pwa 实现 PWA (Progressive Web App) 功能，支持离线访问和自动更新。

## 功能特性

### 1. Service Worker 缓存

- **静态资源缓存**: JS、CSS、HTML、图片等自动缓存
- **字体缓存**: Google Fonts 缓存一年
- **图片缓存**: 本地图片缓存30天
- **Supabase 存储缓存**: 网络优先，超时回退缓存

### 2. 离线指示器

当网络断开时，顶部显示黄色提示条，恢复后显示绿色确认。

### 3. 自动更新提示

当有新版本可用时，底部弹出更新提示卡片，用户可选择立即更新或稍后处理。

## 配置说明

### vite.config.ts

```typescript
import { VitePWA } from "vite-plugin-pwa";

VitePWA({
  registerType: "autoUpdate",
  manifest: {
    name: "Alo生态",
    short_name: "Alo",
    theme_color: "#0f172a",
    background_color: "#0f172a",
    display: "standalone",
    // ...
  },
  workbox: {
    globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
    runtimeCaching: [/* 缓存策略 */],
  },
})
```

### 缓存策略

| 资源类型 | 策略 | 有效期 |
|---------|------|--------|
| 静态资源 | 预缓存 | 永久 |
| Google Fonts | CacheFirst | 1年 |
| 本地图片 | CacheFirst | 30天 |
| Supabase 存储 | NetworkFirst | 7天 |

## 组件说明

### OfflineIndicator

位置: `src/components/pwa/OfflineIndicator.tsx`

功能:
- 监听 `online/offline` 事件
- 网络断开时显示离线提示
- 网络恢复时显示恢复通知

### PWAUpdatePrompt

位置: `src/components/pwa/PWAUpdatePrompt.tsx`

功能:
- 检测 Service Worker 更新
- 显示更新提示卡片
- 支持立即更新或忽略

## 安装到主屏幕

### iOS Safari

1. 打开应用网址
2. 点击分享按钮
3. 选择"添加到主屏幕"

### Android Chrome

1. 打开应用网址
2. 点击菜单按钮
3. 选择"添加到主屏幕"或"安装应用"

## 开发调试

### 查看 Service Worker

1. 打开 Chrome DevTools
2. 进入 Application 标签
3. 查看 Service Workers 部分

### 清除缓存

```javascript
// 在 DevTools Console 中执行
caches.keys().then(names => {
  names.forEach(name => caches.delete(name));
});
```

### 强制更新

```javascript
// 在 DevTools Console 中执行
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.update());
});
```

## 注意事项

1. **HTTPS 必需**: Service Worker 只能在 HTTPS 或 localhost 下运行
2. **首次加载**: 首次访问需要网络，之后可离线访问已缓存内容
3. **API 请求**: API 请求不会被缓存，离线时会失败
4. **实时功能**: 聊天、通话等实时功能需要网络连接

## 与 Capacitor 原生应用的关系

- **原生应用**: 使用 Capacitor 打包，本身就是离线应用
- **PWA**: 面向 Web 用户，提供类似原生的体验
- **建议**: 原生应用中可禁用 PWA 功能以避免冲突

### 在原生应用中禁用 PWA

在 `vite.config.ts` 中添加环境判断：

```typescript
VitePWA({
  // 原生应用构建时禁用
  disable: process.env.CAPACITOR_BUILD === 'true',
  // ...
})
```

## 测试清单

- [ ] 离线时能查看已加载的页面
- [ ] 网络断开显示离线提示
- [ ] 网络恢复显示恢复通知
- [ ] 新版本发布后显示更新提示
- [ ] 点击更新后应用刷新
- [ ] 可添加到手机主屏幕
- [ ] 从主屏幕启动时全屏显示
