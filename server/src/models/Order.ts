import mongoose, { Schema, Document } from "mongoose";

export type PaymentProvider = "wechat" | "stripe" | "alipay" | "mock";
export type OrderStatus = "pending" | "paid" | "failed" | "expired" | "refunded";
export type BillingPeriod = "monthly" | "yearly";
export type OrderType = "subscription" | "credits_pack" | "private_license";
export const BILLING_SOURCE_PRODUCTS = ["platform", "project_grade", "jinwangtong", "zhipingtong", "transync", "guard"] as const;
export type BillingSourceProduct = typeof BILLING_SOURCE_PRODUCTS[number];
export type PaymentStatus = "created" | "pending" | "paid" | "closed" | "failed" | "refunding" | "refunded";
export type FulfillmentStatus = "pending" | "processing" | "fulfilled" | "failed" | "reversed";

export interface IOrder extends Document {
  orderNo: string;
  userId: mongoose.Types.ObjectId;
  /** 订单类型：subscription=订阅付费，credits_pack=积分包，private_license=私有化授权 */
  orderType: OrderType;
  /** 私有化授权包版本（仅 orderType='private_license' 时使用） */
  licenseVersion?: string;
  /** 私有化授权签发结果（license.json 内容等，仅 orderType='private_license' 时使用） */
  licensePayload?: Record<string, any>;
  plan: "free" | "pro" | "max" | "team";
  /** 积分包 ID（仅 orderType='credits_pack' 时使用） */
  packageId?: string;
  period: BillingPeriod;
  amount: number; // 分
  currency: string;
  provider: PaymentProvider;
  /** 旧状态字段（兼容），新代码使用 paymentStatus + fulfillmentStatus */
  status: OrderStatus;
  /** 支付状态：渠道支付生命周期 */
  paymentStatus: PaymentStatus;
  /** 履约状态：权益发放生命周期 */
  fulfillmentStatus: FulfillmentStatus;
  /** 支付网关返回的原始交易号 */
  transactionId?: string;
  /** Stripe PaymentIntent ID（pi_xxx），用于 Webhook 对账 */
  paymentIntentId?: string;
  /** 支付网关的预支付参数（按需持久化，避免重复下单） */
  payParams?: Record<string, any>;
  /** 购买来源：用于产品转化归因与支付后返回。 */
  sourceProduct: BillingSourceProduct;
  /** 支付完成后的站内安全返回路径。 */
  returnTo?: string;
  /** 幂等键：客户端提交避免重复下单 */
  idempotencyKey?: string;
  /** 当前履约 attempt，用于防止旧履约覆盖新结果。 */
  fulfillmentAttemptId?: string;
  fulfillmentStartedAt?: Date;
  fulfillmentError?: string;
  expiresAt: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    orderNo: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderType: { type: String, enum: ["subscription", "credits_pack", "private_license"], default: "subscription" },
    licenseVersion: { type: String },
    licensePayload: { type: Schema.Types.Mixed },
    plan: { type: String, enum: ["free", "pro", "max", "team"], required: true },
    packageId: { type: String },
    period: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    amount: { type: Number, required: true },
    currency: { type: String, default: "CNY" },
    provider: { type: String, enum: ["wechat", "stripe", "alipay", "mock"], default: "mock" },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "expired", "refunded"],
      default: "pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["created", "pending", "paid", "closed", "failed", "refunding", "refunded"],
      default: "created",
      index: true,
    },
    fulfillmentStatus: {
      type: String,
      enum: ["pending", "processing", "fulfilled", "failed", "reversed"],
      default: "pending",
      index: true,
    },
    transactionId: { type: String },
    paymentIntentId: { type: String, index: true },
    payParams: { type: Schema.Types.Mixed },
    sourceProduct: { type: String, enum: BILLING_SOURCE_PRODUCTS, default: "platform", index: true },
    returnTo: { type: String },
    idempotencyKey: { type: String },
    fulfillmentAttemptId: { type: String },
    fulfillmentStartedAt: { type: Date },
    fulfillmentError: { type: String },
    expiresAt: { type: Date, required: true },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

orderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
    name: "uniq_user_order_idempotency",
  }
);

export const Order = mongoose.model<IOrder>("Order", orderSchema);
