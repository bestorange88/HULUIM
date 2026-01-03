import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, MessageSquare, Shield, Zap, Users, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AboutUs() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-14 border-b border-border bg-card flex items-center px-4 shadow-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="ml-3 text-lg font-semibold">关于讯达</h1>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* 应用介绍 */}
          <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">讯达</h2>
                <p className="text-sm text-muted-foreground">连接每一个人，让沟通更简单</p>
              </div>
            </div>
            
            <p className="text-muted-foreground leading-relaxed">
              我们致力于打造一款安全、高效、功能丰富的即时通讯应用。通过先进的技术和人性化的设计，为用户提供最佳的沟通体验。无论是日常聊天、工作协作还是社交互动，我们都希望成为您最信赖的沟通工具。
            </p>
          </div>

          {/* 核心功能 */}
          <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">核心功能</h3>
            
            <div className="grid gap-4">
              <div className="flex gap-3 p-3 rounded-lg bg-accent/5">
                <MessageSquare className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">即时通讯</h4>
                  <p className="text-sm text-muted-foreground">支持文字、图片、语音、文件等多种消息类型，让沟通更丰富</p>
                </div>
              </div>

              <div className="flex gap-3 p-3 rounded-lg bg-accent/5">
                <Users className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">群组管理</h4>
                  <p className="text-sm text-muted-foreground">创建和管理群组，支持大规模群聊，方便团队协作</p>
                </div>
              </div>

              <div className="flex gap-3 p-3 rounded-lg bg-accent/5">
                <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">数字钱包</h4>
                  <p className="text-sm text-muted-foreground">安全便捷的转账和红包功能，让资金往来更轻松</p>
                </div>
              </div>

              <div className="flex gap-3 p-3 rounded-lg bg-accent/5">
                <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">隐私保护</h4>
                  <p className="text-sm text-muted-foreground">端到端加密技术，保护您的聊天内容和个人信息</p>
                </div>
              </div>

              <div className="flex gap-3 p-3 rounded-lg bg-accent/5">
                <Heart className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">AI助手</h4>
                  <p className="text-sm text-muted-foreground">智能AI助手随时为您服务，解答疑问，提供帮助</p>
                </div>
              </div>
            </div>
          </div>

          {/* 我们的使命 */}
          <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">我们的使命</h3>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                <strong className="text-foreground">连接世界：</strong>
                我们相信技术能够拉近人与人之间的距离。通过我们的应用，无论身在何处，您都可以与亲朋好友保持紧密联系。
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">保护隐私：</strong>
                在数字时代，隐私保护至关重要。我们采用最先进的加密技术，确保您的对话和数据安全。
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">持续创新：</strong>
                我们不断探索新技术、新功能，为用户提供更好的体验。您的反馈是我们前进的动力。
              </p>
            </div>
          </div>

          {/* 应用信息 */}
          <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">应用信息</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">应用版本</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">发布日期</span>
                <span className="font-medium">{new Date().toLocaleDateString('zh-CN')}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">支持平台</span>
                <span className="font-medium">iOS / Android / Web</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">开发团队</span>
                <span className="font-medium">福建益品康丰集团有限公司</span>
              </div>
            </div>
          </div>

          {/* 联系方式 */}
          <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">联系我们</h3>
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">客服邮箱</p>
                <p className="font-medium">ypkfjt001@gmail.com</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">商务合作</p>
                <p className="font-medium">ypkfjt001@gmail.com</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">公司地址</p>
                <p className="font-medium">中国（福建）自由贸易试验区厦门片区 361000</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">客服热线</p>
                <p className="font-medium">4001013230</p>
              </div>
            </div>
          </div>

          {/* 相关链接 */}
          <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">法律条款</h3>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/privacy-policy')}
                className="justify-start"
              >
                隐私政策
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/terms-of-service')}
                className="justify-start"
              >
                用户协议
              </Button>
            </div>
          </div>

          {/* 致谢 */}
          <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">特别致谢</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              感谢所有用户的支持和信任！您的使用和反馈是我们持续改进的动力。我们会继续努力，为您提供更好的服务。
            </p>
          </div>

          <div className="text-center text-sm text-muted-foreground py-4">
            <p>Copyright 2024© 福建益品康丰集团有限公司 版权所有</p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
