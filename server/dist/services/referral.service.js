"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processReferralOnRegister = processReferralOnRegister;
exports.activateReferralOnPayment = activateReferralOnPayment;
exports.settleCommissions = settleCommissions;
exports.requestWithdrawal = requestWithdrawal;
exports.getReferralStats = getReferralStats;
exports.getReferralList = getReferralList;
exports.getCommissionList = getCommissionList;
const mongoose_1 = __importDefault(require("mongoose"));
const Referral_1 = require("../models/Referral");
const User_1 = require("../models/User");
const credit_ledger_service_1 = require("./credit-ledger.service");
const Withdrawal_1 = require("../models/Withdrawal");
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
async function processReferralOnRegister(newUserId, referralCode) {
    if (!referralCode)
        return;
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // 1. 查找直接推荐人
        const directReferrer = await User_1.User.findOne({ referralCode }).session(session);
        if (!directReferrer || directReferrer._id.toString() === newUserId) {
            await session.abortTransaction();
            return;
        }
        // 2. 更新新用户的 referredBy
        await User_1.User.findByIdAndUpdate(newUserId, { referredBy: directReferrer._id }, { session });
        // 3. 创建一级 Referral
        await Referral_1.Referral.create([
            {
                referrerId: directReferrer._id,
                referredUserId: new mongoose_1.default.Types.ObjectId(newUserId),
                level: 1,
                status: 'pending',
            },
        ], { session });
        // 4. 查找二级推荐人（推荐人的推荐人）
        const l2Referrer = await User_1.User.findById(directReferrer.referredBy).session(session);
        if (l2Referrer) {
            await Referral_1.Referral.create([
                {
                    referrerId: l2Referrer._id,
                    referredUserId: new mongoose_1.default.Types.ObjectId(newUserId),
                    level: 2,
                    status: 'pending',
                },
            ], { session });
        }
        // 5. 查找三级推荐人
        if (l2Referrer?.referredBy) {
            const l3Referrer = await User_1.User.findById(l2Referrer.referredBy).session(session);
            if (l3Referrer) {
                await Referral_1.Referral.create([
                    {
                        referrerId: l3Referrer._id,
                        referredUserId: new mongoose_1.default.Types.ObjectId(newUserId),
                        level: 3,
                        status: 'pending',
                    },
                ], { session });
            }
        }
        // 6. 奖励推荐积分：一级推荐人 +100
        await grantReferralCredits(directReferrer._id.toString(), 100, '推荐新用户注册奖励', newUserId, session);
        await session.commitTransaction();
    }
    catch (error) {
        await session.abortTransaction();
        console.error('[referral] processReferralOnRegister error:', error);
    }
    finally {
        session.endSession();
    }
}
/**
 * 用户首次付费后，激活推荐链路并计算佣金
 */
async function activateReferralOnPayment(referredUserId, orderAmount, // 分
orderId) {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // 查找该用户的所有推荐关系（三级）
        const referrals = await Referral_1.Referral.find({
            referredUserId,
            status: 'pending',
        }).session(session);
        if (referrals.length === 0) {
            await session.abortTransaction();
            return;
        }
        for (const ref of referrals) {
            const rate = COMMISSION_RATES[ref.level] || 0;
            const commissionAmount = Math.floor(orderAmount * rate);
            if (commissionAmount <= 0)
                continue;
            // 创建佣金记录
            await Referral_1.Commission.create([
                {
                    userId: ref.referrerId,
                    referralId: ref._id,
                    orderId: orderId ? new mongoose_1.default.Types.ObjectId(orderId) : undefined,
                    orderAmount,
                    commissionRate: rate,
                    commissionAmount,
                    level: ref.level,
                    status: 'pending',
                },
            ], { session });
            // 更新推荐人佣金余额
            await User_1.User.findByIdAndUpdate(ref.referrerId, {
                $inc: {
                    commissionBalance: commissionAmount,
                    totalCommissionEarned: commissionAmount,
                },
            }, { session });
            // 激活推荐记录
            await Referral_1.Referral.findByIdAndUpdate(ref._id, {
                status: 'active',
                activatedAt: new Date(),
            }, { session });
        }
        await session.commitTransaction();
    }
    catch (error) {
        await session.abortTransaction();
        console.error('[referral] activateReferralOnPayment error:', error);
    }
    finally {
        session.endSession();
    }
}
/**
 * 结算佣金（pending → settled）
 */
async function settleCommissions(userId) {
    const result = await Referral_1.Commission.updateMany({ userId, status: 'pending' }, { status: 'settled', settledAt: new Date() });
    return result.modifiedCount;
}
const MIN_WITHDRAW_YUAN = 50;
/**
 * 申请提现：校验可提现余额（已结算且未提现），生成提现单并锁定对应佣金。
 * - 可提现 = 已结算佣金（分） - 已提现（分）
 * - 锁定：将足够的 settled 佣金标记为 withdrawn，并累加 commissionWithdrawn
 */
