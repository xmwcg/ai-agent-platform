import mongoose, { Document } from "mongoose";
export type PaymentProvider = "wechat" | "stripe" | "alipay" | "mock";
export type OrderStatus = "pending" | "paid" | "failed" | "expired" | "refunded";
export type BillingPeriod = "monthly" | "yearly";
export type OrderType = "subscription" | "credits_pack" | "private_license";
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
    amount: number;
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
    /** 幂等键：客户端提交避免重复下单 */
    idempotencyKey?: string;
    expiresAt: Date;
    paidAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Order: mongoose.Model<IOrder, {}, {}, {}, mongoose.Document<unknown, {}, IOrder, {}, {}> & IOrder & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Order.d.ts.map