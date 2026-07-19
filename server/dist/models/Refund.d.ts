/**
 * 退款模型 — 完整的退款生命周期管理
 *
 * - refundNo: 高熵唯一退款编号
 * - 状态流转: pending → approved → processing → success/failed
 * - 支持管理员审批、微信真实退款、权益回收、审计记录
 */
import mongoose, { Document } from "mongoose";
export type RefundStatus = "pending" | "approved" | "rejected" | "processing" | "success" | "failed";
export type RefundReason = "duplicate_payment" | "voluntary_refund" | "service_unavailable" | "fraud" | "other";
export interface IRefund extends Document {
    refundNo: string;
    orderNo: string;
    userId: mongoose.Types.ObjectId;
    amount: number;
    refundableAmount: number;
    actualRefundAmount: number;
    reason: RefundReason;
    userDescription?: string;
    status: RefundStatus;
    adminId?: mongoose.Types.ObjectId;
    adminNote?: string;
    wechatRefundId?: string;
    providerOrderNo?: string;
    repairedAt?: Date;
    failedReason?: string;
    creditSnapshot: {
        totalCredits: number;
        consumedCreditsInOrder: number;
        remainingCreditsInOrder: number;
    };
    createdAt: Date;
    updatedAt: Date;
}
export declare const Refund: mongoose.Model<IRefund, {}, {}, {}, mongoose.Document<unknown, {}, IRefund, {}, {}> & IRefund & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Refund.d.ts.map