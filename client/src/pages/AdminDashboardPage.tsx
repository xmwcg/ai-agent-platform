// client/src/pages/AdminDashboardPage.tsx
//
// Internal operations dashboard (admin only). North-Star: Weekly Active
// Creators (WAU). Reuses the project's antd 5 + echarts + dark theme tokens
// (client/src/theme/tokens.ts -> THEME_COLORS.dark / BRAND).
//
// Self-contained: creates its own axios instance so it does NOT modify
// services/api.ts. Token is read from localStorage (same convention as the
// global apiClient interceptor).
//
// Route: /admin/dashboard  (register in client/src/router.tsx, see router.patch.tsx)

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Col, Row, Statistic, Progress, Tag, Table, Spin, Typography, Alert, Space, Tooltip,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';
import { extractApiError } from '@/services/api';
import { useUIStore } from '@/stores/ui';

const { Title, Text, Paragraph } = Typography;

// --- self-contained api client (does not touch services/api.ts) ---
const opsApi = axios.create({ baseURL: '/api', timeout: 15000 });
opsApi.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

interface Snapshot {
  northStar: { wau: number; wauTarget: number; wowGrowth: number };
  acquisition: { signupsLast7d: number; newCreatorsLast7d: number };
  activation: { activatedLast7d: number; activationRate: number };
  retention: { weeklyRetentionRate: number; returningCreators: number };
  revenue: { mrr: number; paidUsers: number; arpu: number; ordersLast7d: number };
  referral: { referralSignupsLast7d: number; publicApiCallsLast7d: number; quotaHitsLast7d: number };
  trend: { week: string; wau: number }[];
}

// project tokens (client/src/theme/tokens.ts)
const C = {
  primary: '#6c5ce7',
  success: '#00b894',
  warning: '#fdcb6e',
  danger: '#e17055',
  darkText: '#9ca3af',
  darkAxis: '#1f2340',
  darkSplit: '#181b30',
  lightText: '#5a6170',
  lightAxis: '#e8ecf2',
};

type Status = { color: string; label: string };
function role(cur: number, target: number): Status {
  if (target <= 0) return { color: C.primary, label: '观测' };
  const r = cur / target;
  if (r >= 0.9) return { color: C.success, label: '健康' };
  if (r >= 0.6) return { color: C.warning, label: '警戒' };
  return { color: C.danger, label: '风险' };
}

