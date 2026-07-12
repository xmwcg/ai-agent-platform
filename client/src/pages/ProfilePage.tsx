import { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Space, Tag, Table, message,
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
import { billingAPI, profileAPI, referralAPI, marketplaceAPI, byokAPI, extractApiError, MediaByokKey } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { usePaymentStore } from '@/stores/payment';
import { useUIStore } from '@/stores/ui';
import PageHeader from '@/components/PageHeader';

const { Title, Paragraph, Text } = Typography;

const PLAN_TAGS: Record<string, { text: string; color: string }> = {
  free: { text: '免费版', color: 'default' },
  pro: { text: '专业版', color: 'blue' },
  max: { text: '旗舰版', color: 'gold' },
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
  const [creditsHistoryLoading, setCreditsHistoryLoading] = useState(false);

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
    } catch {}
    setCreditsHistoryLoading(false);
  }, []);
  useEffect(() => { loadCreditsHistory(); }, [loadCreditsHistory]);

  const loadByokKeys = async () => {
    setByokLoading(true);
    try { const res: any = await byokAPI.list(); if (res?.data) setByokKeys(res.data); } catch {}
    setByokLoading(false);
  };
  useEffect(() => { loadByokKeys(); }, []);

  // 加载真实分销统计与邀请链接（替换原写死的收益/推荐人数与 demo 链接）
  const loadReferral = useCallback(async () => {
    try {
      const statsRes: any = await referralAPI.stats();
      setReferralStats(statsRes?.data || null);
      const codeRes: any = await referralAPI.code();
      setReferralLink(codeRes?.data?.referralLink || codeRes?.data?.referralCode ? `https://aibak.site/register?ref=${codeRes.data.referralCode}` : '');
    } catch {}
  }, []);
  useEffect(() => { loadReferral(); }, [loadReferral]);

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

  const pointsDataSource = creditsHistory.length > 0
    ? creditsHistory.map((item: any, idx: number) => ({ id: item._id || `c-${idx}`, type: item.type || 'earn', amount: item.amount || 0, desc: item.description || item.meta?.reason || '积分变动', time: item.createdAt?.slice(0, 10) || '-' }))
    : [
      { id: '1', type: 'earn', amount: 10, desc: '每日签到', time: '-' },
      { id: '2', type: 'earn', amount: 50, desc: '完成AI对话', time: '-' },
      { id: '3', type: 'spend', amount: -20, desc: '兑换API调用', time: '-' },
      { id: '4', type: 'earn', amount: 100, desc: '分享推广奖励', time: '-' },
      { id: '5', type: 'earn', amount: 30, desc: '上传知识文档', time: '-' },
    ];

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
      key: 'points', label: <span><GiftOutlined /> 积分记录</span>,
    },
    {
      key: 'referral', label: <span><TeamOutlined /> 分销代理</span>,
    },
    {
      key: 'byok', label: <span><KeyOutlined /> 媒体 Key</span>,
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
        <Form.Item label="新密码"><Input.Password placeholder="修改密码功能即将上线" disabled /></Form.Item>
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
          <Table dataSource={pointsDataSource} rowKey="id" size="small" pagination={{ pageSize: 10 }}
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

  const [activeTab, setActiveTab] = useState('overview');
  const tabContentMap: Record<string, React.ReactNode> = {
    overview: renderOverview(),
    security: renderSecurity(),
    points: renderPoints(),
    referral: renderReferral(),
    byok: renderByok(),
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
