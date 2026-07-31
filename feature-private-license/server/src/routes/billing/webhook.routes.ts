/**
 * 支付 Webhook 路由（从 routes/billing.ts 抽离的独立子模块）
 * 包含：支付网关回调（微信 / 支付宝 / Stripe，带验签、幂等、重放防护、审计）+ Webhook 事件日志查看。
 * v2: 新增 PaymentAttempt 幂等、退款回调支持、Outbox 事件发件。
 */
import { Router, Request, Response } from "express";
import { AuthRequest, requireAuth } from "../../middleware/auth";
import { Order, PaymentProvider, PaymentStatus, FulfillmentStatus } from "../../models/Order";
import { WebhookEvent } from "../../models/WebhookEvent";
import { PaymentAttempt } from "../../models/PaymentAttempt";
import { OutboxEvent } from "../../models/OutboxEvent";
import { getPaymentGateway } from "../../services/payment.service";
import { activateSubscription, grantCreditsPack } from "./logic";
import { issuePrivateLicense } from "../../services/private-license.service";
import { getPrivateLicensePackage } from "../../config/private-license";
import { User } from "../../models/User";
import { sendError } from "../../lib/http-error";
import { logger } from "../../lib/logger";
import crypto from "crypto";

const router = Router();

// 支付网关回调（微信 / 支付宝 / Stripe）—— 带幂等性、重放防护、审计日志
router.post("/webhook/:provider", async (req: Request, res: Response) => {
  const provider = req.params.provider as PaymentProvider;
  if (process.env.NODE_ENV === "production" && provider !== "wechat") {
    return res.status(404).json({ success: false, error: "接口不存在" });
  }
  try {
    const gateway = getPaymentGateway(provider);

    // 回执：支付宝要求返回纯文本 "success"，否则会持续重推；其余渠道返回 JSON 即可
    const ack = (extra?: Record<string, unknown>) => (provider === "alipay"
      ? res.status(200).send("success")
      : res.status(200).json({ received: true, ...extra }));

    // 获取原始请求体
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);

    // 签名获取
    const signature = (req.headers["stripe-signature"] as string)
      || (req.headers["wechatpay-signature"] as string)
      || (req.headers["x-wechat-signature"] as string)
      || "";

    // ========== 1. 验签（防伪造回调） ==========
    const wechatHeaders = provider === "wechat" ? {
      wechatTimestamp: (req.headers["wechatpay-timestamp"] as string) || "",
      wechatNonce: (req.headers["wechatpay-nonce"] as string) || "",
      wechatSerial: (req.headers["wechatpay-serial"] as string) || "",
    } : undefined;

    const extra = provider === "alipay"
      ? { alipayParams: (req.body && !Buffer.isBuffer(req.body) ? req.body : {}) as Record<string, string> }
      : wechatHeaders;

    const result = await gateway.verifyWebhook(rawBody, signature, extra);
    if (!result) {
      logger.warn("webhook", `验签失败: provider=${provider}`);
      return process.env.NODE_ENV === "production" && provider === "wechat"
        ? res.status(401).json({ code: "SIGN_ERROR", message: "签名验证失败" })
        : ack();
    }

    // ========== 2. 幂等性检查（PaymentAttempt 替代旧 WebhookEvent） ==========
    const idempotencyKey = result.transactionId || `${provider}:${crypto.randomBytes(8).toString("hex")}`;

    const existingAttempt = await PaymentAttempt.findOne({ idempotencyKey });
    if (existingAttempt && existingAttempt.status === "confirmed") {
      logger.info("webhook", `事件已确认，跳过: key=${idempotencyKey}`);
      return ack({ idempotent: true });
    }

    // ========== 3. 重放攻击防护 ==========
    let sigTime = 0;
    if (provider === "stripe") {
      const tsMatch = signature.match(/\bt=(\d+)\b/);
      sigTime = tsMatch ? Number(tsMatch[1]) : 0;
    } else if (provider === "wechat" && wechatHeaders?.wechatTimestamp) {
      sigTime = Number(wechatHeaders.wechatTimestamp);
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (sigTime && Math.abs(nowSec - sigTime) > 300) {
      logger.warn("webhook", `重放攻击风险: provider=${provider} sigTime=${sigTime} now=${nowSec}`);

      // 先写 PaymentAttempt 再写 WebhookEvent
      await PaymentAttempt.create({
        orderNo: result.orderNo || "",
        idempotencyKey,
        provider: provider as any,
        amount: 0,
        eventType: result.eventType || "unknown",
        status: "duplicate",
        errorMessage: `重放攻击防护: 时间差 ${Math.abs(nowSec - sigTime)}s`,
        rawEvent: rawBody.slice(0, 1024),
      });

      await WebhookEvent.create({
        eventId: idempotencyKey,
        provider: provider as any,
        orderNo: result.orderNo,
        transactionId: result.transactionId,
        status: "skipped",
        errorMessage: `重放攻击防护: 签名时间差 ${Math.abs(nowSec - sigTime)}s > 300s`,
        rawSummary: rawBody.slice(0, 512),
      });
      return ack();
    }

    // ========== 4. 处理退款回调 ==========
    if (result.eventType && result.eventType.toLowerCase().includes("refund")) {
      return await handleRefundWebhook(result, idempotencyKey, rawBody, provider, ack, res);
    }

    // ========== 5. 非成功事件跳过 ==========
    if (!result.success) {
      logger.info("webhook", `非成功事件: provider=${provider} eventType=${result.eventType} orderNo=${result.orderNo}`);

      await PaymentAttempt.create({
        orderNo: result.orderNo || "",
        idempotencyKey,
        provider: provider as any,
        amount: 0,
        eventType: result.eventType || "unknown",
        status: "duplicate",
        rawEvent: rawBody.slice(0, 1024),
      });

      return ack();
    }

    // ========== 6. 查询订单并激活订阅 ==========
    let order = result.orderNo
      ? await Order.findOne({ orderNo: result.orderNo })
      : null;

    if (!order && result.transactionId) {
      order = await Order.findOne({
        $or: [
          { paymentIntentId: result.transactionId },
          { transactionId: result.transactionId },
        ],
      });
    }

    if (!order) {
      logger.error("webhook", `找不到对应订单: key=${idempotencyKey} orderNo=${result.orderNo} txId=${result.transactionId}`);

      await PaymentAttempt.create({
        orderNo: result.orderNo || "",
        idempotencyKey,
        provider: provider as any,
        amount: 0,
        eventType: result.eventType || "unknown",
        status: "failed",
        errorMessage: "找不到对应订单",
        rawEvent: rawBody.slice(0, 1024),
      });

      await WebhookEvent.create({
        eventId: idempotencyKey,
        provider: provider as any,
        orderNo: result.orderNo,
        transactionId: result.transactionId,
        status: "failed",
        errorMessage: "找不到对应订单",
        rawSummary: rawBody.slice(0, 512),
      });
      return ack();
    }

    // ========== 7. 已支付订单不重复激活 ==========
    if (order.paymentStatus === "paid" || order.status === "paid") {
      logger.info("webhook", `订单已支付，跳过激活: orderNo=${order.orderNo}`);

      await PaymentAttempt.create({
        orderNo: order.orderNo,
        idempotencyKey,
        provider: provider as any,
        amount: order.amount,
        transactionId: result.transactionId,
        eventType: result.eventType || "success",
        status: "duplicate",
        rawEvent: rawBody.slice(0, 1024),
      });

      await WebhookEvent.create({
        eventId: idempotencyKey,
        provider: provider as any,
        orderNo: order.orderNo,
        transactionId: result.transactionId,
        status: "skipped",
        rawSummary: rawBody.slice(0, 512),
      });
      return ack({ alreadyPaid: true });
    }

    // ========== 8. 更新订单状态 + 激活订阅/充值积分 ==========
    order.status = "paid";
    order.paymentStatus = "paid" as PaymentStatus;
    order.paidAt = new Date();
    order.transactionId = result.transactionId || order.transactionId;
    if (result.transactionId && provider === "stripe") {
      order.paymentIntentId = result.transactionId;
    }
    await order.save();

    // 写 Outbox 事件（事务型发件箱）
    await OutboxEvent.create({
      eventType: "payment_confirmed",
      aggregateId: order.orderNo,
      idempotencyKey: `payment-confirmed:${order.orderNo}:${idempotencyKey}`,
      payload: {
        orderNo: order.orderNo,
        transactionId: result.transactionId,
        provider,
        amount: order.amount,
        orderType: order.orderType,
        plan: order.plan,
        packageId: order.packageId,
        userId: order.userId.toString(),
      },
    });

    // 履约
    if (order.orderType === "credits_pack" && order.packageId) {
      await grantCreditsPack(order.userId.toString(), order.packageId, order.orderNo);
      await Order.updateOne(
        { orderNo: order.orderNo },
        { $set: { fulfillmentStatus: "fulfilled" as FulfillmentStatus } }
      );
    } else if (order.orderType === "private_license" && order.packageId) {
      // 私有化授权：调金网通签发 License，不进积分账本（避免双账本冲突）
      const licenseResult = await fulfillPrivateLicense(order.userId.toString(), order.packageId, order.orderNo);
      await Order.updateOne(
        { orderNo: order.orderNo },
        {
          $set: {
            fulfillmentStatus: licenseResult.ok ? ("fulfilled" as FulfillmentStatus) : ("pending" as FulfillmentStatus),
            licensePayload: licenseResult.payload,
          },
        }
      );
    } else {
      await activateSubscription(order.userId.toString(), order.plan, order.period, order.orderNo);
      await Order.updateOne(
        { orderNo: order.orderNo },
        { $set: { fulfillmentStatus: "fulfilled" as FulfillmentStatus } }
      );
    }

    // ========== 9. 记录 PaymentAttempt（成功） ==========
    await PaymentAttempt.create({
      orderNo: order.orderNo,
      idempotencyKey,
      provider: provider as any,
      amount: order.amount,
      transactionId: result.transactionId,
      eventType: result.eventType || "success",
      status: "confirmed",
      confirmedAt: new Date(),
      rawEvent: rawBody.slice(0, 1024),
    });

    // ========== 10. 记录 WebhookEvent（兼容旧审计） ==========
    await WebhookEvent.create({
      eventId: idempotencyKey,
      provider: provider as any,
      orderNo: order.orderNo,
      transactionId: result.transactionId,
      status: "processed",
      rawSummary: rawBody.slice(0, 512),
      processedAt: new Date(),
    });

    logger.info("webhook", `支付确认成功: orderNo=${order.orderNo} provider=${provider}`);
    return ack();
  } catch (err) {
    logger.error("webhook", `处理失败: provider=${req.params.provider}`, err);
    if (process.env.NODE_ENV === "production" && provider === "wechat") {
      return res.status(500).json({ code: "SYSTEM_ERROR", message: "处理失败，请重试" });
    }
    if (provider === "alipay") return res.status(200).send("success");
    return res.status(200).json({ received: true });
  }
});

