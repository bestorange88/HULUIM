# AI 服务迁移指南

## 📋 概述

为了提升系统性能和扩展性，我们创建了统一的 AI 服务 Edge Function (`ai-service-unified`)，整合了所有 AI 相关功能。

## 🎯 迁移目标

将以下独立的 Edge Functions 整合到统一服务：
- ❌ `ai-chat` → ✅ `ai-service-unified` (action: 'chat')
- ❌ `translate-message` → ✅ `ai-service-unified` (action: 'translate')
- ❌ `transcribe-audio` → ✅ `ai-service-unified` (action: 'transcribe')

## 🔄 迁移步骤

### 1. 新的调用方式

#### AI 对话
```typescript
// ❌ 旧方式
const { data } = await supabase.functions.invoke('ai-chat', {
  body: { message: '你好' }
});

// ✅ 新方式
const { data } = await supabase.functions.invoke('ai-service-unified', {
  body: { 
    action: 'chat',
    params: { 
      message: '你好',
      conversationHistory: [] // 可选
    }
  }
});
```

#### 消息翻译
```typescript
// ❌ 旧方式
const { data } = await supabase.functions.invoke('translate-message', {
  body: { content: 'Hello', targetLang: 'zh' }
});

// ✅ 新方式
const { data } = await supabase.functions.invoke('ai-service-unified', {
  body: { 
    action: 'translate',
    params: { 
      text: 'Hello',
      targetLang: 'zh',
      sourceLang: 'auto' // 可选
    }
  }
});
```

#### 语音转文字
```typescript
// ❌ 旧方式
const { data } = await supabase.functions.invoke('transcribe-audio', {
  body: { audioData: base64Audio }
});

// ✅ 新方式
const { data } = await supabase.functions.invoke('ai-service-unified', {
  body: { 
    action: 'transcribe',
    params: { 
      audioData: base64Audio,
      format: 'webm' // 可选
    }
  }
});
```

### 2. 响应格式

所有操作都返回统一格式：

```typescript
{
  success: boolean;
  // 成功时的字段（根据 action 不同）
  response?: string;      // chat
  translatedText?: string; // translate
  text?: string;          // transcribe
  // 失败时的字段
  error?: string;
}
```

### 3. 需要修改的文件

#### 文件列表（按优先级）

1. **AI 对话相关**
   - `src/components/chat/ChatArea.tsx` (发送消息给 AI 助手)
   - 搜索 `ai-chat` 并替换调用方式

2. **翻译功能相关**
   - `src/components/chat/MessageActions.tsx` (消息翻译按钮)
   - 搜索 `translate-message` 并替换调用方式

3. **语音转文字相关**
   - `src/components/chat/VoiceRecorder.tsx` (发送语音后转文字)
   - `src/components/chat/MessageActions.tsx` (历史语音转文字)
   - 搜索 `transcribe-audio` 并替换调用方式

### 4. 代码示例

#### 修改 AI 对话
```typescript
// 在 ChatArea.tsx 中
const sendAIMessage = async (message: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('ai-service-unified', {
      body: { 
        action: 'chat',
        params: { 
          message,
          conversationHistory: previousMessages // 如果需要上下文
        }
      }
    });

    if (error) throw error;
    
    if (data.success) {
      // 使用 data.response
      console.log('AI回复:', data.response);
    } else {
      console.error('AI错误:', data.error);
    }
  } catch (error) {
    console.error('调用失败:', error);
  }
};
```

#### 修改翻译功能
```typescript
// 在 MessageActions.tsx 中
const translateMessage = async (text: string, targetLang: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('ai-service-unified', {
      body: { 
        action: 'translate',
        params: { 
          text,
          targetLang
        }
      }
    });

    if (error) throw error;
    
    if (data.success) {
      return data.translatedText;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('翻译失败:', error);
    return text; // 失败时返回原文
  }
};
```

### 5. 测试清单

- [ ] AI 对话功能正常
- [ ] 消息翻译功能正常（中→英、英→中）
- [ ] 语音转文字功能正常（发送时）
- [ ] 历史语音消息转文字功能正常
- [ ] 错误处理正常（显示友好错误信息）
- [ ] 性能测试（响应时间 < 3秒）

### 6. 回滚计划

如果迁移后出现问题，可以快速回滚：

1. 在 `supabase/config.toml` 中保留旧的 Edge Functions 配置
2. 修改代码调用回旧的函数名
3. 重新部署

## 📊 迁移收益

### 性能提升
- ✅ 减少 Edge Function 冷启动次数（3个→1个）
- ✅ 减少网络往返次数（统一接口）
- ✅ 更好的资源隔离（不影响实时消息）

### 维护性提升
- ✅ 统一的错误处理
- ✅ 统一的日志记录
- ✅ 更容易监控和调试

### 成本优化
- ✅ 减少 Edge Function 实例数量
- ✅ 更高效的资源利用

## 🚀 迁移时间表

- **第1天：** 部署 `ai-service-unified` Edge Function（已完成✅）
- **第2-3天：** 修改前端代码调用新接口
- **第4天：** 测试所有 AI 功能
- **第5天：** 生产环境发布
- **第6-7天：** 监控稳定性，确认无问题
- **第8天：** 删除旧的 Edge Functions（可选）

## 💡 注意事项

1. **向后兼容**：建议保留旧的 Edge Functions 1-2周，确保迁移顺利
2. **错误处理**：新接口都返回 `success` 字段，务必检查
3. **超时设置**：AI 服务调用可能需要 2-5秒，设置合理的超时时间
4. **用户体验**：添加加载状态和友好的错误提示

## 📞 需要帮助？

如遇到问题，请：
1. 检查 Edge Function 日志
2. 确认 `LOVABLE_API_KEY` 已正确配置
3. 查看 `UPGRADE_GUIDE.md` 了解整体架构

---

**最后更新：** 2024-12-01
**状态：** 待迁移
