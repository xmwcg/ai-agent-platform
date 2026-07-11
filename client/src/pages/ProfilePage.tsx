import { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Space, Tag, Table, message,
  Row, Col, Modal, Avatar, Spin, Tabs, Form, Input, Select, Switch,
  QRCode, Statistic, List, Divider, Tooltip,
} from 'antd';
import {
  UserOutlined, CrownOutlined, CreditCardOutlined,
  SafetyCertificateOutlined, GiftOutlined, ShareAltOutlined,
  QrcodeOutlined, TeamOutlined, WalletOutlined, MobileOutlined,
  MailOutlined, WechatOutlined, CalendarOutlined,
  SendOutlined, DollarOutlined, ExportOutlined,
  KeyOutlined, PlusOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { billingAPI, profileAPI, marketplaceAPI, byokAPI, extractApiError, MediaByokKey } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { usePaymentStore } from '@/stores/payment';
import { useUIStore } from '@/stores/ui';

const { Title, Paragraph, Text } = Typography;

const PLAN_LABEL: Record<string, { text: string; color: string }> = {
  free: { text: '免费版', color: 'default' },
  pro: { text: '专业版', color: 'blue' },
  max: { text: '旗舰版', color: 'gold' },
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const isMobile = useUIStore((s) => s.isMobile);

  // ─── 全局 Auth Store ───
  const authUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const fetchProfileAction = useAuthStore((s) => s.fetchProfile);

  // ─── 全局 Payment Store ───
  const subscription = usePaymentStore((s) => s.subscription);
  const fetchSubscription = usePaymentStore((s) => s.fetchSubscription);

  const [loading, setLoading] = useState(true);
  const [signChecked, setSignChecked] = useState(false);
  const [shareModal, setShareModal] = useState(false);

  // BYOK 媒体 Key 管理
  const [byokKeys, setByokKeys] = useState<MediaByokKey[]>([]);
  const [byokLoading, setByokLoading] = useState(false);
  const [byokModal, setByokModal] = useState(false);
  const [byokForm, setByokForm] = useState({ provider: 'hunyuan' as string, secretId: '', secretKey: '', enabled: true });
  const [byokSaving, setByokSaving] = useState(false);

  // ─── 积分数据（从 API 获取） ───
  const [creditsHistory, setCreditsHistory] = useState<any[]>([]);
  const [creditsHistoryLoading, setCreditsHistoryLoading] = useState(false);

  // ─── 初始化数据 ───
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // 并行拉取
        await Promise.allSettled([
          fetchProfileAction(),
          fetchSubscription(),
        ]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchProfileAction, fetchSubscription]);

  // ─── 加载积分历史 ───
  const loadCreditsHistory = useCallback(async () => {
    setCreditsHistoryLoading(true);
    try {
      const res: any = await marketplaceAPI.usage();
      const history = res?.data?.transactions || res?.data || [];
      setCreditsHistory(Array.isArray(history) ? history : []);
    } catch {
      // 降级使用已有数据
    }
    setCreditsHistoryLoading(false);
  }, []);

  useEffect(() => { loadCreditsHistory(); }, [loadCreditsHistory]);

  // ─── BYOK 管理 ───
  const loadByokKeys = async () => {
    setByokLoading(true);
    try {
      const res: any = await byokAPI.list();
      if (res?.data) setByokKeys(res.data);
    } catch { /* 未登录静默 */ }
    setByokLoading(false);
  };

  useEffect(() => { loadByokKeys(); }, []);

  const handleSaveByok = async () => {
    if (!byokForm.secretKey.trim()) { message.warning('请输入 Secret Key / API Token'); return; }
    setByokSaving(true);
    try {
      await byokAPI.upsert({
        provider: byokForm.provider,
        secretId: byokForm.secretId || undefined,
        secretKey: byokForm.secretKey.trim(),
        enabled: byokForm.enabled,
      });
      message.success('保存成功');
      setByokModal(false);
      loadByokKeys();
    } catch (err) {
      message.error(extractApiError(err, '保存失败'));
    }
    setByokSaving(false);
  };

  const handleDeleteByok = async (provider: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `删除 ${provider} 的 API Key 后，生成将回落至平台垫付。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await byokAPI.remove(provider);
          message.success('已删除');
          loadByokKeys();
        } catch (err) {
          message.error(extractApiError(err, '删除失败'));
        }
      },
    });
  };

  const providerName = (p: string) =>
    ({ hunyuan: '腾讯混元', keling: '可灵 Kling', jimeng: '即梦 Jimeng' } as Record<string, string>)[p] || p;

  const handleSignIn = () => {
    if (signChecked) { message.info('今日已签到'); return; }
    setSignChecked(true);
    message.success(`签到成功！+${10} 积分`);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;

  const plan = subscription?.plan || authUser?.plan || 'free';
  const credits = subscription?.credits ?? authUser?.credits ?? 0;

  // ─── 积分数据源：优先 API，降级默认 ───
  const pointsDataSource = creditsHistory.length > 0
    ? creditsHistory.map((item: any, idx: number) => ({
        id: item._id || `credit-${idx}`,
        type: item.type || 'earn',
        amount: item.amount || 0,
        desc: item.description || item.meta?.reason || '积分变动',
        time: item.createdAt?.slice(0, 10) || '-',
      }))
    : [
        { id: '1', type: 'earn', amount: 10, desc: '每日签到', time: '-' },
        { id: '2', type: 'earn', amount: 50, desc: '完成AI对话', time: '-' },
        { id: '3', type: 'spend', amount: -20, desc: '兑换API调用', time: '-' },
        { id: '4', type: 'earn', amount: 100, desc: '分享推广奖励', time: '-' },
        { id: '5', type: 'earn', amount: 30, desc: '上传知识文档', time: '-' },
      ];

  const tabItems = [
    {
      key: 'overview', label: <span><UserOutlined /> 概览</span>,
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={14}>
            <Card>
              <Space align="center" size={16} style={{ marginBottom: 16 }}>
                <Avatar size={64} icon={<UserOutlined />} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }} />
                <div>
                  <Text strong style={{ fontSize: 20 }}>{authUser?.name || '用户'}</Text>
                  <div><Text type="secondary">{authUser?.email}</Text></div>
                  <Tag color={PLAN_LABEL[plan]?.color} style={{ marginTop: 4 }}>
                    {PLAN_LABEL[plan]?.text}
                  </Tag>
                </div>
              </Space>
              <Divider style={{ margin: '12px 0' }} />
              <Row gutter={16}>
                <Col span={8}><Statistic title="积分" value={credits} prefix={<CreditCardOutlined />} /></Col>
                <Col span={8}><Statistic title="总收益" value={378.80} prefix={<DollarOutlined />} precision={2} suffix="¥" /></Col>
                <Col span={8}><Statistic title="推荐人" value={3} prefix={<TeamOutlined />} suffix="人" /></Col>
              </Row>
              <Divider />
              <Space>
                <Button type="primary" icon={<CrownOutlined />} onClick={() => navigate('/pricing')}
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}>
                  升级会员
                </Button>
                {plan !== 'free' && <Button danger onClick={() => message.info('请联系客服')}>取消订阅</Button>}
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={10}>
            {/* 签到 */}
            <Card size="small" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong><CalendarOutlined /> 每日签到</Text>
                  <div><Text type="secondary">连续签到 7 天，今日 +10 积分</Text></div>
                </div>
                <Button type={signChecked ? 'default' : 'primary'} disabled={signChecked} onClick={handleSignIn}>
                  {signChecked ? '已签到' : '签到'}
                </Button>
              </div>
            </Card>
            {/* 快捷操作 */}
            <Card size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button block icon={<ShareAltOutlined />} onClick={() => setShareModal(true)}>分享推广</Button>
                <Button block icon={<GiftOutlined />} onClick={() => navigate('/points-center')}>积分中心</Button>
              </Space>
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'security', label: <span><SafetyCertificateOutlined /> 安全设置</span>,
      children: (
        <Card>
          <Title level={5}>账户安全</Title>
          <Form layout="vertical" style={{ maxWidth: 500 }}>
            <Form.Item label="手机号">
              <Input prefix={<MobileOutlined />} value={authUser?.phone || ''} placeholder="绑定手机号" />
              <Button type="link" size="small" style={{ padding: 0 }}>发送验证码</Button>
            </Form.Item>
            <Form.Item label="微信号">
              <Input prefix={<WechatOutlined />} value={authUser?.wechatOpenid ? '已绑定' : ''} placeholder="绑定微信" />
            </Form.Item>
            <Form.Item label="邮箱">
              <Input prefix={<MailOutlined />} value={authUser?.email || ''} disabled />
              <Text type="secondary" style={{ fontSize: 12 }}>邮箱作为登录账号，暂不可修改</Text>
            </Form.Item>
            <Form.Item label="新密码">
              <Input.Password placeholder="输入新密码（留空不修改）" />
            </Form.Item>
            <Button type="primary" onClick={() => message.success('安全设置已保存')}>保存设置</Button>
          </Form>
        </Card>
      ),
    },
    {
      key: 'points', label: <span><GiftOutlined /> 积分中心</span>,
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={10}>
            <Card>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Text type="secondary">可用积分</Text>
                <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.2, color: '#6366f1' }}>{credits}</div>
                <Text type="secondary">10 积分 = 1 次 API 调用</Text>
              </div>
              <Divider />
              <Title level={5}>积分获取方式</Title>
              <List size="small" dataSource={[
                '每日签到 +10', '每次 AI 对话 +5', '上传知识文档 +30',
                '邀请好友注册 +100', '好友付费 +5% 佣金（转化为积分）',
              ]} renderItem={(item) => <List.Item>✅ {item}</List.Item>} />
            </Card>
          </Col>
          <Col xs={24} md={14}>
            <Card title="积分记录" extra={
              <Button size="small" loading={creditsHistoryLoading} onClick={loadCreditsHistory}>刷新</Button>
            }>
              <Table dataSource={pointsDataSource} rowKey="id" size="small" pagination={{ pageSize: 10 }}
                columns={[
                  { title: '说明', dataIndex: 'desc', key: 'desc' },
                  { title: '变动', dataIndex: 'amount', key: 'amount',
                    render: (v: number) => <Text style={{ color: v > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{v > 0 ? `+${v}` : v}</Text> },
                  { title: '时间', dataIndex: 'time', key: 'time' },
                  { title: '类型', dataIndex: 'type', key: 'type',
                    render: (t: string) => <Tag>{t === 'earn' ? '获取' : t === 'spend' ? '消费' : t}</Tag> },
                ]}
              />
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'referral', label: <span><TeamOutlined /> 分销代理</span>,
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card>
              <Title level={5}>你的邀请链接</Title>
              <Input value={`https://aibak.site/ref=${authUser?._id || 'demo'}`} readOnly />
              <Space style={{ marginTop: 12 }} wrap>
                <Button icon={<QrcodeOutlined />} onClick={() => setShareModal(true)}>分享二维码</Button>
                <Button icon={<ExportOutlined />}>复制链接</Button>
              </Space>
              <Divider />
              <Title level={5}>佣金比例</Title>
              <List size="small">
                <List.Item>一级分销：<strong>5%</strong> 佣金</List.Item>
                <List.Item>二级分销：<strong>2%</strong> 佣金</List.Item>
                <List.Item>三级分销：<strong>1%</strong> 佣金</List.Item>
                <List.Item>最低提现：<strong>¥50</strong></List.Item>
              </List>
            </Card>
          </Col>
          <Col xs={24} md={16}>
            <Card title="分销记录">
              <Table dataSource={[]} rowKey="id" size="small" pagination={false}
                locale={{ emptyText: '暂无分销记录，快去邀请好友吧！' }}
                columns={[
                  { title: '用户', dataIndex: 'name', key: 'name' },
                  { title: '层级', dataIndex: 'level', key: 'level', render: (v: number) => v ? <Tag>第{v}级</Tag> : '-' },
                  { title: '佣金', dataIndex: 'commission', key: 'commission',
                    render: (v: number) => v ? <Text style={{ color: '#10b981' }}>¥{v.toFixed(2)}</Text> : '-' },
                  { title: '时间', dataIndex: 'time', key: 'time' },
                ]}
              />
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'byok', label: <span><KeyOutlined /> 媒体 API Key</span>,
      children: (
        <Card>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            配置你在厂商获取的 API Key，生成时优先使用自带密钥（平台零垫付、不消耗配额）。
            支持的厂商：腾讯混元、可灵 Kling、即梦 Jimeng。
          </Paragraph>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setByokForm({ provider: 'hunyuan', secretId: '', secretKey: '', enabled: true });
              setByokModal(true);
            }}
            style={{ marginBottom: 16 }}
          >
            添加 API Key
          </Button>
          {byokLoading ? (
            <Spin />
          ) : byokKeys.length === 0 ? (
            <Paragraph type="secondary">暂无配置的 API Key，点击上方按钮添加。</Paragraph>
          ) : (
            byokKeys.map((k) => (
              <Card
                key={k.provider}
                size="small"
                style={{ marginBottom: 12 }}
                extra={
                  <Space>
                    <Tag color={k.enabled ? 'green' : 'default'}>{k.enabled ? '已启用' : '已停用'}</Tag>
                    <Button
                      size="small"
                      icon={<PlusOutlined style={{ transform: 'rotate(45deg)' }} />}
                      onClick={() => {
                        setByokForm({ provider: k.provider, secretId: '', secretKey: '', enabled: k.enabled });
                        setByokModal(true);
                      }}
                    >编辑</Button>
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteByok(k.provider)}>
                      删除
                    </Button>
                  </Space>
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar size={32} style={{ background: '#1677ff' }}>{providerName(k.provider).charAt(0)}</Avatar>
                  <div>
                    <Text strong>{providerName(k.provider)}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {k.secretIdMask ? `SecretId: ${k.secretIdMask} | ` : ''}SecretKey: {k.secretKeyMask}
                    </Text>
                  </div>
                </div>
              </Card>
            ))
          )}

          {/* BYOK 添加/编辑弹窗 */}
          <Modal
            title="配置厂商 API Key"
            open={byokModal}
            onOk={handleSaveByok}
            onCancel={() => setByokModal(false)}
            confirmLoading={byokSaving}
            okText="保存" cancelText="取消"
            destroyOnClose
          >
            <Form layout="vertical">
              <Form.Item label="厂商" required>
                <Select
                  value={byokForm.provider}
                  onChange={(v) => setByokForm((f) => ({ ...f, provider: v }))}
                  options={[
                    { label: '腾讯混元 (Hunyuan)', value: 'hunyuan' },
                    { label: '可灵 Kling', value: 'keling' },
                    { label: '即梦 Jimeng', value: 'jimeng' },
                  ]}
                />
              </Form.Item>
              {byokForm.provider === 'hunyuan' && (
                <Form.Item label="Secret ID" tooltip="腾讯云 API 密钥 SecretId（可灵/即梦无需填写）">
                  <Input
                    value={byokForm.secretId}
                    onChange={(e) => setByokForm((f) => ({ ...f, secretId: e.target.value }))}
                    placeholder="AKID..."
                  />
                </Form.Item>
              )}
              <Form.Item
                label={byokForm.provider === 'hunyuan' ? 'Secret Key' : 'API Token / Bearer Token'}
                required
                tooltip="此密钥将加密存储，明文不落库"
              >
                <Input.Password
                  value={byokForm.secretKey}
                  onChange={(e) => setByokForm((f) => ({ ...f, secretKey: e.target.value }))}
                  placeholder={byokForm.provider === 'hunyuan' ? '输入 SecretKey...' : '输入 API Token...'}
                />
              </Form.Item>
              <Form.Item label="启用状态">
                <Switch
                  checked={byokForm.enabled}
                  onChange={(v) => setByokForm((f) => ({ ...f, enabled: v }))}
                  checkedChildren="启用" unCheckedChildren="停用"
                />
              </Form.Item>
            </Form>
          </Modal>
        </Card>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Title level={isMobile ? 4 : 3}><UserOutlined /> 个人中心</Title>
      <Tabs defaultActiveKey="overview" items={tabItems} />

      {/* 分享弹窗 */}
      <Modal open={shareModal} onCancel={() => setShareModal(false)} footer={null} title="分享推广">
        <div style={{ textAlign: 'center' }}>
          <QRCode value={`https://aibak.site/ref/${authUser?._id || 'demo'}`} size={180} />
          <Paragraph style={{ marginTop: 12 }}>
            扫描二维码注册，你即可获得 <Tag color="gold">100 积分</Tag> 奖励
          </Paragraph>
        </div>
      </Modal>
    </div>
  );
}
