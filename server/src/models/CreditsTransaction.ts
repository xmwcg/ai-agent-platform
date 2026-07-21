import mongoose, { Schema, Document } from 'mongoose';

/**
 * 积分变动明细（CreditsTransaction）
 *
 * 记录每一笔积分变动（收入/支出），支撑：
 * - 用户积分余额对账
 * - 积分消费报表
 * - 积分包购买审计
 *
 * 财务与权益相关流水长期保留，不设置 TTL。
 */
export type CreditsTransactionType =
  | 'purchase'
  | 'grant'
  | 'deduction'
  | 'refund'
  | 'reversal'
  | 'freeze'
  | 'unfreeze'
  | 'adjustment'
  | 'expire';

export interface ICreditsTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: CreditsTransactionType; // deduction=API扣减, grant=订阅赠送, purchase=积分包购买
  amount: number; // 变动额（正数收入，负数支出）
  balanceBefore?: number;
  balanceAfter: number;
  idempotencyKey?: string;
  businessType?: string;
  businessId?: string;
  sourceOrderNo?: string;
  relatedTransactionId?: mongoose.Types.ObjectId;
  status?: 'pending' | 'committed' | 'reversed' | 'failed';
  operatorId?: string;
  auditReason?: string; // 变动后余额
  resource?: string; // 关联资源（chat/embed/compare/image），仅 deduction 类型
  apiKeyId?: mongoose.Types.ObjectId; // 关联 API Key，仅 deduction 类型
  orderNo?: string; // 关联订单号，grant/purchase 类型
  description?: string; // 人类可读描述
  createdAt: Date;
}

const CreditsTransactionSchema = new Schema<ICreditsTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'purchase',
        'grant',
        'deduction',
        'refund',
        'reversal',
        'freeze',
        'unfreeze',
        'adjustment',
        'expire',
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number },
    balanceAfter: { type: Number, required: true },
    idempotencyKey: { type: String },
    businessType: { type: String },
    businessId: { type: String },
    sourceOrderNo: { type: String },
    relatedTransactionId: { type: Schema.Types.ObjectId, ref: 'CreditsTransaction' },
    status: {
      type: String,
      enum: ['pending', 'committed', 'reversed', 'failed'],
      default: 'committed',
    },
    operatorId: { type: String },
    auditReason: { type: String, maxlength: 500 },
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
// 仅当调用方真正提供字符串幂等键时参与唯一约束。
// compound sparse 索引会因为 userId 始终存在而仍索引缺失的 idempotencyKey（记为 null），
// 导致同一用户的第二条普通流水误报 E11000。
CreditsTransactionSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  }
);
CreditsTransactionSchema.index({ userId: 1, businessType: 1, businessId: 1, type: 1 });

export const CreditsTransaction = mongoose.model<ICreditsTransaction>(
  'CreditsTransaction',
  CreditsTransactionSchema
);
