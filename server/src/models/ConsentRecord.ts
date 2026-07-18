/**
 * 用户协议同意记录模型
 *
 * 记录每次用户同意/拒绝协议的时间、版本和元信息。
 * 协议更新后需重新征得用户同意。
 */
import mongoose, { Schema, Document } from "mongoose";

export type ConsentType = "terms_of_service" | "privacy_policy" | "cookie_policy" | "refund_policy" | "data_processing";

export interface IConsentRecord extends Document {
  userId: mongoose.Types.ObjectId;
  consentType: ConsentType;
  version: string;
  accepted: boolean;
  ipAddress: string;
  userAgent: string;
  channel: "web" | "wechat" | "douyin" | "admin";
  withdrawnAt?: Date;
  createdAt: Date;
}

const ConsentRecordSchema = new Schema<IConsentRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    consentType: {
      type: String,
      required: true,
      enum: ["terms_of_service", "privacy_policy", "cookie_policy", "refund_policy", "data_processing"],
    },
    version: { type: String, required: true },
    accepted: { type: Boolean, required: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, default: "" },
    channel: { type: String, enum: ["web", "wechat", "douyin", "admin"], default: "web" },
    withdrawnAt: { type: Date },
  },
  { timestamps: true }
);

ConsentRecordSchema.index({ userId: 1, consentType: 1 });
ConsentRecordSchema.index({ userId: 1, version: 1 });

export const ConsentRecord = mongoose.model<IConsentRecord>("ConsentRecord", ConsentRecordSchema);