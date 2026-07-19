import mongoose, { Document } from 'mongoose';
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type WithdrawalMethod = 'wechat' | 'alipay';
export interface IWithdrawal extends Document {
    userId: mongoose.Types.ObjectId;
    amount: number;
    amountCents: number;
    method: WithdrawalMethod;
    account?: string;
    status: WithdrawalStatus;
    note?: string;
    createdAt: Date;
    updatedAt: Date;
    /** 获取收款账号明文（仅供后端内部使用） */
    getDecryptedAccount(): string | null;
}
export declare const Withdrawal: mongoose.Model<IWithdrawal, {}, {}, {}, mongoose.Document<unknown, {}, IWithdrawal, {}, {}> & IWithdrawal & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Withdrawal.d.ts.map