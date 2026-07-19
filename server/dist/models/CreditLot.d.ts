import mongoose, { Document } from 'mongoose';
export type CreditLotSourceType = 'subscription_free' | 'promotion_free' | 'purchase' | 'refund' | 'adjustment' | 'legacy_protected';
export type CreditLotStatus = 'active' | 'depleted' | 'expired' | 'reversed';
export interface ICreditLot extends Document {
    userId: mongoose.Types.ObjectId;
    sourceType: CreditLotSourceType;
    originalAmount: number;
    remainingAmount: number;
    sourceOrderNo?: string;
    idempotencyKey: string;
    expiresAt?: Date;
    status: CreditLotStatus;
    migrationBatch?: string;
    auditReason?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const CreditLot: mongoose.Model<ICreditLot, {}, {}, {}, mongoose.Document<unknown, {}, ICreditLot, {}, {}> & ICreditLot & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=CreditLot.d.ts.map