/**
 * 事务型发件箱模型 — 保证跨服务操作最终一致性
 *
 * - 支付回调 → 权益履约链路中，先写发件箱再返回成功
 * - 后台 Worker 定时拉取 pending 事件并执行
 * - 支持重试次数和指数退避
 */
import mongoose, { Document } from "mongoose";
export type OutboxStatus = "pending" | "processing" | "done" | "failed" | "dead";
export type OutboxEventType = "payment_confirmed" | "subscription_activated" | "credits_granted" | "refund_confirmed" | "credits_reversed" | "order_expired";
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
export declare const OutboxEvent: mongoose.Model<IOutboxEvent, {}, {}, {}, mongoose.Document<unknown, {}, IOutboxEvent, {}, {}> & IOutboxEvent & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=OutboxEvent.d.ts.map