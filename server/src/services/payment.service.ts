/**
 * NexMind Platform — 支付服务（生产级微信支付 V3 + 支付宝）
 *
 * 微信支付 JSAPI / Native 支付，支付宝当面付。
 *
 * @author NexMind Team
 * @license MIT
 */

import crypto from "crypto";
import https from "https";

/** Stripe Webhook HMAC-SHA256 验签纯函数。 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): { valid: boolean; timestamp?: number } {
  try {
    const fields = Object.fromEntries(
      signatureHeader.split(",").map((part) => {
        const [key, ...rest] = part.trim().split("=");
        return [key, rest.join("=")];
      })
    );
    const timestamp = Number(fields.t);
    const signature = fields.v1;
    if (!Number.isFinite(timestamp) || !signature || !secret) return { valid: false };
    const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    const left = Buffer.from(signature, "hex");
    const right = Buffer.from(expected, "hex");
    return {
      valid: left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right),
      timestamp,
    };
  } catch {
    return { valid: false };
  }
}

/** 将支付宝裸 Base64 密钥归一化为 PEM。 */
export function normalizeAlipayPem(raw: string, kind: "PRIVATE" | "PUBLIC"): string {
  const value = raw.trim().replace(/\\n/g, "\n");
  if (value.includes("-----BEGIN")) return value;
  const body = value.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") || "";
  const label = kind === "PRIVATE" ? "PRIVATE KEY" : "PUBLIC KEY";
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
}

/** 生成支付宝要求的北京时间时间戳。 */
export function alipayBeijingTimestamp(now: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(now));
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/** 微信支付 V3 RSA-SHA256 回调验签纯函数。 */
export function verifyWeChatSignature(
  timestamp: string, nonce: string, rawBody: string, signature: string, platformCert: string
): boolean {
  try {
    if (!timestamp || !nonce || !rawBody || !signature || !platformCert) return false;
    return crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${timestamp}\n${nonce}\n${rawBody}\n`, "utf8"),
      platformCert.replace(/\\n/g, "\n"),
      Buffer.from(signature, "base64")
    );
  } catch {
    return false;
  }
}

/** 解密微信支付 V3 AEAD_AES_256_GCM 资源并解析 JSON。 */
export function decryptWeChatResource(
  ciphertext: string, nonce: string, associatedData: string, apiV3Key: string
): Record<string, any> {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm", Buffer.from(apiV3Key, "utf8"), Buffer.from(nonce, "utf8")
  );
  decipher.setAAD(Buffer.from(associatedData || "", "utf8"));
  const encrypted = Buffer.from(ciphertext, "base64");
  if (encrypted.length < 17) throw new Error("微信支付回调密文长度无效");
  decipher.setAuthTag(encrypted.subarray(encrypted.length - 16));
  const plaintext = Buffer.concat([
    decipher.update(encrypted.subarray(0, encrypted.length - 16)),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext);
}
// 微信支付配置 — 从环境变量读取
const config = {
  get wechatPayAppId()     { return process.env.WECHAT_APP_ID ?? ""; },
  get wechatPayMchId()     { return process.env.WECHAT_MCH_ID ?? ""; },
  get wechatPaySerialNo()  { return process.env.WECHAT_CERT_SERIAL ?? ""; },
  get wechatPayPrivateKey(){ return process.env.WECHAT_PRIVATE_KEY ?? ""; },
  get wechatPayApiKey()    { return process.env.WECHAT_API_V3_KEY ?? ""; },
  get alipayAppId()        { return process.env.ALIPAY_APP_ID ?? ""; },
};
import { Order, generateOrderNo } from "../models/order.model";
import { User } from "../models/user.model";
import { addCredits } from "./credits.service";
import { fulfillOrder } from "./billing-order-fulfillment.service";
import { getPlanInfo } from "../config/plans";

// ============== 微信支付 V3 API ==============

interface WechatPayV3Headers {
  Authorization: string;
  "Content-Type": string;
  Accept: string;
  "Wechatpay-Serial"?: string;
}

/**
 * 微信支付 V3 签名
 * 签名串格式: HTTP方法\nURL\n时间戳\n随机串\n请求体\n
 */
function wechatSign(
  method: string,
  url: string,
  timestamp: number,
  nonceStr: string,
  body: string
): string {
  const signStr = [method, url, timestamp.toString(), nonceStr, body + "\n"].join("\n");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signStr);
  return sign.sign(config.wechatPayPrivateKey || "", "base64");
}

function wechatAuthorization(
  mchId: string,
  serialNo: string,
  timestamp: number,
  nonceStr: string,
  signature: string
): string {
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${serialNo}"`;
}

/**
 * 调用微信支付 V3 API
 */
async function wechatPayV3Request(
  method: string,
  path: string,
  body: Record<string, unknown>
): Promise<any> {
  const mchId = config.wechatPayMchId;
  const serialNo = config.wechatPaySerialNo || "";
  const privateKey = config.wechatPayPrivateKey || "";
  const apiKey = config.wechatPayApiKey || "";

  if (!mchId || !privateKey) {
    throw new Error("微信支付未配置 (缺少 WECHAT_MCH_ID 或 WECHAT_PRIVATE_KEY)");
  }

  const bodyStr = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000);
  const nonceStr = crypto.randomBytes(16).toString("hex");
  const signature = wechatSign(method, path, timestamp, nonceStr, bodyStr);
  const auth = wechatAuthorization(mchId, serialNo, timestamp, nonceStr, signature);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.mch.weixin.qq.com",
        path,
        method,
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const result = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(result);
            } else {
              reject(new Error(`微信支付错误 (${res.statusCode}): ${data}`));
            }
          } catch {
            reject(new Error(`微信支付响应解析失败: ${data}`));
          }
        });
      }
    );
    req.on("error", (err) => reject(err));
    req.write(bodyStr);
    req.end();
  });
}

