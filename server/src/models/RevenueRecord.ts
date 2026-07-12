import mongoose, { Schema, Document } from 'mongoose';

/**
 * 收益记录（RevenueRecord）
 *
 * 记录每次 API 调用产生的创作者收益：
 * - 用户调用付费 API → 平台扣费 → 创作者获得分成
 */
export interface IRevenueRecord extends Document {
  userId: mongoose.Types.ObjectId;       // 收益归属者（API Key 创建者）
  apiKeyId: mongoose.Types.ObjectId;     // 关联 API Key
  usageLogId?: mongoose.Types.ObjectId;   // 关联调用日志
  resource: string;                       // 资源类型 (chat/embed/compare/image)
  callAmount: number;                     // 调用收费总额（分）
  platformFee: number;                    // 平台抽成（分）
  creatorRevenue: number;                 // 创作者收益（分）
  platformRate: number;                   // 平台抽成比例
  status: 'pending' | 'settled' | 'withdrawn'; // 待结算/已结算/已提现
  settledAt?: Date;
  withdrawnAt?: Date;
  withdrawRequestId?: mongoose.Types.ObjectId; // 关联提现申请
  createdAt: Date;
}

const RevenueRecordSchema = new Schema<IRevenueRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
    usageLogId: { type: Schema.Types.ObjectId, ref: 'ApiUsageLog' },
    resource: { type: String, required: true },
    callAmount: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    creatorRevenue: { type: Number, required: true },
    platformRate: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'settled', 'withdrawn'],
      default: 'pending',
    },
    settledAt: { type: Date },
    withdrawnAt: { type: Date },
    withdrawRequestId: { type: Schema.Types.ObjectId, ref: 'WithdrawRequest' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

RevenueRecordSchema.index({ userId: 1, createdAt: -1 });
RevenueRecordSchema.index({ userId: 1, status: 1 });
RevenueRecordSchema.index({ apiKeyId: 1 });
RevenueRecordSchema.index({ status: 1 });

export const RevenueRecord = mongoose.model<IRevenueRecord>('RevenueRecord', RevenueRecordSchema);

/**
 * 提现申请（WithdrawRequest）
 */
export interface IWithdrawRequest extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;                  // 提现金额（分）
  fee: number;                     // 手续费（分）
  netAmount: number;               // 到账金额（分）
  method: 'wechat' | 'alipay';
  account: string;                 // 提现账号
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  rejectReason?: string;
  processedAt?: Date;
  transactionId?: string;          // 支付平台交易号
  createdAt: Date;
}

const WithdrawRequestSchema = new Schema<IWithdrawRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    fee: { type: Number, required: true, default: 0 },
    netAmount: { type: Number, required: true },
    method: { type: String, enum: ['wechat', 'alipay'], required: true },
    account: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'rejected'],
      default: 'pending',
    },
    rejectReason: { type: String },
    processedAt: { type: Date },
    transactionId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

WithdrawRequestSchema.index({ userId: 1, createdAt: -1 });
WithdrawRequestSchema.index({ status: 1 });

export const WithdrawRequest = mongoose.model<IWithdrawRequest>('WithdrawRequest', WithdrawRequestSchema);
