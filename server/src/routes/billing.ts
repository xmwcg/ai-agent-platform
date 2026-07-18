import { Router, Request, Response } from 'express';
import { AuthRequest, requireAuth, requireAdmin } from '../middleware/auth';
import { User } from '../models/User';
import { Order, PaymentProvider, BillingPeriod } from '../models/Order';
import { PLANS, PlanId, getPlan } from '../config/billing';
import { CREDITS_PACKAGES } from '../config/credits-pricing';
import { PRIVATE_LICENSE_PACKAGES, getPrivateLicensePackage } from '../config/private-license';
import { getGlobalCost } from '../services/cost-control.service';
import { getPaymentGateway, isRealGateway, listPaymentMethods } from '../services/payment.service';
import { resolveUserPlan, getQuotaUsage } from '../middleware/subscription';
import { sendError } from '../lib/http-error';
import { validate } from '../lib/validation';
import { logger } from '../lib/logger';
import { activateSubscription, grantCreditsPack, resolvePaymentProvider, genOrderNo, createOrderSchema } from './billing/logic';
import webhookRoutes from './billing/webhook.routes';
import refundRoutes from './billing/refund.routes';
import reconciliationRoutes from './billing/reconciliation.routes';

const router = Router();

// 套餐列表（公开）
router.get('/plans', (_req: Request, res: Response) => {
  res.json({ success: true, data: Object.values(PLANS) });
});

// 已启用的支付方式（公开，前端据此动态展示入口；缺密钥的渠道自动隐藏）
router.get('/payment-methods', (_req: Request, res: Response) => {
  res.json({ success: true, data: { methods: listPaymentMethods() } });
});

// 积分包列表（公开）
router.get('/credits-packages', (_req: Request, res: Response) => {
  res.json({ success: true, data: CREDITS_PACKAGES });
});

