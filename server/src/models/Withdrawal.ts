import mongoose, { Schema, Document } from 'mongoose';
import { encryptField, decryptField } from '../lib/field-crypto';

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type WithdrawalMethod = 'wechat' | 'alipay';

export interface IWithdrawal extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;        // 提现金额（元）
  amountCents: number;   // 提现金额（分，内部结算口径）
  method: WithdrawalMethod;
  account?: string;      // 收款账号（AES-256-GCM 加密存储）
  status: WithdrawalStatus;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  /** 获取收款账号明文（仅供后端内部使用） */
  getDecryptedAccount(): string | null;
}

const withdrawalSchema = new Schema<IWithdrawal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    amountCents: { type: Number, required: true },
    method: { type: String, enum: ['wechat', 'alipay'], default: 'wechat' },
    account: { type: String, select: false }, // 默认查询不返回密文字段
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending' },
    note: { type: String },
  },
  { timestamps: true }
);

// 🔒 提现账号加密（P0 安全加固）
withdrawalSchema.pre('save', function (next) {
  try {
    const raw = (this as any).account;
    if (raw && !raw.startsWith('enc::')) {
      this.set('account', encryptField(raw));
    }
    next();
  } catch (err: any) {
    next(err);
  }
});

// 返回 JSON 时掩码账号（仅展示后 4 位）
withdrawalSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    if (ret.account) {
      try {
        const decrypted = decryptField(ret.account);
        // 掩码：仅展示后 4 位，其余显示为 ****
        ret.account = decrypted.length > 4
          ? `****${decrypted.slice(-4)}`
          : '****';
      } catch {
        ret.account = '****'; // 解密失败绝不泄露半密文
      }
    }
    delete ret.__v;
    return ret;
  },
});

/** 获取收款账号明文（仅供后端内部使用，如打款时）。 */
withdrawalSchema.methods.getDecryptedAccount = function (): string | null {
  if (!this.account) return null;
  try {
    return decryptField(this.account);
  } catch {
    return null;
  }
};

export const Withdrawal = mongoose.model<IWithdrawal>('Withdrawal', withdrawalSchema);
