import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function TermsOfService() {
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
        <h1 className="ml-3 text-lg font-semibold">用户协议</h1>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
            <h2 className="text-xl font-bold text-primary">用户服务协议</h2>
            <p className="text-sm text-muted-foreground">生效日期：{new Date().toLocaleDateString('zh-CN')}</p>
            
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold text-base mb-2">1. 协议接受</h3>
                <p className="text-muted-foreground leading-relaxed">
                  欢迎使用本应用。通过注册、访问或使用本应用，您同意受本服务协议（"协议"）的约束。如果您不同意本协议，请勿使用本应用。
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">2. 服务说明</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p>本应用提供以下服务：</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>即时通讯服务（文本、图片、语音、文件传输）</li>
                    <li>好友和群组管理</li>
                    <li>数字钱包服务（红包、转账）</li>
                    <li>AI助手对话服务</li>
                    <li>客户服务支持</li>
                  </ul>
                  <p className="mt-2">我们保留随时修改、暂停或终止部分或全部服务的权利。</p>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">3. 账户注册</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p>注册账户时，您需要：</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>提供真实、准确、完整的信息</li>
                    <li>年满13周岁（某些地区可能要求年满18周岁）</li>
                    <li>保护账户安全，不与他人共享密码</li>
                    <li>对账户下的所有活动负责</li>
                    <li>及时更新账户信息</li>
                  </ul>
                  <p className="mt-2">我们有权拒绝注册、暂停或终止违反本协议的账户。</p>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">4. 用户行为规范</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p className="font-medium">您同意不会：</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>发布非法、有害、威胁、辱骂、骚扰、诽谤、粗俗、淫秽或其他令人反感的内容</li>
                    <li>冒充他人或虚假陈述与他人的关系</li>
                    <li>侵犯他人的知识产权、隐私权或其他权利</li>
                    <li>传播病毒、恶意软件或其他有害代码</li>
                    <li>进行欺诈、洗钱或其他非法金融活动</li>
                    <li>干扰或破坏服务的正常运行</li>
                    <li>使用自动化工具（机器人、爬虫等）访问服务</li>
                    <li>收集或存储他人的个人信息</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">5. 内容权利</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p className="font-medium">5.1 用户内容</p>
                  <p>您保留对您发布内容的所有权。通过发布内容，您授予我们全球性、非独占、免费的许可，以存储、使用、展示和传输您的内容以提供服务。</p>
                  
                  <p className="font-medium mt-3">5.2 应用权利</p>
                  <p>应用的设计、文本、图形、界面、代码和其他内容受知识产权法保护，归我们所有或由我们授权使用。</p>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">6. 钱包和支付服务</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p className="font-medium">6.1 钱包余额</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>钱包余额不是银行存款，不受存款保险保护</li>
                    <li>您需确保账户安全，防止未经授权的访问</li>
                    <li>我们不对您因自身过失造成的损失负责</li>
                  </ul>
                  
                  <p className="font-medium mt-3">6.2 交易规则</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>所有交易均为实时处理，一旦完成不可撤销</li>
                    <li>红包有效期为24小时，过期未领取将退回发送者</li>
                    <li>转账有效期为24小时，过期未接收将退回发送者</li>
                    <li>我们保留冻结涉嫌欺诈账户的权利</li>
                  </ul>

                  <p className="font-medium mt-3">6.3 提现规则</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>提现需通过身份验证</li>
                    <li>可能需要1-3个工作日处理</li>
                    <li>可能收取服务费（具体见费率说明）</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">7. 隐私保护</h3>
                <p className="text-muted-foreground leading-relaxed">
                  我们如何收集、使用和保护您的个人信息，请参见我们的<span className="text-primary cursor-pointer hover:underline" onClick={() => navigate('/privacy-policy')}>隐私政策</span>。
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">8. 知识产权投诉</h3>
                <p className="text-muted-foreground leading-relaxed">
                  如果您认为某内容侵犯了您的知识产权，请联系我们：ypkfjt001@gmail.com，并提供相关证明材料。我们将及时处理合法的投诉。
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">9. 免责声明</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p>本应用"按现状"提供，不提供任何明示或暗示的保证，包括但不限于：</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>服务的适用性、可靠性、及时性</li>
                    <li>服务不会中断或无错误</li>
                    <li>通过服务获得的结果准确或可靠</li>
                    <li>第三方内容的质量或准确性</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">10. 责任限制</h3>
                <p className="text-muted-foreground leading-relaxed">
                  在法律允许的最大范围内，我们对任何间接、偶然、特殊、后果性或惩罚性损害不承担责任，包括但不限于利润损失、数据丢失、业务中断等，即使我们已被告知此类损害的可能性。
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">11. 账户终止</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p className="font-medium">11.1 您的终止权</p>
                  <p>您可以随时通过应用内设置删除账户。删除后30天内数据将被永久删除（法律要求保留的除外）。</p>
                  
                  <p className="font-medium mt-3">11.2 我们的终止权</p>
                  <p>我们可能因以下原因暂停或终止您的账户：</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>违反本协议</li>
                    <li>涉嫌欺诈或非法活动</li>
                    <li>长期不活跃（超过2年）</li>
                    <li>法律要求</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">12. 争议解决</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p>本协议受[您所在司法管辖区]法律管辖。因本协议引起的争议应首先通过友好协商解决；协商不成的，应提交[指定仲裁机构]仲裁。</p>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">13. 协议修改</h3>
                <p className="text-muted-foreground leading-relaxed">
                  我们保留随时修改本协议的权利。重大变更将通过应用内通知或电子邮件通知您。继续使用服务即表示您接受修改后的协议。
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">14. 可分割性</h3>
                <p className="text-muted-foreground leading-relaxed">
                  如果本协议的任何条款被认定为无效或不可执行，该条款应在最小必要范围内修改或删除，其余条款继续有效。
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">15. 联系我们</h3>
                <div className="text-muted-foreground space-y-2">
                  <p>如有任何关于本协议的问题，请联系我们：</p>
                  <ul className="list-none space-y-1">
                    <li>邮箱：ypkfjt001@gmail.com</li>
                    <li>地址：中国（福建）自由贸易试验区厦门片区 361000</li>
                    <li>客服热线：4001013230</li>
                  </ul>
                </div>
              </section>

              <section className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground italic">
                  通过使用本应用，您确认已阅读、理解并同意受本用户协议的约束。
                </p>
              </section>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