// 购买积分包（需登录）
router.post('/credits-packages/order', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { packageId, provider } = req.body as { packageId?: string; provider?: PaymentProvider };
    if (!packageId) {
      return res.status(400).json({ success: false, error: '缺少 packageId' });
    }
    const pkg = CREDITS_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
      return res.status(400).json({ success: false, error: '无效的积分包' });
    }
    const payProvider = resolvePaymentProvider(provider);
    const orderNo = genOrderNo();
    const order = await Order.create({
      orderNo,
      userId: req.user!.id,
      orderType: 'credits_pack',
      plan: 'free',
      packageId,
      period: 'monthly',
      amount: pkg.price,
      currency: 'CNY',
      provider: payProvider,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const gateway = getPaymentGateway(payProvider);
    const result = await gateway.createOrder({
      orderNo,
      amount: pkg.price,
      currency: 'CNY',
      description: `AI Agent Platform - ${pkg.name}`,
      clientIp: req.ip,
    });

    order.payParams = result.payParams;
    if (result.paymentIntentId) {
      order.paymentIntentId = result.paymentIntentId;
    }
    await order.save();

    res.json({
      success: true,
      data: {
        orderNo,
        amount: pkg.price,
        credits: pkg.credits,
        currency: 'CNY',
        provider: payProvider,
        isReal: isRealGateway(payProvider),
        payParams: result.payParams,
        expiredAt: order.expiresAt,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 私有化授权包列表（公开）
router.get('/private-license-packages', (_req: Request, res: Response) => {
  res.json({ success: true, data: PRIVATE_LICENSE_PACKAGES });
});

// 购买私有化授权（需登录）——复用现有微信支付下单流程，订单类型为 private_license
router.post('/private-license/order', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { packageId, provider } = req.body as { packageId?: string; provider?: PaymentProvider };
    if (!packageId) {
      return res.status(400).json({ success: false, error: '缺少 packageId' });
    }
    const pkg = getPrivateLicensePackage(packageId);
    if (!pkg) {
      return res.status(400).json({ success: false, error: '无效的私有化授权包' });
    }
    const payProvider = resolvePaymentProvider(provider);
    const orderNo = genOrderNo();
    const order = await Order.create({
      orderNo,
      userId: req.user!.id,
      orderType: 'private_license',
      plan: 'free',
      packageId,
      licenseVersion: pkg.version,
      period: 'monthly',
      amount: pkg.price,
      currency: 'CNY',
      provider: payProvider,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const gateway = getPaymentGateway(payProvider);
    const result = await gateway.createOrder({
      orderNo,
      amount: pkg.price,
      currency: 'CNY',
      description: `AI Agent Platform - 私有化授权 ${pkg.name}`,
      clientIp: req.ip,
    });

    order.payParams = result.payParams;
    if (result.paymentIntentId) {
      order.paymentIntentId = result.paymentIntentId;
    }
    await order.save();

    res.json({
      success: true,
      data: {
        orderNo,
        amount: pkg.price,
        currency: 'CNY',
        provider: payProvider,
        isReal: isRealGateway(payProvider),
        payParams: result.payParams,
        expiredAt: order.expiresAt,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 我的订阅状态（需登录）
router.get('/subscription', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('plan membershipExpiresAt credits').lean();
    const { plan, expired } = await resolveUserPlan(req.user!.id);
    const usage = await getQuotaUsage(req.user!.id);
    res.json({
      success: true,
      data: {
        plan,
        expired,
        membershipExpiresAt: user?.membershipExpiresAt || null,
        credits: user?.credits || 0,
        usage,
        plans: Object.values(PLANS),
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 创建订单（需登录）
router.post('/orders', requireAuth, validate(createOrderSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { plan, period, provider } = req.body as {
      plan?: PlanId;
      period?: BillingPeriod;
      provider?: PaymentProvider;
    };

    const targetPlan: PlanId = plan || 'pro';
    if (!PLANS[targetPlan]) {
      return res.status(400).json({ success: false, error: '无效的套餐' });
    }
    const targetPeriod: BillingPeriod = period === 'yearly' ? 'yearly' : 'monthly';
    const amount = targetPeriod === 'yearly' ? PLANS[targetPlan].priceYearly : PLANS[targetPlan].priceMonthly;
    const payProvider = resolvePaymentProvider(provider);

    // 免费套餐无需支付
    if (amount === 0) {
      await activateSubscription(req.user!.id, targetPlan, targetPeriod);
      return res.json({ success: true, data: { free: true, plan: targetPlan } });
    }

    const orderNo = genOrderNo();
    const order = await Order.create({
      orderNo,
      userId: req.user!.id,
      plan: targetPlan,
      period: targetPeriod,
      amount,
      currency: 'CNY',
      provider: payProvider,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const gateway = getPaymentGateway(payProvider);
    const result = await gateway.createOrder({
      orderNo,
      amount,
      currency: 'CNY',
      description: `AI Agent Platform - ${PLANS[targetPlan].name} (${targetPeriod === 'yearly' ? '年付' : '月付'})`,
      clientIp: req.ip,
    });

    // 保存预支付参数和 PaymentIntent ID，便于支付状态对账
    order.payParams = result.payParams;
    if (result.paymentIntentId) {
      order.paymentIntentId = result.paymentIntentId;
    }
    await order.save();

    res.json({
      success: true,
      data: {
        orderNo,
        amount,
        currency: 'CNY',
        provider: payProvider,
        isReal: isRealGateway(payProvider),
        payParams: result.payParams,
        expiredAt: order.expiresAt,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 模拟支付成功（仅 mock 网关，便于开发/演示跑通完整链路）
router.get('/orders/:orderNo/pay', requireAuth, async (req: AuthRequest, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, error: '接口不存在' });
  }
  try {
    const order = await Order.findOne({ orderNo: req.params.orderNo });
    if (!order) return res.status(404).json({ success: false, error: '订单不存在' });
    if (order.userId.toString() !== req.user!.id) {
      return res.status(403).json({ success: false, error: '无权操作他人订单' });
    }
    if (order.status === 'paid') {
      return res.json({ success: true, data: { alreadyPaid: true } });
    }
    order.status = 'paid';
    order.paidAt = new Date();
    order.transactionId = `MOCK${Date.now()}`;
    await order.save();

    if (order.orderType === 'credits_pack' && order.packageId) {
      const balance = await grantCreditsPack(order.userId.toString(), order.packageId, order.orderNo);
      return res.json({ success: true, data: { paid: true, orderType: 'credits_pack', credits: balance } });
    }
    if (order.orderType === 'private_license' && order.packageId) {
      // 私有化订单：mock/轮询路径仅标记已支付，license 由 webhook 履约（生产）签发
      return res.json({ success: true, data: { paid: true, orderType: 'private_license', packageId: order.packageId } });
    }
    await activateSubscription(order.userId.toString(), order.plan, order.period, order.orderNo);
    res.json({ success: true, data: { paid: true, plan: order.plan } });
  } catch (err) {
    sendError(res, err);
  }
});

// 查询订单支付状态（前端扫码后轮询用）
// 对真实网关（微信/支付宝）主动查单：即便公网回调延迟/未到，扫码付款后也能可靠到账
router.get('/orders/:orderNo/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ orderNo: req.params.orderNo });
    if (!order) return res.status(404).json({ success: false, error: '订单不存在' });
    if (order.userId.toString() !== req.user!.id) {
      return res.status(403).json({ success: false, error: '无权查看他人订单' });
    }

    // 已支付：直接返回，并回带最新积分/套餐，便于前端刷新
    if (order.status === 'paid') {
      const u = await User.findById(order.userId).select('plan credits').lean();
      return res.json({ success: true, data: { status: 'paid', orderNo: order.orderNo, plan: u?.plan, credits: u?.credits } });
    }

    // 主动查单兜底（仅真实网关且实现了 queryOrder）
    const gateway = getPaymentGateway(order.provider);
    if (isRealGateway(order.provider) && typeof gateway.queryOrder === 'function') {
      try {
        const q = await gateway.queryOrder(order.orderNo);
        if (q.paid) {
          // 原子占位：只有仍未支付的订单才会被标记，避免并发轮询重复激活
          const claimed = await Order.findOneAndUpdate(
            { orderNo: order.orderNo, status: { $ne: 'paid' } },
            { $set: { status: 'paid', paidAt: new Date(), transactionId: q.transactionId || order.transactionId } },
            { new: true }
          );
          if (claimed) {
            if (claimed.orderType === 'credits_pack' && claimed.packageId) {
              await grantCreditsPack(claimed.userId.toString(), claimed.packageId, claimed.orderNo);
            } else if (claimed.orderType === 'private_license' && claimed.packageId) {
              // 私有化订单：轮询路径仅标记已支付，license 由 webhook 履约签发
            } else {
              await activateSubscription(claimed.userId.toString(), claimed.plan, claimed.period, claimed.orderNo);
            }
            logger.info('billing', `轮询查单激活成功: orderNo=${claimed.orderNo} provider=${order.provider}`);
          }
          const u = await User.findById(order.userId).select('plan credits').lean();
          return res.json({ success: true, data: { status: 'paid', orderNo: order.orderNo, plan: u?.plan, credits: u?.credits } });
        }
      } catch (e) {
        logger.warn('billing', `主动查单失败: ${order.orderNo} ${(e as Error).message}`);
      }
    }

    const expired = order.expiresAt && new Date(order.expiresAt).getTime() < Date.now();
    return res.json({ success: true, data: { status: expired ? 'expired' : 'pending', orderNo: order.orderNo } });
  } catch (err) {
    sendError(res, err);
  }
});

// 订单详情：订单本体 + 会员状态 + 当前积分余额 + 当日配额用量（AI 对话次数等）
router.get('/orders/:orderNo/detail', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ orderNo: req.params.orderNo });
    if (!order) return res.status(404).json({ success: false, error: '订单不存在' });
    if (order.userId.toString() !== req.user!.id) {
      return res.status(403).json({ success: false, error: '无权查看他人订单' });
    }
    const user = await User.findById(order.userId).select('plan credits membershipExpiresAt').lean();
    const { plan, expired } = await resolveUserPlan(order.userId.toString());
    const usage = await getQuotaUsage(order.userId.toString());
    res.json({
      success: true,
      data: {
        order,
        membership: { plan, expired, membershipExpiresAt: user?.membershipExpiresAt || null },
        credits: user?.credits ?? 0,
        usage,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 支付 Webhook 回调与事件日志已抽离至 ./billing/webhook.routes.ts（含验签、幂等、重放防护、审计）

// 取消订阅（到期后降级为 free；保留已付费周期权益直到到期日）
router.post('/subscription/cancel', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('plan membershipExpiresAt');
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    if (user.plan === 'free') {
      return res.json({ success: true, message: '当前已是免费版' });
    }
    const expires = user.membershipExpiresAt ? new Date(user.membershipExpiresAt).getTime() : 0;
    if (expires <= Date.now()) {
      // 已到期：立即降级
      await User.findByIdAndUpdate(req.user!.id, {
        $set: { plan: 'free' },
      });
      return res.json({ success: true, message: '订阅已过期，已降级为免费版' });
    }
    // 未到期：设置 membershipExpiresAt 为当前时间，但不清除 plan
    // plan 由会员到期检查中间件自动降级
    await User.findByIdAndUpdate(req.user!.id, {
      $set: { membershipExpiresAt: new Date() },
    });
    res.json({
      success: true,
      data: { originalExpiresAt: user.membershipExpiresAt },
      message: '订阅已取消，当前周期权益将被保留。到期后自动降级为免费版',
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 支付状态诊断（Admin 面板用：查看当前支付渠道配置状态）
router.get('/payment-status', requireAuth, async (_req: AuthRequest, res: Response) => {
  const mask = (s: string | undefined) => {
    if (!s) return '未配置';
    if (s.length <= 8) return '****';
    return s.slice(0, 4) + '****' + s.slice(-4);
  };
  const defaultProvider = process.env.DEFAULT_PAY_PROVIDER || (process.env.NODE_ENV === 'production' ? 'wechat' : 'mock');
  res.json({
    success: true,
    data: {
      defaultProvider,
      isReal: defaultProvider !== 'mock',
      wechat: {
        configured: !!(process.env.WECHAT_MCH_ID && process.env.WECHAT_APP_ID && process.env.WECHAT_API_V3_KEY && process.env.WECHAT_CERT_SERIAL && process.env.WECHAT_PRIVATE_KEY && process.env.WECHAT_PLATFORM_CERT),
        mchId: mask(process.env.WECHAT_MCH_ID),
        appId: mask(process.env.WECHAT_APP_ID),
        hasApiKey: !!process.env.WECHAT_API_V3_KEY,
        hasPlatformCert: !!process.env.WECHAT_PLATFORM_CERT,
        notifyUrl: process.env.WECHAT_NOTIFY_URL || process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL}/api/billing/webhook/wechat` : '未配置',
      },
      alipay: {
        configured: !!(process.env.ALIPAY_APP_ID && process.env.ALIPAY_PRIVATE_KEY),
        appId: mask(process.env.ALIPAY_APP_ID),
        hasPrivateKey: !!process.env.ALIPAY_PRIVATE_KEY,
        hasPublicKey: !!process.env.ALIPAY_PUBLIC_KEY,
        notifyUrl: process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL}/api/billing/webhook/alipay` : '未配置',
      },
      stripe: {
        configured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
        hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
        hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      },
      publicBaseUrl: process.env.PUBLIC_BASE_URL || '未配置',
    },
  });
});

// Webhook 事件日志已抽离至 ./billing/webhook.routes.ts

// 我的订单历史（需登录）
router.get('/orders/history', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const orders = await Order.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: orders });
  } catch (err) {
    sendError(res, err);
  }
});

// 支付 Webhook 子模块（回调验签 + 事件日志），独立维护以降低单文件复杂度
router.use(webhookRoutes);

// 退款与权益回收子模块
router.use(refundRoutes);


// 对账子模块
router.use(reconciliationRoutes);

/* ============================================================
 * 毛利看板（仅 Admin 内部，绝不对客户开放）
 * 聚合：∑已支付收入（按订单类型/月份） − ∑全站 AI 成本（按日汇总）
 * ============================================================ */
router.get('/profit-summary', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthStart = `${month}-01`;
    const nextMonth = new Date(`${month}-01`);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEnd = nextMonth.toISOString().slice(0, 10);

    // 1) 收入：按订单类型聚合当月已支付订单金额（分）
    const paidOrders = await Order.find({
      paymentStatus: 'paid',
      paidAt: { $gte: new Date(monthStart), $lt: nextMonth },
    }).lean();

    const revenue = { subscription: 0, credits_pack: 0, private_license: 0, total: 0 };
    for (const o of paidOrders as any[]) {
      const t = o.orderType as keyof typeof revenue;
      if (t in revenue) {
        (revenue as any)[t] += o.amount || 0;
        revenue.total += o.amount || 0;
      }
    }

    // 2) 成本：聚合当月每日全站 AI 成本（分）
    let costTotal = 0;
    const days: number[] = [];
    const d = new Date(monthStart);
    while (d.toISOString().slice(0, 7) === month) {
      days.push(Number(await getGlobalCost(d.toISOString().slice(0, 10))));
      d.setDate(d.getDate() + 1);
    }
    costTotal = days.reduce((s, v) => s + v, 0);

    // 3) 毛利
    const grossProfit = revenue.total - costTotal;
    const margin = revenue.total > 0 ? Math.round((grossProfit / revenue.total) * 1000) / 10 : 0;

    res.json({
      success: true,
      data: {
        month,
        revenue,              // 分
        cost: costTotal,       // 分
        grossProfit,          // 分
        margin,               // 毛利率 %
        dailyCost: days,       // 当月每日成本（分），供折线图
        orderCount: paidOrders.length,
        note: '内部毛利看板，仅管理员可见，不对客户开放',
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;


