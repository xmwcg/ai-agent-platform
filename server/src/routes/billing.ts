import { Router, Request, Response } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { User } from '../models/User';
import { Order, PaymentProvider, BillingPeriod } from '../models/Order';
import { WebhookEvent } from '../models/WebhookEvent';
import { CreditsTransaction } from '../models/CreditsTransaction';
import { PLANS, PlanId, DEFAULT_PLAN, getPlan } from '../config/billing';
import { CREDITS_PACKAGES } from '../config/credits-pricing';
import { getPaymentGateway, isRealGateway } from '../services/payment.service';
import { resolveUserPlan, getQuotaUsage } from '../middleware/subscription';
import { sendError } from '../lib/http-error';
import { validate, ValidationSchema } from '../lib/validation';
import { logger } from '../lib/logger';

const router = Router();

// 创建订单输入校验（plan 限定已知套餐，period 限定月/年）
const createOrderSchema: ValidationSchema = {
  plan: { type: 'string', oneOf: ['free', 'pro', 'max'] },
  period: { type: 'string', oneOf: ['monthly', 'yearly'] },
  provider: { type: 'string', oneOf: ['mock', 'wechat', 'stripe'] },
};

/** 生成订单号：AI + 时间戳 + 随机 */
function genOrderNo(): string {
  return `AI${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

/** 激活订阅：写入套餐、有效期、积分 */
async function activateSubscription(userId: string, plan: PlanId, period: BillingPeriod, orderNo?: string): Promise<void> {
  const p = getPlan(plan);
  const now = Date.now();
  const durationMs = period === 'yearly' ? 365 * 86400 * 1000 : 30 * 86400 * 1000;
  const user = await User.findByIdAndUpdate(userId, {
    $set: {
      plan,
      membershipExpiresAt: new Date(now + durationMs),
    },
    $inc: { credits: p.credits },
  }, { new: true });
  // 记录订阅赠送积分明细（异步不阻塞）
  if (user && p.credits > 0) {
    void CreditsTransaction.create({
      userId: user._id,
      type: 'grant',
      amount: p.credits,
      balanceAfter: user.credits,
      orderNo,
      description: `${p.name}订阅赠送 ${p.credits} 积分`,
    });
  }
}

/** 积分包支付成功后充值 */
async function grantCreditsPack(userId: string, packageId: string, orderNo: string): Promise<number> {
  const pkg = CREDITS_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw new Error(`未知积分包: ${packageId}`);
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { credits: pkg.credits } },
    { new: true }
  );
  if (!user) throw new Error('用户不存在');
  // 记录积分购买明细（异步不阻塞）
  void CreditsTransaction.create({
    userId: user._id,
    type: 'purchase',
    amount: pkg.credits,
    balanceAfter: user.credits,
    orderNo,
    description: `购买 ${pkg.name}`,
  });
  logger.info('billing', `积分包充值成功: userId=${userId} package=${packageId} credits=+${pkg.credits} balance=${user.credits}`);
  return user.credits;
}

// 套餐列表（公开）
router.get('/plans', (_req: Request, res: Response) => {
  res.json({ success: true, data: Object.values(PLANS) });
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
    const payProvider: PaymentProvider = provider || (process.env.DEFAULT_PAY_PROVIDER as PaymentProvider) || 'mock';
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
    const payProvider: PaymentProvider = provider || (process.env.DEFAULT_PAY_PROVIDER as PaymentProvider) || 'mock';

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
    await activateSubscription(order.userId.toString(), order.plan, order.period);
    res.json({ success: true, data: { paid: true, plan: order.plan } });
  } catch (err) {
    sendError(res, err);
  }
});

// 支付网关回调（微信 / Stripe）—— 带幂等性、重放防护、审计日志
router.post('/webhook/:provider', async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider as PaymentProvider;
    const gateway = getPaymentGateway(provider);

    // 获取原始请求体（express.raw() 中间件下 req.body 为 Buffer）
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

    // Stripe 签名头 vs 微信签名头（微信 v3 使用标准 wechatpay-* 头）
    const signature = (req.headers['stripe-signature'] as string)
      || (req.headers['wechatpay-signature'] as string)
      || (req.headers['x-wechat-signature'] as string)
      || '';

    // ========== 1. 验签（防伪造回调） ==========
    const wechatHeaders = provider === 'wechat' ? {
      wechatTimestamp: (req.headers['wechatpay-timestamp'] as string) || '',
      wechatNonce: (req.headers['wechatpay-nonce'] as string) || '',
      wechatSerial: (req.headers['wechatpay-serial'] as string) || '',
    } : undefined;

    const result = await gateway.verifyWebhook(rawBody, signature, wechatHeaders);
    if (!result || !result.success) {
      // 区分验签失败与非成功事件（如 payment_failed）
      if (result && result.eventType) {
        logger.info('webhook', `非成功事件: provider=${provider} eventType=${result.eventType} orderNo=${result.orderNo}`);
      } else {
        logger.warn('webhook', `验签失败: provider=${provider}`);
      }
      // 永远返回 200，避免支付网关认为回调失败而重试
      return res.status(200).json({ received: true });
    }

    // ========== 2. 提取事件 ID（幂等性标识） ==========
    const eventId = result.transactionId || result.orderNo || `${provider}_${Date.now()}`;

    // ========== 3. 幂等性检查：同一事件只处理一次 ==========
    const existing = await WebhookEvent.findOne({ eventId });
    if (existing) {
      logger.info('webhook', `事件已处理，跳过: eventId=${eventId} status=${existing.status}`);
      return res.status(200).json({ received: true, idempotent: true });
    }

    // ========== 4. 重放攻击防护：验签时间戳有效期 5 分钟 ==========
    let sigTime = 0;
    if (provider === 'stripe') {
      const tsMatch = signature.match(/\bt=(\d+)\b/);
      sigTime = tsMatch ? Number(tsMatch[1]) : 0;
    } else if (provider === 'wechat' && wechatHeaders?.wechatTimestamp) {
      sigTime = Number(wechatHeaders.wechatTimestamp);
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (sigTime && Math.abs(nowSec - sigTime) > 300) {
      logger.warn('webhook', `重放攻击风险: provider=${provider} sigTime=${sigTime} now=${nowSec} diff=${Math.abs(nowSec - sigTime)}s`);
      await WebhookEvent.create({
        eventId,
        provider: provider as 'wechat' | 'stripe',
        orderNo: result.orderNo,
        transactionId: result.transactionId,
        status: 'skipped',
        errorMessage: `重放攻击防护: 签名时间差 ${Math.abs(nowSec - sigTime)}s > 300s`,
        rawSummary: rawBody.slice(0, 512),
      });
      return res.status(200).json({ received: true });
    }

    // ========== 5. 查询订单并激活订阅 ==========
    // 优先级：paymentIntentId > orderNo > transactionId
    let order = result.orderNo
      ? await Order.findOne({ orderNo: result.orderNo })
      : null;

    if (!order && result.transactionId) {
      // 尝试通过 PaymentIntent ID 反查订单
      order = await Order.findOne({
        $or: [
          { paymentIntentId: result.transactionId },
          { transactionId: result.transactionId },
        ],
      });
    }

    if (!order) {
      logger.error('webhook', `找不到对应订单: eventId=${eventId} orderNo=${result.orderNo} txId=${result.transactionId}`);
      await WebhookEvent.create({
        eventId,
        provider: provider as 'wechat' | 'stripe',
        orderNo: result.orderNo,
        transactionId: result.transactionId,
        status: 'failed',
        errorMessage: '找不到对应订单',
        rawSummary: rawBody.slice(0, 512),
      });
      return res.status(200).json({ received: true });
    }

    // ========== 6. 幂等激活：已支付订单不重复激活 ==========
    if (order.status === 'paid') {
      logger.info('webhook', `订单已支付，跳过激活: orderNo=${order.orderNo}`);
      await WebhookEvent.create({
        eventId,
        provider: provider as 'wechat' | 'stripe',
        orderNo: order.orderNo,
        transactionId: result.transactionId,
        status: 'skipped',
        rawSummary: rawBody.slice(0, 512),
      });
      return res.status(200).json({ received: true, alreadyPaid: true });
    }

    // ========== 7. 更新订单状态 + 激活订阅/充值积分 ==========
    order.status = 'paid';
    order.paidAt = new Date();
    order.transactionId = result.transactionId || order.transactionId;
    if (result.transactionId && provider === 'stripe') {
      order.paymentIntentId = result.transactionId;
    }
    await order.save();

    if (order.orderType === 'credits_pack' && order.packageId) {
      await grantCreditsPack(order.userId.toString(), order.packageId, order.orderNo);
      logger.info('webhook', `积分包充值成功: orderNo=${order.orderNo} packageId=${order.packageId}`);
    } else {
      await activateSubscription(order.userId.toString(), order.plan, order.period, order.orderNo);
      logger.info('webhook', `订阅激活成功: orderNo=${order.orderNo} plan=${order.plan} provider=${provider}`);
    }

    // ========== 8. 记录成功事件 ==========
    await WebhookEvent.create({
      eventId,
      provider: provider as 'wechat' | 'stripe',
      orderNo: order.orderNo,
      transactionId: result.transactionId,
      status: 'processed',
      rawSummary: rawBody.slice(0, 512),
      processedAt: new Date(),
    });

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('webhook', `处理失败: provider=${req.params.provider}`, err);
    // 永远返回 200，避免支付网关认为回调失败而无限重试
    res.status(200).json({ received: true });
  }
});

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
  const defaultProvider = process.env.DEFAULT_PAY_PROVIDER || 'mock';
  res.json({
    success: true,
    data: {
      defaultProvider,
      isReal: defaultProvider !== 'mock',
      wechat: {
        configured: !!(process.env.WECHAT_MCH_ID && process.env.WECHAT_API_V3_KEY && process.env.WECHAT_PRIVATE_KEY),
        mchId: mask(process.env.WECHAT_MCH_ID),
        appId: mask(process.env.WECHAT_APP_ID),
        hasApiKey: !!process.env.WECHAT_API_V3_KEY,
        hasPlatformCert: !!process.env.WECHAT_PLATFORM_CERT,
        notifyUrl: process.env.WECHAT_NOTIFY_URL || process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL}/api/billing/webhook/wechat` : '未配置',
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

// Webhook 事件日志（最近 50 条，供诊断面板查看）
router.get('/webhook-events', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string;
    const filter: Record<string, any> = {};
    if (status && ['received', 'processed', 'skipped', 'failed'].includes(status)) {
      filter.status = status;
    }
    const [events, total] = await Promise.all([
      WebhookEvent.find(filter).sort({ receivedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      WebhookEvent.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: {
        list: events,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        summary: {
          total,
          processed: await WebhookEvent.countDocuments({ status: 'processed' }),
          failed: await WebhookEvent.countDocuments({ status: 'failed' }),
          skipped: await WebhookEvent.countDocuments({ status: 'skipped' }),
        },
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

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

export default router;
