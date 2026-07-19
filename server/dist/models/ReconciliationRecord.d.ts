/**
 * 对账记录模型 — 每日自动对账与差异追踪
 *
 * - batchId: 对账批次号（日期 YYYYMMDD）
 * - 记录匹配/不匹配订单和金额差异
 * - 支持手动触发对账和差异处理
 */
import mongoose, { Document } from "mongoose";
export type ReconciliationStatus = "pending" | "matched" | "partial" | "unmatched";
export interface IDifference {
    orderNo: string;
    type: "missing_in_wechat" | "missing_in_system" | "amount_mismatch" | "status_mismatch";
    systemAmount?: number;
    wechatAmount?: number;
    systemStatus?: string;
    wechatStatus?: string;
    resolved: boolean;
    resolvedAt?: Date;
    resolution?: string;
}
export interface IReconciliationRecord extends Document {
    batchId: string;
    provider: string;
    dateRange: {
        start: Date;
        end: Date;
    };
    totalSystemOrders: number;
    totalWechatOrders: number;
    totalSystemAmount: number;
    totalWechatAmount: number;
    matchedOrders: number;
    unmatchedOrders: number;
    differences: IDifference[];
    status: ReconciliationStatus;
    startedAt: Date;
    completedAt?: Date;
    errorMessage?: string;
}
export declare const ReconciliationRecord: mongoose.Model<IReconciliationRecord, {}, {}, {}, mongoose.Document<unknown, {}, IReconciliationRecord, {}, {}> & IReconciliationRecord & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ReconciliationRecord.d.ts.map