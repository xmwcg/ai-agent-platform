import { Typography, Divider } from 'antd';

const { Title, Paragraph, Text } = Typography;

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <Title level={2}>隐私政策</Title>
      <Paragraph type="secondary">最后更新日期：2026-07-11</Paragraph>
      <Divider />
      <Paragraph>
        保护用户隐私是 <Text strong>Reasonix AI Agent Platform</Text> 的基本准则。本政策说明我们如何收集、使用与保护您的信息。
      </Paragraph>

      <Title level={4}>1. 我们收集的信息</Title>
      <Paragraph>
        <ul>
          <li><Text strong>账户信息</Text>：注册时提供的邮箱、昵称等。</li>
          <li><Text strong>使用内容</Text>：您上传的文档、对话输入、技能配置与工作流编排。</li>
          <li><Text strong>技术数据</Text>：设备信息、访问日志、用于保障安全的 Cookie。</li>
        </ul>
      </Paragraph>

      <Title level={4}>2. 信息的使用</Title>
      <Paragraph>
        我们仅将信息用于：提供与改进服务、进行配额与计费、保障账户安全、履行法律义务。
        我们不会向第三方出售您的个人信息。
      </Paragraph>

      <Title level={4}>3. 第三方模型</Title>
      <Paragraph>
        当您调用 AI 能力时，相关输入会按您所选模型路由至对应的第三方大模型厂商。
        请避免在其中输入敏感个人信息。我们仅在获得您授权后转发必要内容。
      </Paragraph>

      <Title level={4}>4. 数据安全</Title>
      <Paragraph>
        我们采用传输加密（HTTPS/TLS）与访问控制措施保护数据。尽管如此，互联网传输无法保证绝对安全，
        请您妥善保管账户凭证。
      </Paragraph>

      <Title level={4}>5. 您的权利</Title>
      <Paragraph>
        您可随时在「个人中心」查看、更正或导出您的数据，也可申请注销账户并删除相关数据。
      </Paragraph>

      <Title level={4}>6. 联系我们</Title>
      <Paragraph>
        如对本政策有疑问，请通过平台内「个人中心」联系我们。
      </Paragraph>

      <Divider />
      <Paragraph type="secondary">相关条款请参见 <a href="/terms">服务条款</a>。</Paragraph>
    </div>
  );
}
