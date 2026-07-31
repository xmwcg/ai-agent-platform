import mongoose from 'mongoose';
import { RevenueRecord, WithdrawRequest } from '../models/RevenueRecord';
import { User } from '../models/User';
import { ApiKey } from '../models/ApiKey';
import {
  MARKETPLACE_FEE,
  MarketplaceResourceType,
} from '../config/marketplace-fee';

/**
 * 记录 API 调用产生的收益（平台抽成 + 创作者分成）
 */
export async function recordApiRevenue(
  userId: string,
  apiKeyId: string,
  resource: MarketplaceResourceType,
  callAmount: number // 分
): Promise<void> {
  if (callAmount <= 0) return;

  // 查询创作者套餐，决定抽成比例
  const user = await User.findById(userId).select('plan').lean();
  const tier = user?.plan || 'free';
  const platformRate = MARKETPLACE_FEE.creatorTierRates[tier] || MARKETPLACE_FEE.platformRate;

  const platformFee = Math.floor(callAmount * platformRate);
  const creatorRevenue = callAmount - platformFee;

  await RevenueRecord.create({
    userId: new mongoose.Types.ObjectId(userId),
    apiKeyId: new mongoose.Types.ObjectId(apiKeyId),
    resource,
    callAmount,
    platformFee,
    creatorRevenue,
    platformRate,
    status: 'pending',
  });
}

/**
 * 获取创作者收益概览
 */
export async function getCreatorRevenueStats(userId: string) {
  const [pending, settled, withdrawn, pendingTotal, settledTotal, totalCalls] = await Promise.all([
    RevenueRecord.countDocuments({ userId, status: 'pending' }),
    RevenueRecord.countDocuments({ userId, status: 'settled' }),
    RevenueRecord.countDocuments({ userId, status: 'withdrawn' }),
    RevenueRecord.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$creatorRevenue' } } },
    ]),
    RevenueRecord.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), status: { $in: ['settled', 'withdrawn'] } } },
      { $group: { _id: null, total: { $sum: '$creatorRevenue' } } },
    ]),
    RevenueRecord.countDocuments({ userId }),
  ]);

  return {
    pendingCount: pending,
    pendingRevenue: pendingTotal[0]?.total || 0,
    settledCount: settled,
    settledRevenue: settledTotal[0]?.total || 0,
    withdrawnCount: withdrawn,
    totalCalls,
    canWithdraw: (pendingTotal[0]?.total || 0) >= MARKETPLACE_FEE.minWithdrawAmount,
    minWithdrawAmount: MARKETPLACE_FEE.minWithdrawAmount,
    withdrawFee: MARKETPLACE_FEE.withdrawFee,
  };
}

/**
 * 获取收益明细列表（分页）
 */
export async function getRevenueList(
  userId: string,
  status?: string,
  page = 1,
  pageSize = 20
) {
  const filter: any = { userId };
  if (status && ['pending', 'settled', 'withdrawn'].includes(status)) {
    filter.status = status;
  }

  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    RevenueRecord.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate('apiKeyId', 'name'),
    RevenueRecord.countDocuments(filter),
  ]);

  return { items, total, page, pageSize };
}

/**
 * 创建提现申请
 */
export async function createWithdrawRequest(
  userId: string,
  amount: number, // 分
  method: 'wechat' | 'alipay',
  account: string
) {
  // 校验最低提现金额
  if (amount < MARKETPLACE_FEE.minWithdrawAmount) {
    throw new Error(`最低提现金额为 ¥${(MARKETPLACE_FEE.minWithdrawAmount / 100).toFixed(0)}`);
  }

  // 校验可用余额
  const stats = await getCreatorRevenueStats(userId);
  if (stats.pendingRevenue < amount) {
    throw new Error(`可用余额不足，当前可提现 ¥${(stats.pendingRevenue / 100).toFixed(2)}`);
  }

  const fee = MARKETPLACE_FEE.withdrawFee;
  const netAmount = amount - fee;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 创建提现申请
    const request = await WithdrawRequest.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userId),
          amount,
          fee,
          netAmount,
          method,
          account,
          status: 'pending',
        },
      ],
      { session }
    );

    // 将对应金额的 pending 收益标记为 settled
    let remaining = amount;
    const records = await RevenueRecord.find({ userId, status: 'pending' })
      .sort({ createdAt: 1 })
      .session(session);

    const settledIds: mongoose.Types.ObjectId[] = [];
    for (const record of records) {
      if (remaining <= 0) break;
      settledIds.push(record._id as mongoose.Types.ObjectId);
      remaining -= record.creatorRevenue;
    }

    await RevenueRecord.updateMany(
      { _id: { $in: settledIds } },
      {
        $set: {
          status: 'withdrawn',
          withdrawnAt: new Date(),
          withdrawRequestId: request[0]._id,
        },
      },
      { session }
    );

    // 扣减 User 的 commissionBalance（如果有）
    await User.findByIdAndUpdate(
      userId,
      { $inc: { commissionBalance: -amount } },
      { session }
    );

    await session.commitTransaction();

    return {
      requestId: request[0]._id,
      amount,
      fee,
      netAmount,
      status: 'pending',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * 获取提现申请列表
 */
export async function getWithdrawList(
  userId: string,
  page = 1,
  pageSize = 20
) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    WithdrawRequest.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    WithdrawRequest.countDocuments({ userId }),
  ]);

  return { items, total, page, pageSize };
}

/**
 * 按资源类型统计收益
 */
export async function getRevenueByResource(userId: string) {
  return RevenueRecord.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$resource',
        totalRevenue: { $sum: '$creatorRevenue' },
        totalCalls: { $sum: 1 },
        totalPlatformFee: { $sum: '$platformFee' },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);
}
