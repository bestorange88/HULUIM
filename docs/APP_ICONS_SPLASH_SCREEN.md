# 应用图标与启动画面配置指南

## 概述

本指南介绍如何为 Alo生态 应用配置 Android 和 iOS 的应用图标及启动画面。

## 准备工作

### 1. 准备源图标

准备一张 **1024x1024 像素** 的 PNG 图标文件，命名为 `icon.png`。
- 确保图标清晰、简洁
- 建议使用 Alo生态 品牌标识
- 背景可以是透明或纯色

### 2. 准备启动画面

准备一张 **2732x2732 像素** 的 PNG 启动画面，命名为 `splash.png`。
- 中心放置 logo，四周留有足够边距
- 背景色建议使用 `#0f172a` (应用主题深色)

## 方法一：使用 @capacitor/assets 自动生成（推荐）

### 安装工具

```bash
npm install -D @capacitor/assets
```

### 创建资源目录

```bash
mkdir -p resources
```

### 放置源文件

将以下文件放入 `resources/` 目录：
- `icon.png` (1024x1024)
- `splash.png` (2732x2732)

### 生成图标

```bash
npx capacitor-assets generate --iconBackgroundColor '#0f172a' --splashBackgroundColor '#0f172a'
```

这将自动生成所有平台所需的图标尺寸。

## 方法二：手动配置

### Android 图标配置

在 `android/app/src/main/res/` 目录下创建以下文件夹和图标：

```
mipmap-mdpi/
  ic_launcher.png (48x48)
  ic_launcher_round.png (48x48)
  ic_launcher_foreground.png (108x108)

mipmap-hdpi/
  ic_launcher.png (72x72)
  ic_launcher_round.png (72x72)
  ic_launcher_foreground.png (162x162)

mipmap-xhdpi/
  ic_launcher.png (96x96)
  ic_launcher_round.png (96x96)
  ic_launcher_foreground.png (216x216)

mipmap-xxhdpi/
  ic_launcher.png (144x144)
  ic_launcher_round.png (144x144)
  ic_launcher_foreground.png (324x324)

mipmap-xxxhdpi/
  ic_launcher.png (192x192)
  ic_launcher_round.png (192x192)
  ic_launcher_foreground.png (432x432)
```

### Android 自适应图标

创建 `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`：

```xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
```

创建 `android/app/src/main/res/values/colors.xml`：

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0f172a</color>
</resources>
```

### Android 启动画面

创建 `android/app/src/main/res/drawable/splash.png` (1920x1920 或更大)

创建 `android/app/src/main/res/drawable/launch_splash.xml`：

```xml
<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_background"/>
    <item>
        <bitmap
            android:gravity="center"
            android:src="@drawable/splash"/>
    </item>
