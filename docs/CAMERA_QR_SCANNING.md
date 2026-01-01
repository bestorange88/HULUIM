# 相机与二维码扫描配置指南

## 概述

本应用使用 MLKit Barcode Scanning 插件实现原生二维码扫描，在 Web 端使用 html5-qrcode 作为备选方案。

## 依赖安装

```bash
npm install @capacitor-mlkit/barcode-scanning
npx cap sync
```

## Android 配置

### 1. 添加权限到 AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="true" />
```

### 2. 配置 Camera2 API (可选，提升兼容性)

在 `android/app/build.gradle` 中添加：

```gradle
android {
    defaultConfig {
        // 启用 MLKit 优化
        minSdkVersion 21
    }
}
```

### 3. 添加 Google Play Services (MLKit 依赖)

在 `android/build.gradle` 中：

```gradle
dependencies {
    classpath 'com.google.gms:google-services:4.3.15'
}
```

## iOS 配置

### 1. 添加相机权限描述

在 `ios/App/App/Info.plist` 中添加：

```xml
<key>NSCameraUsageDescription</key>
<string>需要相机权限来扫描二维码</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>需要相册权限来识别图片中的二维码</string>
```

### 2. 配置 Podfile

确保 iOS 部署目标版本 >= 13.0：

```ruby
platform :ios, '13.0'
```

运行：

```bash
cd ios/App
pod install
```

## 功能特性

### 原生扫描 (Android/iOS)

- 使用 Google MLKit 实现高效二维码识别
- 支持从相册选择图片扫描
- 自动处理相机权限请求
- 快速识别，低功耗

### Web 扫描 (备选)

- 使用 html5-qrcode 库
- 支持所有现代浏览器
- 自动切换至后置摄像头
- 15 FPS 连续扫描

## 支持的二维码格式

1. **群组邀请链接**: `/join/{code}`
2. **用户个人二维码**: `/user/{userId}`
3. **用户名格式**: `@username` 或 `username`
4. **8位邀请码**: `ABCD1234`
5. **带参数的邀请链接**: `?invite={code}`

## 故障排除

### Android 扫描失败

1. 检查相机权限是否授予
2. 确认 Google Play Services 已安装
3. 重启应用重试

### iOS 扫描失败

1. 检查 Info.plist 权限描述
2. 在系统设置中确认相机权限
3. 确保 iOS 版本 >= 13.0

### Web 扫描失败

1. 确认 HTTPS 访问（HTTP 下相机受限）
2. 检查浏览器相机权限
3. 尝试使用 Chrome 或 Safari

## 测试

### 测试用二维码内容

```
# 群组邀请
https://example.com/join/TESTCODE

# 用户二维码
https://example.com/user/550e8400-e29b-41d4-a716-446655440000

# 直接用户名
@testuser

# 邀请码
TEST1234
```
