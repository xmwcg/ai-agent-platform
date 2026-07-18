import { Typography, Divider, Alert } from "antd";

const { Title, Paragraph, Text } = Typography;

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <Title level={2}>服务条款</Title>
      <Paragraph type="secondary">最后更新日期：2026-07-18</Paragraph>
      <Divider />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="协议更新提示"
        description="本条款发生重大变更时，我们将通过平台公告、邮件或站内通知提前告知，并在您下次登录时重新征得您的明确同意。仅在您勾选同意后，变更条款才对您生效。"
      />

      <Paragraph>
        欢迎使用 <Text strong>AIbak</Text>（域名 aibak.site，以下简称"本平台"）。
        在使用本平台提供的 AI 对话、知识中枢、技能市场、开放 API、团队协作等服务前，请您仔细阅读以下条款。
        注册或使用本平台即表示您已阅读、理解并同意接受本服务条款约束。如您不同意本条款，请停止注册或使用。
      </Paragraph>

      <Title level={4}>1. 服务说明</Title>
      <Paragraph>
        本平台提供基于人工智能的内容生成、知识检索、模型配置、工具调用与工作流编排能力。
        生成内容由大模型产生，平台不保证其准确性、完整性或适用性，您应自行判断并承担使用风险。
        AI 生成内容不代表本平台立场。本平台保留在不事先通知的情况下对服务内容进行调整、升级或暂停的权利。
      </Paragraph>

      <Title level={4}>2. 账户与责任</Title>
      <Paragraph>
        <ul>
          <li>您需对账户下的所有活动负责，并妥善保管登录凭证。不得将账户出借、转让或供他人使用。</li>
          <li>注册信息必须真实、准确；信息变更应及时更新。因信息不实或未及时更新造成的损失由您自行承担。</li>
          <li>不得将本平台用于任何违法、侵权或损害他人的用途，包括但不限于生成虚假信息、侵犯知识产权、网络攻击、骚扰、欺诈等。</li>
          <li>发现账户异常或安全漏洞，应立即通知我们。</li>
        </ul>
      </Paragraph>

      <Title level={4}>3. 付费、积分与订阅</Title>
      <Paragraph>
        <ul>
          <li>部分功能需付费或消耗积分。具体价格以 <a href="/pricing">会员升级</a> 页面实时展示为准。</li>
          <li>免费额度来源于注册赠送、活动奖励或套餐赠送，按规则到期清零。付费购买的积分在有效期内不会随会员到期而清零。</li>
          <li>自动续费订阅将在到期前自动扣款续期。您可随时在"个人中心"取消自动续费，取消后当前周期结束后不再扣款。</li>
          <li>积分详细规则请参阅 <a href="/points-rules">积分规则</a>。</li>
        </ul>
      </Paragraph>

      <Title level={4}>4. 退款政策</Title>
      <Paragraph>
        本平台支持通过人工审批流程进行退款，具体规则如下：
        <ul>
          <li>退款须通过"个人中心"提交申请，注明退款原因。管理员将对订单状态和已消费积分数额进行审核。</li>
          <li>退款金额以剩余未消费积分为上限。已消费积分对应的权益不予退还，积分包按未消费比例退款。</li>
          <li>涉及微信支付的订单，退款将通过微信支付原路返回，到账时间以微信支付规则为准。</li>
          <li>完整退款政策请参阅 <a href="/refund-policy">退款政策</a>。</li>
        </ul>
      </Paragraph>

      <Title level={4}>5. 数据与隐私</Title>
      <Paragraph>
        我们依据 <a href="/privacy">隐私政策</a> 收集与处理您的数据。您上传的知识文档、对话内容仅用于向您提供服务。
        我们不会向第三方出售您的个人信息。您可以随时导出或申请删除您的个人数据，详见隐私政策。
      </Paragraph>

      <Title level={4}>6. 知识产权</Title>
      <Paragraph>
        <ul>
          <li>本平台的代码、界面设计、商标和品牌标识归本平台所有，未经许可不得复制、修改或分发。</li>
          <li>您通过本平台创建的知识内容、工作流和技能配置归您所有，您授予我们在提供本服务所需范围内的使用许可。</li>
          <li>AI 生成内容的权利归属以各模型厂商的服务条款为准。</li>
        </ul>
      </Paragraph>

      <Title level={4}>7. AI 内容风险提示</Title>
      <Paragraph>
        <ul>
          <li>AI 生成内容可能存在事实错误、逻辑矛盾或不当表述，不应作为专业建议（法律、医疗、金融等）的依据。</li>
          <li>严禁利用本平台生成违法违规内容、侵犯他人权益的内容或虚假误导性信息。</li>
          <li>当您调用第三方大模型时，相关输入会路由至对应厂商，请避免输入敏感个人信息。详见 <a href="/privacy">隐私政策</a> 中关于第三方模型数据处理的部分。</li>
        </ul>
      </Paragraph>

      <Title level={4}>8. 免责声明</Title>
      <Paragraph>
        <ul>
          <li>本平台按"现状"提供，不就可用性、可靠性或适用性作出明示或暗示担保。</li>
          <li>因不可抗力、网络故障、第三方服务中断等原因导致的服务暂停或数据丢失，平台不承担责任，但将尽力恢复服务。</li>
          <li>在法律允许的最大范围内，因使用或无法使用本平台造成的间接损失，平台不承担责任。</li>
        </ul>
      </Paragraph>

      <Title level={4}>9. 未成年人使用规则</Title>
      <Paragraph>
        <ul>
          <li>本平台主要面向 18 周岁以上用户。未满 18 周岁的用户须在监护人同意和指导下使用。</li>
          <li>未满 14 周岁的儿童使用本平台前，监护人应仔细阅读 <a href="/privacy">隐私政策</a> 中关于儿童个人信息保护的规定。</li>
          <li>我们建议监护人指导未成年人正确使用 AI 工具，注意甄别 AI 生成内容的准确性。</li>
        </ul>
      </Paragraph>

      <Title level={4}>10. 条款变更</Title>
      <Paragraph>
        我们可能不时更新本条款。对于重大变更（包括但不限于收费方式、退款政策、责任限制的实质性修改），
        我们将提前在平台公告、邮件或站内通知告知，并在您下次登录时重新征得您的明确同意。
        对于非重大变更，更新后将在本页面公布。
      </Paragraph>

      <Title level={4}>11. 适用法律与争议解决</Title>
      <Paragraph>
        本条款的订立、执行和解释适用中华人民共和国法律。因本条款产生的争议，双方应友好协商解决；
        协商不成的，提交有管辖权的人民法院诉讼解决。
      </Paragraph>

      <Divider />
      <Paragraph type="secondary">
        如需进一步说明，请通过 <a href="/contact">联系我们</a> 页面或发送邮件至 contact@aibak.site 与我们取得联系。
      </Paragraph>
    </div>
  );
}