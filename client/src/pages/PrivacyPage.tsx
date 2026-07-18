import { Typography, Divider, Table, Alert } from "antd";

const { Title, Paragraph, Text } = Typography;

const DATA_COLLECTION = [
  { key: "1", category: "账户信息", items: "昵称、邮箱、手机号（如绑定）、头像", purpose: "账户创建、身份识别与登录安全", retention: "账户存续期间；注销后按法规保留必要的财务/安全记录" },
  { key: "2", category: "使用内容", items: "AI 对话输入与输出、上传的知识文档、技能配置、工作流编排", purpose: "向您提供 AI 对话、知识管理和工具调用服务", retention: "账户存续期间；您可随时删除；对话记录定期清理" },
  { key: "3", category: "支付信息", items: "订单编号、交易金额、支付渠道流水号", purpose: "订单处理、退款、财务对账", retention: "按《电子商务法》等法规要求至少保留 3 年" },
  { key: "4", category: "积分账本", items: "积分增减记录、额度来源与消耗明细", purpose: "计费、额度管理与对账", retention: "账户存续期间 + 法定财务留存期限" },
  { key: "5", category: "技术数据", items: "IP 地址、浏览器类型、访问日志、Cookie", purpose: "安全防护、访问统计与平台优化", retention: "日志最长保留 90 天；Cookie 按各自生命周期" },
  { key: "6", category: "API 使用记录", items: "API 调用模型、次数、时间戳", purpose: "用量统计与计费", retention: "账户存续期间，用于用量查询与账单" },
];

