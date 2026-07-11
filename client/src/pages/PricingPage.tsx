import { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Tag, message, Modal, Divider, Segmented, Row, Col, Spin,
} from 'antd';
import { CheckOutlined, CrownOutlined, ThunderboltOutlined, WalletOutlined } from '@ant-design/icons';
import { billingAPI, extractApiError } from '@/services/api';

const { Title, Paragraph, Text } = Typography;

type PriceType = 'credits' | 'month' | 'year';

interface PlanFromServer {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number; // 分
  priceYearly: number;  // 分
  credits: number;
  features: string[];
  highlighted?: boolean;
}

interface CreditsPackage {
  id: string;
  name: string;
  credits: number;
  price: number; // 分
  description: string;
}

function centsToYuan(cents: number): string {
  if (cents <= 0) return '免费';
  return `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default function PricingPage() {
  const [priceType, setPriceType] = useState<PriceType>('month');
  const [currentPlan, setCurrentPlan] = useState('free');
  const [paying, setPaying] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PlanFromServer | CreditsPackage | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'yearly'>('monthly');

  // 从后端加载数据
  const [plans, setPlans] = useState<PlanFromServer[]>([]);
  const [creditsPackages, setCreditsPackages] = useState<CreditsPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [plansRes, pkgsRes, subRes] = await Promise.all([
          billingAPI.getPlans(),
          billingAPI.getCreditsPackages(),
          billingAPI.getSubscription().catch(() => null),
        ]);
        // 过滤掉免费版（不需要购买），或按需保留
        const allPlans = (plansRes as any)?.data || [];
        setPlans(allPlans);
        setCreditsPackages((pkgsRes as any)?.data || []);
        if ((subRes as any)?.data?.plan) {
          setCurrentPlan((subRes as any).data.plan);
        }
      } catch (e) {
        setLoadError(extractApiError(e, '加载套餐失败'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSelect = (item: PlanFromServer | CreditsPackage, period?: 'monthly' | 'yearly') => {
    const id = 'id' in item ? item.id : '';
    if (id === currentPlan) {
      message.info('您已订阅此套餐');
      return;
    }
    setSelectedItem(item);
    setSelectedPeriod(period || 'monthly');
    setConfirmOpen(true);
  };

  const handlePay = async () => {
    if (!selectedItem) return;
    setPaying(('id' in selectedItem ? selectedItem.id : 'package'));
    try {
      if ('credits' in selectedItem && selectedItem.priceMonthly > 0) {
        // 订阅套餐
        const res: any = await billingAPI.createOrder({
          plan: selectedItem.id as 'free' | 'pro' | 'max',
          period: selectedPeriod,
        });
        // Mock 模式自动支付
        if (res?.data?.payParams?.payUrl) {
          await billingAPI.mockPay(res.data.orderNo);
          message.success('支付成功！套餐已激活');
          setCurrentPlan(selectedItem.id);
        } else {
          message.success('订单已创建，请完成支付');
        }
      } else if ('description' in selectedItem) {
        // 积分包
        const res: any = await billingAPI.createCreditsOrder({
          packageId: selectedItem.id,
        });
        if (res?.data?.payParams?.payUrl) {
          await billingAPI.mockPay(res.data.orderNo);
          message.success(`成功购买 ${selectedItem.name}`);
        } else {
          message.success('订单已创建，请完成支付');
        }
      }
      setConfirmOpen(false);
    } catch (e) {
      message.error(extractApiError(e, '支付失败'));
    }
    setPaying(null);
  };

  // 获取付费套餐（不含免费版）
  const paidPlans = plans.filter((p) => p.id !== 'free');

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
        <Paragraph type="secondary" style={{ marginTop: 16 }}>加载套餐信息...</Paragraph>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Paragraph type="danger">{loadError}</Paragraph>
        <Button onClick={() => window.location.reload()}>重试</Button>
      </div>
    );
  }

  const displayPlans = priceType === 'credits'
    ? creditsPackages
    : paidPlans;

  const getItemPrice = (item: PlanFromServer | CreditsPackage): string => {
    if ('priceMonthly' in item) {
      if (priceType === 'year') return centsToYuan(item.priceYearly);
      return centsToYuan(item.priceMonthly);
    }
    // 积分包
    return centsToYuan((item as CreditsPackage).price);
  };

  const getItemOriginalPrice = (item: PlanFromServer | CreditsPackage): string | null => {
    if ('priceMonthly' in item && priceType === 'year') {
      // 年付 = 月付 × 10，标出原价（月付 × 12）
      const orig = item.priceMonthly * 12;
      return `原价 ¥${(orig / 100).toFixed(0)}`;
    }
    return null;
  };

  const getItemId = (item: PlanFromServer | CreditsPackage): string =>
    'id' in item ? item.id : (item as CreditsPackage).id;

  const getItemName = (item: PlanFromServer | CreditsPackage): string =>
    'id' in item ? item.name : (item as CreditsPackage).name;

  const getItemTagline = (item: PlanFromServer | CreditsPackage): string => {
    if ('tagline' in item) return item.tagline;
    return (item as CreditsPackage).description;
  };

  const getItemFeatures = (item: PlanFromServer | CreditsPackage): string[] => {
    if ('features' in item) return item.features;
    const pkg = item as CreditsPackage;
    return [`${pkg.credits} 积分`, '可用于 AI 对话 / API 调用 / 工具使用', '永久有效'];
  };

  const getItemHighlighted = (item: PlanFromServer | CreditsPackage): boolean => {
    if ('highlighted' in item) return !!item.highlighted;
    // 积分包：500 积分的为推荐
    return (item as CreditsPackage).credits === 500;
  };

  const getItemBadge = (item: PlanFromServer | CreditsPackage): string | null => {
    if ('highlighted' in item && item.highlighted) return '推荐';
    if ('credits' in item && item.credits >= 2000) return '最划算';
    return null;
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      {/* 标题 */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={2}>灵活的付费方案</Title>
        <Paragraph type="secondary" style={{ fontSize: 16 }}>
          积分按需购买 · 按月订阅 · 包年优惠 —— 想用就付，不用不扣费
        </Paragraph>

        <Segmented
          value={priceType}
          onChange={(v) => setPriceType(v as PriceType)}
          size="large"
          style={{ marginTop: 16 }}
          options={[
            { value: 'credits', label: '⚡ 积分包', icon: <ThunderboltOutlined /> },
            { value: 'month', label: '💳 按月', icon: <WalletOutlined /> },
            { value: 'year', label: '🏆 包年', icon: <CrownOutlined /> },
          ]}
        />
      </div>

      {/* 免费版卡片 */}
      {priceType !== 'credits' && plans.some((p) => p.id === 'free') && (
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Tag color="green" style={{ fontSize: 14, padding: '4px 16px' }}>
            {currentPlan === 'free' ? '当前方案：免费版' : '已有免费版可用'}
          </Tag>
        </div>
      )}

      {/* 套餐/积分包卡片列表 */}
      {displayPlans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Paragraph type="secondary">
            {priceType === 'credits' ? '暂无积分包可选' : '暂无付费套餐'}
          </Paragraph>
        </div>
      ) : (
        <Row gutter={[20, 20]} justify="center">
          {displayPlans.map((item) => {
            const id = getItemId(item);
            const highlighted = getItemHighlighted(item);
            const badge = getItemBadge(item);
            return (
              <Col xs={24} sm={12} md={8} key={id}>
                <Card
                  className={`pricing-card ${highlighted ? 'highlight' : ''}`}
                  hoverable
                  actions={[
                    <Button
                      key="buy"
                      type={highlighted ? 'primary' : 'default'}
                      block
                      onClick={() => handleSelect(item as PlanFromServer | CreditsPackage, priceType === 'year' ? 'yearly' : 'monthly')}
                      loading={paying === id}
                      style={{
                        margin: '0 16px',
                        background: highlighted ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : undefined,
                        border: highlighted ? 'none' : undefined,
                      }}
                    >
                      {currentPlan === id ? '当前方案' : ('priceMonthly' in item && item.priceMonthly === 0) ? '免费使用' : priceType === 'credits' ? '立即购买' : '立即订阅'}
                    </Button>,
                  ]}
                >
                  {badge && <Tag className="plan-badge" color="#8b5cf6">{badge}</Tag>}
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <Text strong style={{ fontSize: 18 }}>{getItemName(item)}</Text>
                    <div style={{ margin: '8px 0' }}>
                      <Text style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Inter, sans-serif' }}>
                        {getItemPrice(item)}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 14 }}>
                        /{priceType === 'credits' ? '包' : priceType === 'year' ? '年' : '月'}
                      </Text>
                    </div>
                    {getItemOriginalPrice(item) && (
                      <Text delete type="secondary" style={{ fontSize: 13 }}>
                        {getItemOriginalPrice(item)}
                      </Text>
                    )}
                  </div>
                  <Divider style={{ margin: '0 0 12px' }} />
                  <div style={{ minHeight: 160 }}>
                    {getItemFeatures(item).map((f, i) => (
                      <div key={i} style={{ padding: '5px 0', fontSize: 14 }}>
                        <CheckOutlined style={{ color: '#10b981', marginRight: 8 }} />
                        {f}
                      </div>
                    ))}
                    {'credits' in item && item.credits > 0 && (
                      <div style={{ padding: '5px 0', fontSize: 14 }}>
                        <CheckOutlined style={{ color: '#f59e0b', marginRight: 8 }} />
                        赠送 {item.credits} 积分
                      </div>
                    )}
                  </div>
                </Card>
              </Col>
            );
          })}
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
          loading: !!paying,
          style: { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' },
        }}
      >
        {selectedItem && (
          <div>
            <Paragraph>
              <strong>项目：</strong>{getItemName(selectedItem)}
              {priceType !== 'credits' && ` - ${selectedPeriod === 'yearly' ? '年付' : '月付'}`}
            </Paragraph>
            <Paragraph><strong>价格：</strong>{getItemPrice(selectedItem)}</Paragraph>
            <Paragraph><strong>支付方式：</strong>微信支付 / Stripe</Paragraph>
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              当前为 Mock 模式，点击确认将模拟支付完成
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