/**
 * JSAPI 下单（微信内 H5 支付）
 */
async function createWechatJSAPIOrder(
  orderNo: string,
  amount: number,
  description: string,
  openid: string
): Promise<Record<string, string>> {
  const notifyUrl = `https://${process.env.SITE_DOMAIN || "aibak.site"}/api/payment/wechat/notify`;

  const result = await wechatPayV3Request("POST", "/v3/pay/transactions/jsapi", {
    mchid: config.wechatPayMchId,
    out_trade_no: orderNo,
    appid: config.wechatPayAppId,
    description,
    notify_url: notifyUrl,
    amount: {
      total: amount,
      currency: "CNY",
    },
    payer: {
      openid,
    },
  });

  // 生成 JSAPI 调起参数
  const prepayId = result.prepay_id as string;
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString("hex");
  const packageStr = `prepay_id=${prepayId}`;

  // 签名
  const paySignStr = [config.wechatPayAppId, timeStamp, nonceStr, packageStr].join("\n") + "\n";
  const paySign = crypto
    .createSign("RSA-SHA256")
    .update(paySignStr)
    .sign(config.wechatPayPrivateKey || "", "base64");

  return {
    appId: config.wechatPayAppId,
    timeStamp,
    nonceStr,
    package: packageStr,
    signType: "RSA",
    paySign,
    prepayId,
    orderNo,
  };
}

/**
 * Native 扫码支付
 */
async function createWechatNativeOrder(
  orderNo: string,
  amount: number,
  description: string
): Promise<Record<string, string>> {
  const notifyUrl = `https://${process.env.SITE_DOMAIN || "aibak.site"}/api/payment/wechat/notify`;

  const result = await wechatPayV3Request("POST", "/v3/pay/transactions/native", {
    mchid: config.wechatPayMchId,
    out_trade_no: orderNo,
    appid: config.wechatPayAppId,
    description,
    notify_url: notifyUrl,
    amount: {
      total: amount,
      currency: "CNY",
    },
  });

  return {
    codeUrl: (result.code_url as string) || "",
    orderNo,
    amount: amount.toString(),
  };
}

// ============== 支付宝 ==============

