import { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Space, Tag, message, Radio, Modal, Divider, Segmented, Row, Col,
} from 'antd';
import { CheckOutlined, CrownOutlined, ThunderboltOutlined, CalendarOutlined, WalletOutlined } from '@ant-design/icons';
import { billingAPI, extractApiError } from '@/services/api';

const { Title, Paragraph, Text } = Typography;

// 付费类型
type PriceType = 'call' | 'day' | 'month' | 'year';

interface Plan {
  id: string;
  name: string;
  tagline: string;
  price: number;
  priceType: PriceType;
  originalPrice?: number;
  features: string[];
  limits: Record<string, string | number>;
  highlighted?: boolean;
  badge?: string;
}

const CALL_PLANS: Plan[] = [
  { id: 'call-10', name: '体验包', tagline: '10次调用', price: 9.9, priceType: 'call',
    features: ['10 次 AI 对话', '有效期 30 天', '支持所有模型', '标准响应速度'],
    limits: { 对话次数: '10 次', 文件上传: '5 MB' },
  },
  { id: 'call-100', name: '标准包', tagline: '100次调用', price: 79, priceType: 'call', originalPrice: 99,
    features: ['100 次 AI 对话', '有效期 90 天', '优先响应速度', 'API 调用权限'],
    limits: { 对话次数: '100 次', 文件上传: '20 MB' }, highlighted: true, badge: '推荐',
  },
  { id: 'call-500', name: '企业包', tagline: '500次调用', price: 349, priceType: 'call', originalPrice: 495,
    features: ['500 次 AI 对话', '有效期 365 天', '最高优先级', 'API + 团队协作', '专属客服'],
    limits: { 对话次数: '500 次', 文件上传: '50 MB' },
  },
];

const PLAN_TIERS: Plan[] = [
  { id: 'free', name: '免费版', tagline: '个人体验', price: 0, priceType: 'month',
    features: ['每日 20 次 AI 对话', '基础知识库（5 个文档）', '3 个智能工具', '社区支持'],
    limits: { AI对话: '20 次/天', 知识文档: '5 个', 文件大小: '5 MB', API配额: '100 次/天' },
  },
  { id: 'pro', name: '专业版', tagline: '专业创作', price: 29, priceType: 'month', originalPrice: 39,
    features: ['每日 200 次 AI 对话', '无限知识库', '全部 20+ 智能工具', '优先客服', 'API 开放', '高级模型接入'],
    limits: { AI对话: '200 次/天', 知识文档: '无限', 文件大小: '50 MB', API配额: '5000 次/天' },
    highlighted: true, badge: '最受欢迎',
  },
  { id: 'max', name: '旗舰版', tagline: '企业级', price: 99, priceType: 'month', originalPrice: 129,
    features: ['无限 AI 对话', '无限知识库', '所有功能无限制', '团队协作（最多 50 人）', '专属客服 + 电话', '自定义模型配置', '白标 API'],
    limits: { AI对话: '无限', 知识文档: '无限', 文件大小: '200 MB', API配额: '无限' },
  },
];

