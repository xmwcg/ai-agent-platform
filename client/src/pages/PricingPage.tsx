import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Card, Typography, Button, Tag, message, Modal, Divider, Segmented, Row, Col, Spin, Result, Tabs, Input, Select, Space,
} from 'antd';
import {
  CheckOutlined, CrownOutlined, ThunderboltOutlined, WalletOutlined,
  WechatOutlined, LoadingOutlined, SendOutlined,
} from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import apiClient, { billingAPI, extractApiError, projectGradeAPI } from '@/services/api';
import { useResponsive } from '@/hooks/useResponsive';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createOrderIdempotencyKey, parsePaymentContext } from './Pricing/payment-context';
import { useAuthStore } from '@/stores/auth';
import { buildLoginPath } from '@/utils/safe-return-to';
import {
  ProductTab, PRODUCT_PARAM_MAP, PRODUCT_META,
  JINWANGTONG_PLANS, JinWangTongPlan,
  ZHIPINGTONG_PLANS, ZhiPingTongPlan,
  TRANSYNC_PLANS, TranSyncPlan,
  GUARD_PLANS, GuardPlan,
} from '@/config/product-pricing';

const { Title, Paragraph, Text } = Typography;

// 后端 createOrder 路由只接受 plan ∈ {free, pro, max, team}（见 server/src/routes/billing/logic.ts）。
// 前端在产品 Tab 下点击的是产品专用 id（zpt_* / ts_* / jwt_*），必须先映射到 PLANS 枚举值，
// 否则后端 schema 校验直接 400。映射按价格档位匹配，等级越高映射越高 plan。
const PRODUCT_PLAN_MAP: Record<string, 'free' | 'pro' | 'max' | 'team'> = {
  // 金网通（永久买断，对应企业 IT 资产规模）
  jwt_basic: 'pro',
  jwt_pro: 'max',
  jwt_enterprise: 'team',
  // 智评通（按月/年订阅，AI 项目质量评估）
  zpt_basic: 'pro',
  zpt_pro: 'max',
  zpt_enterprise: 'team',
  // TranSync（按月/年订阅，多语言实时翻译）
  ts_free: 'free',
  ts_pro: 'pro',
  ts_team: 'team',
  // NexMind Guard（按年订阅）
  guard_free: 'free',
  guard_pro: 'pro',
  guard_max: 'max',
};

// selectedType → 后端 sourceProduct，用于产品归因与后续产品履约
const PRODUCT_SOURCE_MAP: Record<string, 'platform' | 'project_grade' | 'jinwangtong' | 'zhipingtong' | 'transync' | 'guard'> = {
  plan: 'platform',
  enterprise: 'platform', // 实际走 createPrivateLicenseOrder，不会进 createOrder
  jinwangtong: 'jinwangtong',
  zhipingtong: 'zhipingtong',
  transync: 'transync',
  guard: 'guard',
};

type PriceType = 'credits' | 'month' | 'year' | 'enterprise';

interface PlanFromServer {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  credits: number;
  features: string[];
  highlighted?: boolean;
  competitorMonthly: number | null;
  discountLabel: string | null;
}

interface CreditsPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  description: string;
}

interface EnterprisePackage {
  id: string;
  name: string;
  tagline: string;
  version: string;
  price: number;
  validDays: number;
  seats: number;
  features: string[];
  highlighted?: boolean;
  competitorPrice: number | null;
  discountLabel: string | null;
}

type SelectableItem = PlanFromServer | CreditsPackage | EnterprisePackage | JinWangTongPlan | ZhiPingTongPlan | TranSyncPlan;

