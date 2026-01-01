# App Resources / 应用资源

将以下文件放入此目录：

## 必需文件

### icon.png
- 尺寸：1024x1024 像素
- 格式：PNG (透明或纯色背景)
- 用途：应用图标

### splash.png  
- 尺寸：2732x2732 像素
- 格式：PNG
- 用途：启动画面
- 建议：logo居中，背景色 #0f172a

## 生成命令

```bash
# 安装工具
npm install -D @capacitor/assets

# 生成所有尺寸图标
npx capacitor-assets generate --iconBackgroundColor '#0f172a' --splashBackgroundColor '#0f172a'
```

## 输出位置

- Android: `android/app/src/main/res/`
- iOS: `ios/App/App/Assets.xcassets/`

详细说明请参阅 `docs/APP_ICONS_SPLASH_SCREEN.md`