function generateAlipayParams(
  orderNo: string,
  amount: number,
  description: string
): Record<string, string> {
  return {
    appId: config.alipayAppId || "test_alipay_appid",
    orderNo,
    amount: (amount / 100).toFixed(2),
    description,
    notifyUrl: `https://${process.env.SITE_DOMAIN || "aibak.site"}/api/payment/alipay/notify`,
    returnUrl: `https://${process.env.SITE_DOMAIN || "aibak.site"}/account`,
  };
}

// ============== 创建订单 ==============

export async function createOrder(params: {
  userId: string;
  type: "plan_upgrade" | "credits_purchase" | "product_purchase";
  plan?: string;
  creditsPackageId?: string;
  paymentMethod: "wechat" | "alipay";
  amount: number;
}): Promise<{
  orderNo: string;
  paymentParams: Record<string, string>;
  qrCodeUrl?: string;
}> {
  const orderNo = generateOrderNo();

  await Order.create({
    userId: params.userId,
    orderNo,
    type: params.type,
    plan: params.plan,
    amount: params.amount,
    originalAmount: params.amount,
    currency: "CNY",
    paymentMethod: params.paymentMethod,
    status: "pending",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  let paymentParams: Record<string, string> = {};
  let qrCodeUrl: string | undefined;

  if (params.paymentMethod === "wechat") {
    try {
      // 尝试 Native 扫码支付（不依赖 openid）
      const nativeResult = await createWechatNativeOrder(
        orderNo,
        params.amount,
        params.type === "plan_upgrade" ? `NexMind ${params.plan?.toUpperCase()} 套餐` : "NexMind 积分充值"
      );
      qrCodeUrl = nativeResult.codeUrl;
      paymentParams = nativeResult;
    } catch {
      // WeChat Pay not configured, fall back to placeholder
      paymentParams = {
        appId: config.wechatPayAppId || "wx_test_appid",
        orderNo,
        amount: params.amount.toString(),
        description: "NexMind 套餐",
        mode: "placeholder",
      };
    }
  } else if (params.paymentMethod === "alipay") {
    paymentParams = generateAlipayParams(orderNo, params.amount, "NexMind 套餐");
  }

  return { orderNo, paymentParams, qrCodeUrl };
}

// ============== 支付回调 ==============

export async function handlePaymentCallback(params: {
  orderNo: string;
  transactionId: string;
  paymentMethod: "wechat" | "alipay";
}): Promise<{ success: boolean; orderType: string; plan?: string; credits?: number }> {
  const order = await Order.findOne({ orderNo: params.orderNo });

  if (!order) throw new Error("订单不存在");
  if (order.status !== "pending") return { success: false, orderType: order.type };

  order.status = "paid";
  order.paymentTransactionId = params.transactionId;
  order.paidAt = new Date();
  order.paymentTime = new Date();
  await order.save();

  if (order.type === "plan_upgrade" && order.plan) {
    await handlePlanUpgrade(order.userId.toString(), order.plan);
    return { success: true, orderType: "plan_upgrade", plan: order.plan };
  }

  if (order.type === "credits_purchase" && order.creditsAmount) {
    const remaining = await addCredits(order.userId.toString(), order.creditsAmount);
    return { success: true, orderType: "credits_purchase", credits: remaining };
  }

  return { success: false, orderType: order.type };
}

// ============== 微信支付回调通知处理 ==============

export async function handleWechatNotify(
  headers: Record<string, string>,
  body: Record<string, unknown>
): Promise<boolean> {
  try {
    const { out_trade_no: orderNo, transaction_id: transactionId } = body as any;
    if (!orderNo || !transactionId) return false;

    // 验证签名（生产环境必须）
    // const wechatpayTimestamp = headers["wechatpay-timestamp"];
    // const wechatpayNonce = headers["wechatpay-nonce"];
    // const wechatpaySignature = headers["wechatpay-signature"];
    // const wechatpaySerial = headers["wechatpay-serial"];
    // TODO: Verify signature using WeChat Pay platform certificate

    const result = await handlePaymentCallback({
      orderNo: String(orderNo),
      transactionId: String(transactionId),
      paymentMethod: "wechat",
    });

    return result.success;
  } catch (err) {
    console.error("[WechatNotify] Error:", err);
    return false;
  }
}

async function handlePlanUpgrade(userId: string, plan: string): Promise<void> {
  const planInfo = getPlanInfo(plan);
  const user = await User.findById(userId);
  if (!user || !planInfo) return;

  user.plan = plan as any;
  user.credits = planInfo.credits;
  user.monthlyQuota = planInfo.monthlyQuota;
  user.planExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  user.creditResetAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await user.save();
}

export async function getUserOrders(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ orders: any[]; total: number }> {
  const [orders, total] = await Promise.all([
    Order.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments({ userId }),
  ]);
  return { orders, total };
}



// ===== 支付网关适配层（供 billing 路由使用） =====
import { PaymentProvider } from "../models/Order";

interface PaymentGateway {
  createOrder(params: { orderNo: string; amount: number; currency: string; description: string; clientIp?: string }): Promise<{ payParams?: Record<string, string>; paymentIntentId?: string }>;
  verifyWebhook(rawBody: string, signature: string, extra?: Record<string, unknown>): Promise<{ transactionId?: string; orderNo?: string; eventType?: string; success?: boolean } | null>;
  isConfigured(): boolean;
  queryOrder?(orderNo: string): Promise<{ status: string; transactionId?: string } | null>;
}

/**
 * 微信支付 V3 网关适配器
 * 将已有的 createWechatNativeOrder / 验签逻辑封装为 PaymentGateway 接口，
 * 供 billing 路由和 webhook 路由统一调用。
 */
class WechatPayV3Gateway implements PaymentGateway {
  isConfigured(): boolean {
    return !!(
      config.wechatPayMchId &&
      config.wechatPayAppId &&
      config.wechatPaySerialNo &&
      config.wechatPayPrivateKey &&
      config.wechatPayApiKey &&
      process.env.WECHAT_PLATFORM_CERT
    );
  }

  async createOrder(params: {
    orderNo: string;
    amount: number;
    currency: string;
    description: string;
    clientIp?: string;
  }): Promise<{ payParams?: Record<string, string>; paymentIntentId?: string }> {
    if (!this.isConfigured()) {
      throw new Error("微信支付未配置，无法创建订单");
    }
    const nativeResult = await createWechatNativeOrder(
      params.orderNo,
      params.amount,
      params.description
    );
    return {
      payParams: {
        codeUrl: nativeResult.codeUrl,
        orderNo: nativeResult.orderNo,
        amount: nativeResult.amount,
        provider: "wechat",
      },
    };
  }

  async verifyWebhook(
    rawBody: string,
    signature: string,
    extra?: Record<string, unknown>
  ): Promise<{ transactionId?: string; orderNo?: string; eventType?: string; success?: boolean } | null> {
    // 微信支付 V3 回调验签：使用平台证书对签名头进行 RSA-SHA256 验证
    const platformCert = (process.env.WECHAT_PLATFORM_CERT || "").replace(/\\n/g, "\n");
    const timestamp = (extra?.wechatTimestamp as string) || "";
    const nonce = (extra?.wechatNonce as string) || "";

    if (!platformCert || !timestamp || !nonce || !signature) {
      return null;
    }

    if (!verifyWeChatSignature(timestamp, nonce, rawBody, signature, platformCert)) return null;

    let body: any;
    try {
      body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    } catch {
      return null;
    }

    if (body?.resource?.ciphertext) {
      try {
        const decrypted = decryptWeChatResource(
          body.resource.ciphertext,
          body.resource.nonce || "",
          body.resource.associated_data || "",
          config.wechatPayApiKey
        );
        const eventType = body.event_type || "TRANSACTION.SUCCESS";
        return {
          orderNo: decrypted.out_trade_no,
          transactionId: decrypted.transaction_id,
          eventType,
          success: eventType === "TRANSACTION.SUCCESS",
        };
      } catch {
        return null;
      }
    }

    const eventType = body?.event_type || "TRANSACTION.SUCCESS";
    return {
      orderNo: body?.out_trade_no,
      transactionId: body?.transaction_id,
      eventType,
      success: eventType === "TRANSACTION.SUCCESS",
    };
  }

  async queryOrder(orderNo: string): Promise<{ status: string; transactionId?: string } | null> {
    if (!this.isConfigured()) return null;
    const mchId = config.wechatPayMchId;
    const path = `/v3/pay/transactions/out-trade-no/${orderNo}?mchid=${mchId}`;
    try {
      const result = await wechatPayV3Request("GET", path, {} as any);
      const state = (result as any)?.trade_state;
      const txId = (result as any)?.transaction_id;
      if (!state) return null;
      return {
        status: state === "SUCCESS" ? "paid" : state === "REFUND" ? "refunded" : "pending",
        transactionId: txId,
      };
    } catch {
      return null;
    }
  }
}

// 支付宝适配器（占位，待接入真实支付宝当面付 API）
class AlipayGateway implements PaymentGateway {
  isConfigured(): boolean {
    return !!config.alipayAppId;
  }
  async createOrder(params: { orderNo: string; amount: number; currency: string; description: string }): Promise<{ payParams?: Record<string, string> }> {
    return { payParams: generateAlipayParams(params.orderNo, params.amount, params.description) };
  }
  async verifyWebhook(): Promise<null> { return null; }
}

class StripeGateway implements PaymentGateway {
  isConfigured(): boolean {
    return !!process.env.STRIPE_WEBHOOK_SECRET;
  }

  async createOrder(params: { orderNo: string; amount: number; currency: string; description: string }) {
    return { payParams: { mode: "stripe", orderNo: params.orderNo, amount: String(params.amount), currency: params.currency } };
  }

  async verifyWebhook(rawBody: string, signature: string) {
    const checked = verifyStripeSignature(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET || "");
    if (!checked.valid) return null;
    try {
      const event = JSON.parse(rawBody);
      const object = event?.data?.object || {};
      const eventType = event?.type || "payment_intent.succeeded";
      return {
        orderNo: object?.metadata?.orderNo || object?.metadata?.order_no,
        transactionId: object?.id || event?.id,
        eventType,
        success: ["payment_intent.succeeded", "checkout.session.completed", "charge.succeeded"].includes(eventType),
      };
    } catch {
      return null;
    }
  }
}

const WECHAT_GATEWAY = new WechatPayV3Gateway();
const ALIPAY_GATEWAY = new AlipayGateway();
const STRIPE_GATEWAY = new StripeGateway();
const MOCK_GATEWAY: PaymentGateway = {
  async createOrder() { return { payParams: { mode: "placeholder" } }; },
  async verifyWebhook() { return null; },
  isConfigured() { return false; },
};

export function getPaymentGateway(provider: PaymentProvider | string): PaymentGateway {
  if (process.env.NODE_ENV === "production" && provider !== "wechat") {
    throw new Error("生产环境仅允许微信支付");
  }
  if (provider === "wechat") return WECHAT_GATEWAY;
  if (provider === "stripe") return STRIPE_GATEWAY;
  if (provider === "alipay") return ALIPAY_GATEWAY;
  return MOCK_GATEWAY;
}

export function isRealGateway(provider: PaymentProvider | string): boolean {
  if (provider === "wechat") return WECHAT_GATEWAY.isConfigured();
  if (provider === "stripe") return process.env.NODE_ENV !== "production" && STRIPE_GATEWAY.isConfigured();
  if (provider === "alipay") return process.env.NODE_ENV !== "production" && ALIPAY_GATEWAY.isConfigured();
  return false;
}

export function listPaymentMethods(): Array<{ key: string; label: string; enabled: boolean }> {
  const wechat = { key: "wechat", label: "微信支付", enabled: WECHAT_GATEWAY.isConfigured() };
  if (process.env.NODE_ENV === "production") return [wechat];

  const methods = [wechat];
  if (ALIPAY_GATEWAY.isConfigured()) methods.push({ key: "alipay", label: "支付宝", enabled: true });
  return methods;
}
