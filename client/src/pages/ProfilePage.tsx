import { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Space, Tag, Progress, Table, message,
  Row, Col, Modal, Avatar, Spin, Tabs, Form, Input, QRCode, Statistic,
  List, Divider, Badge, Tooltip,
} from 'antd';
import {
  UserOutlined, CrownOutlined, CreditCardOutlined, HistoryOutlined,
  SafetyCertificateOutlined, ApiOutlined, GiftOutlined, ShareAltOutlined,
  QrcodeOutlined, TeamOutlined, WalletOutlined, MobileOutlined,
  MailOutlined, WechatOutlined, CalendarOutlined, TrophyOutlined,
  SendOutlined, DollarOutlined, ExportOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { billingAPI, profileAPI, marketplaceAPI, extractApiError } from '@/services/api';

const { Title, Paragraph, Text } = Typography;

const PLAN_LABEL: Record<string, { text: string; color: string }> = {
  free: { text: '免费版', color: 'default' },
  pro: { text: '专业版', color: 'blue' },
  max: { text: '旗舰版', color: 'gold' },
};

// 模拟积分记录
const MOCK_POINTS: { id: string; type: string; amount: number; desc: string; time: string }[] = [
  { id: '1', type: 'earn', amount: 10, desc: '每日签到', time: '2025-07-09' },
  { id: '2', type: 'earn', amount: 50, desc: '完成AI对话', time: '2025-07-09' },
  { id: '3', type: 'spend', amount: -20, desc: '兑换API调用', time: '2025-07-08' },
  { id: '4', type: 'earn', amount: 100, desc: '分享推广奖励', time: '2025-07-08' },
  { id: '5', type: 'earn', amount: 30, desc: '上传知识文档', time: '2025-07-07' },
];

// 分销记录
const MOCK_REFERRALS: { id: string; name: string; level: number; commission: number; time: string }[] = [
  { id: '1', name: '张**', level: 1, commission: 29.9, time: '2025-07-05' },
  { id: '2', name: '李**', level: 1, commission: 99.0, time: '2025-07-01' },
  { id: '3', name: '王**', level: 2, commission: 9.9, time: '2025-06-28' },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>({ name: '用户', email: 'user@example.com', credits: 500, phone: '', wechat: '' });
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signChecked, setSignChecked] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const dailyPoints = 10;
  const totalPoints = 1850;

  useEffect(() => {
    Promise.all([
      profileAPI.get().catch(() => null),
      billingAPI.getSubscription().catch(() => null),
    ]).then(([p, s]: any[]) => {
      if (p?.user) setUser((prev: any) => ({ ...prev, ...p.user }));
      if (s?.data) setSub(s.data);
    }).finally(() => setLoading(false));
  }, []);

  const handleSignIn = () => {
    if (signChecked) { message.info('今日已签到'); return; }
    setSignChecked(true);
    message.success(`签到成功！+${dailyPoints} 积分`);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;

  const plan = sub?.plan || user?.plan || 'free';
  const credits = sub?.credits ?? user?.credits ?? 0;

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
                  <Text strong style={{ fontSize: 20 }}>{user?.name || '用户'}</Text>
                  <div><Text type="secondary">{user?.email}</Text></div>
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
                  <div><Text type="secondary">连续签到 {7} 天，今日 +{dailyPoints} 积分</Text></div>
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
                <Button block icon={<GiftOutlined />} onClick={() => message.info('兑换中心建设中')}>积分兑换</Button>
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
              <Input prefix={<MobileOutlined />} value={user?.phone || ''} placeholder="绑定手机号" />
              <Button type="link" size="small" style={{ padding: 0 }}>发送验证码</Button>
            </Form.Item>
            <Form.Item label="微信号">
              <Input prefix={<WechatOutlined />} value={user?.wechat || ''} placeholder="绑定微信" />
            </Form.Item>
            <Form.Item label="邮箱">
              <Input prefix={<MailOutlined />} value={user?.email || ''} disabled />
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
            <Card title="积分记录">
              <Table dataSource={MOCK_POINTS} rowKey="id" size="small" pagination={false}
                columns={[
                  { title: '说明', dataIndex: 'desc', key: 'desc' },
                  { title: '变动', dataIndex: 'amount', key: 'amount',
                    render: (v: number) => <Text style={{ color: v > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{v > 0 ? `+${v}` : v}</Text> },
                  { title: '时间', dataIndex: 'time', key: 'time' },
                  { title: '类型', dataIndex: 'type', key: 'type',
                    render: (t: string) => <Tag>{t === 'earn' ? '获取' : '消费'}</Tag> },
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
              <Input value={`https://aiagent.app/ref=${user?._id || 'demo'}`} readOnly />
              <Space style={{ marginTop: 12 }} wrap>
                <Button icon={<QrcodeOutlined />} onClick={() => setShareModal(true)}>分享二维码</Button>
                <Button icon={<ExportOutlined />}>复制链接</Button>
              </Space>
              <Divider />
              <Title level={5}>佣金比例</Title>
              <List size="small">
                <List.Item>一级分销：<strong>5%</strong> 佣金（近竞品 1/3）</List.Item>
                <List.Item>二级分销：<strong>2%</strong> 佣金</List.Item>
                <List.Item>三级分销：<strong>1%</strong> 佣金</List.Item>
                <List.Item>最低提现：<strong>¥50</strong></List.Item>
              </List>
            </Card>
          </Col>
          <Col xs={24} md={16}>
            <Card title="分销记录">
              <Table dataSource={MOCK_REFERRALS} rowKey="id" size="small" pagination={false}
                columns={[
                  { title: '用户', dataIndex: 'name', key: 'name' },
                  { title: '层级', dataIndex: 'level', key: 'level',
                    render: (v: number) => <Tag>第{v}级</Tag> },
                  { title: '佣金', dataIndex: 'commission', key: 'commission',
                    render: (v: number) => <Text style={{ color: '#10b981' }}>¥{v.toFixed(2)}</Text> },
                  { title: '时间', dataIndex: 'time', key: 'time' },
                ]}
              />
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'share', label: <span><ShareAltOutlined /> 分享</span>,
      children: (
        <Card>
          <Row gutter={[24, 24]}>
            <Col span={12} style={{ textAlign: 'center' }}>
              <Title level={5}>分享二维码</Title>
              <QRCode value={`https://aiagent.app/ref=${user?._id || 'demo'}`} size={200} />
              <div style={{ marginTop: 12 }}><Button icon={<ExportOutlined />}>下载二维码</Button></div>
            </Col>
            <Col span={12} style={{ textAlign: 'center' }}>
              <Title level={5}>分享链接</Title>
              <Input.TextArea value={`🔥 推荐你使用 AI Agent Platform！\n一站式 AI 生产力平台，注册即送 100 积分。\nhttps://aiagent.app/ref=${user?._id || 'demo'}`} rows={4} />
              <Space style={{ marginTop: 12 }}>
                <Button icon={<WechatOutlined />} style={{ background: '#07c160', color: '#fff' }}>分享到微信</Button>
                <Button icon={<SendOutlined />}>复制文案</Button>
              </Space>
            </Col>
          </Row>
        </Card>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Title level={3}><UserOutlined /> 个人中心</Title>
      <Tabs defaultActiveKey="overview" items={tabItems} />

      {/* 分享弹窗 */}
      <Modal open={shareModal} onCancel={() => setShareModal(false)} footer={null} title="分享推广">
        <div style={{ textAlign: 'center' }}>
          <QRCode value={`https://aiagent.app/ref=${user?._id || 'demo'}`} size={180} />
          <Paragraph style={{ marginTop: 12 }}>
            扫描二维码注册，你即可获得 <Tag color="gold">100 积分</Tag> 奖励
          </Paragraph>
        </div>
      </Modal>
    </div>
  );
}
