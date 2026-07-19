import mongoose, { Document } from 'mongoose';
export interface IUser extends Document {
    email: string;
    password: string;
    name: string;
    avatar?: string;
    phone?: string;
    phoneHash?: string;
    wechatOpenid?: string;
    douyinOpenid?: string;
    douyinUnionid?: string;
    role: 'user' | 'admin';
    isBanned?: boolean;
    mfaEnabled?: boolean;
    mfaSecret?: string;
    mfaVerifiedAt?: Date;
    emailVerified?: boolean;
    emailVerifiedAt?: Date;
    failedLoginAttempts?: number;
    lockedUntil?: Date;
    provider: string;
    providerId?: string;
    plan: 'free' | 'pro' | 'max' | 'team';
    membershipExpiresAt?: Date;
    credits: number;
    referralCode: string;
    referredBy?: mongoose.Types.ObjectId;
    commissionBalance: number;
    totalCommissionEarned: number;
    commissionWithdrawn: number;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
    /** 获取手机号明文（仅供后端内部使用，不得直接返回前端） */
    getDecryptedPhone(): string | null;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=User.d.ts.map