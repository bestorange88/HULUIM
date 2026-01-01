# 原生音频路由切换指南

## 问题说明

移动浏览器不支持通过 Web API 直接控制听筒/扬声器切换。要实现真正的音频路由控制，需要在原生 App 中添加 Capacitor 插件。

## 解决方案

### Android 原生实现

在 `android/app/src/main/java/` 目录下创建自定义 Capacitor 插件：

#### 1. 创建插件文件

`android/app/src/main/java/app/lovable/plugins/AudioTogglePlugin.java`:

```java
package app.lovable.plugins;

import android.content.Context;
import android.media.AudioManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AudioToggle")
public class AudioTogglePlugin extends Plugin {
    
    @PluginMethod
    public void setAudioMode(PluginCall call) {
        String mode = call.getString("mode", "speaker");
        
        AudioManager audioManager = (AudioManager) getContext()
            .getSystemService(Context.AUDIO_SERVICE);
        
        if (audioManager == null) {
            call.reject("AudioManager not available");
            return;
        }
        
        try {
            if ("speaker".equals(mode)) {
                // 切换到扬声器
                audioManager.setMode(AudioManager.MODE_NORMAL);
                audioManager.setSpeakerphoneOn(true);
            } else if ("earpiece".equals(mode)) {
                // 切换到听筒
                audioManager.setSpeakerphoneOn(false);
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            }
            
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to set audio mode: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void getAudioMode(PluginCall call) {
        AudioManager audioManager = (AudioManager) getContext()
            .getSystemService(Context.AUDIO_SERVICE);
        
        if (audioManager == null) {
            call.reject("AudioManager not available");
            return;
        }
        
        String mode = audioManager.isSpeakerphoneOn() ? "speaker" : "earpiece";
        call.resolve(new com.getcapacitor.JSObject().put("mode", mode));
    }
}
```

#### 2. 注册插件

在 `android/app/src/main/java/app/lovable/.../MainActivity.java` 中注册插件：

```java
import app.lovable.plugins.AudioTogglePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 注册自定义插件
        this.registerPlugin(AudioTogglePlugin.class);
    }
}
```

#### 3. 添加权限

在 `android/app/src/main/AndroidManifest.xml` 中添加：

```xml
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
```

### iOS 原生实现

#### 1. 创建插件文件

`ios/App/App/Plugins/AudioTogglePlugin.swift`:

```swift
import Foundation
import Capacitor
import AVFoundation

@objc(AudioTogglePlugin)
public class AudioTogglePlugin: CAPPlugin {
    
    @objc func setAudioMode(_ call: CAPPluginCall) {
        guard let mode = call.getString("mode") else {
            call.reject("Mode is required")
            return
        }
        
        let audioSession = AVAudioSession.sharedInstance()
        
        do {
            try audioSession.setCategory(.playAndRecord, options: [.allowBluetooth])
            
            if mode == "speaker" {
                try audioSession.overrideOutputAudioPort(.speaker)
            } else {
                try audioSession.overrideOutputAudioPort(.none)
            }
            
            try audioSession.setActive(true)
            call.resolve()
        } catch {
            call.reject("Failed to set audio mode: \(error.localizedDescription)")
        }
    }
    
    @objc func getAudioMode(_ call: CAPPluginCall) {
        let audioSession = AVAudioSession.sharedInstance()
        let currentRoute = audioSession.currentRoute
        
        var mode = "earpiece"
        for output in currentRoute.outputs {
            if output.portType == .builtInSpeaker {
                mode = "speaker"
                break
            }
        }
        
        call.resolve(["mode": mode])
    }
}
```

#### 2. 注册插件

在 `ios/App/App/AppDelegate.swift` 或通过 Capacitor 的插件注册机制注册。

创建 `ios/App/App/Plugins/AudioTogglePlugin.m`:

```objc
#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(AudioTogglePlugin, "AudioToggle",
    CAP_PLUGIN_METHOD(setAudioMode, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getAudioMode, CAPPluginReturnPromise);
)
```

## 前端使用

插件注册后，前端代码 `src/utils/audioRouting.ts` 会自动检测并使用原生插件：

```typescript
// 自动检测并使用
const AudioToggle = (window as any).Capacitor?.Plugins?.AudioToggle;
if (AudioToggle) {
  await AudioToggle.setAudioMode({ mode: 'speaker' }); // 或 'earpiece'
}
```

## 测试步骤

1. 完成上述原生代码添加后，运行：
   ```bash
   npx cap sync
   ```

2. 重新构建并运行 App：
   ```bash
   npx cap run android  # 或 ios
   ```

3. 在通话界面点击听筒/扬声器切换按钮，应该能看到：
   - Toast 提示 "已切换到扬声器" 或 "已切换到听筒"
   - 实际的音频输出设备切换

## 注意事项

- Web 版本（浏览器访问）无法实现真正的听筒切换，这是浏览器的限制
- 只有打包为原生 App 后，添加原生插件代码才能实现完整功能
- 某些设备可能需要额外的权限配置
