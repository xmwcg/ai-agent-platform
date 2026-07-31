import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Statistic, Tag, Badge, Button, Table, Space, Typography, Spin, Progress, Tooltip, Alert } from 'antd';
import {
  DashboardOutlined, ApiOutlined, CloudServerOutlined, TeamOutlined, ThunderboltOutlined,
  WarningOutlined, CheckCircleOutlined, ReloadOutlined, RobotOutlined,
  DollarOutlined, ClusterOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import apiClient, { extractApiError } from '@/services/api';

const { Title, Text } = Typography;

interface DashboardData {
  system: { cpu: number; memory: { total: number; free: number; usedPercent: number }; uptime: number; platform: string; hostname: string };
  services: Record<string, { status: string; port: number | null }>;
  models: { count: number; providers: string[] };
  ops: any;
  public: any;
  alerts: Array<{ level: string; message: string; fix?: string }>;
  timestamp: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/ops/dashboard');
      setData(res.data.data);
      setError('');
    } catch (e) {
      setError(extractApiError(e, '获取监控数据失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 30000); return () => clearInterval(t); }, [fetchData]);

  const handleQuickFix = async () => {
    try { await apiClient.post('/diagnostics/quick-fix'); fetchData(); } catch { /* ignore */ }
  };

  if (loading && !data) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" tip="加载监控数据..." /></div>;
  if (error && !data) return <Alert type="error" message={error} action={<Button onClick={fetchData}>重试</Button>} />;

  const cpuOpt = {
    grid: { top: 10, right: 10, bottom: 0, left: 0 },
    series: [{
      type: 'gauge', radius: '85%', center: ['50%', '55%'],
      axisLine: { lineStyle: { width: 12, color: [[0.3, '#10b981'], [0.7, '#f59e0b'], [1, '#ef4444']] } },
      axisTick: { show: false }, splitLine: { show: false },
      detail: { fontSize: 18, formatter: '{value}%', offsetCenter: [0, '60%'] },
      data: [{ value: data?.system.cpu || 0, name: 'CPU' }],
    }],
  };

  const memOpt = {
    grid: { top: 10, right: 10, bottom: 0, left: 0 },
    series: [{
      type: 'gauge', radius: '85%', center: ['50%', '55%'],
      axisLine: { lineStyle: { width: 12, color: [[0.5, '#6366f1'], [0.8, '#f59e0b'], [1, '#ef4444']] } },
      axisTick: { show: false }, splitLine: { show: false },
      detail: { fontSize: 18, formatter: '{value}%', offsetCenter: [0, '60%'] },
      data: [{ value: data?.system.memory.usedPercent || 0, name: '内存' }],
    }],
  };

  const alerts = data?.alerts || [];

  return (
    <div style={{ padding: '16px 20px', maxWidth: 1440, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <DashboardOutlined style={{ fontSize: 24, color: '#6366f1' }} />
          <Title level={4} style={{ margin: 0 }}>NexMind by AIbak · 全域实时监控</Title>
          <Tag color="green">● 在线</Tag>
        </Space>
        <Space>
          <Text type="secondary">{new Date(data?.timestamp || '').toLocaleTimeString()}</Text>
          <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchData}>刷新</Button>
          {alerts.length > 0 && (
            <Button type="primary" danger icon={<WarningOutlined />} onClick={handleQuickFix}>
              一键修复 ({alerts.length})
            </Button>
          )}
        </Space>
      </div>

      {alerts.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`${alerts.length} 个告警`}
          description={
            <Table
              size="small"
              pagination={false}
              dataSource={alerts.map((a, i) => ({ ...a, key: i }))}
              columns={[
                { title: '级别', dataIndex: 'level', width: 70, render: (v: string) => <Tag color={v === 'critical' ? 'red' : v === 'warning' ? 'orange' : 'blue'}>{v}</Tag> },
                { title: '信息', dataIndex: 'message' },
                { title: '修复建议', dataIndex: 'fix', render: (v: string) => v ? <Text type="secondary">{v}</Text> : '-' },
              ]}
            />
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* KPI Row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {[
          { title: '活跃用户', value: data?.public?.totalCreators || 0, icon: <TeamOutlined />, color: '#6366f1' },
          { title: 'API 调用/周', value: data?.public?.weeklyActiveCreators || 0, icon: <ApiOutlined />, color: '#10b981' },
          { title: '接入模型', value: data?.models?.count || 0, icon: <RobotOutlined />, color: '#f59e0b' },
          { title: '运行时间', value: data?.system?.uptime ? `${Math.floor(data.system.uptime / 3600)}h` : '--', icon: <CloudServerOutlined />, color: '#ec4899' },
          { title: '服务状态', value: Object.values(data?.services || {}).every((s: any) => s.status === 'healthy') ? '全部正常' : '异常', icon: <CheckCircleOutlined />, color: '#8b5cf6' },
        ].map((kpi, i) => (
          <Col xs={12} sm={8} md={4} lg={Math.floor(24 / 5)} key={i}>
            <Card size="small" style={{ borderLeft: `3px solid ${kpi.color}` }}>
              <Statistic title={kpi.title} value={kpi.value} prefix={kpi.icon} valueStyle={{ fontSize: 20 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Main Grid */}
      <Row gutter={[12, 12]}>
        {/* Gauges */}
        <Col xs={24} md={8}>
          <Card size="small" title="系统资源">
            <Row>
              <Col span={12}><ReactECharts option={cpuOpt} style={{ height: 150 }} /></Col>
              <Col span={12}><ReactECharts option={memOpt} style={{ height: 150 }} /></Col>
            </Row>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">主机: {data?.system.hostname} | {data?.system.platform} | 内存: {data?.system.memory.total}MB</Text><br />
              <Text type="secondary">后端 :3000 <Badge status="success" /> | 代理 :8080 <Badge status="success" /> | Tunnel <Badge status="success" /></Text>
            </div>
          </Card>
        </Col>

        {/* Service Topology */}
        <Col xs={24} md={10}>
          <Card size="small" title="服务调用拓扑 · 实时数据流">
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', padding: '20px 0', flexWrap: 'wrap' }}>
              {[
                { label: '用户', color: '#6366f1', icon: <TeamOutlined /> },
                { label: 'Cloudflare', color: '#f59e0b', icon: <CloudServerOutlined /> },
                { label: 'Tunnel', color: '#10b981', icon: <ApiOutlined /> },
                { label: 'serve.js\n:8080', color: '#ec4899', icon: <ClusterOutlined /> },
                { label: 'Backend\n:3000', color: '#8b5cf6', icon: <ThunderboltOutlined /> },
                { label: 'MongoDB\nRedis', color: '#f43f5e', icon: <SafetyCertificateOutlined /> },
                { label: 'AI Models\nAgnes/混元', color: '#06b6d4', icon: <RobotOutlined /> },
              ].map((node, i, arr) => (
                <React.Fragment key={i}>
                  <div style={{
                    background: node.color + '22', border: `1px solid ${node.color}`, borderRadius: 8,
                    padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: node.color,
                    whiteSpace: 'pre-line', minWidth: 60
                  }}>
                    <div style={{ fontSize: 16, marginBottom: 2 }}>{node.icon}</div>
                    {node.label}
                  </div>
                  {i < arr.length - 1 && <Text style={{ color: '#666' }}>→</Text>}
                </React.Fragment>
              ))}
            </div>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                DNS: aibak.site → Cloudflare Edge (LAX) → Tunnel QUIC → localhost:8080 → API proxy → :3000
              </Text>
            </div>
          </Card>
        </Col>

        {/* Model List */}
        <Col xs={24} md={6}>
          <Card size="small" title="AI 模型供应">
            {data?.models?.providers?.map((p: string) => (
              <div key={p} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Text>{p}</Text>
                <Badge status="success" text="可用" />
              </div>
            ))}
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">总计: {data?.models?.count || 0} 个 Provider</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Bottom: Stats Table */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col span={24}>
          <Card size="small" title="平台运营指标">
            <Row gutter={[16, 8]}>
              {[
                { label: '注册用户', value: data?.ops?.totalCreators || '--' },
                { label: '付费用户', value: data?.ops?.paidCreators || '--' },
                { label: '本周活跃', value: data?.ops?.weeklyActiveCreators || '--' },
                { label: '知识文档', value: data?.public?.totalKnowledge || '--' },
                { label: '公开报告', value: data?.public?.totalPublishedReports || '--' },
                { label: '付费转化率', value: data?.ops?.conversionRate ? `${(data.ops.conversionRate * 100).toFixed(1)}%` : '--' },
              ].map((s, i) => (
                <Col xs={12} sm={8} md={4} key={i}>
                  <Statistic title={s.label} value={s.value} valueStyle={{ fontSize: 18 }} />
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
