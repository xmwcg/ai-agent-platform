import mongoose from 'mongoose';
import { DailyCheckIn } from '../models/DailyCheckIn';
import { grantCredits } from './credit-ledger.service';

// 签到积分规则
const CHECK_IN_CONFIG = {
  basePoints: 10,
  streakBonus: 5,
  maxStreakBonus: 50,
  weeklyBonus: 30,
};

/** 每日签到：业务事实、额度批次、余额缓存和流水在同一事务内提交。 */
export async function dailyCheckIn(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await DailyCheckIn.findOne({ userId, date: today });
  if (existing) {
    return { success: false, message: '今日已签到', points: 0, streak: existing.streak };
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const yesterdayCheckIn = await DailyCheckIn.findOne({ userId, date: yesterday });
  const streak = (yesterdayCheckIn?.streak || 0) + 1;
  let points = CHECK_IN_CONFIG.basePoints;
  points += Math.min(streak * CHECK_IN_CONFIG.streakBonus, CHECK_IN_CONFIG.maxStreakBonus);
  if (streak % 7 === 0) points += CHECK_IN_CONFIG.weeklyBonus;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await DailyCheckIn.create(
        [{ userId: new mongoose.Types.ObjectId(userId), date: today, pointsEarned: points, streak }],
        { session }
      );
      await grantCredits({
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
  } catch (error) {
    if (Number((error as any)?.code) === 11000) {
      const duplicate = await DailyCheckIn.findOne({ userId, date: today });
      return {
        success: false,
        message: '今日已签到',
        points: 0,
        streak: duplicate?.streak || streak,
      };
    }
    throw error;
  } finally {
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
export async function getCheckInStatus(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const [todayCheckIn, yesterdayCheckIn, totalCheckIns] = await Promise.all([
    DailyCheckIn.findOne({ userId, date: today }),
    DailyCheckIn.findOne({
      userId,
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    }),
    DailyCheckIn.countDocuments({ userId }),
  ]);

  return {
    checkedInToday: !!todayCheckIn,
    todayPoints: todayCheckIn?.pointsEarned || 0,
    streak: yesterdayCheckIn?.streak || 0,
    totalCheckIns,
    nextStreakBonus: Math.min(
      ((yesterdayCheckIn?.streak || 0) + 1) * CHECK_IN_CONFIG.streakBonus,
      CHECK_IN_CONFIG.maxStreakBonus
    ),
    weeklyBonusInDays: 7 - ((yesterdayCheckIn?.streak || 0) % 7),
  };
}

/** 获取签到历史。 */
export async function getCheckInHistory(userId: string, page = 1, pageSize = 30) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    DailyCheckIn.find({ userId }).sort({ date: -1 }).skip(skip).limit(pageSize),
    DailyCheckIn.countDocuments({ userId }),
  ]);
  return { items, total, page, pageSize };
}

/**
 * 仅供已验证的内部业务事件调用。调用方必须提供不可伪造且唯一的业务事实 ID。
 * 不再暴露任何允许客户端直接领取任务积分的路由。
 */
export async function awardVerifiedTaskPoints(
  userId: string,
  amount: number,
  taskType: keyof typeof TASK_POINTS,
  businessId: string
): Promise<void> {
  if (!businessId?.trim()) throw new Error('任务奖励缺少业务事实 ID');
  await grantCredits({
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

export const TASK_POINTS = {
  ai_chat: 5,
  knowledge_upload: 30,
  course_complete: 20,
  tool_use: 3,
  daily_login: 2,
  profile_complete: 50,
  share_content: 5,
} as const;