export default function PricingPage() {
  const [priceType, setPriceType] = useState<PriceType>('month');
  const [currentPlan, setCurrentPlan] = useState('free');
  const [paying, setPaying] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  useEffect(() => {
    billingAPI.getSubscription().then((r: any) => {
      if (r?.data?.plan) setCurrentPlan(r.data.plan);
    }).catch(() => {});
  }, []);

  const handleSelect = (plan: Plan) => {
    if (plan.id === currentPlan) { message.info('您已订阅此套餐'); return; }
    setSelectedPlan(plan);
    setConfirmOpen(true);
  };

  const handlePay = async () => {
    if (!selectedPlan) return;
    const planId = selectedPlan.id.replace('call-', '');
    const orderPlan = ['free', 'pro', 'max'].includes(selectedPlan.id) ? selectedPlan.id : 'pro';
    setPaying(selectedPlan.id);
    try {
      await billingAPI.createOrder({
        plan: orderPlan as any,
        period: selectedPlan.priceType === 'year' ? 'yearly' : 'monthly',
      });
      message.success('订单创建成功，正在跳转支付...');
      setConfirmOpen(false);
    } catch (e) {
      message.error(extractApiError(e, '创建订单失败'));
    }
    setPaying(null);
  };

  const getDisplayPrice = (plan: Plan) => {
    if (plan.price === 0) return '免费';
    return `¥${plan.price}`;
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      {/* 标题 */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={2}>灵活的付费方案</Title>
        <Paragraph type="secondary" style={{ fontSize: 16 }}>
          按次付费 · 按天付费 · 按月订阅 —— 想用就付，不用不扣费
        </Paragraph>

        {/* 付费类型切换 */}
        <Segmented
          value={priceType}
          onChange={(v) => setPriceType(v as PriceType)}
          size="large"
          style={{ marginTop: 16 }}
          options={[
            { value: 'call', label: '⚡ 按次', icon: <ThunderboltOutlined /> },
            { value: 'day', label: '📅 按天', icon: <CalendarOutlined /> },
            { value: 'month', label: '💳 按月', icon: <WalletOutlined /> },
            { value: 'year', label: '🏆 包年', icon: <CrownOutlined /> },
          ]}
        />
      </div>

      {/* 套餐卡片 */}
      {priceType === 'call' ? (
        <Row gutter={[20, 20]} justify="center">
          {CALL_PLANS.map((plan) => (
            <Col xs={24} sm={12} md={8} key={plan.id}>
              <Card
                className={`pricing-card ${plan.highlighted ? 'highlight' : ''}`}
                hoverable
                actions={[
                  <Button
                    key="buy"
                    type={plan.highlighted ? 'primary' : 'default'}
                    block
                    onClick={() => handleSelect(plan)}
                    loading={paying === plan.id}
                    style={{
                      margin: '0 16px',
                      background: plan.highlighted ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : undefined,
                      border: plan.highlighted ? 'none' : undefined,
                    }}
                  >
                    {plan.price === 0 ? '免费使用' : currentPlan === plan.id ? '当前方案' : '立即购买'}
                  </Button>,
                ]}
              >
                {plan.badge && <Tag className="plan-badge" color="#8b5cf6">{plan.badge}</Tag>}
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Text strong style={{ fontSize: 18 }}>{plan.name}</Text>
                  <div style={{ margin: '8px 0' }}>
                    <Text style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Inter, sans-serif' }}>
                      {getDisplayPrice(plan)}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 14 }}>/{plan.tagline}</Text>
                  </div>
                  {plan.originalPrice && (
                    <Text delete type="secondary" style={{ fontSize: 13 }}>
                      原价 ¥{plan.originalPrice}
                    </Text>
                  )}
                </div>
                <Divider style={{ margin: '0 0 12px' }} />
                <div style={{ minHeight: 140 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ padding: '5px 0', fontSize: 14 }}>
                      <CheckOutlined style={{ color: '#10b981', marginRight: 8 }} />
                      {f}
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Row gutter={[20, 20]} justify="center">
          {PLAN_TIERS.map((plan) => (
            <Col xs={24} sm={12} md={8} key={plan.id}>
              <Card
                className={`pricing-card ${plan.highlighted ? 'highlight' : ''}`}
                hoverable
                actions={[
                  <Button
                    key="buy"
                    type={plan.highlighted ? 'primary' : 'default'}
                    block
                    onClick={() => handleSelect(plan)}
                    loading={paying === plan.id}
                    style={{
                      margin: '0 16px',
                      background: plan.highlighted ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : undefined,
                      border: plan.highlighted ? 'none' : undefined,
                    }}
                  >
                    {plan.price === 0 ? '免费使用' : currentPlan === plan.id ? '当前方案' : '立即订阅'}
                  </Button>,
                ]}
              >
                {plan.badge && <Tag className="plan-badge" color="#8b5cf6">{plan.badge}</Tag>}
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Text strong style={{ fontSize: 18 }}>{plan.name}</Text>
                  <div style={{ margin: '8px 0' }}>
                    <Text style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Inter, sans-serif' }}>
                      {getDisplayPrice(plan)}
                    </Text>
                    {plan.price > 0 && <Text type="secondary" style={{ fontSize: 14 }}>/{priceType === 'year' ? '年' : '月'}</Text>}
                  </div>
                  {plan.originalPrice && (
                    <Text delete type="secondary" style={{ fontSize: 13 }}>原价 ¥{plan.originalPrice}</Text>
                  )}
                </div>
                <Divider style={{ margin: '0 0 12px' }} />
                <div style={{ minHeight: 180 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ padding: '5px 0', fontSize: 14 }}>
                      <CheckOutlined style={{ color: '#10b981', marginRight: 8 }} />
                      {f}
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 确认支付弹窗 */}
      <Modal
        title="确认订单"
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onOk={handlePay}
        okText="确认支付"
        cancelText="返回"
        okButtonProps={{
          loading: paying === selectedPlan?.id,
          style: { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' },
        }}
      >
        {selectedPlan && (
          <div>
            <Paragraph><strong>套餐：</strong>{selectedPlan.name} - {selectedPlan.tagline}</Paragraph>
            <Paragraph><strong>价格：</strong>{getDisplayPrice(selectedPlan)}</Paragraph>
            <Paragraph><strong>支付方式：</strong>微信支付 / Stripe</Paragraph>
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              💡 支持按需付费，不用不扣费，随时可取消
            </Paragraph>
          </div>
        )}
      </Modal>

      <style>{`
        .pricing-card { border-radius: 14px; transition: all 0.3s; position: relative; }
        .pricing-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.1); }
        .pricing-card.highlight {
          border: 2px solid #818cf8;
          box-shadow: 0 0 20px rgba(129,140,248,0.15);
        }
        .plan-badge {
          position: absolute; top: 12px; right: 12px;
          border-radius: 10px; padding: 2px 12px;
        }
      `}</style>
    </div>
  );
}
