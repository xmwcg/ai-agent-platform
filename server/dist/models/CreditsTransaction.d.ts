import mongoose, { Document } from 'mongoose';
/**
 * 积分变动明细（CreditsTransaction）
 *
 * 记录每一笔积分变动（收入/支出），支撑：
 * - 用户积分余额对账
 * - 积分消费报表
 * - 积分包购买审计
 *
 * 财务与权益相关流水长期保留，不设置 TTL。
 */
export type CreditsTransactionType = 'purchase' | 'grant' | 'deduction' | 'refund' | 'reversal' | 'freeze' | 'unfreeze' | 'adjustment' | 'expire';
export interface ICreditsTransaction extends Document {
    userId: mongoose.Types.ObjectId;
    type: CreditsTransactionType;
    amount: number;
    balanceBefore?: number;
    balanceAfter: number;
    idempotencyKey?: string;
    businessType?: string;
    businessId?: string;
    sourceOrderNo?: string;
    relatedTransactionId?: mongoose.Types.ObjectId;
    status?: 'pending' | 'committed' | 'reversed' | 'failed';
    operatorId?: string;
    auditReason?: string;
    resource?: string;
    apiKeyId?: mongoose.Types.ObjectId;
    orderNo?: string;
    description?: string;
    createdAt: Date;
}
export declare const CreditsTransaction: mongoose.Model<ICreditsTransaction, {}, {}, {}, mongoose.Document<unknown, {}, ICreditsTransaction, {}, {}> & ICreditsTransaction & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=CreditsTransaction.d.ts.map