import mongoose, { Document } from 'mongoose';
/**
 * 收益记录（RevenueRecord）
 *
 * 记录每次 API 调用产生的创作者收益：
 * - 用户调用付费 API → 平台扣费 → 创作者获得分成
 */
export interface IRevenueRecord extends Document {
    userId: mongoose.Types.ObjectId;
    apiKeyId: mongoose.Types.ObjectId;
    usageLogId?: mongoose.Types.ObjectId;
    resource: string;
    callAmount: number;
    platformFee: number;
    creatorRevenue: number;
    platformRate: number;
    status: 'pending' | 'settled' | 'withdrawn';
    settledAt?: Date;
    withdrawnAt?: Date;
    withdrawRequestId?: mongoose.Types.ObjectId;
    createdAt: Date;
}
export declare const RevenueRecord: mongoose.Model<IRevenueRecord, {}, {}, {}, mongoose.Document<unknown, {}, IRevenueRecord, {}, {}> & IRevenueRecord & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
/**
 * 提现申请（WithdrawRequest）
 */
export interface IWithdrawRequest extends Document {
    userId: mongoose.Types.ObjectId;
    amount: number;
    fee: number;
    netAmount: number;
    method: 'wechat' | 'alipay';
    account: string;
    status: 'pending' | 'processing' | 'completed' | 'rejected';
    rejectReason?: string;
    processedAt?: Date;
    transactionId?: string;
    createdAt: Date;
}
export declare const WithdrawRequest: mongoose.Model<IWithdrawRequest, {}, {}, {}, mongoose.Document<unknown, {}, IWithdrawRequest, {}, {}> & IWithdrawRequest & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=RevenueRecord.d.ts.map