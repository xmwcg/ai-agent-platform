import mongoose, { Schema, Document } from 'mongoose';

export type PaymentProvider = 'wechat' | 'stripe' | 'alipay' | 'mock';
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
export type BillingPeriod = 'monthly' | 'yearly';
export type OrderType = 'subscription' | 'credits_pack';

export interface IOrder extends Document {
  orderNo: string;
  userId: mongoose.Types.ObjectId;
  /** 订单类型：subscription=订阅付费，credits_pack=积分包 */
  orderType: OrderType;
  plan: 'free' | 'pro' | 'max' | 'team';
  /** 积分包 ID（仅 orderType='credits_pack' 时使用） */
  packageId?: string;
  period: BillingPeriod;
  amount: number; // 分
  currency: string;
  provider: PaymentProvider;
  status: OrderStatus;
  /** 支付网关返回的原始交易号 */
  transactionId?: string;
  /** Stripe PaymentIntent ID（pi_xxx），用于 Webhook 对账 */
  paymentIntentId?: string;
  /** 支付网关的预支付参数（按需持久化，避免重复下单） */
  payParams?: Record<string, any>;
  expiresAt: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    orderNo: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderType: { type: String, enum: ['subscription', 'credits_pack'], default: 'subscription' },
    plan: { type: String, enum: ['free', 'pro', 'max', 'team'], required: true },
    packageId: { type: String },
    period: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'CNY' },
    provider: { type: String, enum: ['wechat', 'stripe', 'alipay', 'mock'], default: 'mock' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'expired', 'refunded'],
      default: 'pending',
      index: true,
    },
    transactionId: { type: String },
    paymentIntentId: { type: String, index: true },
    payParams: { type: Schema.Types.Mixed },
    expiresAt: { type: Date, required: true },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

export const Order = mongoose.model<IOrder>('Order', orderSchema);
