"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordApiRevenue = recordApiRevenue;
exports.getCreatorRevenueStats = getCreatorRevenueStats;
exports.getRevenueList = getRevenueList;
exports.createWithdrawRequest = createWithdrawRequest;
exports.getWithdrawList = getWithdrawList;
exports.getRevenueByResource = getRevenueByResource;
const mongoose_1 = __importDefault(require("mongoose"));
const RevenueRecord_1 = require("../models/RevenueRecord");
const User_1 = require("../models/User");
const marketplace_fee_1 = require("../config/marketplace-fee");
/**
 * 记录 API 调用产生的收益（平台抽成 + 创作者分成）
 */
async function recordApiRevenue(userId, apiKeyId, resource, callAmount // 分
) {
    if (callAmount <= 0)
        return;
    // 查询创作者套餐，决定抽成比例
    const user = await User_1.User.findById(userId).select('plan').lean();
    const tier = user?.plan || 'free';
    const platformRate = marketplace_fee_1.MARKETPLACE_FEE.creatorTierRates[tier] || marketplace_fee_1.MARKETPLACE_FEE.platformRate;
    const platformFee = Math.floor(callAmount * platformRate);
    const creatorRevenue = callAmount - platformFee;
    await RevenueRecord_1.RevenueRecord.create({
        userId: new mongoose_1.default.Types.ObjectId(userId),
        apiKeyId: new mongoose_1.default.Types.ObjectId(apiKeyId),
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
async function getCreatorRevenueStats(userId) {
    const [pending, settled, withdrawn, pendingTotal, settledTotal, totalCalls] = await Promise.all([
        RevenueRecord_1.RevenueRecord.countDocuments({ userId, status: 'pending' }),
        RevenueRecord_1.RevenueRecord.countDocuments({ userId, status: 'settled' }),
        RevenueRecord_1.RevenueRecord.countDocuments({ userId, status: 'withdrawn' }),
        RevenueRecord_1.RevenueRecord.aggregate([
            { $match: { userId: new mongoose_1.default.Types.ObjectId(userId), status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$creatorRevenue' } } },
        ]),
        RevenueRecord_1.RevenueRecord.aggregate([
            { $match: { userId: new mongoose_1.default.Types.ObjectId(userId), status: { $in: ['settled', 'withdrawn'] } } },
            { $group: { _id: null, total: { $sum: '$creatorRevenue' } } },
        ]),
        RevenueRecord_1.RevenueRecord.countDocuments({ userId }),
    ]);
    return {
        pendingCount: pending,
        pendingRevenue: pendingTotal[0]?.total || 0,
        settledCount: settled,
        settledRevenue: settledTotal[0]?.total || 0,
        withdrawnCount: withdrawn,
        totalCalls,
        canWithdraw: (pendingTotal[0]?.total || 0) >= marketplace_fee_1.MARKETPLACE_FEE.minWithdrawAmount,
        minWithdrawAmount: marketplace_fee_1.MARKETPLACE_FEE.minWithdrawAmount,
        withdrawFee: marketplace_fee_1.MARKETPLACE_FEE.withdrawFee,
    };
}
/**
 * 获取收益明细列表（分页）
 */
async function getRevenueList(userId, status, page = 1, pageSize = 20) {
    const filter = { userId };
    if (status && ['pending', 'settled', 'withdrawn'].includes(status)) {
        filter.status = status;
    }
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
        RevenueRecord_1.RevenueRecord.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .populate('apiKeyId', 'name'),
        RevenueRecord_1.RevenueRecord.countDocuments(filter),
    ]);
    return { items, total, page, pageSize };
}
/**
 * 创建提现申请
 */
async function createWithdrawRequest(userId, amount, // 分
method, account) {
    // 校验最低提现金额
    if (amount < marketplace_fee_1.MARKETPLACE_FEE.minWithdrawAmount) {
        throw new Error(`最低提现金额为 ¥${(marketplace_fee_1.MARKETPLACE_FEE.minWithdrawAmount / 100).toFixed(0)}`);
    }
    // 校验可用余额
    const stats = await getCreatorRevenueStats(userId);
    if (stats.pendingRevenue < amount) {
        throw new Error(`可用余额不足，当前可提现 ¥${(stats.pendingRevenue / 100).toFixed(2)}`);
    }
    const fee = marketplace_fee_1.MARKETPLACE_FEE.withdrawFee;
    const netAmount = amount - fee;
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // 创建提现申请
        const request = await RevenueRecord_1.WithdrawRequest.create([
            {
                userId: new mongoose_1.default.Types.ObjectId(userId),
                amount,
                fee,
                netAmount,
                method,
                account,
                status: 'pending',
            },
        ], { session });
        // 将对应金额的 pending 收益标记为 settled
        let remaining = amount;
        const records = await RevenueRecord_1.RevenueRecord.find({ userId, status: 'pending' })
            .sort({ createdAt: 1 })
            .session(session);
        const settledIds = [];
        for (const record of records) {
            if (remaining <= 0)
                break;
            settledIds.push(record._id);
            remaining -= record.creatorRevenue;
        }
        await RevenueRecord_1.RevenueRecord.updateMany({ _id: { $in: settledIds } }, {
            $set: {
                status: 'withdrawn',
                withdrawnAt: new Date(),
                withdrawRequestId: request[0]._id,
            },
        }, { session });
        // 扣减 User 的 commissionBalance（如果有）
        await User_1.User.findByIdAndUpdate(userId, { $inc: { commissionBalance: -amount } }, { session });
        await session.commitTransaction();
        return {
            requestId: request[0]._id,
            amount,
            fee,
            netAmount,
            status: 'pending',
        };
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
}
/**
 * 获取提现申请列表
 */
async function getWithdrawList(userId, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
        RevenueRecord_1.WithdrawRequest.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize),
        RevenueRecord_1.WithdrawRequest.countDocuments({ userId }),
    ]);
    return { items, total, page, pageSize };
}
/**
 * 按资源类型统计收益
 */
async function getRevenueByResource(userId) {
    return RevenueRecord_1.RevenueRecord.aggregate([
        { $match: { userId: new mongoose_1.default.Types.ObjectId(userId) } },
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
//# sourceMappingURL=marketplace-revenue.service.js.map