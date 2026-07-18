import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ApiOutlined,
  BarChartOutlined,
  DollarOutlined,
  ReloadOutlined,
  RiseOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { extractApiError, opsAPI, billingAPI, type OpsSnapshot } from '@/services/api';
import { useUIStore } from '@/stores/ui';

const { Title, Text, Paragraph } = Typography;

const COLORS = {
  primary: '#6c5ce7',
  cyan: '#00cec9',
  success: '#00b894',
  warning: '#fdcb6e',
  danger: '#e17055',
  blue: '#0984e3',
  purple: '#a29bfe',
  textDark: '#9ca3af',
  textLight: '#5a6170',
  splitDark: '#20243a',
  splitLight: '#edf1f7',
};

type Status = 'healthy' | 'watch' | 'risk' | 'observe';

type MetricRow = {
  key: string;
  layer: string;
  metric: string;
  value: string;
  source: string;
  decision: string;
  status: Status;
};

function pct(value: number): string {
  if (!Number.isFinite(value)) return '0.0%';
  return `${(value * 100).toFixed(1)}%`;
}

function currency(value: number): string {
  return `¥${Math.round(value).toLocaleString()}`;
}

function count(value: number): string {
  return Math.round(value || 0).toLocaleString();
}

function statusColor(status: Status): string {
  return {
    healthy: 'success',
    watch: 'warning',
    risk: 'error',
    observe: 'processing',
  }[status];
}

function statusText(status: Status): string {
  return {
    healthy: '健康',
    watch: '关注',
    risk: '风险',
    observe: '观测',
  }[status];
}

function targetStatus(current: number, target: number, reverse = false): Status {
  if (!Number.isFinite(current) || target <= 0) return 'observe';
  const ratio = current / target;
  if (reverse) {
    if (ratio <= 0.5) return 'healthy';
    if (ratio <= 1) return 'watch';
    return 'risk';
  }
  if (ratio >= 0.9) return 'healthy';
  if (ratio >= 0.55) return 'watch';
  return 'risk';
}

function makeAxis(dark: boolean) {
  return {
    axisLine: { lineStyle: { color: dark ? COLORS.splitDark : COLORS.splitLight } },
    axisTick: { show: false },
    axisLabel: { color: dark ? COLORS.textDark : COLORS.textLight },
    splitLine: { lineStyle: { color: dark ? COLORS.splitDark : COLORS.splitLight } },
  };
}

