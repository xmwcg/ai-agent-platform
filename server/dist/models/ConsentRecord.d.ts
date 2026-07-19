/**
 * 用户协议同意记录模型
 *
 * 记录每次用户同意/拒绝协议的时间、版本和元信息。
 * 协议更新后需重新征得用户同意。
 */
import mongoose, { Document } from "mongoose";
export type ConsentType = "terms_of_service" | "privacy_policy" | "cookie_policy" | "refund_policy" | "points_rules" | "data_processing";
export interface IConsentRecord extends Document {
    userId: mongoose.Types.ObjectId;
    consentType: ConsentType;
    version: string;
    accepted: boolean;
    ipAddress: string;
    userAgent: string;
    channel: "web" | "wechat" | "douyin" | "admin";
    withdrawnAt?: Date;
    createdAt: Date;
}
export declare const ConsentRecord: mongoose.Model<IConsentRecord, {}, {}, {}, mongoose.Document<unknown, {}, IConsentRecord, {}, {}> & IConsentRecord & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ConsentRecord.d.ts.map