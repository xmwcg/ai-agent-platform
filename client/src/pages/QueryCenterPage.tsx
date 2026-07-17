import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Divider, Empty, Input, List, message,
  Progress, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography,
} from 'antd';
import {
  ApiOutlined, BarChartOutlined, BookOutlined, CheckCircleOutlined,
  CopyOutlined, LinkOutlined, LockOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient, { extractApiError } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

const { Title, Paragraph, Text } = Typography;

interface ProviderProtocol {
  id: string;
  name: string;
  description: string;
  requestFormat: string;
}

interface ProviderEndpoint {
  id: string;
  name: string;
  region: string;
  baseUrl: string;
  modelListPath?: string;
  authMode: string;
  extraHeaders?: Record<string, string>;
}

interface ProviderCatalogEntry {
  id: string;
  name: string;
  category: 'domestic' | 'international';
  protocols: ProviderProtocol[];
  endpoints: ProviderEndpoint[];
  keyFormat: string;
  recommendedModels: string[];
  capabilities: string[];
  supportsModelFetch: boolean;
  officialWebsite: string;
  registrationUrl?: string;
  apiKeyGuideUrl?: string;
  officialDocsUrl: string;
  apiKeySteps: string[];
  commonErrors: string[];
  reviewedAt: string;
}

interface AccountSummary {
  plan: string;
  membershipExpiresAt: string | null;
  credits: {
    free: number;
    paid: number;
    legacyProtected: number;
    adjustment: number;
    total: number;
    cachedTotal: number;
    reconciled: boolean;
    migrationState: string;
  };
  monthUsage: { calls: number; successRate: number; creditsConsumed: number };
  recentOrder: any | null;
}

interface UsageData {
  totals: { calls: number; successRate: number; creditsConsumed: number };
  daily: Array<{ date: string; calls: number; success: number; creditsConsumed: number }>;
  resourceRanking: Array<{ resource: string; calls: number; creditsConsumed: number }>;
  modelRanking: Array<{ model: string; calls: number }>;
  modelTrackingAvailable: boolean;
  orders: any[];
  pricing: { plans: any[]; creditPackages: any[] };
}

function reviewedStatus(reviewedAt: string) {
  const age = Date.now() - new Date(`${reviewedAt}T00:00:00+08:00`).getTime();
  return age <= 180 * 86400 * 1000;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN') : '—';
}

export default function QueryCenterPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(['providers', 'docs', 'account'].includes(tabFromUrl || '') ? tabFromUrl! : 'providers');
  const [providers, setProviders] = useState<ProviderCatalogEntry[]>([]);
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerId, setProviderId] = useState(searchParams.get('provider') || '');
  const [endpointId, setEndpointId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelLoading, setModelLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [rangeDays, setRangeDays] = useState(30);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === providerId) || providers[0],
    [providerId, providers],
  );
  const selectedEndpoint = useMemo(
    () => selectedProvider?.endpoints.find((endpoint) => endpoint.id === endpointId) || selectedProvider?.endpoints[0],
    [endpointId, selectedProvider],
  );

  useEffect(() => {
    let cancelled = false;
    apiClient.get('/query-center/providers')
      .then((response: any) => {
        if (cancelled) return;
        const rows = Array.isArray(response?.data) ? response.data : [];
        setProviders(rows);
        const requested = searchParams.get('provider');
        const initial = rows.find((item: ProviderCatalogEntry) => item.id === requested) || rows[0];
        if (initial) {
          setProviderId(initial.id);
          setEndpointId(initial.endpoints[0]?.id || '');
        }
      })
      .catch((error) => message.error(extractApiError(error, '厂商目录加载失败')))
      .finally(() => !cancelled && setProviderLoading(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedProvider) return;
    if (!selectedProvider.endpoints.some((endpoint) => endpoint.id === endpointId)) {
      setEndpointId(selectedProvider.endpoints[0]?.id || '');
    }
    setModels([]);
    setApiKey('');
  }, [selectedProvider?.id]);

  const loadAccount = async (days = rangeDays) => {
    if (!user) return;
    setAccountLoading(true);
    const to = new Date();
    const from = new Date(to.getTime() - Math.max(days - 1, 0) * 86400 * 1000);
    try {
      const [summaryResponse, usageResponse]: any[] = await Promise.all([
        apiClient.get('/query-center/account-summary'),
        apiClient.get('/query-center/usage', { params: { from: from.toISOString(), to: to.toISOString(), groupBy: 'day' } }),
      ]);
      setSummary(summaryResponse?.data || null);
      setUsage(usageResponse?.data || null);
    } catch (error) {
      message.error(extractApiError(error, '账户统计加载失败'));
    } finally {
      setAccountLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'account' && user) void loadAccount();
  }, [activeTab, user?._id]);

  const changeTab = (key: string) => {
    setActiveTab(key);
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    message.success('已复制');
  };

  const fetchModels = async () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent('/query-center?tab=providers')}`);
      return;
    }
    if (!selectedProvider?.supportsModelFetch) {
      message.info('该厂商当前仅提供官方接入参考，不提供在线模型列表');
      return;
    }
    if (!apiKey.trim()) {
      message.warning('请输入仅用于本次查询的 API Key');
      return;
    }
    setModelLoading(true);
    setModels([]);
    try {
      const response: any = await apiClient.post(`/query-center/providers/${selectedProvider.id}/models`, {
        endpointId: selectedEndpoint?.id,
        apiKey,
      });
      const rows = Array.isArray(response?.data) ? response.data : [];
      setModels(rows);
      message.success(`已从官方 Endpoint 获取 ${rows.length} 个模型`);
    } catch (error) {
      message.error(extractApiError(error, '模型列表查询失败'));
    } finally {
      setApiKey('');
      setModelLoading(false);
    }
  };

  const providerPanel = (
    <Row gutter={[20, 20]}>
      <Col xs={24} lg={8}>
        <Card title="选择大模型厂商" loading={providerLoading}>
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            value={selectedProvider?.id}
            options={providers.map((provider) => ({ value: provider.id, label: provider.name }))}
            onChange={setProviderId}
          />
          {selectedProvider && (
            <>
              <Space wrap style={{ marginTop: 16 }}>
                <Tag color={selectedProvider.category === 'domestic' ? 'green' : 'blue'}>{selectedProvider.category === 'domestic' ? '国内厂商' : '国际厂商'}</Tag>
                <Tag color={reviewedStatus(selectedProvider.reviewedAt) ? 'green' : 'orange'}>
                  {reviewedStatus(selectedProvider.reviewedAt) ? '资料已核验' : '待重新核验'} · {selectedProvider.reviewedAt}
                </Tag>
              </Space>
              <Divider />
              <Text strong>支持能力</Text>
              <div style={{ marginTop: 8 }}>{selectedProvider.capabilities.map((item) => <Tag key={item}>{item}</Tag>)}</div>
              <Divider />
              <Button type="primary" block onClick={() => navigate('/model-config')}>前往模型配置中心</Button>
            </>
          )}
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        {selectedProvider && selectedEndpoint ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title="协议、地区与 Endpoint">
              <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
                <Descriptions.Item label="协议">{selectedProvider.protocols.map((item) => item.name).join(' / ')}</Descriptions.Item>
                <Descriptions.Item label="地区">
                  <Select style={{ minWidth: 180 }} value={selectedEndpoint.id} options={selectedProvider.endpoints.map((item) => ({ value: item.id, label: `${item.name} · ${item.region}` }))} onChange={setEndpointId} />
                </Descriptions.Item>
                <Descriptions.Item label="Base URL" span={2}>
                  <Space wrap><Text code>{selectedEndpoint.baseUrl}</Text><Button type="text" icon={<CopyOutlined />} onClick={() => copy(selectedEndpoint.baseUrl)} /></Space>
                </Descriptions.Item>
                <Descriptions.Item label="模型列表 Endpoint" span={2}>
                  <Text code>{selectedEndpoint.modelListPath ? `${selectedEndpoint.baseUrl.replace(/\/$/, '')}/${selectedEndpoint.modelListPath.replace(/^\//, '')}` : '厂商未开放统一模型列表接口'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="鉴权方式">{selectedEndpoint.authMode}</Descriptions.Item>
                <Descriptions.Item label="API Key 格式">{selectedProvider.keyFormat}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="实时获取当前可用模型">
              {!selectedProvider.supportsModelFetch && <Alert showIcon type="info" message="仅提供接入参考" description="该厂商暂未提供可可靠适配的官方模型列表接口，本站不会伪造实时模型清单。" style={{ marginBottom: 16 }} />}
              {!user && <Alert showIcon type="warning" message="登录后才能使用真实 API Key 查询" style={{ marginBottom: 16 }} />}
              <Input.Password
                autoComplete="off"
                value={apiKey}
                disabled={!selectedProvider.supportsModelFetch}
                placeholder="API Key 仅用于本次请求，不保存、不写日志"
                onChange={(event) => setApiKey(event.target.value)}
                onPressEnter={fetchModels}
              />
              <Space wrap style={{ marginTop: 12 }}>
                <Button type="primary" icon={<ReloadOutlined />} loading={modelLoading} disabled={!selectedProvider.supportsModelFetch} onClick={fetchModels}>查询模型列表</Button>
                <Text type="secondary"><LockOutlined /> 查询完成后输入框自动清空，不会自动保存配置。</Text>
              </Space>
              {models.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>官方接口返回模型（{models.length}）</Text>
                  <div style={{ marginTop: 8, maxHeight: 220, overflowY: 'auto' }}>{models.map((model) => <Tag key={model} style={{ marginBottom: 8 }}>{model}</Tag>)}</div>
                </div>
              )}
            </Card>

            <Card title="推荐模型参考">
              {selectedProvider.recommendedModels.map((model) => <Tag color="purple" key={model}>{model}</Tag>)}
              <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>推荐清单仅用于配置参考，实际可用模型以厂商账户权限和实时查询结果为准。</Paragraph>
            </Card>
          </Space>
        ) : <Empty description="暂无厂商目录" />}
      </Col>
    </Row>
  );

  const docsPanel = selectedProvider ? (
    <Row gutter={[20, 20]}>
      <Col xs={24} lg={8}>
        <Card title="厂商文档索引">
          <Select style={{ width: '100%' }} value={selectedProvider.id} options={providers.map((provider) => ({ value: provider.id, label: provider.name }))} onChange={setProviderId} />
          <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
            <Button href={selectedProvider.officialWebsite} target="_blank" rel="noreferrer" icon={<LinkOutlined />} block>官方网站</Button>
            {selectedProvider.registrationUrl && <Button href={selectedProvider.registrationUrl} target="_blank" rel="noreferrer" icon={<LinkOutlined />} block>注册账号入口</Button>}
            {selectedProvider.apiKeyGuideUrl && <Button href={selectedProvider.apiKeyGuideUrl} target="_blank" rel="noreferrer" icon={<LinkOutlined />} block>获取 API Key</Button>}
            <Button type="primary" href={selectedProvider.officialDocsUrl} target="_blank" rel="noreferrer" icon={<BookOutlined />} block>官方接入指南</Button>
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Card title={`${selectedProvider.name} 接入参考`} extra={<Tag color={reviewedStatus(selectedProvider.reviewedAt) ? 'green' : 'orange'}>最后审核：{selectedProvider.reviewedAt}</Tag>}>
          {!reviewedStatus(selectedProvider.reviewedAt) && <Alert showIcon type="warning" message="资料超过 180 天未复核，请优先以厂商官方文档为准。" style={{ marginBottom: 16 }} />}
          <Title level={5}>获取 API Key 步骤</Title>
          <List dataSource={selectedProvider.apiKeySteps} renderItem={(item, index) => <List.Item><Space><CheckCircleOutlined style={{ color: '#52c41a' }} /><Text>{index + 1}. {item}</Text></Space></List.Item>} />
          <Divider />
          <Title level={5}>协议与接入地址</Title>
          {selectedProvider.protocols.map((protocol) => <Paragraph key={protocol.id}><Text strong>{protocol.name}</Text>：{protocol.description}</Paragraph>)}
          {selectedProvider.endpoints.map((endpoint) => <Descriptions key={endpoint.id} size="small" bordered column={1} style={{ marginBottom: 12 }}><Descriptions.Item label={`${endpoint.name} · ${endpoint.region}`}><Text code>{endpoint.baseUrl}</Text></Descriptions.Item></Descriptions>)}
          <Divider />
          <Title level={5}>常见错误</Title>
          <List size="small" dataSource={selectedProvider.commonErrors} renderItem={(item) => <List.Item>{item}</List.Item>} />
        </Card>
      </Col>
    </Row>
  ) : <Empty description="暂无厂商文档" />;

  const accountPanel = !user ? (
    <Card style={{ textAlign: 'center', padding: 24 }}>
      <LockOutlined style={{ fontSize: 36, color: '#6c5ce7' }} />
      <Title level={4}>登录后查询个人真实数据</Title>
      <Paragraph type="secondary">订单、免费额度、付费额度和用量只在用户本人登录后展示，不进入全站搜索结果。</Paragraph>
      <Button type="primary" onClick={() => navigate('/login?redirect=/query-center?tab=account')}>立即登录</Button>
    </Card>
  ) : (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card loading={accountLoading} title="额度与会员摘要" extra={<Button icon={<ReloadOutlined />} onClick={() => loadAccount()}>刷新真实数据</Button>}>
        {summary && (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={12} md={6}><Statistic title="总可用额度" value={summary.credits.total} /></Col>
              <Col xs={12} md={6}><Statistic title="免费额度" value={summary.credits.free} /></Col>
              <Col xs={12} md={6}><Statistic title="付费额度" value={summary.credits.paid} /></Col>
              <Col xs={12} md={6}><Statistic title="历史保护额度" value={summary.credits.legacyProtected} /></Col>
            </Row>
            <Divider />
            <Descriptions column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="当前套餐"><Tag color="blue">{summary.plan.toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="会员到期">{formatDate(summary.membershipExpiresAt)}</Descriptions.Item>
              <Descriptions.Item label="兼容余额缓存">{summary.credits.cachedTotal}</Descriptions.Item>
              <Descriptions.Item label="额度状态"><Tag color={summary.credits.reconciled ? 'green' : 'orange'}>{summary.credits.reconciled ? '余额与批次一致' : '历史余额待迁移/核对'}</Tag></Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Card>

      <Card loading={accountLoading} title="用量统计" extra={<Space>{[1, 7, 30].map((days) => <Button key={days} type={rangeDays === days ? 'primary' : 'default'} size="small" onClick={() => { setRangeDays(days); void loadAccount(days); }}>{days === 1 ? '今日' : `近 ${days} 天`}</Button>)}</Space>}>
        {usage && (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={12} md={8}><Statistic title="调用次数" value={usage.totals.calls} /></Col>
              <Col xs={12} md={8}><Statistic title="成功率" value={usage.totals.successRate} suffix="%" /></Col>
              <Col xs={12} md={8}><Statistic title="积分消耗" value={usage.totals.creditsConsumed} /></Col>
            </Row>
            <Divider />
            <Title level={5}>按日趋势</Title>
            {usage.daily.length ? usage.daily.map((row) => (
              <div key={row.date} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <Text>{row.date.slice(5)}</Text>
                <Progress percent={usage.totals.calls ? Math.round((row.calls / Math.max(...usage.daily.map((item) => item.calls), 1)) * 100) : 0} showInfo={false} />
                <Text>{row.calls} 次</Text>
              </div>
            )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该时间范围暂无调用记录" />}
            <Divider />
            <Title level={5}>使用资源排行</Title>
            <List size="small" dataSource={usage.resourceRanking} locale={{ emptyText: '暂无资源用量' }} renderItem={(item) => <List.Item extra={`${item.creditsConsumed} 积分`}><Text>{item.resource || '未分类资源'} · {item.calls} 次</Text></List.Item>} />
            {!usage.modelTrackingAvailable && <Alert type="info" showIcon message="现有调用日志尚未采集模型维度，本站不会生成模拟模型排行。" />}
          </>
        )}
      </Card>

      <Card loading={accountLoading} title="订单查询">
        <Table
          rowKey={(row) => row.orderNo}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          dataSource={usage?.orders || []}
          scroll={{ x: 720 }}
          columns={[
            { title: '订单号', dataIndex: 'orderNo', render: (value: string) => <Button type="link" onClick={() => navigate(`/orders/${value}`)}>{value}</Button> },
            { title: '类型', dataIndex: 'orderType' },
            { title: '金额', dataIndex: 'amount', render: (value: number, row: any) => `${row.currency || 'CNY'} ${(Number(value || 0) / 100).toFixed(2)}` },
            { title: '状态', dataIndex: 'status', render: (value: string) => <Tag>{value}</Tag> },
            { title: '支付时间', dataIndex: 'paidAt', render: formatDate },
            { title: '创建时间', dataIndex: 'createdAt', render: formatDate },
          ]}
        />
      </Card>

      <Card loading={accountLoading} title="当前套餐与积分包价格">
        <Row gutter={[12, 12]}>
          {(usage?.pricing.plans || []).map((plan) => <Col xs={24} sm={12} lg={6} key={plan.id}><Card size="small"><Text strong>{plan.name}</Text><div>¥{(plan.priceMonthly / 100).toFixed(2)} / 月</div><Text type="secondary">赠送 {plan.credits} 积分</Text></Card></Col>)}
          {(usage?.pricing.creditPackages || []).map((pack) => <Col xs={24} sm={12} lg={6} key={pack.id}><Card size="small"><Text strong>{pack.name}</Text><div>¥{(pack.price / 100).toFixed(2)}</div><Text type="secondary">{pack.description}</Text></Card></Col>)}
        </Row>
        <Button type="primary" style={{ marginTop: 16 }} onClick={() => navigate('/pricing')}>查看完整价格与购买</Button>
      </Card>
    </Space>
  );

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={2} style={{ marginBottom: 8 }}>本站查询中心</Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>统一查询官方 API 接入信息、模型文档，以及登录账户的真实额度、用量和订单数据。</Paragraph>
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={changeTab}
        items={[
          { key: 'providers', label: <Space><ApiOutlined />官方 API 接入查询</Space>, children: providerPanel },
          { key: 'docs', label: <Space><BookOutlined />模型接入文档参考</Space>, children: docsPanel },
          { key: 'account', label: <Space><BarChartOutlined />我的本站统计</Space>, children: accountPanel },
        ]}
      />
    </div>
  );
}