</layer-list>
```

在 `android/app/src/main/res/values/colors.xml` 添加：

```xml
<color name="splash_background">#0f172a</color>
```

### iOS 图标配置

在 `ios/App/App/Assets.xcassets/AppIcon.appiconset/` 目录下放置以下图标：

```
Contents.json (配置文件)
icon-20.png (20x20)
icon-20@2x.png (40x40)
icon-20@3x.png (60x60)
icon-29.png (29x29)
icon-29@2x.png (58x58)
icon-29@3x.png (87x87)
icon-40.png (40x40)
icon-40@2x.png (80x80)
icon-40@3x.png (120x120)
icon-60@2x.png (120x120)
icon-60@3x.png (180x180)
icon-76.png (76x76)
icon-76@2x.png (152x152)
icon-83.5@2x.png (167x167)
icon-1024.png (1024x1024)
```

### iOS Contents.json

```json
{
  "images": [
    { "size": "20x20", "idiom": "iphone", "filename": "icon-20@2x.png", "scale": "2x" },
    { "size": "20x20", "idiom": "iphone", "filename": "icon-20@3x.png", "scale": "3x" },
    { "size": "29x29", "idiom": "iphone", "filename": "icon-29@2x.png", "scale": "2x" },
    { "size": "29x29", "idiom": "iphone", "filename": "icon-29@3x.png", "scale": "3x" },
    { "size": "40x40", "idiom": "iphone", "filename": "icon-40@2x.png", "scale": "2x" },
    { "size": "40x40", "idiom": "iphone", "filename": "icon-40@3x.png", "scale": "3x" },
    { "size": "60x60", "idiom": "iphone", "filename": "icon-60@2x.png", "scale": "2x" },
    { "size": "60x60", "idiom": "iphone", "filename": "icon-60@3x.png", "scale": "3x" },
    { "size": "20x20", "idiom": "ipad", "filename": "icon-20.png", "scale": "1x" },
    { "size": "20x20", "idiom": "ipad", "filename": "icon-20@2x.png", "scale": "2x" },
    { "size": "29x29", "idiom": "ipad", "filename": "icon-29.png", "scale": "1x" },
    { "size": "29x29", "idiom": "ipad", "filename": "icon-29@2x.png", "scale": "2x" },
    { "size": "40x40", "idiom": "ipad", "filename": "icon-40.png", "scale": "1x" },
    { "size": "40x40", "idiom": "ipad", "filename": "icon-40@2x.png", "scale": "2x" },
    { "size": "76x76", "idiom": "ipad", "filename": "icon-76.png", "scale": "1x" },
    { "size": "76x76", "idiom": "ipad", "filename": "icon-76@2x.png", "scale": "2x" },
    { "size": "83.5x83.5", "idiom": "ipad", "filename": "icon-83.5@2x.png", "scale": "2x" },
    { "size": "1024x1024", "idiom": "ios-marketing", "filename": "icon-1024.png", "scale": "1x" }
  ],
  "info": { "version": 1, "author": "xcode" }
}
```

### iOS 启动画面

在 Xcode 中：
1. 打开 `ios/App/App.xcworkspace`
2. 选择 App 项目 → App target → General
3. 找到 "App Icons and Launch Images"
4. 点击 "Launch Screen File" 设置为 `LaunchScreen`

编辑 `ios/App/App/LaunchScreen.storyboard`，设置背景色为 `#0f172a`。

## Capacitor 配置

`capacitor.config.ts` 已配置启动画面：

```typescript
plugins: {
  SplashScreen: {
    launchShowDuration: 2000,        // 显示2秒
    launchAutoHide: true,            // 自动隐藏
    launchFadeOutDuration: 500,      // 淡出0.5秒
    backgroundColor: "#0f172a",       // 背景色
    androidSplashResourceName: "splash",
    androidScaleType: "CENTER_CROP",
    showSpinner: false,
    splashFullScreen: true,
    splashImmersive: true,
  }
}
```

## 快速生成脚本

创建 `scripts/generate-icons.sh`：

```bash
#!/bin/bash

# 检查依赖
if ! command -v convert &> /dev/null; then
    echo "请安装 ImageMagick: brew install imagemagick"
    exit 1
fi

# 源文件
SOURCE="resources/icon.png"

# Android 图标
mkdir -p android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}

convert $SOURCE -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher.png
convert $SOURCE -resize 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher.png
convert $SOURCE -resize 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
convert $SOURCE -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
convert $SOURCE -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png

echo "Android 图标生成完成"
```

## 验证配置

### Android

```bash
npx cap sync android
npx cap run android
```

### iOS

```bash
npx cap sync ios
npx cap run ios
```

## 常见问题

### 图标显示为默认图标

1. 确保文件名正确
2. 运行 `npx cap sync`
3. 清理并重新构建项目

### 启动画面不显示

1. 检查 `capacitor.config.ts` 配置
2. 确保启动画面资源文件存在
3. iOS 检查 LaunchScreen.storyboard

### 图标模糊

确保使用正确尺寸的图标文件，不要拉伸小图标。

## 在线工具

- [App Icon Generator](https://appicon.co/) - 在线生成多尺寸图标
- [Figma](https://figma.com) - 设计并导出图标
- [IconKitchen](https://icon.kitchen/) - Android 自适应图标生成器
