# 推送通知配置指南

## 概述

本应用使用 Capacitor Push Notifications 插件实现原生推送通知功能。

## Android 配置 (Firebase Cloud Messaging)

### 1. 创建 Firebase 项目

1. 访问 [Firebase Console](https://console.firebase.google.com/)
2. 创建新项目或选择现有项目
3. 添加 Android 应用，包名为: `app.lovable.a50db10995f34b9b99cf1b4d82615234`

### 2. 下载配置文件

1. 在 Firebase 控制台下载 `google-services.json`
2. 将文件放置到 `android/app/google-services.json`

### 3. 配置 Android 项目

在 `android/app/build.gradle` 添加:

```gradle
apply plugin: 'com.google.gms.google-services'
```

在 `android/build.gradle` 添加:

```gradle
dependencies {
    classpath 'com.google.gms:google-services:4.3.15'
}
```

### 4. 配置 AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

<meta-data
    android:name="com.google.firebase.messaging.default_notification_icon"
    android:resource="@mipmap/ic_launcher" />
<meta-data
    android:name="com.google.firebase.messaging.default_notification_color"
    android:resource="@color/colorPrimary" />
```

## iOS 配置 (Apple Push Notification Service)

### 1. Apple Developer 配置

1. 登录 [Apple Developer](https://developer.apple.com/)
2. 进入 Certificates, Identifiers & Profiles
3. 创建 App ID 并启用 Push Notifications

### 2. 创建推送证书

1. 创建 APNs Key 或 APNs Certificate
2. 下载并保存 `.p8` 文件

### 3. 配置 Xcode

1. 打开 `ios/App/App.xcworkspace`
2. 在 Signing & Capabilities 中添加 "Push Notifications"
3. 添加 "Background Modes" 并勾选 "Remote notifications"

### 4. 配置 AppDelegate.swift

确保包含以下代码:

```swift
import Capacitor
import UIKit
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    // ... existing code
    
    func application(_ application: UIApplication, 
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications, 
            object: deviceToken
        )
    }
    
    func application(_ application: UIApplication, 
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications, 
            object: error
        )
    }
}
```

## 服务端发送推送

### 使用 Firebase Admin SDK (Android)

```javascript
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const message = {
  notification: {
    title: '新消息',
    body: '您收到一条新消息'
  },
  data: {
    conversationId: 'xxx',
    type: 'message'
  },
  token: deviceToken
};

admin.messaging().send(message);
```

### 使用 APNs (iOS)

可以使用第三方库如 `apn` 或直接调用 APNs HTTP/2 API。

## 测试推送通知

### Android

1. 运行 `npx cap run android`
2. 在 Firebase Console > Cloud Messaging 发送测试消息

### iOS

1. 运行 `npx cap run ios`
2. 使用 APNs 工具或 Xcode 发送测试推送

## 注意事项

1. **iOS 模拟器不支持推送通知**，必须使用真机测试
2. **Android 模拟器** 需要 Google Play Services
3. 推送通知需要应用在后台或关闭状态才能显示系统通知
4. 前台收到推送时，应用会通过 `pushNotificationReceived` 事件处理

## 故障排除

### Android 无法收到推送

1. 检查 `google-services.json` 是否正确放置
2. 确认 Firebase 项目配置正确
3. 检查设备是否有 Google Play Services

### iOS 无法收到推送

1. 确认推送证书/密钥配置正确
2. 检查 Bundle ID 是否匹配
3. 确认设备允许通知权限
4. 检查 APNs 环境（开发/生产）是否正确