export default function AdminDashboardPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const themeMode = useUIStore((s) => s.themeMode);
  const dark = themeMode === 'dark';

  const load = () => {
    setLoading(true);
    setErr('');
    opsApi
      .get('/ops/snapshot')
      .then((r) => setSnap(r.data?.data ?? null))
      .catch((e) => {
        if (e?.response?.status === 403) setErr('无访问权限：仅管理员可查看运营看板。');
        else setErr(extractApiError(e, '加载失败，请稍后重试'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const trendOption = useMemo(() => {
    if (!snap) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { left: 56, right: 24, top: 36, bottom: 36 },
      xAxis: {
        type: 'category',
        data: snap.trend.map((t) => t.week),
        axisLine: { lineStyle: { color: dark ? C.darkAxis : C.lightAxis } },
        axisLabel: { color: dark ? C.darkText : C.lightText },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: dark ? C.darkAxis : C.lightAxis } },
        axisLabel: { color: dark ? C.darkText : C.lightText },
        splitLine: { lineStyle: { color: dark ? C.darkSplit : '#f1f4f9' } },
      },
      series: [
        {
          name: 'WAU',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: snap.trend.map((t) => t.wau),
          lineStyle: { color: C.primary, width: 3 },
          itemStyle: { color: C.primary },
          areaStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
              { offset: 0, color: 'rgba(108,92,231,0.30)' },
              { offset: 1, color: 'rgba(108,92,231,0.02)' },
            ] },
          },
          markLine: {
            symbol: 'none',
            data: [{ yAxis: snap.northStar.wauTarget, name: '目标' }],
            lineStyle: { type: 'dashed', color: C.warning, width: 2 },
            label: { formatter: '目标 {c}', color: C.warning },
          },
        },
      ],
    };
  }, [snap, dark]);

  if (loading) return <Spin style={{ display: 'block', margin: '60px auto' }} />;
  if (err) return <Alert type="error" showIcon message={err} style={{ margin: 16 }} />;
  if (!snap) return null;

  const ns = role(snap.northStar.wau, snap.northStar.wauTarget);
  const wow = snap.northStar.wowGrowth;
  const wauPct = Math.round((snap.northStar.wau / snap.northStar.wauTarget) * 100);

  const rows = [
    { cat: '北极星', hl: true, name: '周活跃创作用户 WAU', current: snap.northStar.wau, target: snap.northStar.wauTarget, status: ns },
    { cat: '获取', hl: false, name: '周新注册用户', current: snap.acquisition.signupsLast7d, target: 1000, status: role(snap.acquisition.signupsLast7d, 1000) },
    { cat: '获取', hl: false, name: '周新增创作者', current: snap.acquisition.newCreatorsLast7d, target: 500, status: role(snap.acquisition.newCreatorsLast7d, 500) },
    { cat: '激活', hl: false, name: '激活率（注册→活跃）', current: `${(snap.activation.activationRate * 100).toFixed(1)}%`, target: '40%', status: role(snap.activation.activationRate, 0.4) },
    { cat: '留存', hl: true, name: '周留存率', current: `${(snap.retention.weeklyRetentionRate * 100).toFixed(1)}%`, target: '60%', status: role(snap.retention.weeklyRetentionRate, 0.6) },
    { cat: '留存', hl: true, name: '回流创作者', current: snap.retention.returningCreators, target: '-', status: { color: C.primary, label: '观测' } },
    { cat: '收入', hl: false, name: 'MRR（月经常性收入）', current: `¥${snap.revenue.mrr.toFixed(0)}`, target: '¥200,000', status: role(snap.revenue.mrr, 200000) },
    { cat: '收入', hl: false, name: '付费用户数', current: snap.revenue.paidUsers, target: 1000, status: role(snap.revenue.paidUsers, 1000) },
    { cat: '收入', hl: false, name: 'ARPU（客单价）', current: `¥${snap.revenue.arpu.toFixed(1)}`, target: '¥39', status: role(snap.revenue.arpu, 39) },
    { cat: '推荐', hl: false, name: '周推荐转化注册', current: snap.referral.referralSignupsLast7d, target: 100, status: role(snap.referral.referralSignupsLast7d, 100) },
    { cat: '推荐', hl: false, name: '周 API 调用量', current: snap.referral.publicApiCallsLast7d, target: 50000, status: role(snap.referral.publicApiCallsLast7d, 50000) },
    { cat: '推荐', hl: false, name: '周配额触顶次数', current: snap.referral.quotaHitsLast7d, target: 200, status: role(snap.referral.quotaHitsLast7d, 200) },
  ];

  const columns = [
    { title: '分类', dataIndex: 'cat', width: 80, render: (v: string, r: any) =>
      <Tag color={r.hl ? 'purple' : 'default'}>{v}</Tag> },
    { title: '指标', dataIndex: 'name' },
    { title: '当前值', dataIndex: 'current' },
    { title: '目标值', dataIndex: 'target' },
    { title: '状态', dataIndex: 'status', render: (s: Status) => <Tag color={s.color}>{s.label}</Tag> },
  ];

  return (
    <div style={{ padding: 4 }}>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Title level={4} style={{ margin: 0 }}>运营看板 · 北极星指标体系</Title>
        <Tooltip title="刷新">
          <ReloadOutlined onClick={load} style={{ fontSize: 16, cursor: 'pointer', color: 'var(--text-secondary)' }} />
        </Tooltip>
      </Space>

      {/* KPI 卡 */}
      <Row gutter={[12, 12]}>
        <Col xs={12} md={8} lg={4}>
          <Card size="small">
            <Statistic title="WAU 周活跃创作者" value={snap.northStar.wau} valueStyle={{ color: ns.color }} />
            <Progress percent={wauPct} size="small" strokeColor={ns.color} />
            <Tag color={ns.color}>{ns.label}</Tag>
          </Card>
        </Col>
        <Col xs={12} md={8} lg={4}>
          <Card size="small">
            <Statistic title="WoW 周环比" value={wow * 100} precision={1} suffix="%" valueStyle={{ color: wow >= 0 ? C.success : C.danger }} />
            <Text type="secondary" style={{ fontSize: 12 }}>{wow >= 0 ? '较上周增长' : '较上周下降'}</Text>
          </Card>
        </Col>
        <Col xs={12} md={8} lg={4}>
          <Card size="small">
            <Statistic title="MRR" value={snap.revenue.mrr} prefix="¥" precision={0} />
            <Text type="secondary" style={{ fontSize: 12 }}>付费 {snap.revenue.paidUsers} · ARPU ¥{snap.revenue.arpu.toFixed(0)}</Text>
          </Card>
        </Col>
        <Col xs={12} md={8} lg={4}>
          <Card size="small">
            <Statistic title="周留存率" value={snap.retention.weeklyRetentionRate * 100} precision={1} suffix="%" valueStyle={{ color: role(snap.retention.weeklyRetentionRate, 0.6).color }} />
            <Text type="secondary" style={{ fontSize: 12 }}>回流 {snap.retention.returningCreators} 人</Text>
          </Card>
        </Col>
        <Col xs={12} md={8} lg={4}>
          <Card size="small">
            <Statistic title="周新增创作者" value={snap.acquisition.newCreatorsLast7d} />
            <Text type="secondary" style={{ fontSize: 12 }}>新注册 {snap.acquisition.signupsLast7d}</Text>
          </Card>
        </Col>
        <Col xs={12} md={8} lg={4}>
          <Card size="small">
            <Statistic title="周 API 调用" value={snap.referral.publicApiCallsLast7d} />
            <Text type="secondary" style={{ fontSize: 12 }}>配额触顶 {snap.referral.quotaHitsLast7d}</Text>
          </Card>
        </Col>
      </Row>

      {/* 趋势 */}
      <Card title="12 周 WAU 趋势" size="small" style={{ marginTop: 16 }}>
        <ReactECharts option={trendOption} style={{ height: 300 }} />
      </Card>

      {/* 明细表 */}
      <Card title="指标明细（北极星 → 获取/激活/留存/收入/推荐）" size="small" style={{ marginTop: 16 }}>
        <Table
          dataSource={rows}
          columns={columns}
          pagination={false}
          rowKey="name"
          size="small"
          rowClassName={(r: any) => (r.hl ? 'ops-row-hl' : '')}
        />
      </Card>

      {/* 指标治理说明 */}
      <Card title="指标治理说明" size="small" style={{ marginTop: 16 }}>
        <Paragraph style={{ marginBottom: 8 }}>
          <Text strong>为什么选 WAU 作为北极星：</Text>平台是供给侧（创作者）驱动的订阅 SaaS，
          创作者每周回流持续沉淀资产（知识文档/客服机器人/MCP/API Key）形成切换成本；
          变现引擎（配额触顶→402→升级）只有在创作者周回流时才被触发。WAU 同时反映「规模」与「健康」，
          比 DAU 更稳、比注册数更真。
        </Paragraph>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          <Text strong>虚荣指标反例（不作为北极星）：</Text>注册总数（不反映活跃）、累计文档数（只增不减）、
          总 API 调用量（无去重无价值）、客服部署总数（不等于使用）、粉丝数（可注水）。这些仅作辅助观测。
        </Paragraph>
      </Card>
    </div>
  );
}