export default function AdminDashboardPage() {
  const [snapshot, setSnapshot] = useState<OpsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const themeMode = useUIStore((s) => s.themeMode);
  const dark = themeMode === 'dark';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res: any = await opsAPI.snapshot();
      setSnapshot(res?.data ?? res);
    } catch (err) {
      const status = (err as any)?.response?.status;
      if (status === 403) setError('当前账号不是管理员，无法查看后台运营看板。');
      else setError(extractApiError(err, '运营看板加载失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const analysis = useMemo(() => {
    if (!snapshot) return null;
    const wauProgress = snapshot.northStar.wauTarget > 0
      ? Math.min(100, Math.round((snapshot.northStar.wau / snapshot.northStar.wauTarget) * 100))
      : 0;
    const quotaPressure = snapshot.referral.publicApiCallsLast7d > 0
      ? snapshot.referral.quotaHitsLast7d / snapshot.referral.publicApiCallsLast7d
      : 0;
    const paidConversionProxy = snapshot.northStar.wau > 0
      ? snapshot.revenue.paidUsers / snapshot.northStar.wau
      : 0;
    return { wauProgress, quotaPressure, paidConversionProxy };
  }, [snapshot]);

  const trendOption = useMemo(() => {
    if (!snapshot) return {};
    const axis = makeAxis(dark);
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 24, top: 36, bottom: 34 },
      xAxis: { type: 'category', data: snapshot.trend.map((i) => i.week), ...axis },
      yAxis: { type: 'value', ...axis },
      series: [{
        name: 'WAU',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: snapshot.trend.map((i) => i.wau),
        lineStyle: { color: COLORS.primary, width: 3 },
        itemStyle: { color: COLORS.primary },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(108, 92, 231, 0.32)' },
              { offset: 1, color: 'rgba(108, 92, 231, 0.02)' },
            ],
          },
        },
        markLine: {
          symbol: 'none',
          lineStyle: { color: COLORS.warning, type: 'dashed' },
          data: [{ yAxis: snapshot.northStar.wauTarget, name: '目标' }],
          label: { color: COLORS.warning, formatter: '目标 {c}' },
        },
      }],
    };
  }, [snapshot, dark]);

  const funnelOption = useMemo(() => {
    if (!snapshot) return {};
    const axis = makeAxis(dark);
    const data = [
      { name: '新增注册', value: snapshot.acquisition.signupsLast7d, color: COLORS.blue },
      { name: '新增创作者', value: snapshot.acquisition.newCreatorsLast7d, color: COLORS.primary },
      { name: '激活用户', value: snapshot.activation.activatedLast7d, color: COLORS.cyan },
      { name: '回流用户', value: snapshot.retention.returningCreators, color: COLORS.success },
    ];
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 88, right: 28, top: 18, bottom: 28 },
      xAxis: { type: 'value', ...axis },
      yAxis: { type: 'category', data: data.map((i) => i.name), ...axis },
      series: [{
        name: '用户漏斗',
        type: 'bar',
        data: data.map((i) => ({ value: i.value, itemStyle: { color: i.color } })),
        barWidth: 18,
        label: { show: true, position: 'right', color: dark ? COLORS.textDark : COLORS.textLight },
      }],
    };
  }, [snapshot, dark]);

  const revenueOption = useMemo(() => {
    if (!snapshot) return {};
    const axis = makeAxis(dark);
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { left: 52, right: 20, top: 24, bottom: 42 },
      xAxis: { type: 'category', data: ['MRR', 'ARPU', '付费用户', '7日订单'], ...axis },
      yAxis: { type: 'value', ...axis },
      series: [{
        name: '变现指标',
        type: 'bar',
        barWidth: 28,
        data: [
          { value: snapshot.revenue.mrr, itemStyle: { color: COLORS.success } },
          { value: snapshot.revenue.arpu, itemStyle: { color: COLORS.cyan } },
          { value: snapshot.revenue.paidUsers, itemStyle: { color: COLORS.primary } },
          { value: snapshot.revenue.ordersLast7d, itemStyle: { color: COLORS.warning } },
        ],
      }],
    };
  }, [snapshot, dark]);

  const quotaOption = useMemo(() => {
    if (!snapshot || !analysis) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: { formatter: '{b}: {c}%' },
      series: [{
        name: '配额压力',
        type: 'gauge',
        min: 0,
        max: 20,
        progress: { show: true, width: 12, itemStyle: { color: COLORS.warning } },
        axisLine: { lineStyle: { width: 12, color: [[0.35, COLORS.success], [0.75, COLORS.warning], [1, COLORS.danger]] } },
        axisTick: { show: false },
        splitLine: { length: 8, lineStyle: { color: dark ? COLORS.textDark : COLORS.textLight } },
        axisLabel: { color: dark ? COLORS.textDark : COLORS.textLight },
        pointer: { width: 4 },
        detail: { formatter: '{value}%', color: dark ? '#fff' : '#111827', fontSize: 22 },
        data: [{ value: Number((analysis.quotaPressure * 100).toFixed(2)), name: '触顶率' }],
      }],
    };
  }, [snapshot, analysis, dark]);

  const rows: MetricRow[] = useMemo(() => {
    if (!snapshot || !analysis) return [];
    return [
      {
        key: 'wau', layer: '北极星', metric: 'WAU 周活跃创作者', value: `${count(snapshot.northStar.wau)} / ${count(snapshot.northStar.wauTarget)}`,
        source: 'ApiUsageLog.ownerId + Order.userId', decision: '判断平台真实活跃规模，驱动资源投放和产品优先级', status: targetStatus(snapshot.northStar.wau, snapshot.northStar.wauTarget),
      },
      {
        key: 'wow', layer: '增长', metric: 'WAU 周环比', value: pct(snapshot.northStar.wowGrowth),
        source: 'ApiUsageLog.timestamp 周窗口去重', decision: '识别增长是否持续，异常下滑时优先排查流量、登录和核心链路', status: snapshot.northStar.wowGrowth >= 0 ? 'healthy' : 'risk',
      },
      {
        key: 'signup', layer: '获取', metric: '7 日新增注册', value: count(snapshot.acquisition.signupsLast7d),
        source: 'User.createdAt', decision: '衡量获客入口和内容投放效果', status: 'observe',
      },
      {
        key: 'activation', layer: '激活', metric: '激活率', value: pct(snapshot.activation.activationRate),
        source: 'User.createdAt + ApiUsageLog / Order', decision: '判断新用户是否完成首次有效使用', status: targetStatus(snapshot.activation.activationRate, 0.45),
      },
      {
        key: 'retention', layer: '留存', metric: '周留存率', value: pct(snapshot.retention.weeklyRetentionRate),
        source: '连续两周活跃用户交集', decision: '判断知识库、客服、MCP、API Key 等资产是否形成回访', status: targetStatus(snapshot.retention.weeklyRetentionRate, 0.6),
      },
      {
        key: 'mrr', layer: '收入', metric: 'MRR', value: currency(snapshot.revenue.mrr),
        source: 'Order.status=paid + paidAt 30日', decision: '衡量订阅收入健康度', status: targetStatus(snapshot.revenue.mrr, 10000),
      },
      {
        key: 'arpu', layer: '收入', metric: 'ARPU', value: currency(snapshot.revenue.arpu),
        source: 'MRR / paidUsers', decision: '判断付费质量和套餐结构是否健康', status: targetStatus(snapshot.revenue.arpu, 99),
      },
      {
        key: 'api', layer: '生态', metric: '7 日 API 调用量', value: count(snapshot.referral.publicApiCallsLast7d),
        source: 'ApiUsageLog.timestamp', decision: '判断开放 API 市场和嵌入式场景的使用深度', status: targetStatus(snapshot.referral.publicApiCallsLast7d, 50000),
      },
      {
        key: 'quota', layer: '转化', metric: '配额触顶率', value: pct(analysis.quotaPressure),
        source: 'ApiUsageLog.status=quota_exceeded', decision: '触发升级提示、套餐调整和限流策略优化', status: targetStatus(analysis.quotaPressure, 0.05, true),
      },
    ];
  }, [snapshot, analysis]);

  const columns = [
    { title: '层级', dataIndex: 'layer', width: 92, render: (value: string) => <Tag color={value === '北极星' ? 'purple' : 'blue'}>{value}</Tag> },
    { title: '指标', dataIndex: 'metric', width: 160 },
    { title: '当前值', dataIndex: 'value', width: 140 },
    { title: '数据源', dataIndex: 'source', width: 220, render: (value: string) => <Text code>{value}</Text> },
    { title: '业务决策', dataIndex: 'decision' },
    { title: '状态', dataIndex: 'status', width: 96, render: (value: Status) => <Tag color={statusColor(value)}>{statusText(value)}</Tag> },
  ];

  if (loading) return <Spin style={{ display: 'block', margin: '72px auto' }} />;
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="无法加载运营看板"
        description={error}
        action={<Button icon={<ReloadOutlined />} onClick={load}>重试</Button>}
      />
    );
  }
  if (!snapshot || !analysis) return <Alert type="warning" showIcon message="暂无运营数据" />;

  return (
    <div style={{ padding: 4 }}>
      <Space align="start" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>后台运营看板</Title>
          <Paragraph type="secondary" style={{ margin: '6px 0 0' }}>
            Data Analyst 指标体系 + Data Visualization 图表层，直接读取 <Text code>/api/ops/snapshot</Text>。
          </Paragraph>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
      </Space>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} xl={4}>
          <Card size="small">
            <Statistic title="WAU 周活跃创作者" value={snapshot.northStar.wau} prefix={<TeamOutlined />} valueStyle={{ color: COLORS.primary }} />
            <Progress percent={analysis.wauProgress} size="small" strokeColor={COLORS.primary} />
            <Text type="secondary">目标 {count(snapshot.northStar.wauTarget)}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <Card size="small">
            <Statistic title="周环比增长" value={snapshot.northStar.wowGrowth * 100} precision={1} suffix="%" prefix={<RiseOutlined />} valueStyle={{ color: snapshot.northStar.wowGrowth >= 0 ? COLORS.success : COLORS.danger }} />
            <Text type="secondary">与上一周活跃用户比较</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <Card size="small">
            <Statistic title="7 日新增注册" value={snapshot.acquisition.signupsLast7d} prefix={<UserAddOutlined />} />
            <Text type="secondary">新增创作者 {count(snapshot.acquisition.newCreatorsLast7d)}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <Card size="small">
            <Statistic title="周留存率" value={snapshot.retention.weeklyRetentionRate * 100} precision={1} suffix="%" valueStyle={{ color: COLORS.success }} />
            <Text type="secondary">回流 {count(snapshot.retention.returningCreators)} 人</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <Card size="small">
            <Statistic title="MRR" value={snapshot.revenue.mrr} precision={0} prefix={<DollarOutlined />} valueStyle={{ color: COLORS.success }} />
            <Text type="secondary">付费 {count(snapshot.revenue.paidUsers)} · ARPU {currency(snapshot.revenue.arpu)}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <Card size="small">
            <Statistic title="7 日 API 调用" value={snapshot.referral.publicApiCallsLast7d} prefix={<ApiOutlined />} />
            <Text type="secondary">配额触顶 {count(snapshot.referral.quotaHitsLast7d)}</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} xl={14}>
          <Card title="12 周 WAU 趋势" size="small">
            <ReactECharts option={trendOption} style={{ height: 320 }} notMerge lazyUpdate />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="用户增长漏斗" size="small">
            <ReactECharts option={funnelOption} style={{ height: 320 }} notMerge lazyUpdate />
          </Card>
        </Col>
      </Row>

      {/* 毛利看板：仅管理员可见，聚合收入−成本，绝不对客户开放 */}
      <ProfitDashboard dark={dark} />

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} xl={14}>
          <Card title="变现质量" size="small">
            <ReactECharts option={revenueOption} style={{ height: 300 }} notMerge lazyUpdate />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="配额压力与升级机会" size="small">
            <ReactECharts option={quotaOption} style={{ height: 300 }} notMerge lazyUpdate />
            <Space wrap>
              <Tag color="blue">付费转化代理值 {pct(analysis.paidConversionProxy)}</Tag>
              <Tag color={analysis.quotaPressure > 0.05 ? 'orange' : 'green'}>触顶率 {pct(analysis.quotaPressure)}</Tag>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="指标体系与数据源映射" size="small" style={{ marginTop: 12 }}>
        <Table
          rowKey="key"
          dataSource={rows}
          columns={columns}
          pagination={false}
          size="small"
          scroll={{ x: 980 }}
        />
      </Card>

      <Card title="看板口径" size="small" style={{ marginTop: 12 }}>
        <Paragraph style={{ marginBottom: 8 }}>
          <Text strong>北极星指标：</Text>WAU 周活跃创作者。该平台的商业闭环依赖创作者持续使用知识库、AI 对话、MCP、客服、开放 API 与媒体生成能力，WAU 比注册总数更能反映真实价值沉淀。
        </Paragraph>
        <Paragraph style={{ marginBottom: 8 }}>
          <Text strong>数据源：</Text>用户来自 <Text code>User</Text>，变现来自 <Text code>Order</Text>，活跃和配额压力来自 <Text code>ApiUsageLog</Text>。当前页面不新增表结构，直接复用后端聚合层。
        </Paragraph>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          后续如果新增专门的 user_activity 事件表，只需要替换后端 <Text code>getActiveUserIds()</Text> 的数据源，前端图表和指标体系无需重写。
        </Paragraph>
      </Card>
    </div>
  );
}

