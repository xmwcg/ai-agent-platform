import { ClientSession } from 'mongoose';
import { CreditLotSourceType } from '../models/CreditLot';
import { CreditsTransactionType, ICreditsTransaction } from '../models/CreditsTransaction';
import { AppError } from '../lib/http-error';
export declare class CreditLedgerConsistencyError extends AppError {
    constructor(internalDetail?: string);
}
export declare class InsufficientCreditsError extends AppError {
    constructor();
}
export interface CreditLedgerResult {
    transaction: ICreditsTransaction;
    balanceBefore: number;
    balanceAfter: number;
    idempotent: boolean;
    consumedLots: Array<{
        lotId: string;
        sourceType: CreditLotSourceType;
        amount: number;
    }>;
}
interface BaseCreditOperation {
    userId: string;
    amount: number;
    idempotencyKey: string;
    businessType: string;
    businessId: string;
    sourceOrderNo?: string;
    description?: string;
    operatorId?: string;
    auditReason?: string;
    resource?: string;
    apiKeyId?: string;
    session?: ClientSession;
}
export interface GrantCreditsInput extends BaseCreditOperation {
    sourceType: CreditLotSourceType;
    transactionType?: Extract<CreditsTransactionType, 'purchase' | 'grant' | 'refund' | 'adjustment'>;
    expiresAt?: Date;
}
export interface DeductCreditsInput extends BaseCreditOperation {
    transactionType?: Extract<CreditsTransactionType, 'deduction' | 'adjustment'>;
}
export interface CreditReconciliationResult {
    userId: string;
    cachedBalance: number;
    lotBalance: number;
    difference: number;
    consistent: boolean;
}
export declare function grantCredits(input: GrantCreditsInput): Promise<CreditLedgerResult>;
export declare function deductCredits(input: DeductCreditsInput): Promise<CreditLedgerResult>;
export declare function reconcileUserCredits(userIdInput: string, session?: ClientSession): Promise<CreditReconciliationResult>;
export {};
//# sourceMappingURL=credit-ledger.service.d.ts.map