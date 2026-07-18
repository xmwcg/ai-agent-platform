/**
 * 退款模型 — 完整的退款生命周期管理
 *
 * - refundNo: 高熵唯一退款编号
 * - 状态流转: pending → approved → processing → success/failed
 * - 支持管理员审批、微信真实退款、权益回收、审计记录
 */
import mongoose, { Schema, Document } from "mongoose";

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

const refundSchema = new Schema<IRefund>(
  {
    refundNo: { type: String, required: true, unique: true },
    orderNo: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    refundableAmount: { type: Number, required: true, min: 0 },
    actualRefundAmount: { type: Number, default: 0, min: 0 },
    reason: {
      type: String,
      enum: ["duplicate_payment", "voluntary_refund", "service_unavailable", "fraud", "other"],
      required: true,
    },
    userDescription: { type: String, maxlength: 500 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "processing", "success", "failed"],
      default: "pending",
      index: true,
    },
    adminId: { type: Schema.Types.ObjectId, ref: "User" },
    adminNote: { type: String, maxlength: 1000 },
    wechatRefundId: { type: String },
    providerOrderNo: { type: String },
    repairedAt: { type: Date },
    failedReason: { type: String },
    creditSnapshot: {
      totalCredits: { type: Number, default: 0 },
      consumedCreditsInOrder: { type: Number, default: 0 },
      remainingCreditsInOrder: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

refundSchema.index({ userId: 1, status: 1 });
refundSchema.index({ wechatRefundId: 1 });

export const Refund = mongoose.model<IRefund>("Refund", refundSchema);
