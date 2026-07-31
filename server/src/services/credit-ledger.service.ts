import mongoose, { ClientSession } from 'mongoose';
import { CreditLot, CreditLotSourceType, ICreditLot } from '../models/CreditLot';
import {
  CreditsTransaction,
  CreditsTransactionType,
  ICreditsTransaction,
} from '../models/CreditsTransaction';
import { User } from '../models/User';
import { AppError } from '../lib/http-error';

const TRANSACTION_OPTIONS = {
  readPreference: 'primary' as const,
  readConcern: { level: 'snapshot' as const },
  writeConcern: { w: 'majority' as const },
};

export class CreditLedgerConsistencyError extends AppError {
  constructor(internalDetail?: string) {
    super(409, '积分账户正在核对，请稍后重试', 'CREDIT_LEDGER_INCONSISTENT', internalDetail);
    this.name = 'CreditLedgerConsistencyError';
  }
}

export class InsufficientCreditsError extends AppError {
  constructor() {
    super(402, '积分余额不足', 'INSUFFICIENT_CREDITS');
    this.name = 'InsufficientCreditsError';
  }
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

function assertPositiveInteger(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('积分变动金额必须为正整数');
  }
}

function assertOperationIdentity(input: BaseCreditOperation): void {
  if (!input.idempotencyKey?.trim()) throw new Error('缺少 idempotencyKey');
  if (!input.businessType?.trim()) throw new Error('缺少 businessType');
  if (!input.businessId?.trim()) throw new Error('缺少 businessId');
}

function objectId(userId: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(userId)) throw new Error('无效的用户 ID');
  return new mongoose.Types.ObjectId(userId);
}

function isDuplicateKey(error: unknown): boolean {
  return Number((error as any)?.code) === 11000;
}

async function runInTransaction<T>(
  providedSession: ClientSession | undefined,
  operation: (session: ClientSession) => Promise<T>
): Promise<T> {
  if (providedSession) return operation(providedSession);

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await operation(session);
    }, TRANSACTION_OPTIONS);
    if (result === undefined) throw new Error('积分事务未返回结果');
    return result;
  } finally {
    await session.endSession();
  }
}

async function waitForIdempotentResult(
  userId: mongoose.Types.ObjectId,
  idempotencyKey: string
): Promise<ICreditsTransaction | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await CreditsTransaction.findOne({ userId, idempotencyKey });
    if (existing) return existing;
    await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
  }
  return null;
}

function resultFromExisting(transaction: ICreditsTransaction): CreditLedgerResult {
  const balanceAfter = Number(transaction.balanceAfter || 0);
  const balanceBefore = Number(
    transaction.balanceBefore ?? balanceAfter - Number(transaction.amount || 0)
  );
  return {
    transaction,
    balanceBefore,
    balanceAfter,
    idempotent: true,
    consumedLots: [],
  };
}

async function expireDueLots(
  userId: mongoose.Types.ObjectId,
  session: ClientSession,
  now: Date
): Promise<void> {
  const dueLots = await CreditLot.find({
    userId,
    status: 'active',
    remainingAmount: { $gt: 0 },
    expiresAt: { $lte: now },
  })
    .sort({ expiresAt: 1, createdAt: 1 })
    .session(session);

  for (const lot of dueLots) {
    const amount = Number(lot.remainingAmount || 0);
    if (amount <= 0) continue;

    const user = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: amount } },
      { $inc: { credits: -amount } },
      { new: true, session }
    );
    if (!user) {
      throw new CreditLedgerConsistencyError('过期额度超过用户缓存余额，已拒绝自动修正');
    }

    const updated = await CreditLot.updateOne(
      { _id: lot._id, status: 'active', remainingAmount: amount },
      { $set: { remainingAmount: 0, status: 'expired' } },
      { session }
    );
    if (updated.modifiedCount !== 1) {
      throw new CreditLedgerConsistencyError('额度批次在过期处理期间发生并发变化');
    }

    const idempotencyKey = `credit-expire:${String(lot._id)}`;
    await CreditsTransaction.create(
      [
        {
          userId,
          type: 'expire',
          amount: -amount,
          balanceBefore: user.credits + amount,
          balanceAfter: user.credits,
          idempotencyKey,
          businessType: 'credit_lot_expiration',
          businessId: String(lot._id),
          status: 'committed',
          description: '免费额度到期',
          auditReason: `额度批次 ${String(lot._id)} 到期自动清零`,
        },
      ],
      { session }
    );
  }
}

