/**
 * 支付 Webhook 路由（从 routes/billing.ts 抽离的独立子模块）
 * 包含：支付网关回调（微信 / 支付宝 / Stripe，带验签、幂等、重放防护、审计）+ Webhook 事件日志查看。
 */
import { Router, Request, Response } from 'express';
import { AuthRequest, requireAuth } from '../../middleware/auth';
import { Order, PaymentProvider } from '../../models/Order';
import { WebhookEvent } from '../../models/WebhookEvent';
import { getPaymentGateway } from '../../services/payment.service';
import { activateSubscription, grantCreditsPack } from './logic';
import { sendError } from '../../lib/http-error';
import { logger } from '../../lib/logger';

const router = Router();

// 支付网关回调（微信 / 支付宝 / Stripe）—— 带幂等性、重放防护、审计日志
router.post('/webhook/:provider', async (req: Request, res: Response) => {
  const provider = req.params.provider as PaymentProvider;
  if (process.env.NODE_ENV === 'production' && provider !== 'wechat') {
    return res.status(404).json({ success: false, error: '接口不存在' });
  }
  try {
    const gateway = getPaymentGateway(provider);

    // 回执：支付宝要求返回纯文本 "success"，否则会持续重推；其余渠道返回 JSON 即可
    // extra 用于回带幂等/已支付等契约字段（支付宝纯文本回执不受影响）
    const ack = (extra?: Record<string, unknown>) => (provider === 'alipay'
      ? res.status(200).send('success')
      : res.status(200).json({ received: true, ...extra }));

    // 获取原始请求体（express.raw() 中间件下 req.body 为 Buffer；支付宝为解析后的表单对象）
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

    // 支付宝异步通知：body 已被 express.urlencoded 解析为表单对象，交给网关验签
    const extra = provider === 'alipay'
      ? { alipayParams: (req.body && !Buffer.isBuffer(req.body) ? req.body : {}) as Record<string, string> }
      : wechatHeaders;

    const result = await gateway.verifyWebhook(rawBody, signature, extra);
    if (!result) {
      logger.warn('webhook', `验签失败: provider=${provider}`);
      return process.env.NODE_ENV === 'production' && provider === 'wechat'
        ? res.status(401).json({ code: 'SIGN_ERROR', message: '签名验证失败' })
        : ack();
    }
    if (!result.success) {
      logger.info('webhook', `非成功事件: provider=${provider} eventType=${result.eventType || 'unknown'} orderNo=${result.orderNo}`);
      return ack();
    }

    // ========== 2. 提取事件 ID（幂等性标识） ==========
    const eventId = result.transactionId || result.orderNo || `${provider}_${Date.now()}`;

    // ========== 3. 幂等性检查：同一事件只处理一次 ==========
    const existing = await WebhookEvent.findOne({ eventId });
    if (existing) {
      logger.info('webhook', `事件已处理，跳过: eventId=${eventId} status=${existing.status}`);
      return ack({ idempotent: true });
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
        provider: provider as 'wechat' | 'stripe' | 'alipay',
        orderNo: result.orderNo,
        transactionId: result.transactionId,
        status: 'skipped',
        errorMessage: `重放攻击防护: 签名时间差 ${Math.abs(nowSec - sigTime)}s > 300s`,
        rawSummary: rawBody.slice(0, 512),
      });
      return ack();
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
        provider: provider as 'wechat' | 'stripe' | 'alipay',
        orderNo: result.orderNo,
        transactionId: result.transactionId,
        status: 'failed',
        errorMessage: '找不到对应订单',
        rawSummary: rawBody.slice(0, 512),
      });
      return ack();
    }

    // ========== 6. 幂等激活：已支付订单不重复激活 ==========
    if (order.status === 'paid') {
      logger.info('webhook', `订单已支付，跳过激活: orderNo=${order.orderNo}`);
      await WebhookEvent.create({
        eventId,
        provider: provider as 'wechat' | 'stripe' | 'alipay',
        orderNo: order.orderNo,
        transactionId: result.transactionId,
        status: 'skipped',
        rawSummary: rawBody.slice(0, 512),
      });
      return ack({ alreadyPaid: true });
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
      provider: provider as 'wechat' | 'stripe' | 'alipay',
      orderNo: order.orderNo,
      transactionId: result.transactionId,
      status: 'processed',
      rawSummary: rawBody.slice(0, 512),
      processedAt: new Date(),
    });

    return ack();
  } catch (err) {
    logger.error('webhook', `处理失败: provider=${req.params.provider}`, err);
    // 生产微信回调处理失败必须返回非 2xx，让渠道继续重试；不能吞掉持久化/履约故障。
    if (process.env.NODE_ENV === 'production' && provider === 'wechat') {
      return res.status(500).json({ code: 'SYSTEM_ERROR', message: '处理失败，请重试' });
    }
    if (provider === 'alipay') return res.status(200).send('success');
    return res.status(200).json({ received: true });
  }
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

export default router;
