/**
 * NexMind Platform — 订单履约服务
 *
 * 统一处理当前 Order 模型的订阅、积分包和私有授权履约；所有入口均按订单号幂等。
 */

import crypto from "crypto";
import { Order, IOrder } from "../models/Order";
import { User } from "../models/User";
import { activateSubscription, grantCreditsPack } from "../routes/billing/logic";
import { issueLicense } from "./private-license.service";

export interface FulfillmentResult {
  order: Record<string, any>;
  idempotent?: boolean;
  success: boolean;
  orderType: string;
  plan?: string;
  credits?: number;
  licenseId?: string;
  licenseContent?: string;
  downloadUrl?: string;
}

function serializeOrder(order: IOrder): Record<string, any> {
  return typeof (order as any).toObject === "function" ? (order as any).toObject() : order as any;
}

function resolveLicenseEdition(packageId?: string): string {
  const value = String(packageId || "pro").toLowerCase();
  if (value === "free" || value.includes("trial")) return value === "free" ? "free" : "trial";
  if (value.includes("enterprise")) return "enterprise";
  if (value.includes("premium")) return "ent-premium";
  return "pro";
}

async function fulfillPrivateLicense(order: IOrder): Promise<{
  licenseId: string;
  licenseContent: string;
  downloadUrl: string;
}> {
  const issued = issueLicense({
    company: "个人用户",
    edition: resolveLicenseEdition(order.packageId),
    orderNo: order.orderNo,
    userId: order.userId.toString(),
  });
  const parsed = JSON.parse(issued.licenseContent) as Record<string, any>;
  const licensePayload = {
    ...parsed,
    licenseId: issued.licenseId,
    licenseContent: issued.licenseContent,
    downloadUrl: issued.downloadUrl,
    fingerprint: "PENDING_ACTIVATION",
    sign: String(parsed.signature || crypto.createHash("sha256").update(issued.licenseContent).digest("hex")).toUpperCase(),
  };
  order.licensePayload = licensePayload;
  await order.save();
  return issued;
}

/**
 * 履约已支付订单。参数可传订单号或订单文档，兼容路由、Webhook 与 Outbox Worker。
 */
export async function fulfillPaidOrder(orderOrNo: string | IOrder): Promise<FulfillmentResult> {
  const orderNo = typeof orderOrNo === "string" ? orderOrNo : orderOrNo.orderNo;
  let order = await Order.findOne({ orderNo });
  if (!order) throw new Error("订单不存在");
  if (order.paymentStatus !== "paid" && order.status !== "paid") throw new Error("订单尚未支付");

  if (order.fulfillmentStatus === "fulfilled") {
    return {
      success: true,
      idempotent: true,
      orderType: order.orderType,
      order: serializeOrder(order),
      plan: order.plan,
    };
  }

  const attemptId = crypto.randomUUID();
  const locked = await Order.findOneAndUpdate(
    {
      orderNo,
      fulfillmentStatus: { $in: ["pending", "failed"] },
      $or: [{ paymentStatus: "paid" }, { status: "paid" }],
    },
    {
      $set: {
        fulfillmentStatus: "processing",
        fulfillmentAttemptId: attemptId,
        fulfillmentStartedAt: new Date(),
        fulfillmentError: null,
      },
    },
    { new: true }
  );

  if (!locked) {
    order = await Order.findOne({ orderNo });
    if (!order) throw new Error("订单不存在");
    return {
      success: order.fulfillmentStatus === "fulfilled",
      idempotent: true,
      orderType: order.orderType,
      order: serializeOrder(order),
      plan: order.plan,
    };
  }

  order = locked;
  try {
    let credits: number | undefined;
    let license: Awaited<ReturnType<typeof fulfillPrivateLicense>> | undefined;

    if (order.orderType === "subscription") {
      await activateSubscription(order.userId.toString(), order.plan, order.period, order.orderNo);
    } else if (order.orderType === "credits_pack") {
      if (!order.packageId) throw new Error("积分包订单缺少 packageId");
      credits = await grantCreditsPack(order.userId.toString(), order.packageId, order.orderNo);
    } else if (order.orderType === "private_license") {
      license = await fulfillPrivateLicense(order);
    } else {
      throw new Error(`未知订单类型: ${order.orderType}`);
    }

    order = (await Order.findOneAndUpdate(
      { orderNo, fulfillmentAttemptId: attemptId },
      {
        $set: { fulfillmentStatus: "fulfilled" },
        $unset: { fulfillmentError: 1 },
      },
      { new: true }
    )) || order;

    const user = await User.findById(order.userId).select("plan credits").lean();
    return {
      success: true,
      orderType: order.orderType,
      order: serializeOrder(order),
      plan: user?.plan || order.plan,
      credits: credits ?? user?.credits,
      licenseId: license?.licenseId,
      licenseContent: license?.licenseContent,
      downloadUrl: license?.downloadUrl,
    };
  } catch (error) {
    await Order.updateOne(
      { orderNo, fulfillmentAttemptId: attemptId },
      { $set: { fulfillmentStatus: "failed", fulfillmentError: error instanceof Error ? error.message : String(error) } }
    );
    throw error;
  }
}

/** 兼容旧调用名。 */
export async function fulfillOrder(orderOrNo: string | IOrder): Promise<FulfillmentResult> {
  return fulfillPaidOrder(orderOrNo);
}

/** 确保支付确认事件已写入 Outbox，按订单号全局幂等。 */
export async function ensurePaymentConfirmedOutbox(
  orderNo: string,
  meta: Record<string, unknown> = {}
): Promise<void> {
  const { OutboxEvent } = await import("../models/OutboxEvent");
  const idempotencyKey = `payment-confirmed:${orderNo}`;
  await OutboxEvent.updateOne(
    { idempotencyKey },
    {
      $setOnInsert: {
        aggregateId: orderNo,
        idempotencyKey,
        eventType: "payment_confirmed",
        status: "pending",
        payload: { orderNo, ...meta },
        attempts: 0,
        maxAttempts: 5,
        nextRetryAt: new Date(),
      },
    },
    { upsert: true }
  );
}