async function loadAndAssertBalanced(
  userId: mongoose.Types.ObjectId,
  session: ClientSession,
  now = new Date()
): Promise<{ user: any; lots: ICreditLot[]; lotBalance: number }> {
  await expireDueLots(userId, session, now);

  const user = await User.findById(userId).session(session);
  if (!user) throw new Error('用户不存在');

  const lots = await CreditLot.find({
    userId,
    status: 'active',
    remainingAmount: { $gt: 0 },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
  }).session(session);

  const lotBalance = lots.reduce((sum, lot) => sum + Number(lot.remainingAmount || 0), 0);
  if (lotBalance !== Number(user.credits || 0)) {
    throw new CreditLedgerConsistencyError(
      `用户缓存余额 ${Number(user.credits || 0)} 与额度批次余额 ${lotBalance} 不一致`
    );
  }

  return { user, lots, lotBalance };
}

function lotPriority(lot: ICreditLot): number {
  if (lot.sourceType === 'subscription_free' || lot.sourceType === 'promotion_free') return 0;
  if (lot.sourceType === 'legacy_protected') return 1;
  if (lot.sourceType === 'purchase' || lot.sourceType === 'refund') return 2;
  return 3;
}

function sortLotsForDeduction(lots: ICreditLot[]): ICreditLot[] {
  const maxTime = Number.MAX_SAFE_INTEGER;
  return [...lots].sort((a, b) => {
    const priority = lotPriority(a) - lotPriority(b);
    if (priority !== 0) return priority;
    const expiryA = a.expiresAt ? new Date(a.expiresAt).getTime() : maxTime;
    const expiryB = b.expiresAt ? new Date(b.expiresAt).getTime() : maxTime;
    if (expiryA !== expiryB) return expiryA - expiryB;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export async function grantCredits(input: GrantCreditsInput): Promise<CreditLedgerResult> {
  assertPositiveInteger(input.amount);
  assertOperationIdentity(input);
  const userId = objectId(input.userId);

  try {
    return await runInTransaction(input.session, async (session) => {
      const existing = await CreditsTransaction.findOne({
        userId,
        idempotencyKey: input.idempotencyKey,
      }).session(session);
      if (existing) return resultFromExisting(existing);

      const { user } = await loadAndAssertBalanced(userId, session);
      const balanceBefore = Number(user.credits || 0);
      const balanceAfter = balanceBefore + input.amount;

      const lot = await CreditLot.create(
        [
          {
            userId,
            sourceType: input.sourceType,
            originalAmount: input.amount,
            remainingAmount: input.amount,
            sourceOrderNo: input.sourceOrderNo,
            idempotencyKey: input.idempotencyKey,
            expiresAt: input.expiresAt,
            status: 'active',
            auditReason: input.auditReason,
          },
        ],
        { session }
      );

      const updatedUser = await User.findOneAndUpdate(
        { _id: userId, credits: balanceBefore },
        { $inc: { credits: input.amount } },
        { new: true, session }
      );
      if (!updatedUser) {
        throw new CreditLedgerConsistencyError('积分发放期间用户余额发生并发变化');
      }

      const transactionType =
        input.transactionType ||
        (input.sourceType === 'purchase'
          ? 'purchase'
          : input.sourceType === 'refund'
            ? 'refund'
            : input.sourceType === 'adjustment'
              ? 'adjustment'
              : 'grant');
      const created = await CreditsTransaction.create(
        [
          {
            userId,
            type: transactionType,
            amount: input.amount,
            balanceBefore,
            balanceAfter,
            idempotencyKey: input.idempotencyKey,
            businessType: input.businessType,
            businessId: input.businessId,
            sourceOrderNo: input.sourceOrderNo,
            orderNo: input.sourceOrderNo,
            status: 'committed',
            operatorId: input.operatorId,
            auditReason: input.auditReason,
            resource: input.resource,
            apiKeyId: input.apiKeyId,
            description: input.description,
          },
        ],
        { session }
      );

      return {
        transaction: created[0],
        balanceBefore,
        balanceAfter,
        idempotent: false,
        consumedLots: [
          { lotId: String(lot[0]._id), sourceType: input.sourceType, amount: input.amount },
        ],
      };
    });
  } catch (error) {
    if (isDuplicateKey(error) && !input.session) {
      const existing = await waitForIdempotentResult(userId, input.idempotencyKey);
      if (existing) return resultFromExisting(existing);
    }
    throw error;
  }
}

export async function deductCredits(input: DeductCreditsInput): Promise<CreditLedgerResult> {
  assertPositiveInteger(input.amount);
  assertOperationIdentity(input);
  const userId = objectId(input.userId);

  try {
    return await runInTransaction(input.session, async (session) => {
      const existing = await CreditsTransaction.findOne({
        userId,
        idempotencyKey: input.idempotencyKey,
      }).session(session);
      if (existing) return resultFromExisting(existing);

      const { user, lots, lotBalance } = await loadAndAssertBalanced(userId, session);
      if (lotBalance < input.amount) throw new InsufficientCreditsError();

      const balanceBefore = Number(user.credits || 0);
      const balanceAfter = balanceBefore - input.amount;
      let remaining = input.amount;
      const consumedLots: CreditLedgerResult['consumedLots'] = [];

      for (const lot of sortLotsForDeduction(lots)) {
        if (remaining <= 0) break;
        const available = Number(lot.remainingAmount || 0);
        const take = Math.min(available, remaining);
        if (take <= 0) continue;

        const nextRemaining = available - take;
        const updated = await CreditLot.updateOne(
          { _id: lot._id, status: 'active', remainingAmount: { $gte: take } },
          {
            $inc: { remainingAmount: -take },
            ...(nextRemaining === 0 ? { $set: { status: 'depleted' } } : {}),
          },
          { session }
        );
        if (updated.modifiedCount !== 1) {
          throw new CreditLedgerConsistencyError('额度批次在扣费期间发生并发变化');
        }
        consumedLots.push({
          lotId: String(lot._id),
          sourceType: lot.sourceType,
          amount: take,
        });
        remaining -= take;
      }

      if (remaining !== 0) {
        throw new CreditLedgerConsistencyError('额度批次扣减结果不完整');
      }

      const updatedUser = await User.findOneAndUpdate(
        { _id: userId, credits: { $gte: input.amount } },
        { $inc: { credits: -input.amount } },
        { new: true, session }
      );
      if (!updatedUser || Number(updatedUser.credits) !== balanceAfter) {
        throw new CreditLedgerConsistencyError('积分扣费期间用户余额发生并发变化');
      }

      const created = await CreditsTransaction.create(
        [
          {
            userId,
            type: input.transactionType || 'deduction',
            amount: -input.amount,
            balanceBefore,
            balanceAfter,
            idempotencyKey: input.idempotencyKey,
            businessType: input.businessType,
            businessId: input.businessId,
            sourceOrderNo: input.sourceOrderNo,
            status: 'committed',
            operatorId: input.operatorId,
            auditReason: input.auditReason,
            resource: input.resource,
            apiKeyId: input.apiKeyId,
            description: input.description,
          },
        ],
        { session }
      );

      return {
        transaction: created[0],
        balanceBefore,
        balanceAfter,
        idempotent: false,
        consumedLots,
      };
    });
  } catch (error) {
    if (isDuplicateKey(error) && !input.session) {
      const existing = await waitForIdempotentResult(userId, input.idempotencyKey);
      if (existing) return resultFromExisting(existing);
    }
    throw error;
  }
}

export async function reconcileUserCredits(
  userIdInput: string,
  session?: ClientSession
): Promise<CreditReconciliationResult> {
  const userId = objectId(userIdInput);
  return runInTransaction(session, async (activeSession) => {
    await expireDueLots(userId, activeSession, new Date());
    const user = await User.findById(userId).session(activeSession);
    if (!user) throw new Error('用户不存在');
    const lots = await CreditLot.find({
      userId,
      status: 'active',
      remainingAmount: { $gt: 0 },
    }).session(activeSession);
    const lotBalance = lots.reduce((sum, lot) => sum + Number(lot.remainingAmount || 0), 0);
    const cachedBalance = Number(user.credits || 0);
    return {
      userId: String(userId),
      cachedBalance,
      lotBalance,
      difference: cachedBalance - lotBalance,
      consistent: cachedBalance === lotBalance,
    };
  });
}
