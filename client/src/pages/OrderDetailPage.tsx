import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Typography, Spin, Descriptions, Tag, Button, Result, Row, Col, Statistic, message,
} from 'antd';
import {
  ArrowLeftOutlined, ShoppingOutlined, CrownOutlined, MessageOutlined,
  CreditCardOutlined, CheckCircleFilled,
} from '@ant-design/icons';
import { billingAPI, extractApiError } from '@/services/api';
import PageHeader from '@/components/PageHeader';

const { Title, Paragraph, Text } = Typography;

const PLAN_NAMES: Record<string, string> = { free: '免费版', pro: '专业版', max: '旗舰版' };
const PROVIDER_NAMES: Record<string, string> = { wechat: '微信支付', alipay: '支付宝', stripe: 'Stripe', mock: '测试支付' };
const STATUS_META: Record<string, { text: string; color: string }> = {
  pending: { text: '待支付', color: 'gold' },
  paid: { text: '已支付', color: 'green' },
  failed: { text: '支付失败', color: 'red' },
  expired: { text: '已过期', color: 'default' },
  refunded: { text: '已退款', color: 'volcano' },
};

export default function OrderDetailPage() {
  const { orderNo } = useParams<{ orderNo: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [creditPkgs, setCreditPkgs] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [ordersRes, plansRes, pkgsRes]: any[] = await Promise.all([
          billingAPI.getOrders().catch(() => ({ data: [] })),
          billingAPI.getPlans().catch(() => ({ data: [] })),
          billingAPI.getCreditsPackages().catch(() => ({ data: [] })),
        ]);
        const list: any[] = ordersRes?.data || [];
        setOrder(list.find((o) => o.orderNo === orderNo) || null);
        setPlans(plansRes?.data || []);
        setCreditPkgs(pkgsRes?.data || []);
      } catch (err) {
        message.error(extractApiError(err, '加载订单失败'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orderNo]);

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;

  if (!order) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <PageHeader title="订单明细" icon={<ShoppingOutlined />} />
        <Result status="404" title="未找到该订单" subTitle="订单可能不存在或不属于当前账号"
          extra={<Button type="primary" onClick={() => navigate('/profile')}>返回个人中心</Button>} />
      </div>
    );
  }

  // 计算本次到账额度 / 等价 AI 对话次数
  let grantedCredits = 0;
  if (order.orderType === 'credits_pack') {
    const pkg = creditPkgs.find((p) => p.id === order.packageId);
    grantedCredits = pkg?.credits || 0;
  } else {
    const plan = plans.find((p) => p.id === order.plan) || plans.find((p: any) => p.plan === order.plan);
    grantedCredits = plan?.credits || 0;
  }
  const aiCalls = Math.floor(grantedCredits / 10); // 10 积分 ≈ 1 次 API / AI 对话

  const amountYuan = (order.amount || 0) / 100;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader
        title="订单明细"
        subtitle={`订单号 ${order.orderNo}`}
        icon={<ShoppingOutlined />}
        extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/profile')}>返回个人中心</Button>}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={14}>
          <Card style={{ borderRadius: 16, border: '1px solid var(--border)' }}>
            <Descriptions column={1} size="middle" title={null}>
              <Descriptions.Item label="订单状态">
                <Tag color={STATUS_META[order.status]?.color} icon={order.status === 'paid' ? <CheckCircleFilled /> : undefined}>
                  {STATUS_META[order.status]?.text || order.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="订单类型">
                {order.orderType === 'credits_pack' ? '积分包购买' : '会员订阅'}
              </Descriptions.Item>
              <Descriptions.Item label="套餐 / 周期">
                {order.orderType === 'credits_pack'
                  ? (creditPkgs.find((p) => p.id === order.packageId)?.name || order.packageId || '-')
                  : `${PLAN_NAMES[order.plan] || order.plan} · ${order.period === 'yearly' ? '年付' : '月付'}`}
              </Descriptions.Item>
              <Descriptions.Item label="支付金额">
                <Text strong style={{ color: 'var(--brand-primary)', fontSize: 16 }}>¥{amountYuan.toFixed(2)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="支付方式">{PROVIDER_NAMES[order.provider] || order.provider}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{order.createdAt ? new Date(order.createdAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
              {order.paidAt && (
                <Descriptions.Item label="支付时间">{new Date(order.paidAt).toLocaleString('zh-CN')}</Descriptions.Item>
              )}
              {order.transactionId && (
                <Descriptions.Item label="交易流水号">{order.transactionId}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} md={10}>
          <Card style={{ borderRadius: 16, border: '1px solid var(--border)', marginBottom: 16,
            background: 'linear-gradient(135deg, rgba(108,92,231,0.08), rgba(162,155,254,0.05))' }}>
            <Title level={5} style={{ color: 'var(--text-primary)' }}><GiftLocal /> 本次到账</Title>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="赠送积分" value={grantedCredits} prefix={<CrownOutlined style={{ color: 'var(--brand-primary)' }} />}
                  valueStyle={{ color: 'var(--brand-primary)' }} />
              </Col>
              <Col span={12}>
                <Statistic title="等价 AI 对话" value={aiCalls} suffix="次" prefix={<MessageOutlined style={{ color: 'var(--brand-success)' }} />}
                  valueStyle={{ color: 'var(--brand-success)' }} />
              </Col>
            </Row>
            <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0, marginTop: 8 }}>
              积分可用于 AI 对话、文生图、工具调用等全部功能（10 积分 ≈ 1 次 AI 对话）。
            </Paragraph>
          </Card>

          {order.status === 'pending' && (
            <Card style={{ borderRadius: 16, border: '1px solid var(--border)' }}>
              <Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
                订单尚未支付。如需重新支付，请前往定价页重新下单。
              </Paragraph>
              <Button type="primary" block icon={<CreditCardOutlined />} onClick={() => navigate('/pricing')}
                style={{ background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', borderRadius: 10 }}>
                去支付 / 重新下单
              </Button>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}

function GiftLocal() {
  return <span style={{ color: 'var(--brand-primary)', marginRight: 6 }}><CrownOutlined /></span>;
}
