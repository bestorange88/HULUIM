# Android APK 打包完整流程

## 前提条件
- 已安装 Node.js
- 已安装 JDK 17
- 已安装 Android Studio
- 已配置 ANDROID_HOME 环境变量

---

## 第一步：项目准备

```bash
# 1. 进入项目目录
cd C:\Users\CF\Desktop\glide-com-main (3)\glide-com

# 2. 安装依赖（如果还没安装）
npm install

# 3. 添加 Android 平台（首次需要）
npx cap add android

# 4. 构建 Web 资源
npm run build

# 5. 同步到 Android
npx cap sync android
```

---

## 第二步：生成签名密钥（首次打包时执行一次）

```bash
# 确保在项目根目录下
cd C:\Users\CF\Desktop\glide-com-main (3)\glide-com

# 生成签名密钥
keytool -genkey -v -keystore ./android/app/release.keystore -alias alo-release -keyalg RSA -keysize 2048 -validity 10000
```

### 填写信息（使用以下信息）：
```
输入密钥库口令: Aa112211
再次输入新口令: Aa112211
您的名字与姓氏是什么？[Unknown]: Alo
您的组织单位名称是什么？[Unknown]: Tech
您的组织名称是什么？[Unknown]: Alo
您所在的城市或区域名称是什么？[Unknown]: Beijing
您所在的省/市/自治区名称是什么？[Unknown]: Beijing
该单位的双字母国家/地区代码是什么？[Unknown]: CN
CN=Alo, OU=Tech, O=Alo, L=Beijing, ST=Beijing, C=CN是否正确？[否]: y

输入 <alo-release> 的密钥口令 (如果和密钥库口令相同, 按回车): [直接按回车]
```

---

## 第三步：配置签名文件

### 3.1 创建 key.properties 文件

在 `android` 目录下创建 `key.properties` 文件：

```bash
# Windows PowerShell
cd android
New-Item -Path . -Name "key.properties" -ItemType "file"
```

### 3.2 编辑 key.properties 内容

打开 `android/key.properties` 文件，填入以下内容：

```properties
storePassword=Aa112211
keyPassword=Aa112211
keyAlias=alo-release
storeFile=release.keystore
```

---

## 第四步：配置 build.gradle

编辑 `android/app/build.gradle` 文件：

### 4.1 在文件顶部（android { 之前）添加：

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

### 4.2 在 android { 块内添加 signingConfigs：

```gradle
android {
    namespace "app.lovable.a50db10995f34b9b99cf1b4d82615234"
    compileSdkVersion rootProject.ext.compileSdkVersion
    
    // 添加签名配置
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    
    defaultConfig {
        // ... 保持原有配置
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release  // 添加这行
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## 第五步：修改版本号

编辑 `android/app/build.gradle`，找到 `defaultConfig` 部分：

```gradle
defaultConfig {
    applicationId "app.lovable.a50db10995f34b9b99cf1b4d82615234"
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion rootProject.ext.targetSdkVersion
    versionCode 2              // 每次打包递增（1, 2, 3, 4...）
    versionName "1.0.1"        // 版本名称（1.0.0, 1.0.1, 1.1.0...）
}
```

---

## 第六步：禁用开发模式

编辑 `capacitor.config.ts`，注释掉 server 配置：

```typescript
const config: CapacitorConfig = {
  appId: 'app.lovable.a50db10995f34b9b99cf1b4d82615234',
  appName: 'Alo生态',
  webDir: 'dist',
  // 注释掉以下内容
  // server: {
  //   url: 'https://a50db109-95f3-4b9b-99cf-1b4d82615234.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};
```

---

## 第七步：构建 APK

```bash
# 1. 进入 android 目录
cd android

# 2. 清理之前的构建
gradlew clean

# 3. 构建 Release APK
gradlew assembleRelease

# 或者构建 AAB（Google Play 需要）
gradlew bundleRelease
```

---

## 第八步：找到生成的 APK

构建完成后，APK 文件位于：

```
android/app/build/outputs/apk/release/app-release.apk
```

AAB 文件位于：

```
android/app/build/outputs/bundle/release/app-release.aab
```

---

## 第九步：安装测试

```bash
# 连接手机或启动模拟器后
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## 重要提示

### ⚠️ 密钥文件备份
**请务必备份以下文件，丢失将无法更新应用！**

1. `android/app/release.keystore`
2. `android/key.properties`
3. 密码：`Aa112211`

### 📝 版本号规则

- **versionCode**：每次打包必须递增（整数）
  - 第1次打包：1
  - 第2次打包：2
  - 第3次打包：3
  - ...

- **versionName**：给用户看的版本号（字符串）
  - 初始版本：1.0.0
  - 小更新：1.0.1, 1.0.2
  - 功能更新：1.1.0, 1.2.0
  - 大版本：2.0.0

### 🔒 安全注意事项

将以下文件添加到 `.gitignore`：

```
android/app/release.keystore
android/key.properties
```

---

## 完整命令速查（后续打包）

```bash
# 1. 更新代码
git pull

# 2. 安装依赖
npm install

# 3. 构建 Web
npm run build

# 4. 同步到 Android
npx cap sync android

# 5. 修改版本号（编辑 android/app/build.gradle）
# versionCode +1
# versionName 更新

# 6. 注释 capacitor.config.ts 中的 server 配置

# 7. 构建 APK
cd android
gradlew clean
gradlew assembleRelease

# 8. APK 位置
# android/app/build/outputs/apk/release/app-release.apk
```

---

## 故障排查

### 问题1：找不到 gradlew 命令
```bash
# Windows 使用
.\gradlew.bat clean
.\gradlew.bat assembleRelease
```

### 问题2：签名失败
检查 `android/key.properties` 文件内容是否正确。

### 问题3：构建失败
```bash
# 清理后重试
cd android
gradlew clean
gradlew assembleRelease
```

### 问题4：Android SDK 未找到
确保已设置 `ANDROID_HOME` 环境变量指向 Android SDK 目录。

---

## 发布到应用商店

### Google Play（必需 AAB 格式）
```bash
cd android
gradlew bundleRelease
```

上传 `android/app/build/outputs/bundle/release/app-release.aab`

### 其他应用商店（可用 APK）
直接使用 `android/app/build/outputs/apk/release/app-release.apk`