const THIRD_PARTY_SERVICES = [
  { key: "1", name: "微信支付", purpose: "支付处理与退款", dataShared: "订单号、金额、商品描述；不共享您的知识内容", policyUrl: "https://pay.weixin.qq.com/index.php/public/apply_sign/protocol_v2" },
  { key: "2", name: "大模型厂商 (OpenAI / Anthropic / DeepSeek / 通义千问 等)", purpose: "处理 AI 对话请求", dataShared: "您输入到对话中的文本（按您选择的模型路由）；不含您的账户信息", policyUrl: "见各厂商官方网站" },
  { key: "3", name: "腾讯云 CloudBase / COS", purpose: "托管服务与文件存储", dataShared: "应用运行数据和上传文件", policyUrl: "https://cloud.tencent.com/document/product/301" },
  { key: "4", name: "企业微信 / 邮件服务", purpose: "发送通知与告警", dataShared: "通知内容与接收地址", policyUrl: "https://work.weixin.qq.com/privacy" },
];

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <Title level={2}>隐私政策</Title>
      <Paragraph type="secondary">最后更新日期：2026-07-18</Paragraph>
      <Divider />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="政策更新提示"
        description="本政策发生重大变更时，我们将通过平台公告、邮件或站内通知提前告知。重大变更将在您重新同意后才对您生效，不会仅以"继续使用即同意"的方式替代您的明确同意。"
      />

      <Title level={4}>1. 我们是谁</Title>
      <Paragraph>
        <Text strong>AIbak</Text>（域名 aibak.site）是一站式 AI 应用平台，由平台运营主体负责运营。
        我们深知个人信息对您的重要性，并致力于以合法、正当、必要、诚信的原则处理您的个人信息。
        如对本政策有任何疑问，请通过 <a href="/contact">联系我们</a> 或 contact@aibak.site 与我们联系。
      </Paragraph>

      <Title level={4}>2. 我们收集的信息</Title>
      <Paragraph>以下是我们在提供服务过程中收集的个人信息类别及说明：</Paragraph>
      <Table
        size="middle"
        pagination={false}
        style={{ marginBottom: 16 }}
        columns={[
          { title: "信息类别", dataIndex: "category", width: 110 },
          { title: "具体信息", dataIndex: "items" },
          { title: "使用目的", dataIndex: "purpose" },
          { title: "留存期限", dataIndex: "retention", width: 160 },
        ]}
        dataSource={DATA_COLLECTION}
      />

      <Title level={4}>3. 第三方服务与数据共享</Title>
      <Paragraph>
        为向您提供服务，我们可能与以下第三方共享必要信息。除下列情形外，我们不会向任何第三方出售或共享您的个人信息：
      </Paragraph>
      <Table
        size="middle"
        pagination={false}
        style={{ marginBottom: 16 }}
        columns={[
          { title: "第三方", dataIndex: "name", width: 180 },
          { title: "用途", dataIndex: "purpose" },
          { title: "共享数据", dataIndex: "dataShared" },
        ]}
        dataSource={THIRD_PARTY_SERVICES}
      />

      <Title level={4}>4. 第三方模型数据处理说明</Title>
      <Paragraph>
        当您使用 AI 对话功能时，您输入的文本会按您所选模型路由至对应的第三方大模型厂商。
        <Text strong>请避免在对话中输入身份证号、银行卡号、密码、精确位置等敏感个人信息。</Text>
        我们不主动将您的账户信息发送给模型厂商。各厂商对您输入数据的处理方式请参阅其各自的隐私政策。
        我们无法控制第三方厂商如何处理您的输入数据，建议您在使用前了解所选厂商的数据处理政策。
      </Paragraph>

      <Title level={4}>5. AI 内容风险提示</Title>
      <Paragraph>
        <ul>
          <li>AI 生成内容可能存在事实错误、逻辑矛盾或不当表述，不应作为专业建议的依据。</li>
          <li>严禁利用本平台生成违法违规内容、侵犯他人权益的内容或虚假误导性信息。</li>
          <li>我们将采取合理措施过滤违规内容，但对 AI 输出内容的准确性和合法性不作保证。</li>
        </ul>
      </Paragraph>

      <Title level={4}>6. 未成年人保护</Title>
      <Paragraph>
        <ul>
          <li>本平台主要面向 18 周岁以上用户。</li>
          <li>未满 18 周岁的用户需在监护人同意和指导下使用本平台。</li>
          <li><Text strong>未满 14 周岁的儿童</Text>使用本平台前，其监护人应仔细阅读本政策，了解我们收集、使用和保护儿童个人信息的方式。我们仅在监护人明确同意的情况下收集儿童个人信息。</li>
          <li>如我们发现未经监护人同意收集了儿童个人信息，将及时删除。</li>
          <li>监护人可随时联系我们查看、更正或删除其监护儿童的个人信息。</li>
        </ul>
      </Paragraph>

      <Title level={4}>7. 数据安全</Title>
      <Paragraph>
        我们采用传输加密（HTTPS/TLS）、字段级加密、访问控制、安全审计等措施保护您的数据。
        尽管我们采取了合理的安全措施，互联网传输无法保证绝对安全，请您妥善保管账户凭证。
      </Paragraph>

      <Title level={4}>8. 您的权利</Title>
      <Paragraph>根据适用法律，您享有以下权利：</Paragraph>
      <Paragraph>
        <ul>
          <li><Text strong>查阅与更正</Text>：您可在"个人中心"查看和更正您的个人信息。</li>
          <li><Text strong>数据导出</Text>：您可在"个人中心"申请导出您的个人数据，导出内容包含个人资料、订单、积分流水等。导出链接 24 小时内有效。</li>
          <li><Text strong>账号注销</Text>：您可在"个人中心"申请注销账号。注销后您的个人信息将被删除或匿名化，但依法必须保留的财务、支付和安全审计记录除外。注销申请有 7 天冷静期，期间重新登录可撤销注销。</li>
          <li><Text strong>删除个人信息</Text>：除法定义务所需外，您可要求我们删除您的个人信息。您也可直接删除您创建的知识文档和对话记录。</li>
          <li><Text strong>撤回同意</Text>：对于基于同意的数据处理，您可随时撤回同意，但不影响撤回前已进行的处理。</li>
        </ul>
      </Paragraph>

      <Title level={4}>9. Cookie 和类似技术</Title>
      <Paragraph>
        我们使用 Cookie 和 localStorage 来维持登录状态、记住偏好和统计分析。
        您可管理非必要 Cookie 的开启/关闭，详见 <a href="/cookies">Cookies 政策</a>。
      </Paragraph>

      <Title level={4}>10. 数据跨境传输</Title>
      <Paragraph>
        您的数据默认存储在中国境内。当您选择调用境外大模型厂商（如 OpenAI、Anthropic 等）时，
        您的对话输入可能被传输至该厂商所在地区的服务器。该传输基于您的主动选择和同意。
      </Paragraph>

      <Title level={4}>11. 政策变更</Title>
      <Paragraph>
        我们可能不时更新本政策。对于重大变更，我们将提前通过平台公告、邮件或站内通知告知，
        并在您下次登录时重新征得您的同意。对于非重大变更，更新后将在本页面公布。
      </Paragraph>

      <Title level={4}>12. 联系我们</Title>
      <Paragraph>
        如对本政策有任何疑问、意见或投诉，或希望行使您的上述权利，请通过以下方式联系我们：
      </Paragraph>
      <Paragraph>
        <ul>
          <li>邮箱：contact@aibak.site</li>
          <li>在线：<a href="/contact">联系我们</a> 页面</li>
          <li>地址：详见企业注册信息（可在"法律声明"页面查询）</li>
        </ul>
      </Paragraph>

      <Divider />
      <Paragraph type="secondary">
        © {new Date().getFullYear()} AIbak · 本政策最终解释权归平台运营主体所有。
      </Paragraph>
    </div>
  );
}