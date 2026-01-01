# Android WebRTC 权限配置指南

## 问题说明

在打包APK后，语音和视频通话功能提示"通话初始化失败"，通常是因为Android原生应用需要在 `AndroidManifest.xml` 中声明必要的权限。

## 解决方案

### 1. 添加必要权限

在 `android/app/src/main/AndroidManifest.xml` 文件中的 `<manifest>` 标签内添加以下权限声明：

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- 音视频通话必需权限 -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    
    <!-- 网络权限 (WebRTC需要) -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <!-- 可选：蓝牙耳机支持 -->
    <uses-permission android:name="android.permission.BLUETOOTH" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    
    <!-- 硬件特性声明 -->
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
    
    <application ...>
        ...
    </application>
</manifest>
```

### 2. 配置 WebView 允许 getUserMedia

在 `android/app/src/main/java/.../MainActivity.java` 中，确保 WebView 配置正确：

```java
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;

// 在 onCreate 或 WebView 配置中添加
webView.setWebChromeClient(new WebChromeClient() {
    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        runOnUiThread(() -> {
            request.grant(request.getResources());
        });
    }
});
```

### 3. 运行时权限请求

对于 Android 6.0 (API 23) 及以上版本，还需要在运行时请求权限。Capacitor 通常会自动处理这一点，但如果遇到问题，可以在首次使用通话功能前手动请求权限。

### 4. 重新构建 APK

配置完成后，运行以下命令重新构建：

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

## 常见错误及解决

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| NotAllowedError | 权限被拒绝 | 检查系统设置中的应用权限 |
| NotFoundError | 设备不存在 | 确认设备有摄像头/麦克风 |
| NotReadableError | 设备被占用 | 关闭其他使用摄像头的应用 |
| OverconstrainedError | 不支持的格式 | 代码已自动降级处理 |

## 测试步骤

1. 安装APK后首次打开应用
2. 进入任意聊天对话
3. 点击语音或视频通话按钮
4. 系统应弹出权限请求对话框
5. 允许摄像头和麦克风权限
6. 通话应正常初始化

## 注意事项

- 确保在发布版本中也包含了所有必要权限
- 某些设备（如OPPO）可能需要在系统设置中手动开启权限
- 如果使用 ProGuard，确保不要混淆 WebRTC 相关类
