import mongoose, { Document } from 'mongoose';
/** 针对敏感密钥（如第三方 ModelConfig.apiKey）的操作审计类型 */
export type SecretAuditAction = 'secret_created' | 'secret_updated' | 'secret_test' | 'secret_deleted';
export interface ISecretAuditLog extends Document {
    secretType: string;
    ownerId: string;
    actorId: string;
    targetId: string;
    action: SecretAuditAction;
    ip: string;
    userAgent?: string;
    result: 'success' | 'failure';
    alert: boolean;
    detail?: Record<string, unknown>;
    createdAt: Date;
}
export declare const SecretAuditLog: mongoose.Model<ISecretAuditLog, {}, {}, {}, mongoose.Document<unknown, {}, ISecretAuditLog, {}, {}> & ISecretAuditLog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=SecretAuditLog.d.ts.map