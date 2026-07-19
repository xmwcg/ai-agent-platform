import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Tag, List, Progress, Alert, Button, Space, Tabs, Table, Badge, Descriptions, Statistic, Row, Col, Tooltip,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, DashboardOutlined,
  WalletOutlined, ApiOutlined, WarningOutlined,
} from '@ant-design/icons';
import { diagnosticsAPI, billingAPI, extractApiError } from '@/services/api';

const { Title, Text, Paragraph } = Typography;

interface Check { key: string; label: string; ok: boolean; tip: string; }
interface MediaP { name: string; label: string; configured: boolean; }
interface WebhookEvent {
  _id: string;
  eventId: string;
  provider: string;
  orderNo?: string;
  status: string;
  errorMessage?: string;
  receivedAt: string;
  processedAt?: string;
}

function formatTime(iso: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

const DiagnosticsPage: React.FC = () => {
  const [checks, setChecks] = useState<Check[]>([]);
  const [media, setMedia] = useState<MediaP[]>([]);
  const [mockMode, setMockMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [webhookSummary, setWebhookSummary] = useState<any>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await diagnosticsAPI.check();
      const body = (res && res.data) || {};
      const d = (body && body.data && typeof body.data === "object" && !Array.isArray(body.data)) ? body.data : body;
      setChecks(Array.isArray(d.checks) ? d.checks : []);
      setMedia(Array.isArray(d.mediaProviders) ? d.mediaProviders.filter(Boolean) : []);
      setMockMode(!!d.mockMode);
      setPaymentStatus(d.paymentStatus && typeof d.paymentStatus === "object" ? d.paymentStatus : null);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadWebhookEvents = async () => {
    setWebhookLoading(true);
    try {
      const res: any = await billingAPI.getWebhookEvents({ limit: 50 });
      setWebhookEvents(res?.data?.list || []);
      setWebhookSummary(res?.data?.summary || null);
    } catch { /* ignore */ }
    setWebhookLoading(false);
  };

  useEffect(() => { load(); loadWebhookEvents(); }, []);

  const okCount = checks.filter((c) => c.ok).length;
  const percent = checks.length ? Math.round((okCount / checks.length) * 100) : 0;

  const statusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'success';
      case 'failed': return 'error';
      case 'skipped': return 'warning';
      default: return 'default';
    }
  };
  const statusLabel = (status: string) => {
    switch (status) {
      case 'processed': return '已处理';
      case 'failed': return '失败';
      case 'skipped': return '已跳过';
      case 'received': return '已接收';
      default: return status;
    }
  };

  return (
    <div>
      <Title level={3}><DashboardOutlined /> 部署自检 / 健康看板</Title>
      <Paragraph type="secondary">
        一键检测各项依赖与厂商集成状态（不泄露任何密钥明文），快速定位部署问题。
      </Paragraph>

      {mockMode && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="当前为 Mock 模式：无需任何 API Key 即可演示，AI 返回模拟结果。" />
      )}

      <Tabs
        defaultActiveKey="integration"
        items={[
          {
            key: 'integration',
            label: '集成状态',
            children: (
              <>
                <Card title="集成状态" extra={<Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>}>
                  <Progress percent={percent} status={percent === 100 ? 'success' : 'active'} />
                  <List
                    loading={loading}
                    dataSource={checks}
                    renderItem={(c) => (
                      <List.Item>
                        <Space>
                          {c.ok ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                          <Text strong>{c.label}</Text>
                          <Tag color={c.ok ? 'success' : 'error'}>{c.ok ? '正常' : '未配置'}</Tag>
                          {!c.ok && c.tip && <Text type="secondary" style={{ fontSize: 12 }}>{c.tip}</Text>}
                        </Space>
                      </List.Item>
                    )}
                  />
                </Card>
                <Card title="媒体生成厂商" style={{ marginTop: 16 }}>
                  <Space wrap>
                    {(media||[]).filter(Boolean).map((m) => (
                      <Tag key={m.name} color={m.configured ? 'blue' : 'default'}>
                        {m.label} {m.configured ? '· 已接入' : '· 未接入(走Mock)'}
                      </Tag>
                    ))}
                  </Space>
                </Card>
              </>
            ),
          },
          {
            key: 'payment',
            label: (
              <span><WalletOutlined /> 支付管理</span>
            ),
            children: paymentStatus ? (
              <>
                {/* 当前支付渠道 */}
                <Card title="支付渠道配置" style={{ marginBottom: 16 }}>
                  <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                    <Descriptions.Item label="默认支付渠道">
                      <Tag color={(paymentStatus?.isReal ?? false) ? 'blue' : 'orange'}>
                        {(paymentStatus?.defaultProvider ?? "mock") === 'wechat' ? '微信支付' :
                         (paymentStatus?.defaultProvider ?? "mock") === 'stripe' ? 'Stripe' : 'Mock 模式'}
                      </Tag>
                      {!(paymentStatus?.isReal ?? false) && (
                        <Tooltip title="Mock 模式下所有支付均直接成功，无需真实凭证">
                          <WarningOutlined style={{ color: '#faad14', marginLeft: 8 }} />
                        </Tooltip>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="回调地址">
                      <Text code>{(paymentStatus?.notifyUrl ?? "")}</Text>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                {/* 微信支付 */}
                <Card title="微信支付" extra={
                  <Tag color={(paymentStatus?.wechat?.configured ?? false) ? 'success' : 'default'}>
                    {(paymentStatus?.wechat?.configured ?? false) ? '已配置' : '未配置'}
                  </Tag>
                } style={{ marginBottom: 16 }}>
                  <Descriptions bordered column={{ xs: 1, sm: 3 }} size="small">
                    <Descriptions.Item label="商户号">{(paymentStatus?.wechat?.mchId ?? "-") || '-'}</Descriptions.Item>
                    <Descriptions.Item label="AppID">{(paymentStatus?.wechat?.appId ?? "-") || '-'}</Descriptions.Item>
                    <Descriptions.Item label="APIv3 密钥">
                      {(paymentStatus?.wechat?.hasApiKey ?? false) ? <Tag color="success">已设置</Tag> : <Tag color="error">未设置</Tag>}
                    </Descriptions.Item>
                    <Descriptions.Item label="平台证书（验签）">
                      {(paymentStatus?.wechat?.hasPlatformCert ?? false) ? <Tag color="success">已设置</Tag> : <Tag color="warning">未设置</Tag>}
                    </Descriptions.Item>
                    <Descriptions.Item label="商户私钥">
                      {(paymentStatus?.wechat?.hasPrivateKey ?? false) ? <Tag color="success">已设置</Tag> : <Tag color="error">未设置</Tag>}
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                      {(paymentStatus?.wechat?.configured ?? false)
                        ? <Tag color="success">可投产</Tag>
                        : <Text type="secondary">请配置 WECHAT_MCH_ID / WECHAT_API_V3_KEY / WECHAT_PRIVATE_KEY</Text>}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                {/* Stripe */}
                <Card title="Stripe" extra={
                  <Tag color={(paymentStatus?.stripe?.configured ?? false) ? 'success' : 'default'}>
                    {(paymentStatus?.stripe?.configured ?? false) ? '已配置' : '未配置'}
                  </Tag>
                } style={{ marginBottom: 16 }}>
                  <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                    <Descriptions.Item label="Secret Key">
                      {(paymentStatus?.stripe?.hasSecretKey ?? false) ? <Tag color="success">已设置</Tag> : <Tag color="error">未设置</Tag>}
                    </Descriptions.Item>
                    <Descriptions.Item label="Webhook Secret">
                      {(paymentStatus?.stripe?.hasWebhookSecret ?? false) ? <Tag color="success">已设置</Tag> : <Tag color="error">未设置</Tag>}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                {/* 投产指引 */}
                <Alert
                  type="info"
                  showIcon
                  message="如何切换为真实支付？"
                  description={
                    <div>
                      <Paragraph style={{ marginBottom: 8 }}>
                        1. 在 <Text code>.env</Text> 中填入微信支付或 Stripe 的真实凭证
                      </Paragraph>
                      <Paragraph style={{ marginBottom: 8 }}>
                        2. 修改 <Text code>DEFAULT_PAY_PROVIDER=wechat</Text>（或 <Text code>stripe</Text>）
                      </Paragraph>
                      <Paragraph style={{ marginBottom: 8 }}>
                        3. 重启服务：<Text code>docker compose up -d --build server</Text>
                      </Paragraph>
                      <Paragraph style={{ marginBottom: 0 }}>
                        4. 确保 <Text code>PUBLIC_BASE_URL</Text> 为公网可访问的 HTTPS 地址（用于支付回调）
                      </Paragraph>
                    </div>
                  }
                />
              </>
            ) : (
              <Card loading />
            ),
          },
          {
            key: 'webhook',
            label: (
              <span><ApiOutlined /> Webhook 日志</span>
            ),
            children: (
              <Card
                title="Webhook 事件记录"
                extra={<Button icon={<ReloadOutlined />} onClick={loadWebhookEvents} loading={webhookLoading}>刷新</Button>}
              >
                {/* 统计摘要 */}
                {webhookSummary && (
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={6}>
                      <Statistic title="总事件" value={webhookSummary.total} suffix="条" />
                    </Col>
                    <Col span={6}>
                      <Statistic title="已处理" value={webhookSummary.processed} valueStyle={{ color: '#52c41a' }} suffix="条" />
                    </Col>
                    <Col span={6}>
                      <Statistic title="失败" value={webhookSummary.failed} valueStyle={{ color: webhookSummary.failed > 0 ? '#ff4d4f' : undefined }} suffix="条" />
                    </Col>
                    <Col span={6}>
                      <Statistic title="跳过" value={webhookSummary.skipped} valueStyle={{ color: '#faad14' }} suffix="条" />
                    </Col>
                  </Row>
                )}

                {/* 事件列表 */}
                <Table<WebhookEvent>
                  loading={webhookLoading}
                  dataSource={webhookEvents}
                  rowKey="_id"
                  size="small"
                  pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条` }}
                  columns={[
                    {
                      title: '事件 ID',
                      dataIndex: 'eventId',
                      key: 'eventId',
                      width: 200,
                      ellipsis: true,
                      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v?.slice(0, 24)}{(v?.length || 0) > 24 ? '...' : ''}</Text>,
                    },
                    {
                      title: '渠道',
                      dataIndex: 'provider',
                      key: 'provider',
                      width: 80,
                      render: (v: string) => <Tag>{v}</Tag>,
                    },
                    {
                      title: '订单号',
                      dataIndex: 'orderNo',
                      key: 'orderNo',
                      width: 180,
                      ellipsis: true,
                      render: (v: string) => v ? <Text code style={{ fontSize: 12 }}>{v}</Text> : '-',
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      width: 90,
                      render: (v: string) => <Badge status={statusColor(v) as any} text={statusLabel(v)} />,
                    },
                    {
                      title: '错误信息',
                      dataIndex: 'errorMessage',
                      key: 'errorMessage',
                      ellipsis: true,
                      render: (v: string) => v ? <Text type="danger" style={{ fontSize: 12 }}>{v}</Text> : '-',
                    },
                    {
                      title: '接收时间',
                      dataIndex: 'receivedAt',
                      key: 'receivedAt',
                      width: 170,
                      render: (v: string) => formatTime(v),
                    },
                    {
                      title: '处理时间',
                      dataIndex: 'processedAt',
                      key: 'processedAt',
                      width: 170,
                      render: (v: string) => v ? formatTime(v) : '-',
                    },
                  ]}
                  locale={{ emptyText: '暂无 Webhook 事件（Mock 模式下无外部回调）' }}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default DiagnosticsPage;

