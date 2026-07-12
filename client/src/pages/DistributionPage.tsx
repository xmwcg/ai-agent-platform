import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, Row, Col, Statistic, Tag, message, Spin,
  Table, Input, Tooltip, Empty, Divider,
} from 'antd';
import {
  ShareAltOutlined, CopyOutlined, GiftOutlined, TeamOutlined,
  MoneyCollectOutlined, LinkOutlined, CrownOutlined, RiseOutlined,
} from '@ant-design/icons';
import { referralAPI } from '@/services/api';

const { Title, Text, Paragraph } = Typography;

interface ReferralStats {
  inviteCount?: number;
  commissionTotal?: number;
  pendingCommission?: number;
  paidCommission?: number;
  tier?: string;
}
interface Commission {
  _id?: string;
  createdAt?: string;
  amount?: number;
  status?: string;
  fromUser?: string;
  orderNo?: string;
}

const TIERS = [
  { name: '推广员', condition: '邀请 0 人起', rate: '15%', color: 'default' },
  { name: '合伙人', condition: '成功邀请 ≥ 10 人', rate: '25%', color: 'blue' },
  { name: '城市代理', condition: '成功邀请 ≥ 50 人', rate: '35%', color: 'gold' },
];

export default function DistributionPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [stats, setStats] = useState<ReferralStats>({});
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [copied, setCopied] = useState(false);

  const inviteLink = code ? `https://aibak.site/register?ref=${code}` : 'https://aibak.site/register';

  const load = async () => {
    setLoading(true);
    try {
      const [codeRes, statsRes, commRes]: any[] = await Promise.all([
        referralAPI.code().catch(() => ({})),
        referralAPI.stats().catch(() => ({})),
        referralAPI.commissions({ page: 1, pageSize: 20 }).catch(() => ({ data: [] })),
      ]);
      setCode(codeRes?.code || codeRes?.data?.code || '');
      setStats(statsRes?.data || statsRes || {});
      const arr = commRes?.data?.list || commRes?.data?.docs || commRes?.data || [];
      setCommissions(Array.isArray(arr) ? arr : []);
    } catch {
      message.warning('分销数据加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      message.success('邀请链接已复制');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  const commColumns = [
    {
      title: '时间', dataIndex: 'createdAt', key: 'createdAt',
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '—',
    },
    { title: '来源用户', dataIndex: 'fromUser', key: 'fromUser', render: (v: string) => v || '—' },
    { title: '关联订单', dataIndex: 'orderNo', key: 'orderNo', render: (v: string) => v || '—' },
    {
      title: '佣金', dataIndex: 'amount', key: 'amount',
      render: (v: number) => <Text strong style={{ color: '#07c160' }}>¥{(v ?? 0).toFixed(2)}</Text>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const map: Record<string, { t: string; c: string }> = {
          pending: { t: '待结算', c: 'orange' },
          settled: { t: '已结算', c: 'green' },
          paid: { t: '已打款', c: 'blue' },
        };
        const s = map[v] || { t: v || '未知', c: 'default' };
        return <Tag color={s.c}>{s.t}</Tag>;
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <ShareAltOutlined style={{ fontSize: 26, color: '#6c5ce7' }} />
        <Title level={3} style={{ margin: 0 }}>分销中心</Title>
        <Tag color="purple" icon={<CrownOutlined />}>推广赚佣金</Tag>
      </div>
      <Text type="secondary">邀请好友注册 / 升级会员，永久获得订阅分成，多级裂变轻松变现。</Text>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <>
          {/* 邀请链接 */}
          <Card style={{ marginTop: 16, borderRadius: 16,
            background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)', border: 'none', color: '#fff' }}>
            <Row align="middle" gutter={16}>
              <Col xs={24} md={14}>
                <Text style={{ color: 'rgba(255,255,255,0.85)' }}>我的专属邀请链接</Text>
                <div style={{
                  marginTop: 8, padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.15)', fontFamily: 'monospace', fontSize: 14,
                  wordBreak: 'break-all',
                }}>{inviteLink}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  邀请码：<b>{code || '—'}</b>
                </div>
              </Col>
              <Col xs={24} md={10} style={{ textAlign: 'right' }}>
                <Button size="large" icon={copied ? <CopyOutlined /> : <LinkOutlined />}
                  onClick={copyLink}
                  style={{ background: '#fff', color: '#6c5ce7', border: 'none', fontWeight: 600, borderRadius: 10 }}>
                  {copied ? '已复制' : '复制邀请链接'}
                </Button>
                <div style={{ marginTop: 10 }}>
                  <Button ghost size="large" onClick={() => navigate('/pricing')}
                    style={{ borderRadius: 10, borderColor: 'rgba(255,255,255,0.6)', color: '#fff' }}>
                    去会员页推广
                  </Button>
                </div>
              </Col>
            </Row>
          </Card>

          {/* 数据统计 */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={12} md={6}>
              <Card style={{ borderRadius: 14, textAlign: 'center' }}>
                <Statistic title="累计邀请" value={stats.inviteCount ?? 0} prefix={<TeamOutlined style={{ color: '#6c5ce7' }} />} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card style={{ borderRadius: 14, textAlign: 'center' }}>
                <Statistic title="佣金总额" value={stats.commissionTotal ?? 0} precision={2} prefix="¥"
                  valueStyle={{ color: '#07c160' }} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card style={{ borderRadius: 14, textAlign: 'center' }}>
                <Statistic title="待结算" value={stats.pendingCommission ?? 0} precision={2} prefix="¥"
                  valueStyle={{ color: '#fa8c16' }} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card style={{ borderRadius: 14, textAlign: 'center' }}>
                <Statistic title="已打款" value={stats.paidCommission ?? 0} precision={2} prefix="¥"
                  valueStyle={{ color: '#1677ff' }} />
              </Card>
            </Col>
          </Row>

          {/* 分佣等级 */}
          <Title level={4} style={{ marginTop: 28, marginBottom: 12 }}>
            <RiseOutlined /> 分佣等级
          </Title>
          <Row gutter={[16, 16]}>
            {TIERS.map((t) => (
              <Col xs={24} md={8} key={t.name}>
                <Card style={{ borderRadius: 14, borderTop: '3px solid #6c5ce7', height: '100%' }}>
                  <Tag color={t.color} style={{ marginBottom: 8 }}>{t.name}</Tag>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#6c5ce7' }}>{t.rate}</div>
                  <Text type="secondary">{t.condition}</Text>
                </Card>
              </Col>
            ))}
          </Row>

          {/* 佣金明细 */}
          <Title level={4} style={{ marginTop: 28, marginBottom: 12 }}>
            <MoneyCollectOutlined /> 佣金明细
          </Title>
          <Card style={{ borderRadius: 14 }}>
            {commissions.length === 0 ? (
              <Empty description="暂无佣金记录，邀请好友升级会员即可获得分成" />
            ) : (
              <Table rowKey={(r) => r._id || Math.random().toString()} dataSource={commissions}
                columns={commColumns} pagination={false} size="middle" />
            )}
          </Card>

          <Divider />
          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            <GiftOutlined /> 推广规则：通过你的邀请链接注册的用户，其每次会员订阅消费你均可获得对应等级佣金；佣金每月结算，满 ¥100 可提现至微信 / 支付宝。最终解释权归 AIbak 所有。
          </Paragraph>
        </>
      )}
    </div>
  );
}
