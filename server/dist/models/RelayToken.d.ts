import mongoose, { Document } from 'mongoose';
/** 中转站客户令牌：绑定 LicenseId（会员卡号），按量记账（M3 计费层落地） */
export interface IRelayToken extends Document {
    tokenHash: string;
    label: string;
    licenseId: string;
    plan: string;
    quotaTotal: number;
    quotaUsed: number;
    status: 'active' | 'disabled' | 'expired';
    expireAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const RelayToken: mongoose.Model<IRelayToken, {}, {}, {}, mongoose.Document<unknown, {}, IRelayToken, {}, {}> & IRelayToken & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
/** 用量流水：每次调用记一笔，用于账单与对账 */
export interface IRelayUsage extends Document {
    tokenId: string;
    licenseId: string;
    modelName: string;
    used: number;
    createdAt: Date;
}
export declare const RelayUsage: mongoose.Model<IRelayUsage, {}, {}, {}, mongoose.Document<unknown, {}, IRelayUsage, {}, {}> & IRelayUsage & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=RelayToken.d.ts.map