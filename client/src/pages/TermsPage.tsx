import { Typography, Divider } from 'antd';

const { Title, Paragraph, Text } = Typography;

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <Title level={2}>服务条款</Title>
      <Paragraph type="secondary">最后更新日期：2026-07-11</Paragraph>
      <Divider />
      <Paragraph>
        欢迎使用 <Text strong>Reasonix AI Agent Platform</Text>（以下简称「本平台」，域名 aibak.site）。
        在使用本平台提供的 AI 对话、知识中枢、技能市场、开放 API、团队协作等服务前，请您仔细阅读以下条款。
        一旦注册或使用本平台，即表示您已同意接受本条款约束。
      </Paragraph>

      <Title level={4}>1. 服务说明</Title>
      <Paragraph>
        本平台提供基于人工智能的内容生成、知识检索、工具调用与工作流编排能力。生成内容由大模型产生，
        平台不保证其准确性、完整性或适用性，您应自行判断并承担使用风险。
      </Paragraph>

      <Title level={4}>2. 账户与责任</Title>
      <Paragraph>
        您需对账户下的所有活动负责，并妥善保管登录凭证。不得将本平台用于任何违法、侵权或损害他人的用途，
        包括但不限于生成虚假信息、侵犯知识产权、网络攻击等。
      </Paragraph>

      <Title level={4}>3. 付费与订阅</Title>
      <Paragraph>
        部分功能需付费或消耗积分。具体价格以「会员升级」页面为准。虚拟商品（积分、订阅）一经售出，
        除法定情形外不支持无理由退款。
      </Paragraph>

      <Title level={4}>4. 数据与隐私</Title>
      <Paragraph>
        我们依据《隐私政策》收集与处理您的数据。您上传的知识文档、对话内容仅用于向您提供服务，
        详见 <a href="/privacy">隐私政策</a>。
      </Paragraph>

      <Title level={4}>5. 免责声明</Title>
      <Paragraph>
        本平台按「现状」提供，不就可用性、可靠性或适用性作出明示或暗示担保。因使用或无法使用本平台
        造成的直接或间接损失，平台不承担责任，法律法规另有规定的除外。
      </Paragraph>

      <Title level={4}>6. 条款变更</Title>
      <Paragraph>
        我们可能不时更新本条款，更新后将在本页面公布。继续使用即视为接受变更后的条款。
      </Paragraph>

      <Divider />
      <Paragraph type="secondary">如需进一步说明，请通过平台内「个人中心」联系我们。</Paragraph>
    </div>
  );
}
