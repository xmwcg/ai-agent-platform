import mongoose, { Schema, Document } from 'mongoose';

/**
 * 推荐/分销记录（Referral）
 *
 * 记录推荐关系链：推荐人 → 被推荐人
 * 支持三级分销：level 1 = 直推, level 2 = 间推, level 3 = 三级
 */
export interface IReferral extends Document {
  referrerId: mongoose.Types.ObjectId;   // 推荐人
  referredUserId: mongoose.Types.ObjectId; // 被推荐人
  level: number;                          // 分销层级 (1/2/3)
  status: 'pending' | 'active';           // 待激活/已激活
  activatedAt?: Date;                     // 激活时间（被推荐人付费后）
  createdAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    referrerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referredUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    level: { type: Number, enum: [1, 2, 3], required: true },
    status: {
      type: String,
      enum: ['pending', 'active'],
      default: 'pending',
    },
    activatedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ReferralSchema.index({ referrerId: 1, createdAt: -1 });
ReferralSchema.index({ referrerId: 1, level: 1 });

export const Referral = mongoose.model<IReferral>('Referral', ReferralSchema);

/**
 * 佣金记录（Commission）
 *
 * 记录每笔佣金产生与提现
 */
export interface ICommission extends Document {
  userId: mongoose.Types.ObjectId;       // 佣金归属用户
  referralId: mongoose.Types.ObjectId;   // 关联推荐记录
  orderId?: mongoose.Types.ObjectId;     // 关联订单
  orderAmount: number;                   // 订单金额（分）
  commissionRate: number;                // 佣金比例（如 0.05 = 5%）
  commissionAmount: number;              // 佣金金额（分）
  level: number;                         // 分销层级
  status: 'pending' | 'settled' | 'withdrawn'; // 待结算/已结算/已提现
  settledAt?: Date;
  withdrawnAt?: Date;
  withdrawMethod?: 'wechat' | 'alipay';
  createdAt: Date;
}

const CommissionSchema = new Schema<ICommission>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referralId: { type: Schema.Types.ObjectId, ref: 'Referral', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    orderAmount: { type: Number, required: true },
    commissionRate: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    level: { type: Number, enum: [1, 2, 3], required: true },
    status: {
      type: String,
      enum: ['pending', 'settled', 'withdrawn'],
      default: 'pending',
    },
    settledAt: { type: Date },
    withdrawnAt: { type: Date },
    withdrawMethod: { type: String, enum: ['wechat', 'alipay'] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CommissionSchema.index({ userId: 1, createdAt: -1 });
CommissionSchema.index({ userId: 1, status: 1 });
CommissionSchema.index({ referralId: 1 });

export const Commission = mongoose.model<ICommission>('Commission', CommissionSchema);
