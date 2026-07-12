import mongoose, { Schema, Document } from 'mongoose';

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type WithdrawalMethod = 'wechat' | 'alipay';

export interface IWithdrawal extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;        // 提现金额（元）
  amountCents: number;   // 提现金额（分，内部结算口径）
  method: WithdrawalMethod;
  account?: string;      // 收款账号 / 微信 / 支付宝
  status: WithdrawalStatus;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const withdrawalSchema = new Schema<IWithdrawal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    amountCents: { type: Number, required: true },
    method: { type: String, enum: ['wechat', 'alipay'], default: 'wechat' },
    account: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending' },
    note: { type: String },
  },
  { timestamps: true }
);

export const Withdrawal = mongoose.model<IWithdrawal>('Withdrawal', withdrawalSchema);