async function requestWithdrawal(userId, amountYuan, method, account) {
    if (!amountYuan || amountYuan < MIN_WITHDRAW_YUAN) {
        throw new Error(`单笔提现最低 ¥${MIN_WITHDRAW_YUAN}`);
    }
    const amountCents = Math.round(amountYuan * 100);
    const user = await User_1.User.findById(userId);
    if (!user)
        throw new Error('用户不存在');
    const stats = await getReferralStats(userId);
    const settledCents = stats.settledCommission || 0;
    const withdrawnCents = user.commissionWithdrawn || 0;
    const availableCents = settledCents - withdrawnCents;
    if (amountCents > availableCents) {
        throw new Error(`可提现余额不足（当前可提现 ¥${(availableCents / 100).toFixed(2)}）`);
    }
    // 锁定佣金：将 settled 佣金按时间顺序标记为 withdrawn，直到累计 >= amountCents
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const settled = await Referral_1.Commission.find({ userId, status: 'settled' })
            .sort({ createdAt: 1 })
            .session(session);
        let remaining = amountCents;
        const toWithdraw = [];
        for (const c of settled) {
            if (remaining <= 0)
                break;
            toWithdraw.push(c._id.toString());
            remaining -= c.commissionAmount;
        }
        await Referral_1.Commission.updateMany({ _id: { $in: toWithdraw } }, { status: 'withdrawn', withdrawnAt: new Date() }, { session });
        await User_1.User.findByIdAndUpdate(userId, { $inc: { commissionWithdrawn: amountCents } }, { session });
        const wd = await Withdrawal_1.Withdrawal.create([{ userId, amount: amountYuan, amountCents, method, account, status: 'pending' }], { session });
        await session.commitTransaction();
        return { withdrawalId: wd[0]._id.toString(), availableCents: availableCents - amountCents, amountCents };
    }
    catch (err) {
        await session.abortTransaction();
        throw err;
    }
    finally {
        session.endSession();
    }
}
/**
 * 获取用户的推荐统计
 */
async function getReferralStats(userId) {
    const [directCount, totalReferrals, pendingCommissions, settledCommissions] = await Promise.all([
        Referral_1.Referral.countDocuments({ referrerId: userId, level: 1 }),
        Referral_1.Referral.countDocuments({ referrerId: userId }),
        Referral_1.Commission.aggregate([
            { $match: { userId: new mongoose_1.default.Types.ObjectId(userId), status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
        ]),
        Referral_1.Commission.aggregate([
            { $match: { userId: new mongoose_1.default.Types.ObjectId(userId), status: { $in: ['settled', 'withdrawn'] } } },
            { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
        ]),
    ]);
    // 已提现（withdrawn 状态）佣金
    const withdrawnCommissions = await Referral_1.Commission.aggregate([
        { $match: { userId: new mongoose_1.default.Types.ObjectId(userId), status: 'withdrawn' } },
        { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);
    // 近 6 个月佣金趋势（用于报表）
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const trend = await Referral_1.Commission.aggregate([
        {
            $match: {
                userId: new mongoose_1.default.Types.ObjectId(userId),
                createdAt: { $gte: sixMonthsAgo },
            },
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                amount: { $sum: '$commissionAmount' },
            },
        },
        { $sort: { _id: 1 } },
    ]);
    const monthlyTrend = trend.map((t) => ({ month: t._id, amountCents: t.amount }));
    return {
        directReferrals: directCount,
        totalReferrals,
        pendingCommission: pendingCommissions[0]?.total || 0,
        settledCommission: settledCommissions[0]?.total || 0,
        commissionTotal: (pendingCommissions[0]?.total || 0) + (settledCommissions[0]?.total || 0),
        paidCommission: withdrawnCommissions[0]?.total || 0,
        monthlyTrend,
    };
}
/**
 * 获取推荐列表（分页）
 */
async function getReferralList(userId, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
        Referral_1.Referral.find({ referrerId: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .populate('referredUserId', 'name email createdAt'),
        Referral_1.Referral.countDocuments({ referrerId: userId }),
    ]);
    return { items, total, page, pageSize };
}
/**
 * 获取佣金列表（分页）
 */
async function getCommissionList(userId, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
        Referral_1.Commission.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize),
        Referral_1.Commission.countDocuments({ userId }),
    ]);
    return { items, total, page, pageSize };
}
/**
 * 给推荐人发放积分奖励
 */
async function grantReferralCredits(userId, amount, description, referredUserId, session) {
    await (0, credit_ledger_service_1.grantCredits)({
        userId,
        amount,
        idempotencyKey: `referral-register:${referredUserId}:${userId}`,
        businessType: 'referral_registration',
        businessId: referredUserId,
        sourceType: 'promotion_free',
        transactionType: 'grant',
        description,
        auditReason: `被推荐用户 ${referredUserId} 完成注册`,
        session,
    });
}
//# sourceMappingURL=referral.service.js.map