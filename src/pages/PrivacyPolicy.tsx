import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function PrivacyPolicy() {
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
        <h1 className="ml-3 text-lg font-semibold">隐私政策</h1>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
            <h2 className="text-xl font-bold text-primary">隐私政策</h2>
            <p className="text-sm text-muted-foreground">最后更新日期：{new Date().toLocaleDateString('zh-CN')}</p>
            
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold text-base mb-2">1. 引言</h3>
                <p className="text-muted-foreground leading-relaxed">
                  欢迎使用我们的应用。我们非常重视您的隐私保护。本隐私政策说明了我们如何收集、使用、存储和保护您的个人信息。使用本应用即表示您同意本隐私政策的条款。
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">2. 我们收集的信息</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p className="font-medium">2.1 账户信息</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>注册信息：用户名、显示名称、电子邮件地址</li>
                    <li>个人资料：头像、个性签名、状态信息</li>
                  </ul>
                  
                  <p className="font-medium mt-3">2.2 使用信息</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>聊天消息内容（文本、图片、语音、文件）</li>
                    <li>好友关系和群组成员信息</li>
                    <li>钱包余额、交易记录（红包、转账）</li>
                    <li>设备信息和日志数据</li>
                  </ul>

                  <p className="font-medium mt-3">2.3 自动收集的信息</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>IP地址、设备类型、操作系统版本</li>
                    <li>应用使用统计数据</li>
                    <li>错误日志和崩溃报告</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">3. 信息使用方式</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p>我们收集的信息用于：</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>提供和改进应用服务</li>
                    <li>处理您的交易和支付</li>
                    <li>向您发送服务通知和更新</li>
                    <li>保护账户安全，防止欺诈</li>
                    <li>个性化用户体验</li>
                    <li>遵守法律法规要求</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">4. 信息共享</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p>我们不会出售您的个人信息。在以下情况下可能共享您的信息：</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>经您明确同意</li>
                    <li>与服务提供商共享（如云存储、支付处理）</li>
                    <li>遵守法律要求或法律程序</li>
                    <li>保护用户和公众的权利、财产或安全</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">5. 数据安全</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p>我们采取以下措施保护您的数据：</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>数据传输加密（HTTPS/SSL）</li>
                    <li>密码加密存储</li>
                    <li>定期安全审计和漏洞扫描</li>
                    <li>访问控制和权限管理</li>
                    <li>数据备份和灾难恢复机制</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">6. 数据保留</h3>
                <p className="text-muted-foreground leading-relaxed">
                  我们仅在必要时保留您的个人信息。当您删除账户时，我们将在30天内删除您的个人数据，但法律要求保留的信息除外（如交易记录可能需要保留至少5年）。
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">7. 您的权利</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p>您有权：</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>访问和更新您的个人信息</li>
                    <li>删除您的账户和数据</li>
                    <li>导出您的数据</li>
                    <li>撤回同意</li>
                    <li>对我们的数据处理提出投诉</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">8. 儿童隐私</h3>
                <p className="text-muted-foreground leading-relaxed">
                  本应用不面向13岁以下儿童。如果我们发现收集了13岁以下儿童的信息，我们将立即删除这些信息。
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">9. Cookie和追踪技术</h3>
                <p className="text-muted-foreground leading-relaxed">
                  我们使用Cookie和类似技术来改善用户体验、分析使用情况。您可以通过浏览器设置管理Cookie偏好。
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">10. 国际数据传输</h3>
                <p className="text-muted-foreground leading-relaxed">
                  您的信息可能会被传输到您所在国家/地区以外的地方进行处理。我们将采取适当措施确保数据安全。
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">11. 隐私政策更新</h3>
                <p className="text-muted-foreground leading-relaxed">
                  我们可能会不时更新本隐私政策。重大变更时，我们将通过应用内通知或电子邮件通知您。继续使用应用即表示您接受更新后的政策。
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">12. 联系我们</h3>
                <div className="text-muted-foreground space-y-2">
                  <p>如有任何隐私相关问题或疑虑，请联系我们：</p>
                  <ul className="list-none space-y-1">
                    <li>邮箱：ypkfjt001@gmail.com</li>
                    <li>地址：中国（福建）自由贸易试验区厦门片区 361000</li>
                    <li>客服热线：4001013230</li>
                  </ul>
                </div>
              </section>

              <section className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground italic">
                  本隐私政策符合《通用数据保护条例》(GDPR)、《加州消费者隐私法案》(CCPA)以及其他适用的隐私法规。
                </p>
              </section>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
