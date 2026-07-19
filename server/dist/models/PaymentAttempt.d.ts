/**
 * 支付尝试记录模型 — 唯一回调事件去重与审计追踪
 *
 * - 每次支付回调（或主动查单确认）创建一条记录
 * - idempotencyKey 唯一索引保证同一回调只处理一次
 * - rawEvent 保存原始回调数据用于对账
 */
import mongoose, { Document } from "mongoose";
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
export declare const PaymentAttempt: mongoose.Model<IPaymentAttempt, {}, {}, {}, mongoose.Document<unknown, {}, IPaymentAttempt, {}, {}> & IPaymentAttempt & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=PaymentAttempt.d.ts.map