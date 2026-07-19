/**
 * Webhook 事件记录模型 — 用于幂等性保证和审计追查
 *
 * - 同一 eventId 只能处理一次（MongoDB unique index 防重）
 * - 记录处理状态，支撑失败重试与对账
 * - 30 天 TTL 自动清理，控制存储成本
 */
import mongoose, { Document } from 'mongoose';
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
export declare const WebhookEvent: mongoose.Model<IWebhookEvent, {}, {}, {}, mongoose.Document<unknown, {}, IWebhookEvent, {}, {}> & IWebhookEvent & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=WebhookEvent.d.ts.map