"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TASK_POINTS = void 0;
exports.dailyCheckIn = dailyCheckIn;
exports.getCheckInStatus = getCheckInStatus;
exports.getCheckInHistory = getCheckInHistory;
exports.awardVerifiedTaskPoints = awardVerifiedTaskPoints;
const mongoose_1 = __importDefault(require("mongoose"));
const DailyCheckIn_1 = require("../models/DailyCheckIn");
const credit_ledger_service_1 = require("./credit-ledger.service");
// 签到积分规则
const CHECK_IN_CONFIG = {
    basePoints: 10,
    streakBonus: 5,
    maxStreakBonus: 50,
    weeklyBonus: 30,
};
/** 每日签到：业务事实、额度批次、余额缓存和流水在同一事务内提交。 */
async function dailyCheckIn(userId) {
    const today = new Date().toISOString().slice(0, 10);
    const existing = await DailyCheckIn_1.DailyCheckIn.findOne({ userId, date: today });
    if (existing) {
        return { success: false, message: '今日已签到', points: 0, streak: existing.streak };
    }
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const yesterdayCheckIn = await DailyCheckIn_1.DailyCheckIn.findOne({ userId, date: yesterday });
    const streak = (yesterdayCheckIn?.streak || 0) + 1;
    let points = CHECK_IN_CONFIG.basePoints;
    points += Math.min(streak * CHECK_IN_CONFIG.streakBonus, CHECK_IN_CONFIG.maxStreakBonus);
    if (streak % 7 === 0)
        points += CHECK_IN_CONFIG.weeklyBonus;
    const session = await mongoose_1.default.startSession();
    try {
        await session.withTransaction(async () => {
            await DailyCheckIn_1.DailyCheckIn.create([{ userId: new mongoose_1.default.Types.ObjectId(userId), date: today, pointsEarned: points, streak }], { session });
            await (0, credit_ledger_service_1.grantCredits)({
                userId,
                amount: points,
                idempotencyKey: `daily-checkin:${userId}:${today}`,
                businessType: 'daily_checkin',
                businessId: today,
                sourceType: 'promotion_free',
                transactionType: 'grant',
                description: `每日签到 (连续${streak}天)`,
                auditReason: `已验证签到事实 ${today}`,
                session,
            });
        });
    }
    catch (error) {
        if (Number(error?.code) === 11000) {
            const duplicate = await DailyCheckIn_1.DailyCheckIn.findOne({ userId, date: today });
            return {
                success: false,
                message: '今日已签到',
                points: 0,
                streak: duplicate?.streak || streak,
            };
        }
        throw error;
    }
    finally {
        await session.endSession();
    }
    return {
        success: true,
        message: streak % 7 === 0
            ? `签到成功！连续${streak}天 + 周奖励，共获 ${points} 积分`
            : `签到成功！连续${streak}天，获得 ${points} 积分`,
        points,
        streak,
    };
}
/** 获取签到状态（今天是否已签到 + 连续天数）。 */
async function getCheckInStatus(userId) {
    const today = new Date().toISOString().slice(0, 10);
    const [todayCheckIn, yesterdayCheckIn, totalCheckIns] = await Promise.all([
        DailyCheckIn_1.DailyCheckIn.findOne({ userId, date: today }),
        DailyCheckIn_1.DailyCheckIn.findOne({
            userId,
            date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
        }),
        DailyCheckIn_1.DailyCheckIn.countDocuments({ userId }),
    ]);
    return {
        checkedInToday: !!todayCheckIn,
        todayPoints: todayCheckIn?.pointsEarned || 0,
        streak: yesterdayCheckIn?.streak || 0,
        totalCheckIns,
        nextStreakBonus: Math.min(((yesterdayCheckIn?.streak || 0) + 1) * CHECK_IN_CONFIG.streakBonus, CHECK_IN_CONFIG.maxStreakBonus),
        weeklyBonusInDays: 7 - ((yesterdayCheckIn?.streak || 0) % 7),
    };
}
/** 获取签到历史。 */
async function getCheckInHistory(userId, page = 1, pageSize = 30) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
        DailyCheckIn_1.DailyCheckIn.find({ userId }).sort({ date: -1 }).skip(skip).limit(pageSize),
        DailyCheckIn_1.DailyCheckIn.countDocuments({ userId }),
    ]);
    return { items, total, page, pageSize };
}
/**
 * 仅供已验证的内部业务事件调用。调用方必须提供不可伪造且唯一的业务事实 ID。
 * 不再暴露任何允许客户端直接领取任务积分的路由。
 */
async function awardVerifiedTaskPoints(userId, amount, taskType, businessId) {
    if (!businessId?.trim())
        throw new Error('任务奖励缺少业务事实 ID');
    await (0, credit_ledger_service_1.grantCredits)({
        userId,
        amount,
        idempotencyKey: `verified-task:${taskType}:${businessId}`,
        businessType: `verified_task_${taskType}`,
        businessId,
        sourceType: 'promotion_free',
        transactionType: 'grant',
        description: `任务奖励: ${taskType}`,
        auditReason: `已验证内部业务事件 ${businessId}`,
    });
}
exports.TASK_POINTS = {
    ai_chat: 5,
    knowledge_upload: 30,
    course_complete: 20,
    tool_use: 3,
    daily_login: 2,
    profile_complete: 50,
    share_content: 5,
};
//# sourceMappingURL=points.service.js.map