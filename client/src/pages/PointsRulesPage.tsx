import { Typography, Divider, Table, Tag } from "antd";

const { Title, Paragraph, Text } = Typography;

const CREDIT_TYPES = [
  { type: "免费额度", source: "注册赠送、活动奖励、套餐赠送", expires: "按套餐周期或活动规则到期清零", refundable: "否（免费获取）" },
  { type: "付费额度", source: "积分包购买、会员套餐内额度", expires: "不随会员到期清零，有效期按购买规则", refundable: "是（未消费部分）" },
  { type: "历史保护额度", source: "老用户迁移保护", expires: "不设到期时间", refundable: "否（系统迁移）" },
];

const CONSUMPTION_ORDER = [
  { priority: 1, description: "即将到期的免费额度" },
  { priority: 2, description: "历史保护额度" },
  { priority: 3, description: "付费购买额度" },
];

export default function PointsRulesPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <Title level={2}>积分规则</Title>
      <Paragraph type="secondary">最后更新日期：2026-07-18</Paragraph>
      <Divider />

      <Title level={4}>1. 积分是什么</Title>
      <Paragraph>
        积分是 AIbak 平台的虚拟计费单位，用于支付 AI 对话、知识处理、API 调用、Sandbox 执行等功能的使用费用。
        不同类型的服务消耗不同数量的积分，具体消耗请以各功能页面的实时显示为准。
      </Paragraph>

      <Title level={4}>2. 积分来源</Title>
      <Table
        size="middle"
        pagination={false}
        style={{ marginBottom: 16 }}
        columns={[
          { title: "类型", dataIndex: "type", width: 120 },
          { title: "获取来源", dataIndex: "source" },
          { title: "到期规则", dataIndex: "expires", width: 160 },
          { title: "可退款", dataIndex: "refundable", width: 100 },
        ]}
        dataSource={CREDIT_TYPES}
      />

      <Title level={4}>3. 积分消费顺序</Title>
      <Paragraph>每次消费时，系统按以下优先级自动扣除积分：</Paragraph>
      <Table
        size="middle"
        pagination={false}
        style={{ marginBottom: 16 }}
        columns={[
          { title: "优先级", dataIndex: "priority", width: 80 },
          { title: "说明", dataIndex: "description" },
        ]}
        dataSource={CONSUMPTION_ORDER}
      />

      <Title level={4}>4. 积分有效期</Title>
      <Paragraph>
        <ul>
          <li><Text strong>免费额度</Text>：按套餐周期或活动规则到期，到期自动清零。建议在有效期内使用。</li>
          <li><Text strong>付费额度</Text>：不随会员到期而清零。付费购买的积分在购买后长期有效，具体有效期以购买页面标注为准。</li>
          <li><Text strong>历史保护额度</Text>：系统迁移时为老用户自动生成的保护额度，不设到期时间。</li>
        </ul>
      </Paragraph>

      <Title level={4}>5. 积分查询</Title>
      <Paragraph>
        您可在以下位置查看积分余额和明细：
        <ul>
          <li><a href="/points-center">积分中心</a> — 查看积分余额和使用明细</li>
          <li><a href="/query-center">本站查询</a> — 查看免费额度、付费额度、历史保护额度和用量统计</li>
          <li><a href="/pricing">会员升级</a> — 购买积分包和会员套餐</li>
        </ul>
      </Paragraph>

      <Title level={4}>6. 积分使用规则</Title>
      <Paragraph>
        <ul>
          <li>积分不可转让、不可兑换现金（退款除外），不可在不同账户间流转。</li>
          <li>积分消费为实时扣除，单次请求重复提交不会重复扣费（幂等保护）。</li>
          <li>积分余额不足以支付所需费用时，服务将被拒绝，不会透支。</li>
          <li>API Key 调用失败按规则自动冲正积分，调用成功则正常扣费。</li>
        </ul>
      </Paragraph>

      <Title level={4}>7. 积分退款规则</Title>
      <Paragraph>
        付费购买的积分未消费部分可申请退款，具体请参阅 <a href="/refund-policy">退款政策</a>。
        免费获取的积分不支持退款。
      </Paragraph>

      <Title level={4}>8. 防止滥用</Title>
      <Paragraph>
        为保护所有用户的公平使用，我们设置了以下防刷措施：
        <ul>
          <li>签到、任务奖励等有每日/一次性上限。</li>
          <li>积分消费受用户级并发数和频率限制。</li>
          <li>异常积分获取行为将被监控并可能导致账户限制。</li>
        </ul>
      </Paragraph>

      <Divider />
      <Paragraph type="secondary">
        积分规则可能根据运营需要进行调整，重大变更将提前通知。如有疑问请联系 contact@aibak.site。
      </Paragraph>
    </div>
  );
}