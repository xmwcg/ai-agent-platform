import mongoose from 'mongoose';
import { Referral, Commission, IReferral } from '../models/Referral';
import { User } from '../models/User';
import { CreditsTransaction } from '../models/CreditsTransaction';

// 佣金比例配置（三级分销）
const COMMISSION_RATES = {
  1: 0.05, // 一级：5%
  2: 0.02, // 二级：2%
  3: 0.01, // 三级：1%
};

/**
 * 注册时处理推荐关系：
 * - 根据 referralCode 查找推荐人
 * - 创建 Referral 记录
 * - 建立三级分销链路
 */
export async function processReferralOnRegister(
  newUserId: string,
  referralCode?: string
): Promise<void> {
  if (!referralCode) return;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. 查找直接推荐人
    const directReferrer = await User.findOne({ referralCode }).session(session);
    if (!directReferrer || directReferrer._id.toString() === newUserId) {
      await session.abortTransaction();
      return;
    }

    // 2. 更新新用户的 referredBy
    await User.findByIdAndUpdate(
      newUserId,
      { referredBy: directReferrer._id },
      { session }
    );

    // 3. 创建一级 Referral
    await Referral.create(
      [
        {
          referrerId: directReferrer._id,
          referredUserId: new mongoose.Types.ObjectId(newUserId),
          level: 1,
          status: 'pending',
        },
      ],
      { session }
    );

    // 4. 查找二级推荐人（推荐人的推荐人）
    const l2Referrer = await User.findById(directReferrer.referredBy).session(session);
    if (l2Referrer) {
      await Referral.create(
        [
          {
            referrerId: l2Referrer._id,
            referredUserId: new mongoose.Types.ObjectId(newUserId),
            level: 2,
            status: 'pending',
          },
        ],
        { session }
      );
    }

    // 5. 查找三级推荐人
    if (l2Referrer?.referredBy) {
      const l3Referrer = await User.findById(l2Referrer.referredBy).session(session);
      if (l3Referrer) {
        await Referral.create(
          [
            {
              referrerId: l3Referrer._id,
              referredUserId: new mongoose.Types.ObjectId(newUserId),
              level: 3,
              status: 'pending',
            },
          ],
          { session }
        );
      }
    }

    // 6. 奖励推荐积分：一级推荐人 +100
    await grantReferralCredits(
      directReferrer._id.toString(),
      100,
      '推荐新用户注册奖励',
      session
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error('[referral] processReferralOnRegister error:', error);
  } finally {
    session.endSession();
  }
}

/**
 * 用户首次付费后，激活推荐链路并计算佣金
 */
export async function activateReferralOnPayment(
  referredUserId: string,
  orderAmount: number, // 分
  orderId?: string
): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 查找该用户的所有推荐关系（三级）
    const referrals = await Referral.find({
      referredUserId,
      status: 'pending',
    }).session(session);

    if (referrals.length === 0) {
      await session.abortTransaction();
      return;
    }

    for (const ref of referrals) {
      const rate = COMMISSION_RATES[ref.level as keyof typeof COMMISSION_RATES] || 0;
      const commissionAmount = Math.floor(orderAmount * rate);

      if (commissionAmount <= 0) continue;

      // 创建佣金记录
      await Commission.create(
        [
          {
            userId: ref.referrerId,
            referralId: ref._id,
            orderId: orderId ? new mongoose.Types.ObjectId(orderId) : undefined,
            orderAmount,
            commissionRate: rate,
            commissionAmount,
            level: ref.level,
            status: 'pending',
          },
        ],
        { session }
      );

      // 更新推荐人佣金余额
      await User.findByIdAndUpdate(
        ref.referrerId,
        {
          $inc: {
            commissionBalance: commissionAmount,
            totalCommissionEarned: commissionAmount,
          },
        },
        { session }
      );

      // 激活推荐记录
      await Referral.findByIdAndUpdate(
        ref._id,
        {
          status: 'active',
          activatedAt: new Date(),
        },
        { session }
      );
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error('[referral] activateReferralOnPayment error:', error);
  } finally {
    session.endSession();
  }
}

/**
 * 结算佣金（pending → settled）
 */
export async function settleCommissions(userId: string): Promise<number> {
  const result = await Commission.updateMany(
    { userId, status: 'pending' },
    { status: 'settled', settledAt: new Date() }
  );
  return result.modifiedCount;
}

/**
 * 获取用户的推荐统计
 */
export async function getReferralStats(userId: string) {
  const [directCount, totalReferrals, pendingCommissions, settledCommissions] = await Promise.all([
    Referral.countDocuments({ referrerId: userId, level: 1 }),
    Referral.countDocuments({ referrerId: userId }),
    Commission.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]),
    Commission.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), status: { $in: ['settled', 'withdrawn'] } } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]),
  ]);

  return {
    directReferrals: directCount,
    totalReferrals,
    pendingCommission: pendingCommissions[0]?.total || 0,
    settledCommission: settledCommissions[0]?.total || 0,
  };
}

/**
 * 获取推荐列表（分页）
 */
export async function getReferralList(
  userId: string,
  page = 1,
  pageSize = 20
) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    Referral.find({ referrerId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate('referredUserId', 'name email createdAt'),
    Referral.countDocuments({ referrerId: userId }),
  ]);

  return { items, total, page, pageSize };
}

/**
 * 获取佣金列表（分页）
 */
export async function getCommissionList(
  userId: string,
  page = 1,
  pageSize = 20
) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    Commission.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    Commission.countDocuments({ userId }),
  ]);

  return { items, total, page, pageSize };
}

/**
 * 给推荐人发放积分奖励
 */
async function grantReferralCredits(
  userId: string,
  amount: number,
  description: string,
  session?: mongoose.ClientSession
): Promise<void> {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { credits: amount } },
    { new: true, session }
  );

  if (user) {
    await CreditsTransaction.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userId),
          type: 'grant',
          amount,
          balanceAfter: user.credits,
          description,
        },
      ],
      { session }
    );
  }
}
