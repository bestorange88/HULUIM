-- Create articles table for managing page content
CREATE TABLE public.articles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Everyone can read articles
CREATE POLICY "Anyone can read articles"
ON public.articles
FOR SELECT
USING (true);

-- Admins can manage articles (using service role)
CREATE POLICY "Service role can manage articles"
ON public.articles
FOR ALL
USING (true)
WITH CHECK (true);

-- Insert default articles
INSERT INTO public.articles (slug, title, content) VALUES
('help-feedback', '帮助与反馈', '## 常见问题

### 如何添加好友？
在联系人页面点击搜索按钮，输入用户名即可搜索并添加好友。

### 如何创建群聊？
在对话页面点击右上角的加号按钮，选择要加入群聊的好友即可创建群聊。

### 如何充值？
进入钱包页面，点击充值按钮，按照提示完成 USDT 充值。

## 联系我们
如有其他问题，请通过以下方式联系我们：
- 邮箱：client@trustfar.cn
- 电话：010-82629666'),

('about-us', '关于我们', '# 睿信

睿信是一款安全、便捷的即时通讯应用，致力于为用户提供优质的社交体验。

## 公司信息
**北京银信长远科技股份有限公司**

地址：北京市朝阳区安定路35号安华发展大厦8层

联系电话：010-82629666

邮箱：client@trustfar.cn

## 版权信息
Copyright 2024© 银信科技 版权所有

京ICP备14042572号-1'),

('privacy-policy', '隐私政策', '# 隐私政策

最后更新日期：2024年1月

## 信息收集
我们收集您提供的信息，包括但不限于：
- 注册信息（用户名、邮箱、手机号）
- 个人资料信息
- 通讯内容

## 信息使用
我们使用收集的信息用于：
- 提供和改进服务
- 发送服务通知
- 保障账户安全

## 信息保护
我们采取适当的安全措施保护您的个人信息，防止未经授权的访问、使用或泄露。

## 联系我们
如有任何隐私相关问题，请联系：
- 邮箱：client@trustfar.cn
- 电话：010-82629666'),

('terms-of-service', '用户协议', '# 用户协议

欢迎使用睿信！

## 服务条款
使用本应用即表示您同意遵守以下条款：

1. **账户责任**：您对您账户下的所有活动负责
2. **禁止行为**：禁止发布违法、有害或侵权内容
3. **隐私保护**：我们重视您的隐私，详见隐私政策

## 免责声明
本应用按"现状"提供服务，不作任何明示或暗示的保证。

## 争议解决
如发生争议，双方应友好协商解决。

## 联系方式
北京银信长远科技股份有限公司
地址：北京市朝阳区安定路35号安华发展大厦8层
电话：010-82629666
邮箱：client@trustfar.cn

Copyright 2024© 银信科技 版权所有
京ICP备14042572号-1');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.articles;