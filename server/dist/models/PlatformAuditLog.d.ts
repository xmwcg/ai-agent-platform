import mongoose, { Document } from 'mongoose';
/** 平台级审计动作（管理员对用户执行的敏感操作） */
export type PlatformAuditAction = 'user_role_changed' | 'user_banned' | 'user_unbanned';
export interface IPlatformAuditLog extends Document {
    actorId: string;
    action: PlatformAuditAction;
    targetId?: string;
    detail?: Record<string, unknown>;
    createdAt: Date;
}
export declare const PlatformAuditLog: mongoose.Model<IPlatformAuditLog, {}, {}, {}, mongoose.Document<unknown, {}, IPlatformAuditLog, {}, {}> & IPlatformAuditLog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=PlatformAuditLog.d.ts.map