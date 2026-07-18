import { Typography, Divider, Steps, Alert } from "antd";

const { Title, Paragraph, Text } = Typography;

export default function RefundPolicyPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <Title level={2}>退款政策</Title>
      <Paragraph type="secondary">最后更新日期：2026-07-18</Paragraph>
      <Divider />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="退款需人工审批"
        description="本平台所有退款均需经过管理员审核，审核通过后通过原支付渠道退回。系统不会自动退款，也不会在未经审核的情况下发起退款。"
      />

      <Title level={4}>1. 退款适用范围</Title>
      <Paragraph>以下情况可申请退款：</Paragraph>
      <Paragraph>
        <ul>
          <li>积分包购买后<Text strong>未消费</Text>的积分，按未消费比例退款。</li>
          <li>会员订阅购买后<Text strong>7 天</Text>内且未使用会员专属权益的，可申请全额退款。</li>
          <li>因平台系统故障导致重复扣款的，核实后全额退还重复部分。</li>
        </ul>
      </Paragraph>

      <Title level={4}>2. 不支持退款的情况</Title>
      <Paragraph>
        <ul>
          <li>已消费的积分、已使用的 API 调用额度。</li>
          <li>因个人原因（如不再需要、误操作购买等）且已消费部分积分，已消费部分不予退还。</li>
          <li>会员购买超过 7 天或已使用会员专属权益（如专属模型、高并发额度等）。</li>
          <li>活动赠送的免费额度。</li>
          <li>法律法规另有规定的，从其规定。</li>
        </ul>
      </Paragraph>

      <Title level={4}>3. 退款流程</Title>
      <Steps
        direction="vertical"
        size="small"
        current={-1}
        style={{ marginBottom: 20 }}
        items={[
          {
            title: "第一步：提交申请",
            description: "登录后在「个人中心」找到对应订单，点击「申请退款」，填写退款原因和退款金额。",
          },
          {
            title: "第二步：管理员审核（1-3 个工作日）",
            description: "管理员将核对订单状态、已消费积分数额和剩余权益。审核期间订单状态变更为"退款审批中"。",
          },
          {
            title: "第三步：审核结果通知",
            description: "审核通过：系统通过微信支付原路退款，到账时间以微信支付规则为准（通常 1-3 个工作日）。审核不通过：系统将说明拒绝原因。",
          },
          {
            title: "第四步：退款到账与权益回收",
            description: "退款成功后，系统将原子回收对应权益（扣除积分、取消会员等），并在积分账本中记录冲正流水。",
          },
        ]}
      />

      <Title level={4}>4. 退款额度计算</Title>
      <Paragraph>
        <ul>
          <li>积分包退款金额 = 购买金额 ×（剩余积分 / 购买积分），精确到分。</li>
          <li>会员订阅退款金额 = 购买金额 ×（剩余天数 / 总天数），精确到分。</li>
          <li>退款金额不超过原始支付金额。</li>
          <li>积分包最大可退范围默认不超过未消费的本订单积分。超额处理须由超级管理员审批并留下审计记录。</li>
        </ul>
      </Paragraph>

      <Title level={4}>5. 到账时间</Title>
      <Paragraph>
        <ul>
          <li>微信支付退款：审核通过后 1-3 个工作日到账（具体以微信支付实际处理时间为准）。</li>
          <li>退款将退回原支付账户。</li>
          <li>如超过 5 个工作日未到账，请联系客服查询。</li>
        </ul>
      </Paragraph>

      <Title level={4}>6. 退款记录</Title>
      <Paragraph>
        所有退款申请、审批、执行和到账确认均有完整审计记录，包括申请人、审批人、退款金额、退款原因和时间戳。
        您可在「个人中心」查看退款状态和历史。
      </Paragraph>

      <Divider />
      <Paragraph type="secondary">
        如有疑问，请通过 <a href="/contact">联系我们</a> 或 contact@aibak.site 与我们联系。
      </Paragraph>
    </div>
  );
}