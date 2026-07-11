/**
 * Webhook 事件记录模型 — 用于幂等性保证和审计追查
 *
 * - 同一 eventId 只能处理一次（MongoDB unique index 防重）
 * - 记录处理状态，支撑失败重试与对账
 * - 30 天 TTL 自动清理，控制存储成本
 */
import mongoose, { Schema, Document } from 'mongoose';

export type WebhookStatus = 'received' | 'processed' | 'skipped' | 'failed';

export interface IWebhookEvent extends Document {
  /** Stripe evt_xxx 或微信 transaction_id */
  eventId: string;
  provider: 'wechat' | 'stripe' | 'alipay';
  orderNo?: string;
  transactionId?: string;
  status: WebhookStatus;
  /** 失败原因（用于告警/重试） */
  errorMessage?: string;
  /** 原始回调体摘要（脱敏后前 512 字符） */
  rawSummary?: string;
  receivedAt: Date;
  processedAt?: Date;
}

const webhookEventSchema = new Schema<IWebhookEvent>(
  {
    eventId: { type: String, required: true, unique: true },
    provider: { type: String, enum: ['wechat', 'stripe', 'alipay'], required: true },
    orderNo: { type: String, index: true },
    transactionId: { type: String },
    status: {
      type: String,
      enum: ['received', 'processed', 'skipped', 'failed'],
      default: 'received',
    },
    errorMessage: { type: String },
    rawSummary: { type: String, maxlength: 512 },
    receivedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// 30 天 TTL 索引：自动清理旧事件
webhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 30 * 86400 });

export const WebhookEvent = mongoose.model<IWebhookEvent>('WebhookEvent', webhookEventSchema);