function centsToYuan(cents: number): string {
  if (cents <= 0) return '免费';
  return '¥' + (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}
export default function PricingPage() {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authStatus = useAuthStore((s) => s.status);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  // ── 产品 Tab 状态（从 URL 参数推导） ──
  const productParam = searchParams.get('product') || searchParams.get('source') || '';
  const initialProductTab: ProductTab = PRODUCT_PARAM_MAP[productParam] || 'all';
  const [productTab, setProductTab] = useState<ProductTab>(initialProductTab);

  const paymentContext = useMemo(() => parsePaymentContext(searchParams), [searchParams]);
  const [priceType, setPriceType] = useState<PriceType>('month');
  const [currentPlan, setCurrentPlan] = useState('free');
  const [paying, setPaying] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SelectableItem | null>(null);
  const [selectedType, setSelectedType] = useState<'plan' | 'credits' | 'enterprise' | 'jinwangtong' | 'zhipingtong' | 'transync' | 'guard'>('plan');
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [entForm, setEntForm] = useState({ name: '', company: '', email: '', phone: '', planInterest: 'AI平台', requirements: '' });
  const [entSubmitting, setEntSubmitting] = useState(false);
  const handleEnterpriseSubmit = async () => {
    if (!entForm.name || !entForm.requirements) { message.warning('请填写姓名和需求描述'); return; }
    setEntSubmitting(true);
    try {
      await apiClient.post('/marketing/enterprise-inquiry', entForm);
      message.success('咨询已提交，我们将尽快联系您！');
      setEntForm({ name: '', company: '', email: '', phone: '', planInterest: 'AI平台', requirements: '' });
    } catch (e) { message.error(extractApiError(e, '提交失败')); }
    setEntSubmitting(false);
  };

  type PayProvider = 'wechat';
  const PAY_PROVIDERS: { key: PayProvider; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
    { key: 'wechat', label: '微信支付', icon: <WechatOutlined style={{ color: '#09bb07', fontSize: 18 }} />, color: '#09bb07', bg: '#f6ffed' },
  ];
  const [payProvider, setPayProvider] = useState<PayProvider>('wechat');
  const [payStatus, setPayStatus] = useState<'confirm' | 'creating' | 'waiting' | 'success' | 'expired'>('confirm');
  const [qr, setQr] = useState<{ value: string; orderNo: string; itemName: string } | null>(null);
  const pollRef = useRef<number | null>(null);
  const orderIdempotencyKeyRef = useRef<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<{ key: string; label: string; enabled: boolean }[]>([]);

  // 智评通订阅的月/年切换
  const [zptPeriod, setZptPeriod] = useState<'month' | 'year'>('month');
  // TranSync 订阅的月/年切换
  const [tsPeriod, setTsPeriod] = useState<'month' | 'year'>('month');

  const [plans, setPlans] = useState<PlanFromServer[]>([]);
  const [creditsPackages, setCreditsPackages] = useState<CreditsPackage[]>([]);
  const [enterprisePackages, setEnterprisePackages] = useState<EnterprisePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function load() {
      try {
      const [plansRes, pkgsRes, entRes, subRes, methodsRes] = await Promise.all([
        billingAPI.getPlans(),
        billingAPI.getCreditsPackages(),
        billingAPI.getPrivateLicensePackages().catch(() => null),
        billingAPI.getSubscription().catch(() => null),
        billingAPI.getPaymentMethods().catch(() => null),
      ]);
      const allPlans = (plansRes as any)?.data || [];
      setPlans(allPlans);
      setCreditsPackages((pkgsRes as any)?.data || []);
      setEnterprisePackages((entRes as any)?.data || []);
      setPaymentMethods((methodsRes as any)?.data?.methods || []);
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

  useEffect(() => {
    if (paymentMethods.length === 0) return;
    setPayProvider((prev) => {
      const current = paymentMethods.find((p) => p.key === prev);
      if (!current || !current.enabled) {
        const first = paymentMethods.find((p) => p.enabled);
        return first ? (first.key as PayProvider) : prev;
      }
      return prev;
    });
  }, [paymentMethods]);

  useEffect(() => () => stopPolling(), []);

  // ── D4: 未登录点击购买 → 弹出登录提示 → 登录后回到当前页 ──
  const requireAuth = useCallback((fallbackPath?: string): boolean => {
    if (isAuthenticated()) return true;
    // Token 已过期或登录态不完整时先清理，防止支付 API 再返回“Token 无效或已过期”。
    logout();
    const returnTo = fallbackPath || `/pricing${productTab !== 'all' ? `?product=${productTab}` : ''}`;
    Modal.confirm({
      title: '购买前请先登录',
      content: '您还没有登录，登录后将自动回到当前页面。',
      okText: '前往登录',
      cancelText: '取消',
      onOk: () => navigate(buildLoginPath(returnTo), { replace: true }),
    });
    return false;
  }, [isAuthenticated, logout, navigate, productTab]);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const closeModal = () => {
    stopPolling();
    setConfirmOpen(false);
    setPayStatus('confirm');
    setQr(null);
    setPaying(null);
    orderIdempotencyKeyRef.current = null;
  };

  const handleSelect = (
    item: SelectableItem,
    type: 'plan' | 'credits' | 'enterprise' | 'jinwangtong' | 'zhipingtong' | 'transync' | 'guard',
    period?: 'monthly' | 'yearly'
  ) => {
    // D4: auth check
    if (!requireAuth()) return;

    const id = 'id' in item ? item.id : '';
    if (type === 'plan' && id === currentPlan) {
      message.info('您已订阅此套餐');
      return;
    }
    setSelectedItem(item);
    setSelectedType(type);
    setSelectedPeriod(period || 'monthly');
    setPayStatus('creating');
    setQr(null);
    orderIdempotencyKeyRef.current = createOrderIdempotencyKey();
    setConfirmOpen(true);
  };

  const startPolling = (orderNo: string, itemName: string, purchaseType: string) => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const r: any = await billingAPI.getOrderStatus(orderNo);
        const st = r?.data?.status;
        if (st === 'paid') {
          stopPolling();
          if (paymentContext.isProjectGrade && purchaseType === 'plan') {
            try { await projectGradeAPI.getEntitlements(); } catch {
              message.warning('套餐已激活，智评通工作台将在返回后自动刷新最新权益');
            }
          }
          setPayStatus('success');
          if (purchaseType === 'plan' && r?.data?.plan) setCurrentPlan(r.data.plan);
          message.success(
            purchaseType === 'credits' ? `成功购买 ${itemName}`
              : purchaseType === 'enterprise' ? '支付成功！私有化授权正在订单中心等待交付'
              : '支付成功！套餐及智评通权益已激活'
          );
        } else if (st === 'expired') { stopPolling(); setPayStatus('expired'); }
      } catch { /* ignore */ }
    }, 3000);
  };

  const handlePay = async () => {
    if (!selectedItem) return;
    const isCredits = selectedType === 'credits';
    const isEnterprise = selectedType === 'enterprise';
    const itemName = getItemName(selectedItem);
    const idempotencyKey = orderIdempotencyKeyRef.current || createOrderIdempotencyKey();
    orderIdempotencyKeyRef.current = idempotencyKey;
    setPayStatus('creating');
    setPaying('id' in selectedItem ? selectedItem.id : 'package');
    try {
      let res: any;
      if (isEnterprise) {
        res = await billingAPI.createPrivateLicenseOrder({ packageId: selectedItem.id, provider: payProvider });
      } else if (!isCredits) {
        // 产品专用 id (jwt_/zpt_/ts_*) 先映射到 PLANS 枚举；保留 packageId 给后端做产品履约
        const rawId = 'id' in selectedItem ? selectedItem.id : '';
        const mappedPlan = (PRODUCT_PLAN_MAP[rawId] ?? (rawId as 'free' | 'pro' | 'max' | 'team'));
        const mappedSource = PRODUCT_SOURCE_MAP[selectedType] || 'platform';
        const isProductSubscription = mappedSource !== 'platform' && mappedSource !== 'project_grade';
        res = await billingAPI.createOrder({
          plan: mappedPlan,
          period: selectedPeriod,
          provider: payProvider,
          sourceProduct: isProductSubscription ? mappedSource : paymentContext.sourceProduct,
          ...(isProductSubscription ? { productPackageId: rawId } : {}),
          returnTo: paymentContext.returnTo,
          idempotencyKey,
        });
      } else {
        res = await billingAPI.createCreditsOrder({ packageId: selectedItem.id, provider: payProvider });
      }
      const pp = res?.data?.payParams || {};
      const orderNo = res?.data?.orderNo as string;
      if (res?.data?.provider !== 'wechat') throw new Error('当前仅支持微信支付');
      const qrValue = pp.codeUrl;
      if (!qrValue || typeof qrValue !== 'string') {
        throw new Error('未获取到真实微信支付二维码，请稍后重试');
      }
      setQr({ value: qrValue, orderNo, itemName });
      setPayStatus('waiting');
      startPolling(orderNo, itemName, selectedType);
    } catch (e) {
      setPayStatus('confirm');
      message.error(extractApiError(e, '支付失败'));
    }
    setPaying(null);
  };

  const finishPayment = () => {
    const returnTo = paymentContext.returnTo;
    closeModal();
    if (paymentContext.isProjectGrade && returnTo) navigate(returnTo);
  };

  // 直接支付：跳过确认步骤，自动触发创建订单
  useEffect(() => {
    if (payStatus === 'creating' && confirmOpen && selectedItem && paying === null) {
      handlePay();
    }
  }, [payStatus, confirmOpen, selectedItem, paying]);

  const paidPlans = plans.filter((p) => p.id !== 'free');
  const visibleProviders = PAY_PROVIDERS.filter((pp) =>
    paymentMethods.some((method) => method.key === pp.key && method.enabled)
  );

  // ============================================================
  // 工具函数
  // ============================================================

  const getItemId = (item: SelectableItem): string => 'id' in item ? item.id : '';

  const getItemName = (item: SelectableItem): string => {
    if ('id' in item) {
      const it = item as any;
      if (it.name) return it.name;
      if (it.tagline) return it.tagline;
    }
    return '';
  };

  const getItemFeatures = (item: SelectableItem): string[] => {
    const it = item as any;
    if (it.features) return it.features;
    if (it.credits) return [`${it.credits} 积分`, '可用于 AI 对话 / API 调用 / 工具使用', '永久有效'];
    return [];
  };

  const getItemPrice = (item: SelectableItem): string => {
    const it = item as any;
    if ('priceMonthly' in it && it.priceMonthly !== undefined) {
      if (priceType === 'year' || (selectedType === 'zhipingtong' && zptPeriod === 'year') || (selectedType === 'transync' && tsPeriod === 'year')) {
        return centsToYuan(it.priceYearly || it.priceMonthly * 10);
      }
      return centsToYuan(it.priceMonthly);
    }
    if ('price' in it && it.price !== undefined) return centsToYuan(it.price);
    return '免费';
  };

  const getItemOriginalPrice = (item: SelectableItem): string | null => {
    const it = item as any;
    if ('competitorMonthly' in it && it.competitorMonthly > 0) {
      return `竞品 ¥${(it.competitorMonthly / 100).toFixed(0)}/月`;
    }
    if ('competitorPrice' in it && it.competitorPrice > 0) {
      return `竞品 ¥${(it.competitorPrice / 100).toFixed(0)}`;
    }
    return null;
  };

  const getItemHighlighted = (item: SelectableItem): boolean => {
    const it = item as any;
    if ('highlighted' in it) return !!it.highlighted;
    if ('credits' in it && it.credits === 500) return true;
    return false;
  };

  const getItemBadge = (item: SelectableItem): string | null => {
    const it = item as any;
    if (it.highlighted) return '推荐';
    if ('credits' in it && it.credits >= 2000) return '最划算';
    return null;
  };

  const getDiscountLabel = (item: SelectableItem): string | null => {
    const it = item as any;
    if ('discountLabel' in it) return it.discountLabel;
    return null;
  };

  const getItemSubtitle = (item: SelectableItem): string | null => {
    const it = item as any;
    if (it.tagline) return it.tagline;
    if (it.terminals) return `${it.terminals} 终端`;
    if (it.charsPerMonth) return it.charsPerMonth;
    if (it.updateYears) return it.updateYears;
    if (it.version) return it.version;
    return null;
  };

  // ============================================================
  // 渲染一张定价卡片（通用）
  // ============================================================
  const renderPricingCard = (
    item: SelectableItem,
    itemType: 'plan' | 'credits' | 'enterprise' | 'jinwangtong' | 'zhipingtong' | 'transync' | 'guard',
    periodOverride?: 'monthly' | 'yearly',
    priceLabel?: string,
    extraTags?: React.ReactNode,
  ) => {
    const id = getItemId(item);
    const highlighted = getItemHighlighted(item);
    const badge = getItemBadge(item);
    const price = getItemPrice(item);
    const origPrice = getItemOriginalPrice(item);
    const discLabel = getDiscountLabel(item);
    const subtitle = getItemSubtitle(item);

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
              onClick={() => handleSelect(item, itemType, periodOverride)}
              loading={paying === id}
              style={{
                margin: '0 16px',
                background: highlighted ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : undefined,
                border: highlighted ? 'none' : undefined,
              }}
            >
              {itemType === 'jinwangtong' ? '立即购买'
                : itemType === 'enterprise' ? '立即购买授权'
                : ('priceMonthly' in item && (item as any).priceMonthly === 0) ? '免费使用'
                : itemType === 'credits' ? '立即购买'
                : currentPlan === id ? '当前方案' : '立即订阅'}
            </Button>,
          ]}
        >
          {badge && <Tag className="plan-badge" color="#8b5cf6">{badge}</Tag>}
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <Text strong style={{ fontSize: 18 }}>{getItemName(item)}</Text>
            <div style={{ margin: '8px 0', position: 'relative', display: 'inline-block' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
                <Text style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Inter, sans-serif' }}>
                  {price}
                </Text>
                <Text type="secondary" style={{ fontSize: 14 }}>
                  {priceLabel || (itemType === 'jinwangtong' ? ' · 买断'
                    : itemType === 'enterprise' ? ' · 一次性'
                    : itemType === 'credits' ? ' / 包'
                    : periodOverride === 'yearly' ? ' / 年' : ' / 月')}
                </Text>
              </div>
              {discLabel && (
                <span style={{
                  position: 'absolute', top: -14, right: -30,
                  background: 'linear-gradient(135deg, #ff7a45, #ff4d4f)',
                  borderRadius: '6px 6px 2px 6px', padding: '2px 10px', color: '#fff',
                  fontSize: 12, fontWeight: 800,
                  boxShadow: '0 3px 12px rgba(255,77,79,0.3)',
                  letterSpacing: 0.5, whiteSpace: 'nowrap',
                }}>
                  {discLabel}
                </span>
              )}
            </div>
            {origPrice && (
              <Text delete type="secondary" style={{ fontSize: 13, display: 'block' }}>{origPrice}</Text>
            )}
            {subtitle && (
              <div style={{ marginTop: 6 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>{subtitle}</Text>
              </div>
            )}
            {extraTags}
          </div>
          <Divider style={{ margin: '0 0 12px' }} />
          <div style={{ minHeight: 160 }}>
            {getItemFeatures(item).map((f, i) => (
              <div key={i} style={{ padding: '5px 0', fontSize: 14 }}>
                <CheckOutlined style={{ color: '#10b981', marginRight: 8 }} />{f}
              </div>
            ))}
            {'credits' in item && (item as any).credits > 0 && (
              <div style={{ padding: '5px 0', fontSize: 14 }}>
                <CheckOutlined style={{ color: '#f59e0b', marginRight: 8 }} />
                赠送 {(item as any).credits} 积分
              </div>
            )}
          </div>
        </Card>
      </Col>
    );
  };

  // ============================================================
  // 渲染各产品 Section
  // ============================================================

  // 金网通 Section（永久买断）
  const renderJinWangTongSection = (showTitle: boolean) => (
    <div style={{ marginBottom: 40 }}>
      {showTitle && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ color: PRODUCT_META.jinwangtong.color }}>
            {PRODUCT_META.jinwangtong.icon} 金网通 — 企业内网管理
          </Title>
          <Paragraph type="secondary">
            永久买断制 · 纯软件方案 · 比硬件盒子便宜 90%
          </Paragraph>
        </div>
      )}
      <Row gutter={[20, 20]} justify="center">
        {JINWANGTONG_PLANS.map((p) => renderPricingCard(
          p as any, 'jinwangtong', undefined, ' · 买断',
          <div style={{ marginTop: 6 }}><Text type="secondary" style={{ fontSize: 12 }}>{p.updateYears}</Text></div>
        ))}
      </Row>
    </div>
  );

  // 智评通 Section（订阅制）
  const renderZhiPingTongSection = (showTitle: boolean) => (
    <div style={{ marginBottom: 40 }}>
      {showTitle && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ color: PRODUCT_META.zhipingtong.color }}>
            {PRODUCT_META.zhipingtong.icon} 智评通 — AI 项目质量评估
          </Title>
          <Paragraph type="secondary">
            按月/按年订阅 · 竞品 1折 · 六维评分雷达图
          </Paragraph>
          <Segmented
            value={zptPeriod}
            onChange={(v) => setZptPeriod(v as 'month' | 'year')}
            size="small"
            style={{ marginBottom: 12 }}
            options={[
              { value: 'month', label: '💳 按月' },
              { value: 'year', label: '🏆 包年' },
            ]}
          />
        </div>
      )}
      <Row gutter={[20, 20]} justify="center">
        {ZHIPINGTONG_PLANS.map((p) => {
          const priceLabel = zptPeriod === 'year' ? ' / 年' : ' / 月';
          const periodOverride: 'monthly' | 'yearly' = zptPeriod === 'year' ? 'yearly' : 'monthly';
          return renderPricingCard(
            p as any, 'zhipingtong', periodOverride, priceLabel,
            <div style={{ marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{p.projects} 个项目 · {p.reportDays}天报告</Text>
            </div>
          );
        })}
      </Row>
    </div>
  );

  // TranSync Section（订阅制）
  const renderTranSyncSection = (showTitle: boolean) => (
    <div style={{ marginBottom: 40 }}>
      {showTitle && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ color: PRODUCT_META.transync.color }}>
            {PRODUCT_META.transync.icon} TranSync — 多语言实时翻译
          </Title>
          <Paragraph type="secondary">
            按月/按年订阅 · 竞品 1/5 · 浏览器插件+文档+字幕
          </Paragraph>
          <Segmented
            value={tsPeriod}
            onChange={(v) => setTsPeriod(v as 'month' | 'year')}
            size="small"
            style={{ marginBottom: 12 }}
            options={[
              { value: 'month', label: '💳 按月' },
              { value: 'year', label: '🏆 包年' },
            ]}
          />
        </div>
      )}
      <Row gutter={[20, 20]} justify="center">
        {TRANSYNC_PLANS.map((p) => {
          const priceLabel = tsPeriod === 'year' ? ' / 年' : ' / 月';
          const periodOverride: 'monthly' | 'yearly' = tsPeriod === 'year' ? 'yearly' : 'monthly';
          return renderPricingCard(
            p as any, 'transync', periodOverride, priceLabel,
            <div style={{ marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{p.charsPerMonth} · {p.languages}</Text>
            </div>
          );
        })}
      </Row>
    </div>
  );


  // NexMind Guard Section（按年订阅）
  const renderGuardSection = (showTitle: boolean) => (
    <div style={{ marginBottom: 40 }}>
      {showTitle && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ color: PRODUCT_META.guard.color }}>
            {PRODUCT_META.guard.icon} NexMind Guard — 自托管监控与故障自愈
          </Title>
          <Paragraph type="secondary">
            按年订阅 · ROI 35倍 · 监控会看病 告警会叫人 切换会救命
          </Paragraph>
        </div>
      )}
      <Row gutter={[20, 20]} justify="center">
        {GUARD_PLANS.map((p) => renderPricingCard(
          p as any, 'guard', 'yearly', ' / 年',
          <div style={{ marginTop: 6 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{p.monitors}监控 · {p.retention}留存</Text>
          </div>
        ))}
      </Row>
    </div>
  );
  // ============================================================
  // 加载状态
  // ============================================================
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

  // 是否有产品专属 Tab 激活
  const isProductTab = productTab !== 'all';
  // 是否在「全部」Tab 或切换到通用分类（积分/企业版等）
  const showLegacyTabs = !isProductTab; // productTab is 'all' when isProductTab is false

  // 构建 Tabs 选项
  const productTabs = [
    { key: 'all', label: `${PRODUCT_META.all.icon} ${PRODUCT_META.all.label}` },
    { key: 'jinwangtong', label: `${PRODUCT_META.jinwangtong.icon} ${PRODUCT_META.jinwangtong.label}` },
    { key: 'zhipingtong', label: `${PRODUCT_META.zhipingtong.icon} ${PRODUCT_META.zhipingtong.label}` },
    { key: 'transync', label: `${PRODUCT_META.transync.icon} ${PRODUCT_META.transync.label}` },
    { key: 'guard', label: `${PRODUCT_META.guard.icon} ${PRODUCT_META.guard.label}` },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '12px 4px' : '24px 16px' }}>
      {/* 标题 */}
      <div style={{ textAlign: 'center', marginBottom: isMobile ? 20 : 32 }}>
        <Title level={isMobile ? 3 : 2}>灵活的付费方案</Title>
        <Paragraph type="secondary" style={{ fontSize: 16 }}>
          三大产品线独立套餐 · 积分按需购买 · 按月订阅 · 包年优惠
        </Paragraph>
      </div>

      {/* ── D3: 产品 Tab 切换 ── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <Tabs
          activeKey={productTab}
          onChange={(key) => {
            setProductTab(key as ProductTab);
            // 更新 URL 参数
            const newParams = new URLSearchParams(searchParams);
            if (key === 'all') { newParams.delete('product'); }
            else { newParams.set('product', key); }
            navigate(`/pricing?${newParams.toString()}`, { replace: true });
          }}
          size="large"
          style={{ maxWidth: '100%' }}
          items={productTabs.map((t) => ({
            key: t.key,
            label: t.label,
          }))}
        />
      </div>

      {/* ── 产品专属视图 ── */}
      {productTab === 'jinwangtong' && renderJinWangTongSection(false)}
      {productTab === 'zhipingtong' && renderZhiPingTongSection(false)}
      {productTab === 'transync' && renderTranSyncSection(false)}
      {productTab === 'guard' && renderGuardSection(false)}

      {/* ── 全部视图：三个产品 Section + 通用套餐 ── */}
      {productTab === 'all' && (
        <>
          {renderJinWangTongSection(true)}
          {renderZhiPingTongSection(true)}
          {renderTranSyncSection(true)}
          {renderGuardSection(true)}

          {/* 通用平台套餐 */}
          <div style={{ textAlign: 'center', marginBottom: 16, marginTop: 20 }}>
            <Title level={3} style={{ color: '#6366f1' }}>
              🤖 AI 平台通用套餐
            </Title>
            <Paragraph type="secondary">
              AI 对话 · RAG 知识库 · 工作流编排 · 媒体生成
            </Paragraph>

            <Segmented
              value={priceType}
              onChange={(v) => setPriceType(v as PriceType)}
              size={isMobile ? 'middle' : 'large'}
              style={{ marginTop: 8 }}
              options={[
                { value: 'credits', label: '⚡ 积分', icon: <ThunderboltOutlined /> },
                { value: 'month', label: '💳 按月', icon: <WalletOutlined /> },
                { value: 'year', label: '🏆 包年', icon: <CrownOutlined /> },
                { value: 'enterprise', label: '🏢 企业版', icon: <CrownOutlined /> },
              ]}
            />
          </div>

          {/* 免费版标签 */}
          {priceType !== 'credits' && plans.some((p) => p.id === 'free') && (
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Tag color="green" style={{ fontSize: 14, padding: '4px 16px' }}>
                {currentPlan === 'free' ? '当前方案：免费版' : '已有免费版可用'}
              </Tag>
            </div>
          )}

          {/* 通用套餐卡片 */}
          {(() => {
            const displayPlans = priceType === 'credits'
              ? creditsPackages
              : priceType === 'enterprise'
                ? enterprisePackages
                : paidPlans;

            if (displayPlans.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Paragraph type="secondary">
                    {priceType === 'credits' ? '暂无积分包可选' : '暂无付费套餐'}
                  </Paragraph>
                </div>
              );
            }

            return (
              <Row gutter={[20, 20]} justify="center">
                {displayPlans.map((item: any) => {
                  const itemType = priceType === 'credits' ? 'credits'
                    : priceType === 'enterprise' ? 'enterprise' : 'plan';
                  const periodOverride: 'monthly' | 'yearly' | undefined =
                    priceType === 'year' ? 'yearly' : 'monthly';
                  const priceLabel = priceType === 'enterprise'
                    ? ((item as EnterprisePackage).validDays === -1 ? ' · 永久' : ' · 一次性')
                    : priceType === 'credits' ? ' / 包'
                    : priceType === 'year' ? ' / 年' : ' / 月';

                  return renderPricingCard(item as SelectableItem, itemType, periodOverride, priceLabel);
                })}
              </Row>
            );
          })()}
        </>
      )}

      {/* 支付弹窗：确认 → 扫码 → 结果 */}
      <Modal
        title={payStatus === 'success' ? '支付成功' : payStatus === 'waiting' ? '扫码支付' : '确认订单'}
        open={confirmOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnClose
        maskClosable={payStatus !== 'waiting'}
      >
        {selectedItem && (payStatus === 'confirm' || payStatus === 'creating') && (
          <div>
            <Paragraph>
              <strong>项目：</strong>{getItemName(selectedItem)}
              {selectedType !== 'credits' && selectedType !== 'jinwangtong' && ` - ${selectedPeriod === 'yearly' ? '年付' : '月付'}`}
            </Paragraph>
            <Paragraph><strong>价格：</strong>{getItemPrice(selectedItem)}</Paragraph>
            <Divider style={{ margin: '12px 0' }} />
            <Paragraph style={{ marginBottom: 8 }}><strong>支付方式</strong></Paragraph>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {visibleProviders.map((pp) => {
                const active = payProvider === pp.key;
                return (
                  <div key={pp.key} onClick={() => setPayProvider(pp.key)}
                    style={{
                      padding: '8px 16px', border: active ? `2px solid ${pp.color}` : '1px solid #e8e8e8',
                      borderRadius: 8, background: active ? pp.bg : '#fff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 14,
                      fontWeight: active ? 600 : 400, transition: 'all 0.2s',
                    }}
                  >{pp.icon}{pp.label}</div>
                );
              })}
            </div>
            {visibleProviders.length === 0 && (
              <Paragraph type="danger" style={{ marginTop: 12, marginBottom: 0 }}>
                微信支付尚未配置完成，当前暂不接受付款。
              </Paragraph>
            )}
            <div style={{ textAlign: 'right', marginTop: 24 }}>
              <Button onClick={closeModal} style={{ marginRight: 8 }}>返回</Button>
              <Button type="primary" loading={payStatus === 'creating'}
                disabled={visibleProviders.length === 0} onClick={handlePay}
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
              >确认支付</Button>
            </div>
          </div>
        )}

        {payStatus === 'waiting' && qr && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <Paragraph type="secondary" style={{ marginBottom: 12 }}>
              请使用微信扫描二维码完成支付
            </Paragraph>
            <div style={{ display: 'inline-block', padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #eee' }}>
              <QRCodeSVG value={qr.value} size={200} level="M" includeMargin />
            </div>
            <Paragraph style={{ marginTop: 16, fontSize: 22, fontWeight: 800 }}>
              {selectedItem && getItemPrice(selectedItem)}
            </Paragraph>
            <Paragraph type="secondary">
              <LoadingOutlined style={{ marginRight: 6 }} />
              等待支付结果…（付款后自动到账）
            </Paragraph>
            <Button onClick={closeModal}>取消支付</Button>
          </div>
        )}

        {payStatus === 'success' && (
          <Result status="success" title="支付成功"
            subTitle={qr ? qr.itemName : (selectedItem ? getItemName(selectedItem) : '')}
            extra={
              <Button type="primary" onClick={finishPayment}>
                {paymentContext.isProjectGrade ? '返回智评通工作台' : '完成'}
              </Button>
            }
          />
        )}

        {payStatus === 'expired' && (
          <Result status="warning" title="订单已过期"
            subTitle="支付二维码已失效，请重新下单"
            extra={<Button type="primary" onClick={() => { orderIdempotencyKeyRef.current = createOrderIdempotencyKey(); setQr(null); setPayStatus('confirm'); }}>重新下单</Button>}
          />
        )}
      </Modal>

      <style>{`
        .pricing-card { border-radius: 14px; transition: all 0.3s; position: relative; }
        .pricing-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.1); }
        .pricing-card.highlight {
          border: 2px solid #818cf8;
          box-shadow: 0 0 20px rgba(129,140,248,0.15);
        }
        .plan-badge { position: absolute; top: 12px; right: 12px; border-radius: 10px; padding: 2px 12px; }
        @media (max-width: 768px) {
          .pricing-card { border-radius: 12px; }
          .pricing-card .ant-card-body { padding: 16px !important; }
        }
        @media (max-width: 480px) {
          .pricing-card .ant-card-actions > li { margin: 0 !important; }
        }
      `}</style>
    </div>
  );
}
