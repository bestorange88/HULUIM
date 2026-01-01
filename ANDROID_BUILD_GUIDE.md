# 🤖 Alo生态 - Android原生APK打包与升级完整指南

## 📋 目录

1. [环境准备](#环境准备)
2. [项目初始化](#项目初始化)
3. [本地开发与调试](#本地开发与调试)
4. [构建生产版本APK](#构建生产版本apk)
5. [版本升级流程](#版本升级流程)
6. [发布到Google Play](#发布到google-play)
7. [常见问题解决](#常见问题解决)

---

## 🛠️ 环境准备

### 1. 必需软件安装

#### Node.js 和 npm
```bash
# 检查是否已安装（需要 Node.js 16+ 或 18+）
node --version
npm --version

# 如果未安装，访问 https://nodejs.org/ 下载安装
```

#### Java Development Kit (JDK)
```bash
# 推荐安装 JDK 17
# 下载地址：https://adoptium.net/

# 安装后设置环境变量
export JAVA_HOME=/path/to/jdk-17
export PATH=$JAVA_HOME/bin:$PATH

# 验证安装
java --version
```

#### Android Studio
1. 下载 Android Studio：https://developer.android.com/studio
2. 安装时选择 **Standard** 安装模式
3. 确保安装以下组件：
   - Android SDK
   - Android SDK Platform
   - Android Virtual Device (AVD)
   - Android SDK Build-Tools

#### Android SDK 环境变量配置

**macOS/Linux:**
```bash
# 编辑 ~/.bash_profile 或 ~/.zshrc
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools

# 使配置生效
source ~/.bash_profile  # 或 source ~/.zshrc
```

**Windows:**
```powershell
# 设置系统环境变量
setx ANDROID_HOME "C:\Users\你的用户名\AppData\Local\Android\Sdk"
setx PATH "%PATH%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools"
```

验证 Android SDK 安装：
```bash
adb --version
```

---

## 🚀 项目初始化

### 1. 克隆项目到本地

```bash
# 通过 Lovable 导出到 GitHub，然后克隆
git clone https://github.com/你的用户名/你的项目.git
cd 你的项目
```

### 2. 安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 全局安装 Capacitor CLI（如果还没有）
npm install -g @capacitor/cli
```

### 3. 构建 Web 项目

```bash
# 构建生产版本的 Web 应用
npm run build

# 构建完成后会在 dist/ 目录生成静态文件
```

### 4. 添加 Android 平台

```bash
# 添加 Android 平台（首次运行）
npx cap add android

# 如果已经添加过，使用 sync 命令同步
npx cap sync android
```

### 5. 更新项目配置

**检查 `capacitor.config.ts` 配置：**
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a50db10995f34b9b99cf1b4d82615234',
  appName: 'Alo生态',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
```

> ⚠️ **重要提示：** `appId` 是应用的唯一标识符，一旦发布到 Google Play 就**无法更改**。建议使用自己的域名反向格式，例如：`com.yourcompany.alo`

---

## 💻 本地开发与调试

### 1. 在 Android Studio 中打开项目

```bash
# 使用 Capacitor 打开 Android Studio
npx cap open android
```

这会自动打开 Android Studio 并加载项目。

### 2. 连接设备或启动模拟器

#### 使用真机调试：
1. 在 Android 手机上启用**开发者选项**
2. 启用 **USB 调试**
3. 用 USB 线连接手机到电脑
4. 在 Android Studio 中选择你的设备

#### 使用模拟器：
1. 在 Android Studio 中点击 **Device Manager**
2. 创建新的虚拟设备（推荐 Pixel 6 或更新机型）
3. 选择系统镜像（推荐 Android 13 或更高版本）
4. 启动模拟器

### 3. 运行调试版本

```bash
# 方法 1：使用 Capacitor CLI
npx cap run android

# 方法 2：在 Android Studio 中点击 ▶️ Run 按钮
```

### 4. 实时热更新（开发模式）

**启用热更新调试：**

1. 编辑 `capacitor.config.ts`，取消注释 `server` 配置：
```typescript
const config: CapacitorConfig = {
  appId: 'app.lovable.a50db10995f34b9b99cf1b4d82615234',
  appName: 'Alo生态',
  webDir: 'dist',
  server: {
    url: 'https://a50db109-95f3-4b9b-99cf-1b4d82615234.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  // ... 其他配置
};
```

2. 同步配置：
```bash
npx cap sync android
```

3. 重新运行应用，现在应用会从远程服务器加载最新代码

> ⚠️ **注意：** 发布生产版本前，必须**注释掉** `server` 配置！

---

## 📦 构建生产版本APK

### 1. 准备生产配置

**关闭热更新（重要）：**

编辑 `capacitor.config.ts`，确保 `server` 配置已注释：
```typescript
const config: CapacitorConfig = {
  appId: 'app.lovable.a50db10995f34b9b99cf1b4d82615234',
  appName: 'Alo生态',
  webDir: 'dist',
  // server: {
  //   url: 'https://...',
  //   cleartext: true
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};
```

### 2. 构建最新 Web 资源

```bash
# 构建生产版本
npm run build

# 同步到 Android 项目
npx cap sync android
```

### 3. 生成签名密钥（首次构建）

```bash
# 在项目根目录创建密钥存储文件
keytool -genkey -v -keystore ./android/app/release.keystore -alias alo-release -keyalg RSA -keysize 2048 -validity 10000

# 按提示输入信息：
# - 密钥库密码（记住此密码！）
# - 别名密码（可以与密钥库密码相同）
# - 姓名、组织、城市等信息
```

> 🔐 **重要：** 妥善保管 `release.keystore` 文件和密码！丢失后将无法更新已发布的应用！

### 4. 配置签名

**创建 `android/key.properties` 文件：**
```properties
storePassword=你的密钥库密码
keyPassword=你的密钥密码
keyAlias=alo-release
storeFile=release.keystore
```

**编辑 `android/app/build.gradle`：**

在 `android { }` 块内添加：
```gradle
android {
    // ... 其他配置

    signingConfigs {
        release {
            def keystorePropertiesFile = rootProject.file("key.properties")
            def keystoreProperties = new Properties()
            keystoreProperties.load(new FileInputStream(keystorePropertiesFile))

            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 5. 构建 Release APK

**方法 1：使用 Gradle 命令（推荐）**
```bash
cd android
./gradlew assembleRelease

# APK 输出位置：
# android/app/build/outputs/apk/release/app-release.apk
```

**方法 2：使用 Android Studio**
1. 在 Android Studio 中打开项目
2. 选择菜单：**Build → Generate Signed Bundle / APK**
3. 选择 **APK**
4. 选择密钥库文件并输入密码
5. 选择 **release** 构建类型
6. 点击 **Finish**

### 6. 构建 AAB（Google Play 必需）

```bash
cd android
./gradlew bundleRelease

# AAB 输出位置：
# android/app/build/outputs/bundle/release/app-release.aab
```

> 📌 **AAB vs APK：**
> - **AAB (Android App Bundle)：** Google Play 必需格式，包体积更小
> - **APK：** 通用格式，可直接安装或通过第三方商店分发

---

## 🔄 版本升级流程

### 1. 更新版本号

**编辑 `android/app/build.gradle`：**
```gradle
android {
    defaultConfig {
        applicationId "app.lovable.a50db10995f34b9b99cf1b4d82615234"
        minSdkVersion 22
        targetSdkVersion 34
        
        // 每次发布新版本时递增 versionCode
        versionCode 2  // 从 1 改为 2、3、4...
        
        // 更新用户可见的版本号
        versionName "1.0.1"  // 如 1.0.0 → 1.0.1 → 1.1.0 → 2.0.0
    }
}
```

**版本号规则：**
- `versionCode`：整数，每次发布必须递增（用于 Google Play 判断版本新旧）
- `versionName`：字符串，用户可见的版本号（如 1.0.0）

### 2. 更新代码并构建

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖（如有新增）
npm install

# 3. 构建 Web 资源
npm run build

# 4. 同步到 Android
npx cap sync android

# 5. 构建生产版本
cd android
./gradlew bundleRelease  # 或 assembleRelease
```

### 3. 测试新版本

**安装测试：**
```bash
# 方法 1：直接安装 APK 到连接的设备
adb install -r android/app/build/outputs/apk/release/app-release.apk

# 方法 2：在 Android Studio 中运行 release 变体
```

**测试清单：**
- ✅ 启动画面正常
- ✅ 登录/注册功能正常
- ✅ 主要功能（聊天、通话、钱包等）正常
- ✅ 从旧版本升级安装正常
- ✅ 推送通知正常（如有）
- ✅ 权限请求正常

### 4. 提交更新

如果构建的是 AAB 文件，继续下一节发布到 Google Play。

---

## 🚀 发布到Google Play

### 1. 创建 Google Play 开发者账号

1. 访问：https://play.google.com/console
2. 支付一次性注册费用（$25 USD）
3. 完成账号设置

### 2. 创建应用

1. 在 Play Console 中点击 **创建应用**
2. 填写基本信息：
   - 应用名称：**Alo生态**
   - 默认语言：**中文（简体）**
   - 应用类型：**应用**
   - 免费/付费：**免费**
3. 完成声明（隐私政策、目标受众等）

### 3. 准备商店列表资料

**必需资料：**
- **应用图标：** 512×512 PNG（32位，带透明度）
- **功能图片：** 1024×500 JPG/PNG
- **应用截图：** 至少 2 张（手机：1080×1920 或更高）
- **简短描述：** 最多 80 字符
- **完整描述：** 最多 4000 字符
- **隐私政策链接：** 必需（可使用项目中的 `/privacy-policy` 页面）

**准备描述文本：**
```text
简短描述：
Alo生态 - 全方位社交与生活服务平台，集聊天、支付、积分商城于一体

完整描述：
【核心功能】
✨ 即时通讯：文字、语音、视频聊天，红包转账
💎 会员体系：多层级会员权益，专属头像框
🎁 积分商城：签到赚积分，兑换实物与虚拟商品
🎰 幸运转盘：每日免费抽奖，惊喜不断
💰 数字钱包：安全便捷的充值提现体验

【安全保障】
🔐 实名认证系统
🛡️ 多重安全验证
📱 银行级加密技术

立即下载体验！
```

### 4. 上传首个版本

1. 进入 **生产** → **创建新版本**
2. 上传 AAB 文件：`android/app/build/outputs/bundle/release/app-release.aab`
3. 填写版本说明：
   ```text
   首个正式版本发布
   - 完整的即时通讯功能
   - 会员体系
   - 积分商城
   - 钱包充值提现
   ```
4. 保存并审核

### 5. 内容分级

1. 填写内容分级问卷
2. 根据应用功能如实填写
3. 获取分级证书

### 6. 定价和分发

1. 选择 **免费**
2. 选择分发的国家/地区
3. 添加本地化翻译（如需要）

### 7. 提交审核

1. 完成所有必需项（左侧菜单会显示进度）
2. 点击 **提交审核**
3. 审核通常需要 **1-7 天**

### 8. 发布后续版本

```bash
# 1. 更新版本号（build.gradle）
versionCode 2
versionName "1.0.1"

# 2. 构建新的 AAB
cd android
./gradlew bundleRelease

# 3. 在 Play Console 中创建新版本
# 4. 上传新的 AAB
# 5. 填写更新说明
# 6. 提交审核
```

---

## 🐛 常见问题解决

### 问题 1：找不到 Android SDK

**错误信息：**
```
ANDROID_HOME is not set and no 'local.properties' file was found
```

**解决方法：**
```bash
# 设置环境变量
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
# 或
setx ANDROID_HOME "C:\Users\你的用户名\AppData\Local\Android\Sdk"  # Windows

# 验证
echo $ANDROID_HOME
```

---

### 问题 2：Gradle 构建失败

**错误信息：**
```
Could not resolve all dependencies
```

**解决方法：**
```bash
# 清理 Gradle 缓存
cd android
./gradlew clean

# 重新同步
npx cap sync android

# 重新构建
./gradlew assembleRelease
```

---

### 问题 3：应用安装后闪退

**可能原因：**
1. `server` 配置未注释（指向不存在的开发服务器）
2. 缺少必要的权限声明
3. ProGuard 混淆导致代码错误

**解决方法：**

1. **检查 capacitor.config.ts：**
```typescript
// 确保 server 配置已注释
// server: {
//   url: 'https://...',
//   cleartext: true
// },
```

2. **查看崩溃日志：**
```bash
adb logcat | grep -i "AndroidRuntime"
```

3. **禁用 ProGuard（测试用）：**

编辑 `android/app/build.gradle`：
```gradle
buildTypes {
    release {
        minifyEnabled false  // 改为 false
    }
}
```

---

### 问题 4：签名密钥丢失

**问题：** 无法找到之前的 `release.keystore` 文件

**后果：** 
- ❌ 无法发布应用更新到 Google Play
- ❌ 只能以新应用重新发布（失去所有用户）

**预防措施：**
1. ✅ 将 `release.keystore` 备份到安全位置（云存储、U盘）
2. ✅ 将密码记录在密码管理器中
3. ✅ 使用 Google Play App Signing（推荐）

**使用 Google Play App Signing：**
1. 在 Play Console → 应用完整性 → 启用 App Signing
2. Google 会管理你的签名密钥
3. 即使本地密钥丢失也能继续更新应用

---

### 问题 5：构建速度慢

**优化方法：**

1. **启用 Gradle 守护进程：**

编辑 `android/gradle.properties`：
```properties
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.configureondemand=true
org.gradle.jvmargs=-Xmx4096m
```

2. **使用本地 Maven 缓存：**
```bash
# 清理无用缓存
./gradlew clean cleanBuildCache
```

3. **升级 Gradle 版本：**

编辑 `android/gradle/wrapper/gradle-wrapper.properties`：
```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.5-all.zip
```

---

### 问题 6：Google Play 审核被拒

**常见拒绝原因：**

1. **缺少隐私政策**
   - 解决：在 Play Console 中添加隐私政策链接（如 `https://你的域名/privacy-policy`）

2. **目标 API 等级过低**
   - 解决：在 `build.gradle` 中更新 `targetSdkVersion` 至 33 或更高

3. **缺少必要的应用功能**
   - 解决：确保应用完整可用，所有核心功能都能正常工作

4. **权限使用不当**
   - 解决：在 `AndroidManifest.xml` 中正确声明权限，并在应用中说明权限用途

---

### 问题 7：版本号冲突

**错误信息：**
```
Version code XXX has already been used
```

**解决方法：**
```gradle
// 编辑 android/app/build.gradle
defaultConfig {
    versionCode 3  // 必须大于之前上传的所有版本
    versionName "1.0.2"
}
```

---

## 📚 参考资源

- **Capacitor 官方文档：** https://capacitorjs.com/docs
- **Android 开发者文档：** https://developer.android.com
- **Google Play Console：** https://play.google.com/console
- **Gradle 构建工具：** https://gradle.org/

---

## 📞 技术支持

遇到问题时，请按以下顺序排查：

1. ✅ 查看本文档的 [常见问题解决](#常见问题解决)
2. ✅ 查看 Android Studio 的 Build 输出和 Logcat
3. ✅ 搜索 Capacitor 官方文档
4. ✅ 在 Stack Overflow 搜索错误信息

---

## 🎯 快速检查清单

**发布生产版本前：**

- [ ] `capacitor.config.ts` 中 `server` 配置已注释
- [ ] 运行 `npm run build` 构建最新 Web 资源
- [ ] 运行 `npx cap sync android` 同步资源
- [ ] 更新 `versionCode` 和 `versionName`
- [ ] 使用 release 密钥签名
- [ ] 在真机上测试安装和运行
- [ ] 检查应用图标和启动画面显示正常
- [ ] 检查所有核心功能正常工作

**发布到 Google Play 前：**

- [ ] 准备好所有必需的图片和截图
- [ ] 撰写清晰的应用描述
- [ ] 提供隐私政策链接
- [ ] 完成内容分级
- [ ] 设置定价和分发区域
- [ ] 上传 AAB 文件（不是 APK）
- [ ] 填写版本说明

---

**最后更新：** 2024-12-02  
**版本：** 1.0.0  
**适用于：** Alo生态 Android 应用

---

## 💡 提示和最佳实践

1. **始终保留签名密钥备份** - 这是最重要的！
2. **每次发布前在真机测试** - 模拟器可能隐藏某些问题
3. **使用 AAB 而不是 APK** - Google Play 要求，且应用体积更小
4. **启用 Google Play App Signing** - 防止密钥丢失的最佳保险
5. **记录每个版本的更新日志** - 方便回溯和问题定位
6. **分阶段发布新版本** - 先发布给小部分用户，确认无问题后再全量发布

---

祝你发布顺利！🚀