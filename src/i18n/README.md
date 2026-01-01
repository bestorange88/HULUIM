# 国际化 (i18n) 使用指南

本项目使用 `react-i18next` 实现国际化多语言支持。

## 已支持的语言

- 简体中文 (zh)
- English (en)

## 如何使用翻译

### 在React组件中使用

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('common.confirm')}</h1>
      <p>{t('auth.login')}</p>
    </div>
  );
}
```

### 切换语言

```tsx
import { useTranslation } from 'react-i18next';

function LanguageSelector() {
  const { i18n } = useTranslation();
  
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };
  
  return (
    <button onClick={() => changeLanguage('en')}>
      Switch to English
    </button>
  );
}
```

### 获取当前语言

```tsx
const { i18n } = useTranslation();
const currentLanguage = i18n.language; // 'zh' or 'en'
```

## 添加新的翻译

### 1. 编辑翻译文件

在 `src/i18n/locales/zh.json` 和 `src/i18n/locales/en.json` 中添加新的键值对：

```json
{
  "newFeature": {
    "title": "新功能标题",
    "description": "新功能描述"
  }
}
```

### 2. 在组件中使用

```tsx
const { t } = useTranslation();
console.log(t('newFeature.title'));
```

## 翻译文件结构

```
src/i18n/
├── index.ts              # i18n 配置
├── locales/
│   ├── zh.json          # 中文翻译
│   └── en.json          # 英文翻译
└── README.md            # 使用文档
```

## 翻译键命名规范

- 使用小驼峰命名：`myTranslationKey`
- 使用点号分隔命名空间：`namespace.key`
- 保持层级清晰：`common.button.save`

### 推荐的命名空间

- `common`: 通用文本（按钮、标签等）
- `nav`: 导航相关
- `auth`: 认证相关
- `chat`: 聊天相关
- `wallet`: 钱包相关
- `contacts`: 联系人相关
- `profile`: 个人资料相关
- `settings`: 设置相关

## 已实现的页面

以下页面已实现国际化：

- ✅ 通用设置 (GeneralSettings)
- ✅ 个人资料 (Profile)
- ✅ 钱包 (Wallet - 部分)
- ✅ 对话列表 (Conversations - 部分)

## 待实现的页面

以下页面需要添加国际化支持：

- ⏳ 联系人 (Contacts)
- ⏳ 群组 (Groups)
- ⏳ 聊天详情 (ChatDetail)
- ⏳ 个人信息 (PersonalInfo)
- ⏳ 通知设置 (NotificationSettings)
- ⏳ 隐私与安全 (PrivacySecurity)
- ⏳ 帮助与反馈 (HelpFeedback)

## 注意事项

1. **避免硬编码文本**：所有用户可见的文本都应使用翻译函数
2. **保持翻译文件同步**：添加新键时，确保在所有语言文件中都有对应翻译
3. **使用插值**：需要动态内容时，使用插值功能

```tsx
// 插值示例
t('welcome.message', { name: userName })

// 翻译文件
{
  "welcome": {
    "message": "欢迎，{{name}}！"
  }
}
```

4. **复数形式**：react-i18next 支持复数形式处理

```json
{
  "items": "{{count}} 个项目",
  "items_plural": "{{count}} 个项目"
}
```

## 语言切换组件

项目提供了一个即用的语言切换组件：

```tsx
import LanguageSwitcher from '@/components/LanguageSwitcher';

function MyComponent() {
  return (
    <div>
      <LanguageSwitcher />
    </div>
  );
}
```

## 调试

如果翻译未生效：

1. 检查翻译键是否正确
2. 确认翻译文件中存在该键
3. 检查浏览器控制台是否有错误
4. 确认 i18n 已正确初始化（在 main.tsx 中）
