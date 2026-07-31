/**
 * 事务型发件箱模型 — 保证跨服务操作最终一致性
 *
 * - 支付回调 → 权益履约链路中，先写发件箱再返回成功
 * - 后台 Worker 定时拉取 pending 事件并执行
 * - 支持重试次数和指数退避
 */
import mongoose, { Schema, Document } from "mongoose";

export type OutboxStatus = "pending" | "processing" | "done" | "failed" | "dead";
export type OutboxEventType =
  | "payment_confirmed"
  | "subscription_activated"
  | "credits_granted"
  | "refund_confirmed"
  | "credits_reversed"
  | "order_expired";

export interface IOutboxEvent extends Document {
  eventType: OutboxEventType;
  aggregateId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date;
  lastError?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const outboxEventSchema = new Schema<IOutboxEvent>(
  {
    eventType: {
      type: String,
      enum: [
        "payment_confirmed",
        "subscription_activated",
        "credits_granted",
        "refund_confirmed",
        "credits_reversed",
        "order_expired",
      ],
      required: true,
    },
    aggregateId: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "done", "failed", "dead"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    nextRetryAt: { type: Date, default: Date.now, index: true },
    lastError: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// 索引：Worker 拉取待处理事件
outboxEventSchema.index({ status: 1, nextRetryAt: 1 });

export const OutboxEvent = mongoose.model<IOutboxEvent>("OutboxEvent", outboxEventSchema);
