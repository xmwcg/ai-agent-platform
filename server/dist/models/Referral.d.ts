import mongoose, { Document } from 'mongoose';
/**
 * 推荐/分销记录（Referral）
 *
 * 记录推荐关系链：推荐人 → 被推荐人
 * 支持三级分销：level 1 = 直推, level 2 = 间推, level 3 = 三级
 */
export interface IReferral extends Document {
    referrerId: mongoose.Types.ObjectId;
    referredUserId: mongoose.Types.ObjectId;
    level: number;
    status: 'pending' | 'active';
    activatedAt?: Date;
    createdAt: Date;
}
export declare const Referral: mongoose.Model<IReferral, {}, {}, {}, mongoose.Document<unknown, {}, IReferral, {}, {}> & IReferral & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
/**
 * 佣金记录（Commission）
 *
 * 记录每笔佣金产生与提现
 */
export interface ICommission extends Document {
    userId: mongoose.Types.ObjectId;
    referralId: mongoose.Types.ObjectId;
    orderId?: mongoose.Types.ObjectId;
    orderAmount: number;
    commissionRate: number;
    commissionAmount: number;
    level: number;
    status: 'pending' | 'settled' | 'withdrawn';
    settledAt?: Date;
    withdrawnAt?: Date;
    withdrawMethod?: 'wechat' | 'alipay';
    createdAt: Date;
}
export declare const Commission: mongoose.Model<ICommission, {}, {}, {}, mongoose.Document<unknown, {}, ICommission, {}, {}> & ICommission & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Referral.d.ts.map