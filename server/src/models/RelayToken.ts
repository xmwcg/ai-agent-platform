import mongoose, { Schema, Document } from 'mongoose';

/** 中转站客户令牌：绑定 LicenseId（会员卡号），按量记账（M3 计费层落地） */
export interface IRelayToken extends Document {
  tokenHash: string;
  label: string;
  licenseId: string;
  plan: string;
  quotaTotal: number; // 0 表示不限量
  quotaUsed: number;
  status: 'active' | 'disabled' | 'expired';
  expireAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RelayTokenSchema = new Schema<IRelayToken>(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    label: { type: String, required: true },
    licenseId: { type: String, required: true, index: true },
    plan: { type: String, default: 'monthly' },
    quotaTotal: { type: Number, default: 0 },
    quotaUsed: { type: Number, default: 0 },
    status: { type: String, default: 'active', enum: ['active', 'disabled', 'expired'] },
    expireAt: { type: Date },
  },
  { timestamps: true }
);

export const RelayToken = mongoose.model<IRelayToken>('RelayToken', RelayTokenSchema);

/** 用量流水：每次调用记一笔，用于账单与对账 */
export interface IRelayUsage extends Document {
  tokenId: string;
  licenseId: string;
  modelName: string;
  used: number;
  createdAt: Date;
}

const RelayUsageSchema = new Schema<IRelayUsage>(
  {
    tokenId: { type: String, required: true, index: true },
    licenseId: { type: String, required: true, index: true },
    modelName: { type: String },
    used: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const RelayUsage = mongoose.model<IRelayUsage>('RelayUsage', RelayUsageSchema);