/**
 * 毛利看板（仅管理员可见）
 * 聚合：∑已支付收入（订阅/积分/私有化） − ∑全站 AI 成本（按日汇总）。
 * 数据来自后端 /api/billing/profit-summary（requireAdmin 守卫），绝不对客户开放。
 */
function ProfitDashboard({ dark }: { dark: boolean }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res: any = await billingAPI.getProfitSummary(month);
      setData(res?.data ?? null);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) setError('需要管理员权限');
      else setError(extractApiError(err, '毛利看板加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const fenToYuan = (fen: number) => `¥${((fen || 0) / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
  const axis = makeAxis(dark);
  const costChart = data ? {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 52, right: 20, top: 24, bottom: 30 },
    xAxis: { type: 'category', data: (data.dailyCost || []).map((_: any, i: number) => `${i + 1}`), ...axis },
    yAxis: { type: 'value', ...axis },
    series: [{
      name: '每日 AI 成本(元)',
      type: 'line',
      smooth: true,
      data: (data.dailyCost || []).map((v: number) => (v / 100).toFixed(2)),
      lineStyle: { color: COLORS.danger, width: 2 },
      itemStyle: { color: COLORS.danger },
      areaStyle: { color: 'rgba(225,112,85,0.18)' },
    }],
  } : {};

  return (
    <Card
      title="💰 毛利看板（内部 · 仅管理员）"
      size="small"
      style={{ marginTop: 12 }}
      extra={
        <Space>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${dark ? COLORS.splitDark : COLORS.splitLight}` }}
          />
          <Button size="small" icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </Space>
      }
    >
      {error ? (
        <Alert type="warning" showIcon message={error} />
      ) : loading && !data ? (
        <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
      ) : data ? (
        <>
          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}>
              <Statistic title="总收入" value={fenToYuan(data.revenue?.total)} valueStyle={{ color: COLORS.success }} />
              <Text type="secondary">订阅 {fenToYuan(data.revenue?.subscription)} / 积分 {fenToYuan(data.revenue?.credits_pack)} / 私有化 {fenToYuan(data.revenue?.private_license)}</Text>
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="总成本(AI)" value={fenToYuan(data.cost)} valueStyle={{ color: COLORS.danger }} />
              <Text type="secondary">全站模型调用估算成本</Text>
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="毛利" value={fenToYuan(data.grossProfit)} valueStyle={{ color: COLORS.primary }} />
              <Text type="secondary">收入 − 成本</Text>
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="毛利率" value={data.margin} suffix="%" valueStyle={{ color: data.margin >= 0 ? COLORS.success : COLORS.danger }} />
              <Text type="secondary">订单数 {data.orderCount}</Text>
            </Col>
          </Row>
          <div style={{ marginTop: 12 }}>
            <ReactECharts option={costChart} style={{ height: 240 }} notMerge lazyUpdate />
          </div>
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 8 }}
            message="内部数据，严禁对客户展示。利润 = 会员/积分/私有化收入 − 全站 AI 调用成本。"
          />
        </>
      ) : null}
    </Card>
  );
}
