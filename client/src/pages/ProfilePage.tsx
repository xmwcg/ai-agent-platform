import { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Space, Tag, Table, message, Alert,
  Row, Col, Modal, Avatar, Spin, Tabs, Form, Input, Select, Switch,
  Statistic, List, Divider, Tooltip,
} from 'antd';
import {
  UserOutlined, CrownOutlined, CreditCardOutlined,
  SafetyCertificateOutlined, GiftOutlined, ShareAltOutlined,
  QrcodeOutlined, TeamOutlined, WalletOutlined, MobileOutlined,
  MailOutlined, WechatOutlined, CalendarOutlined,
  SendOutlined, DollarOutlined, ExportOutlined,
  KeyOutlined, PlusOutlined, DeleteOutlined,
  SettingOutlined, BellOutlined, LockOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { billingAPI, profileAPI, referralAPI, marketplaceAPI, byokAPI, authAPI, accountAPI, extractApiError, MediaByokKey } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { usePaymentStore } from '@/stores/payment';
import { useUIStore } from '@/stores/ui';
import PageHeader from '@/components/PageHeader';

const { Title, Paragraph, Text } = Typography;

const PLAN_TAGS: Record<string, { text: string; color: string }> = {
  free: { text: '免费版', color: 'default' },
  pro: { text: '专业版', color: 'blue' },
  max: { text: '旗舰版', color: 'gold' },
  team: { text: '团队版', color: 'purple' },
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const isMobile = useUIStore((s) => s.isMobile);
  const authUser = useAuthStore((s) => s.user);
  const fetchProfileAction = useAuthStore((s) => s.fetchProfile);
  const subscription = usePaymentStore((s) => s.subscription);
  const fetchSubscription = usePaymentStore((s) => s.fetchSubscription);

  const [loading, setLoading] = useState(true);
  const [signChecked, setSignChecked] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [byokKeys, setByokKeys] = useState<MediaByokKey[]>([]);
  const [byokLoading, setByokLoading] = useState(false);
  const [byokModal, setByokModal] = useState(false);
  const [byokForm, setByokForm] = useState({ provider: 'hunyuan', secretId: '', secretKey: '', enabled: true });
  const [byokSaving, setByokSaving] = useState(false);
  const [creditsHistory, setCreditsHistory] = useState<any[]>([]);
  const [referralStats, setReferralStats] = useState<any>(null);
  const [referralLink, setReferralLink] = useState('');
  const [profileName, setProfileName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [creditsHistoryLoading, setCreditsHistoryLoading] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [bindings, setBindings] = useState<any>(null);
  const [bindingsLoading, setBindingsLoading] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try { await Promise.allSettled([fetchProfileAction(), fetchSubscription()]); } finally { setLoading(false); }
    };
    load();
  }, [fetchProfileAction, fetchSubscription]);

  const loadCreditsHistory = useCallback(async () => {
    setCreditsHistoryLoading(true);
    try {
      const res: any = await marketplaceAPI.usage();
      const history = res?.data?.transactions || res?.data || [];
      setCreditsHistory(Array.isArray(history) ? history : []);
    } catch { /* 忽略 */ }
    setCreditsHistoryLoading(false);
  }, []);
  useEffect(() => { loadCreditsHistory(); }, [loadCreditsHistory]);

  const loadByokKeys = async () => {
    setByokLoading(true);
    try { const res: any = await byokAPI.list(); if (res?.data) setByokKeys(res.data); } catch { /* 忽略 */ }
    setByokLoading(false);
  };
  useEffect(() => { loadByokKeys(); }, []);

  // 加载第三方账号绑定状态
  const loadBindings = useCallback(async () => {
    setBindingsLoading(true);
    try {
      const res: any = await authAPI.getBindings();
      if (res?.data) setBindings(res.data);
    } catch { /* 忽略 */ }
    setBindingsLoading(false);
  }, []);
  useEffect(() => { loadBindings(); }, [loadBindings]);

  // 加载真实分销统计与邀请链接（替换原写死的收益/推荐人数与 demo 链接）
  const loadReferral = useCallback(async () => {
    try {
      const statsRes: any = await referralAPI.stats();
      setReferralStats(statsRes?.data || null);
      const codeRes: any = await referralAPI.code();
      setReferralLink(codeRes?.data?.referralLink || codeRes?.data?.referralCode ? `https://aibak.site/register?ref=${codeRes.data.referralCode}` : '');
    } catch { /* 忽略 */ }
  }, []);
  useEffect(() => { loadReferral(); }, [loadReferral]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try { const res: any = await billingAPI.getOrders(); if (res?.data) setOrders(res.data); } catch { /* 忽略 */ }
    setOrdersLoading(false);
  }, []);
  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => { if (authUser?.name) setProfileName(authUser.name); }, [authUser?.name]);

  // 真实保存个人资料（PUT /auth/profile，仅后端支持的字段）
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await profileAPI.update({ name: profileName || authUser?.name || '' });
      message.success('资料已保存');
      fetchProfileAction();
    } catch (err) { message.error(extractApiError(err, '保存失败')); }
    setSavingProfile(false);
  };

  const handleSaveByok = async () => {
    if (!byokForm.secretKey.trim()) { message.warning('请输入 Secret Key'); return; }
    setByokSaving(true);
    try {
      await byokAPI.upsert({ provider: byokForm.provider, secretId: byokForm.secretId || undefined, secretKey: byokForm.secretKey.trim(), enabled: byokForm.enabled });
      message.success('保存成功'); setByokModal(false); loadByokKeys();
    } catch (err) { message.error(extractApiError(err, '保存失败')); }
    setByokSaving(false);
  };

  // 真实修改密码：调用后端 PUT /auth/change-password，校验长度与一致性
  const handleChangePassword = async () => {
    if (!pwdCurrent || !pwdNew || !pwdConfirm) { message.warning('请填写完整密码信息'); return; }
    if (pwdNew.length < 10) { message.warning('新密码至少 10 位'); return; }
    if (pwdNew !== pwdConfirm) { message.warning('两次输入的新密码不一致'); return; }
    setSavingPwd(true);
    try {
      await authAPI.changePassword({ currentPassword: pwdCurrent, newPassword: pwdNew });
      message.success('密码已修改，其他设备已自动登出');
      setPwdCurrent(''); setPwdNew(''); setPwdConfirm('');
    } catch (err) {
      const msg = extractApiError(err, '修改失败');
      if (msg.includes('当前密码') || msg.includes('wrong') || msg.includes('incorrect')) {
        message.error('当前密码错误，请重新输入');
      } else {
        message.error(msg);
      }
    }
    setSavingPwd(false);
  };
  const handleDeleteByok = (provider: string) => {
    Modal.confirm({ title: '确认删除', content: `删除 ${provider} 后生成将回落至平台垫付。`, okText: '确认删除', okType: 'danger', cancelText: '取消',
      onOk: async () => { try { await byokAPI.remove(provider); message.success('已删除'); loadByokKeys(); } catch (err) { message.error(extractApiError(err, '删除失败')); } } });
  };
  const providerName = (p: string) => ({ hunyuan: '腾讯混元', keling: '可灵 Kling', jimeng: '即梦 Jimeng' } as Record<string, string>)[p] || p;

  const handleSignIn = () => {
    if (signChecked) { message.info('今日已签到'); return; }
    setSignChecked(true); message.success(`签到成功！+10 积分`);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;

  const plan = subscription?.plan || authUser?.plan || 'free';
  const credits = subscription?.credits ?? authUser?.credits ?? 0;

  // 仅展示真实积分流水；加载失败/无数据时显示空态，不再回落硬编码假数据
  const pointsDataSource = creditsHistory.map((item: any, idx: number) => ({
    id: item._id || `c-${idx}`,
    type: item.type || 'earn',
    amount: item.amount || 0,
    desc: item.description || item.meta?.reason || '积分变动',
    time: item.createdAt?.slice(0, 10) || '-',
  }));

  const cardStyle = {
    borderRadius: 16,
    border: '1px solid var(--border)',
    boxShadow: '0 1px 2px var(--shadow-color)',
  };

  const tabItems: any[] = [
    {
      key: 'overview', label: <span><UserOutlined /> 概览</span>,
    },
    {
      key: 'security', label: <span><SafetyCertificateOutlined /> 安全设置</span>,
    },
    {
      key: 'bindings', label: <span><KeyOutlined /> 账号绑定</span>,
    },
    {
      key: 'points', label: <span><GiftOutlined /> 积分记录</span>,
    },
    {
      key: 'referral', label: <span><TeamOutlined /> 分销代理</span>,
    },
    {
      key: 'byok', label: <span><KeyOutlined /> 媒体 Key</span>,
    },
    {
      key: 'orders', label: <span><CreditCardOutlined /> 订单查询</span>,
    },
  ];

  const renderOverview = () => (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={14}>
        <Card style={cardStyle}>
          <Space align="center" size={16} style={{ marginBottom: 16 }}>
            <Avatar size={64} icon={<UserOutlined />}
              style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }} />
            <div>
              <Text strong style={{ fontSize: 20, color: 'var(--text-primary)' }}>{authUser?.name || '用户'}</Text>
              <div><Text type="secondary">{authUser?.email}</Text></div>
              <Space size={4} style={{ marginTop: 4 }}>
                <Tag color={PLAN_TAGS[plan]?.color}>{PLAN_TAGS[plan]?.text}</Tag>
                {plan === 'free' && <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => navigate('/pricing')}>升级 →</Tag>}
              </Space>
            </div>
          </Space>
          <Divider style={{ margin: '12px 0', borderColor: 'var(--border)' }} />
          <Row gutter={16}>
            <Col span={8}><Statistic title="积分" value={credits} prefix={<GiftOutlined />} valueStyle={{ color: 'var(--text-primary)' }} /></Col>
            <Col span={8}><Statistic title="总收益" value={referralStats ? (referralStats.pendingCommission + referralStats.settledCommission) : 0} prefix={<DollarOutlined />} precision={2} suffix="¥" valueStyle={{ color: 'var(--brand-primary)' }} /></Col>
            <Col span={8}><Statistic title="推荐人" value={referralStats?.totalReferrals ?? 0} prefix={<TeamOutlined />} suffix="人" valueStyle={{ color: 'var(--text-primary)' }} /></Col>
          </Row>
          <Divider style={{ borderColor: 'var(--border)' }} />
          <Space>
            <Button type="primary" icon={<CrownOutlined />} onClick={() => navigate('/pricing')}
              style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', border: 'none', borderRadius: 10 }}>
              升级会员
            </Button>
            {plan !== 'free' && <Button danger onClick={() => message.info('请联系客服')}>取消订阅</Button>}
          </Space>
        </Card>
      </Col>
      <Col xs={24} md={10}>
        <Card size="small" style={{ ...cardStyle, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text strong style={{ color: 'var(--text-primary)' }}><CalendarOutlined style={{ marginRight: 4 }} />每日签到</Text>
              <div><Text type="secondary" style={{ fontSize: 12 }}>连续签到 7 天，今日 +10 积分</Text></div>
            </div>
            <Button type={signChecked ? 'default' : 'primary'} disabled={signChecked} onClick={handleSignIn}
              size="small" style={{ borderRadius: 8 }}>
              {signChecked ? '已签到' : '签到'}
            </Button>
          </div>
        </Card>
        <Card size="small" style={cardStyle}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button block icon={<ShareAltOutlined />} onClick={() => setShareModal(true)}>分享推广</Button>
            <Button block icon={<GiftOutlined />} onClick={() => navigate('/points-center')}>积分中心</Button>
          </Space>
        </Card>
      </Col>
    </Row>
  );

  const renderSecurity = () => (
    <Card style={cardStyle}>
      <Title level={5} style={{ color: 'var(--text-primary)' }}><LockOutlined /> 账户安全</Title>
      <Form layout="vertical" style={{ maxWidth: 500 }}>
        <Form.Item label="昵称">
          <Input
            prefix={<UserOutlined />}
            value={profileName}
            placeholder="设置你的昵称"
            onChange={(e) => setProfileName(e.target.value)}
          />
        </Form.Item>
        <Form.Item label="手机号"><Input prefix={<MobileOutlined />} value={authUser?.phone || ''} placeholder="绑定手机号（备案后开放）" disabled /></Form.Item>
        <Form.Item label="微信号"><Input prefix={<WechatOutlined />} value={authUser?.wechatOpenid ? '已绑定' : ''} placeholder="绑定微信（备案后开放）" disabled /></Form.Item>
        <Form.Item label="邮箱"><Input prefix={<MailOutlined />} value={authUser?.email || ''} disabled /><Text type="secondary" style={{ fontSize: 12 }}>作为登录账号暂不可修改</Text></Form.Item>
        <Form.Item label="修改密码" extra="新密码至少 10 位；修改后其他已登录设备将自动登出。">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input.Password prefix={<LockOutlined />} placeholder="当前密码" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} autoComplete="current-password" />
            <Input.Password prefix={<LockOutlined />} placeholder="新密码（至少 10 位）" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} autoComplete="new-password" />
            <Input.Password prefix={<LockOutlined />} placeholder="确认新密码" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} autoComplete="new-password" />
            <Button type="primary" loading={savingPwd} onClick={handleChangePassword}>更新密码</Button>
          </Space>
        </Form.Item>
        <Button type="primary" loading={savingProfile} onClick={handleSaveProfile}>保存资料</Button>
      </Form>
    </Card>
  );

  const renderPoints = () => (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={10}>
        <Card style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Text type="secondary">可用积分</Text>
            <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--brand-primary)', lineHeight: 1.2 }}>{credits}</div>
            <Text type="secondary">10 积分 = 1 次 API 调用</Text>
          </div>
          <Divider style={{ borderColor: 'var(--border)' }} />
          <Title level={5} style={{ color: 'var(--text-primary)' }}>积分获取方式</Title>
          <List size="small" dataSource={['每日签到 +10', '每次 AI 对话 +5', '上传知识文档 +30', '邀请好友注册 +100', '好友付费 +5% 佣金']}
            renderItem={(i) => <List.Item style={{ color: 'var(--text-secondary)' }}>✅ {i}</List.Item>} />
        </Card>
      </Col>
      <Col xs={24} md={14}>
        <Card title="积分记录" style={cardStyle} extra={<Button size="small" loading={creditsHistoryLoading} onClick={loadCreditsHistory}>刷新</Button>}>
          <Table dataSource={pointsDataSource} rowKey="id" size="small" pagination={{ pageSize: 10 }} locale={{ emptyText: creditsHistoryLoading ? '加载中…' : '暂无积分记录' }}
            columns={[
              { title: '说明', dataIndex: 'desc', key: 'desc' },
              { title: '变动', dataIndex: 'amount', key: 'amount', render: (v: number) => <Text style={{ color: v > 0 ? 'var(--brand-success)' : 'var(--brand-danger)', fontWeight: 600 }}>{v > 0 ? `+${v}` : v}</Text> },
              { title: '时间', dataIndex: 'time', key: 'time' },
              { title: '类型', dataIndex: 'type', key: 'type', render: (t: string) => <Tag>{t === 'earn' ? '获取' : t === 'spend' ? '消费' : t}</Tag> },
            ]} />
        </Card>
      </Col>
    </Row>
  );

  const renderReferral = () => (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}>
        <Card style={cardStyle}>
          <Title level={5} style={{ color: 'var(--text-primary)' }}>你的邀请链接</Title>
          <Input value={referralLink || `https://aibak.site/register?ref=${authUser?._id || ''}`} readOnly />
          <Space style={{ marginTop: 12 }} wrap>
            <Button icon={<QrcodeOutlined />} onClick={() => setShareModal(true)}>分享二维码</Button>
            <Button icon={<ExportOutlined />}>复制链接</Button>
          </Space>
          <Divider style={{ borderColor: 'var(--border)' }} />
          <Title level={5} style={{ color: 'var(--text-primary)' }}>佣金比例</Title>
          <List size="small">
            <List.Item style={{ color: 'var(--text-secondary)' }}>一级分销：<strong>5%</strong> 佣金</List.Item>
            <List.Item style={{ color: 'var(--text-secondary)' }}>二级分销：<strong>2%</strong> 佣金</List.Item>
            <List.Item style={{ color: 'var(--text-secondary)' }}>三级分销：<strong>1%</strong> 佣金</List.Item>
            <List.Item style={{ color: 'var(--text-secondary)' }}>最低提现：<strong>¥50</strong></List.Item>
          </List>
        </Card>
      </Col>
      <Col xs={24} md={16}>
        <Card title="分销记录" style={cardStyle}>
          <Table dataSource={[]} rowKey="id" size="small" pagination={false}
            locale={{ emptyText: '暂无分销记录，快去邀请好友吧！' }}
            columns={[
              { title: '用户', dataIndex: 'name' },
              { title: '层级', dataIndex: 'level', render: (v: number) => v ? <Tag>第{v}级</Tag> : '-' },
              { title: '佣金', dataIndex: 'commission', render: (v: number) => v ? <Text style={{ color: 'var(--brand-success)' }}>¥{v.toFixed(2)}</Text> : '-' },
              { title: '时间', dataIndex: 'time' },
            ]} />
        </Card>
      </Col>
    </Row>
  );

  const renderByok = () => (
    <Card style={cardStyle}>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>配置你在厂商获取的 API Key，生成时优先使用自带密钥（平台零垫付、不消耗配额）。</Paragraph>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => { setByokForm({ provider: 'hunyuan', secretId: '', secretKey: '', enabled: true }); setByokModal(true); }} style={{ marginBottom: 16 }}>添加 API Key</Button>
      {byokLoading ? <Spin /> : byokKeys.length === 0 ? <Paragraph type="secondary">暂无配置的 API Key。</Paragraph> : byokKeys.map((k) => (
        <Card key={k.provider} size="small" style={{ marginBottom: 12 }}
          extra={<Space><Tag color={k.enabled ? 'green' : 'default'}>{k.enabled ? '已启用' : '已停用'}</Tag>
          <Button size="small" icon={<PlusOutlined style={{ transform: 'rotate(45deg)' }} />} onClick={() => { setByokForm({ provider: k.provider, secretId: '', secretKey: '', enabled: k.enabled }); setByokModal(true); }}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteByok(k.provider)}>删除</Button></Space>}>
          <Space><Avatar size={32} style={{ background: '#6c5ce7' }}>{providerName(k.provider).charAt(0)}</Avatar>
          <div><Text strong>{providerName(k.provider)}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{k.secretIdMask ? `SecretId: ${k.secretIdMask} | ` : ''}SecretKey: {k.secretKeyMask}</Text></div></Space>
        </Card>
      ))}
      <Modal title="配置厂商 API Key" open={byokModal} onOk={handleSaveByok} onCancel={() => setByokModal(false)} confirmLoading={byokSaving} okText="保存" cancelText="取消" destroyOnClose>
        <Form layout="vertical">
          <Form.Item label="厂商" required><Select value={byokForm.provider} onChange={(v) => setByokForm((f) => ({ ...f, provider: v }))} options={[{ label: '腾讯混元', value: 'hunyuan' }, { label: '可灵 Kling', value: 'keling' }, { label: '即梦 Jimeng', value: 'jimeng' }]} /></Form.Item>
          {byokForm.provider === 'hunyuan' && <Form.Item label="Secret ID"><Input value={byokForm.secretId} onChange={(e) => setByokForm((f) => ({ ...f, secretId: e.target.value }))} placeholder="AKID..." /></Form.Item>}
          <Form.Item label="Secret Key / Token" required><Input.Password value={byokForm.secretKey} onChange={(e) => setByokForm((f) => ({ ...f, secretKey: e.target.value }))} placeholder="输入密钥..." /></Form.Item>
          <Form.Item label="启用"><Switch checked={byokForm.enabled} onChange={(v) => setByokForm((f) => ({ ...f, enabled: v }))} checkedChildren="启用" unCheckedChildren="停用" /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );

  const renderOrders = () => (
    <Card style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={5} style={{ color: 'var(--text-primary)', margin: 0 }}>我的订单</Title>
        <Button size="small" loading={ordersLoading} onClick={loadOrders}>刷新</Button>
      </div>
      <Table
        dataSource={orders}
        rowKey="orderNo"
        size="small"
        pagination={{ pageSize: 8 }}
        locale={{ emptyText: '暂无订单记录' }}
        columns={[
          {
            title: '订单号', dataIndex: 'orderNo', key: 'orderNo',
            render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
          },
          {
            title: '类型', dataIndex: 'orderType', key: 'orderType',
            render: (t: string) => t === 'credits_pack' ? <Tag>积分包</Tag> : <Tag color="blue">会员</Tag>,
          },
          {
            title: '金额', dataIndex: 'amount', key: 'amount',
            render: (v: number) => <Text strong>¥{((v || 0) / 100).toFixed(2)}</Text>,
          },
          {
            title: '状态', dataIndex: 'status', key: 'status',
            render: (s: string) => {
              const m: Record<string, { t: string; c: string }> = {
                pending: { t: '待支付', c: 'gold' }, paid: { t: '已支付', c: 'green' },
                failed: { t: '失败', c: 'red' }, expired: { t: '过期', c: 'default' }, refunded: { t: '退款', c: 'volcano' },
              };
              return <Tag color={m[s]?.c}>{m[s]?.t || s}</Tag>;
            },
          },
          {
            title: '时间', dataIndex: 'createdAt', key: 'createdAt',
            render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v ? new Date(v).toLocaleDateString('zh-CN') : '-'}</Text>,
          },
          {
            title: '操作', key: 'action',
            render: (_: any, row: any) => (
              <Button type="link" size="small" onClick={() => navigate(`/orders/${row.orderNo}`)}>明细</Button>
            ),
          },
        ]}
      />
    </Card>
  );

  const renderBindings = () => (
    <Card title="第三方账号绑定" loading={bindingsLoading}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        绑定微信/抖音后，可使用对应方式快速登录。解绑最后一个登录方式时需先设置密码。
      </Text>
      <List
        itemLayout="horizontal"
        dataSource={[
          {
            key: 'email',
            icon: <MailOutlined />,
            title: '邮箱',
            desc: bindings?.email || authUser?.email || '未设置',
            bound: !!(bindings?.email || authUser?.email),
            provider: 'email' as const,
          },
          {
            key: 'wechat',
            icon: <WechatOutlined />,
            title: '微信',
            desc: bindings?.wechat?.bound ? '已绑定' : '未绑定',
            bound: !!bindings?.wechat?.bound,
            provider: 'wechat' as const,
          },
          {
            key: 'douyin',
            icon: <span style={{ fontSize: 18 }}>🎵</span>,
            title: '抖音',
            desc: bindings?.douyin?.bound ? '已绑定' : '未绑定',
            bound: !!bindings?.douyin?.bound,
            provider: 'douyin' as const,
          },
        ]}
        renderItem={(item) => (
          <List.Item
            actions={
              item.provider === 'email' ? [] : [
                item.bound ? (
                  <Button
                    key="unbind"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={async () => {
                      try {
                        const fn = item.provider === 'wechat' ? authAPI.unbindWechat : authAPI.unbindDouyin;
                        await fn();
                        message.success(`${item.title}解绑成功`);
                        loadBindings();
                        fetchProfileAction();
                      } catch (err) {
                        const msg = extractApiError(err, '解绑失败');
                        if (msg.includes('设置密码') || msg.includes('NEED_PASSWORD')) {
                          message.warning('解绑后将无任何登录方式，请先在「安全设置」中设置密码');
                          setActiveTab('security');
                        } else {
                          message.error(msg);
                        }
                      }
                    }}
                  >
                    解绑
                  </Button>
                ) : (
                  <Button
                    key="bind"
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={async () => {
                      try {
                        const fn = item.provider === 'wechat' ? authAPI.wechatQr : authAPI.douyinQr;
                        const res: any = await fn();
                        if (res?.authorizeUrl) {
                          // 打开 OAuth 授权页（扫码后回调带回 code，此处简化为提示）
                          window.open(res.authorizeUrl, `${item.provider}_bind`, 'width=420,height=540');
                          message.info(`请在弹窗中完成${item.title}授权`);
                        } else if (res?.mock) {
                          message.info(`${item.title}登录 Mock 模式：未配置密钥`);
                        }
                      } catch (err) {
                        message.error(extractApiError(err, '绑定启动失败'));
                      }
                    }}
                  >
                    绑定
                  </Button>
                ),
              ]
            }
          >
            <List.Item.Meta
              avatar={<Avatar style={{ background: 'var(--bg-sidebar)' }}>{item.icon}</Avatar>}
              title={<Text>{item.title}{item.bound && <Tag color="green" style={{ marginLeft: 8 }}>已绑定</Tag>}</Text>}
              description={<Text type="secondary" style={{ fontSize: 13 }}>{item.desc}</Text>}
            />
          </List.Item>
        )}
      />
    </Card>
  );


  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);

  const handleExportData = async () => {
    Modal.confirm({
      title: '申请个人数据导出',
      content: '系统将收集您的个人资料、订单记录、积分流水、额度批次、协议同意记录和退款记录，生成一份完整的 JSON 数据文件。导出链接将通过页面返回。是否继续？',
      onOk: async () => {
        setExportLoading(true);
        try {
          const res: any = await accountAPI.requestDataExport();
          const token = res?.data?.token || res?.token;
          if (token) {
            // 构建下载链接
            const downloadUrl = `/api/account/export-data/${token}`;
            message.success('数据导出申请成功！');
            Modal.info({
              title: '数据导出就绪',
              content: (
                <div>
                  <Paragraph>您的数据导出文件已生成。点击下方链接下载：</Paragraph>
                  <Button type="primary" href={downloadUrl} target="_blank" icon={<ExportOutlined />}>
                    下载数据导出文件
                  </Button>
                  <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
                    下载链接 24 小时内有效。请妥善保管此文件，包含个人敏感信息。
                  </Paragraph>
                </div>
              ),
              width: 480,
            });
          } else {
            message.error('导出失败，请稍后重试');
          }
        } catch (err) {
          message.error(extractApiError(err, '导出申请失败'));
        } finally {
          setExportLoading(false);
        }
      },
    });
  };

  const handleRequestDeletion = async () => {
    Modal.confirm({
      title: '申请账号注销',
      content: (
        <div>
          <Paragraph type="danger" strong>注销账号为不可逆操作，请仔细阅读以下说明：</Paragraph>
          <Paragraph>
            1. 提交申请后进入 <Text strong>7 天冷静期</Text>，期间您可以随时撤销注销申请。
          </Paragraph>
          <Paragraph>
            2. 冷静期结束后，您需要通过确认链接完成最终注销。
          </Paragraph>
          <Paragraph>
            3. 注销后您的个人信息将被匿名化处理，支付和审计记录将依法保留。
          </Paragraph>
          <Paragraph type="secondary">
            4. 如有未完成订单或未消费积分，请先处理后再申请注销。
          </Paragraph>
        </div>
      ),
      okText: '确认申请注销',
      okButtonProps: { danger: true },
      onOk: async () => {
        setDeleteLoading(true);
        try {
          await accountAPI.requestDeletion();
          setDeleteRequested(true);
          message.success('注销申请已提交。您有 7 天冷静期，期间可以随时撤销。');
        } catch (err) {
          message.error(extractApiError(err, '注销申请失败'));
        } finally {
          setDeleteLoading(false);
        }
      },
    });
  };

  const handleCancelDeletion = async () => {
    Modal.confirm({
      title: '撤销注销申请',
      content: '确认撤销注销申请？您的账号将恢复正常。',
      onOk: async () => {
        try {
          await accountAPI.cancelDeletion();
          setDeleteRequested(false);
          message.success('注销申请已撤销，您的账号已恢复正常。');
        } catch (err) {
          message.error(extractApiError(err, '撤销失败'));
        }
      },
    });
  };

  const renderAccount = () => (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Card title={<span><ExportOutlined /> 个人数据导出</span>}>
          <Paragraph>
            根据个人信息保护法，您有权获取个人数据的副本。导出文件为 JSON 格式，包含您的个人资料、订单、积分流水、额度批次和协议记录。
          </Paragraph>
          <Button
            type="primary"
            icon={<ExportOutlined />}
            loading={exportLoading}
            onClick={handleExportData}
          >
            申请导出个人数据
          </Button>
          <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
            下载链接 24 小时内有效，请及时下载并妥善保管。
          </Paragraph>
        </Card>
      </Col>
      <Col span={24}>
        <Card
          title={<span style={{ color: 'var(--color-danger, #ff4d4f)' }}><DeleteOutlined /> 账号注销</span>}
          style={{ borderColor: 'var(--color-danger-border, #ffa39e)' }}
        >
          {deleteRequested ? (
            <>
              <Alert
                type="warning"
                showIcon
                message="注销申请已提交"
                description="您的注销申请正在 7 天冷静期中。在此期间您可以随时撤销注销申请。冷静期结束后，您将收到确认邮件，完成最终注销。"
                style={{ marginBottom: 16 }}
              />
              <Button danger onClick={handleCancelDeletion}>
                撤销注销申请
              </Button>
            </>
          ) : (
            <>
              <Paragraph type="danger">
                注销账号将匿名化您的个人信息，并禁用账号。支付、退款和安全审计记录将依法保留。
              </Paragraph>
              <Paragraph>
                · 注销有 <Text strong>7 天冷静期</Text>，期间可撤销<br />
                · 有未完成订单时无法完成注销<br />
                · 注销后无法恢复，请谨慎操作
              </Paragraph>
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={deleteLoading}
                onClick={handleRequestDeletion}
              >
                申请注销账号
              </Button>
            </>
          )}
        </Card>
      </Col>
    </Row>
  );
  const tabContentMap: Record<string, React.ReactNode> = {
    overview: renderOverview(),
    security: renderSecurity(),
    bindings: renderBindings(),
    points: renderPoints(),
    referral: renderReferral(),
    byok: renderByok(),
    orders: renderOrders(),
    account: renderAccount(),
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <PageHeader title="个人中心" subtitle="管理账户信息、安全设置、积分与分销代理" icon={<UserOutlined />} />
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems}
        tabBarStyle={{ marginBottom: 20 }}
        tabBarExtraContent={undefined} />
      {tabContentMap[activeTab]}
      <Modal open={shareModal} onCancel={() => setShareModal(false)} footer={null} title="分享推广">
        <div style={{ textAlign: 'center' }}>
          <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 12, display: 'inline-block' }}>
            {/* QR code will use QRCodeSVG if available */}
          </div>
          <Paragraph style={{ marginTop: 12, color: 'var(--text-secondary)' }}>
            扫描二维码注册，你即可获得 <Tag color="gold">100 积分</Tag> 奖励
          </Paragraph>
        </div>
      </Modal>
    </div>
  );
}
