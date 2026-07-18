/**
 * 支付尝试记录模型 — 唯一回调事件去重与审计追踪
 *
 * - 每次支付回调（或主动查单确认）创建一条记录
 * - idempotencyKey 唯一索引保证同一回调只处理一次
 * - rawEvent 保存原始回调数据用于对账
 */
import mongoose, { Schema, Document } from "mongoose";

export type AttemptStatus = "pending" | "confirmed" | "failed" | "duplicate";

export interface IPaymentAttempt extends Document {
  orderNo: string;
  idempotencyKey: string;
  provider: "wechat" | "stripe" | "alipay";
  amount: number;
  currency: string;
  transactionId?: string;
  eventType: string;
  status: AttemptStatus;
  rawEvent?: string;
  errorMessage?: string;
  confirmedAt?: Date;
  createdAt: Date;
}

const paymentAttemptSchema = new Schema<IPaymentAttempt>(
  {
    orderNo: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    provider: {
      type: String,
      enum: ["wechat", "stripe", "alipay"],
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "CNY" },
    transactionId: { type: String, index: true },
    eventType: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "failed", "duplicate"],
      default: "pending",
    },
    rawEvent: { type: String, maxlength: 4096 },
    errorMessage: { type: String },
    confirmedAt: { type: Date },
  },
  { timestamps: true }
);

export const PaymentAttempt = mongoose.model<IPaymentAttempt>("PaymentAttempt", paymentAttemptSchema);
