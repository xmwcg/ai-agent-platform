import mongoose, { Schema, Document } from 'mongoose';

/**
 * 积分变动明细（CreditsTransaction）
 *
 * 记录每一笔积分变动（收入/支出），支撑：
 * - 用户积分余额对账
 * - 积分消费报表
 * - 积分包购买审计
 *
 * TTL 索引 365 天后自动清理，控制存储成本。
 */
export type CreditsTransactionType = 'deduction' | 'grant' | 'purchase';

export interface ICreditsTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: CreditsTransactionType;     // deduction=API扣减, grant=订阅赠送, purchase=积分包购买
  amount: number;                    // 变动额（正数收入，负数支出）
  balanceAfter: number;              // 变动后余额
  resource?: string;                 // 关联资源（chat/embed/compare/image），仅 deduction 类型
  apiKeyId?: mongoose.Types.ObjectId;// 关联 API Key，仅 deduction 类型
  orderNo?: string;                  // 关联订单号，grant/purchase 类型
  description?: string;              // 人类可读描述
  createdAt: Date;
}

const CreditsTransactionSchema = new Schema<ICreditsTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['deduction', 'grant', 'purchase'],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    resource: { type: String },
    apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey' },
    orderNo: { type: String },
    description: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// 复合索引：按用户 + 时间倒序查询变动明细
CreditsTransactionSchema.index({ userId: 1, createdAt: -1 });
// 按用户 + 变动类型过滤
CreditsTransactionSchema.index({ userId: 1, type: 1 });
// TTL 索引：365 天后自动清理
CreditsTransactionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 86400 });

export const CreditsTransaction = mongoose.model<ICreditsTransaction>(
  'CreditsTransaction',
  CreditsTransactionSchema
);
