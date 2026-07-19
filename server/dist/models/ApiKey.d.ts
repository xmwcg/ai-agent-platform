import mongoose, { Document } from 'mongoose';
export interface IApiKey extends Document {
    ownerId: string;
    teamId?: string;
    name: string;
    keyHash: string;
    prefix: string;
    status: 'active' | 'revoked';
    /** 单日调用配额（按量计费闸门） */
    quotaDaily: number;
    usedToday: number;
    lastReset: Date;
    /** 授权范围，如 chat / media / translate */
    scopes: string[];
    /** 是否启用积分自动抵扣（配额耗尽后从用户积分扣减，每 10 积分 = 1 次额外调用） */
    creditsEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ApiKey: mongoose.Model<IApiKey, {}, {}, {}, mongoose.Document<unknown, {}, IApiKey, {}, {}> & IApiKey & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ApiKey.d.ts.map