/**
 * 私有化授权履约：调金网通签发 License 并回写订单。
 * 签发失败时订单 fulfillmentStatus 保持 pending，允许人工补发，不阻断支付成功。
 */
async function fulfillPrivateLicense(
  userId: string,
  packageId: string,
  orderNo: string
): Promise<{ ok: boolean; payload?: Record<string, unknown> }> {
  const pkg = getPrivateLicensePackage(packageId);
  if (!pkg) {
    logger.error("private-license", `未知私有化套餐: packageId=${packageId} orderNo=${orderNo}`);
    return { ok: false };
  }
  try {
    const user = await User.findById(userId).select("email").lean();
    const userEmail = (user as any)?.email || `order-${orderNo}@aibak.site`;
    const issued = await issuePrivateLicense(pkg, orderNo, userEmail);
    logger.info("private-license", `License 签发成功: orderNo=${orderNo} packageId=${packageId}`);
    return { ok: true, payload: issued as unknown as Record<string, unknown> };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("private-license", `License 签发失败，需人工补发: orderNo=${orderNo} err=${message}`);
    return { ok: false };
  }
}

/**
 * 处理退款回调
 */
async function handleRefundWebhook(
  result: any,
  idempotencyKey: string,
  rawBody: string,
  provider: PaymentProvider,
  ack: Function,
  res: Response
) {
  logger.info("webhook", `退款回调: provider=${provider} orderNo=${result.orderNo} eventType=${result.eventType}`);

  // 查找退款记录
  const { Refund } = await import("../../models/Refund");
  const refund = await Refund.findOne({
    orderNo: result.orderNo,
    status: { $in: ["processing", "pending"] },
  });

  if (refund) {
    // 退款成功回调
    if (result.success) {
      refund.status = "success";
      refund.wechatRefundId = result.transactionId || refund.wechatRefundId;
      await refund.save();

      await PaymentAttempt.create({
        orderNo: result.orderNo,
        idempotencyKey,
        provider: provider as any,
        amount: refund.actualRefundAmount,
        transactionId: result.transactionId,
        eventType: "refund_success",
        status: "confirmed",
        confirmedAt: new Date(),
        rawEvent: rawBody.slice(0, 1024),
      });
    } else {
      refund.status = "failed";
      refund.failedReason = `退款回调指示失败: ${result.eventType}`;
      await refund.save();

      await PaymentAttempt.create({
        orderNo: result.orderNo,
        idempotencyKey,
        provider: provider as any,
        amount: 0,
        eventType: "refund_failed",
        status: "failed",
        errorMessage: `退款回调失败: ${result.eventType}`,
        rawEvent: rawBody.slice(0, 1024),
      });
    }
  } else {
    // 未知退款通知：记录
    logger.warn("webhook", `收到未知退款回调: orderNo=${result.orderNo}`);

    await PaymentAttempt.create({
      orderNo: result.orderNo || "",
      idempotencyKey,
      provider: provider as any,
      amount: 0,
      eventType: result.eventType || "refund_unknown",
      status: "failed",
      errorMessage: "找不到对应退款记录",
      rawEvent: rawBody.slice(0, 1024),
    });
  }

  await WebhookEvent.create({
    eventId: idempotencyKey,
    provider: provider as any,
    orderNo: result.orderNo,
    transactionId: result.transactionId,
    status: "processed",
    rawSummary: rawBody.slice(0, 512),
    processedAt: new Date(),
  });

  return ack();
}

// Webhook 事件日志（最近 50 条，供诊断面板查看）
router.get("/webhook-events", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string;
    const filter: Record<string, any> = {};
    if (status && ["received", "processed", "skipped", "failed"].includes(status)) {
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
          processed: await WebhookEvent.countDocuments({ status: "processed" }),
          failed: await WebhookEvent.countDocuments({ status: "failed" }),
          skipped: await WebhookEvent.countDocuments({ status: "skipped" }),
        },
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
