/**
 * 对账记录模型 — 每日自动对账与差异追踪
 *
 * - batchId: 对账批次号（日期 YYYYMMDD）
 * - 记录匹配/不匹配订单和金额差异
 * - 支持手动触发对账和差异处理
 */
import mongoose, { Schema, Document } from "mongoose";

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

const differenceSchema = new Schema<IDifference>(
  {
    orderNo: { type: String, required: true },
    type: {
      type: String,
      enum: ["missing_in_wechat", "missing_in_system", "amount_mismatch", "status_mismatch"],
      required: true,
    },
    systemAmount: { type: Number },
    wechatAmount: { type: Number },
    systemStatus: { type: String },
    wechatStatus: { type: String },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolution: { type: String },
  },
  { _id: false }
);

const reconciliationRecordSchema = new Schema<IReconciliationRecord>(
  {
    batchId: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    dateRange: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
    },
    totalSystemOrders: { type: Number, required: true },
    totalWechatOrders: { type: Number, default: 0 },
    totalSystemAmount: { type: Number, required: true },
    totalWechatAmount: { type: Number, default: 0 },
    matchedOrders: { type: Number, default: 0 },
    unmatchedOrders: { type: Number, default: 0 },
    differences: { type: [differenceSchema], default: [] },
    status: {
      type: String,
      enum: ["pending", "matched", "partial", "unmatched"],
      default: "pending",
    },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

reconciliationRecordSchema.index({ provider: 1, status: 1 });
reconciliationRecordSchema.index({ "dateRange.start": 1, "dateRange.end": 1 });

export const ReconciliationRecord = mongoose.model<IReconciliationRecord>(
  "ReconciliationRecord",
  reconciliationRecordSchema
);
