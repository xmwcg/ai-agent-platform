import mongoose from 'mongoose';
import { DailyCheckIn } from '../models/DailyCheckIn';
import { User } from '../models/User';
import { CreditsTransaction } from '../models/CreditsTransaction';

// 签到积分规则
const CHECK_IN_CONFIG = {
  basePoints: 10,       // 基础签到积分
  streakBonus: 5,       // 连续签到额外积分（每天 +5）
  maxStreakBonus: 50,   // 连续签到最多 +50
  weeklyBonus: 30,      // 连续签到 7 天额外奖励
};

/**
 * 每日签到
 */
export async function dailyCheckIn(userId: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 检查今天是否已签到
  const existing = await DailyCheckIn.findOne({ userId, date: today });
  if (existing) {
    return { success: false, message: '今日已签到', points: 0, streak: existing.streak };
  }

  // 获取昨天的签到记录，计算连续天数
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const yesterdayCheckIn = await DailyCheckIn.findOne({ userId, date: yesterday });

  const prevStreak = yesterdayCheckIn?.streak || 0;
  const streak = prevStreak + 1;

  // 计算积分
  let points = CHECK_IN_CONFIG.basePoints;
  const streakBonus = Math.min(streak * CHECK_IN_CONFIG.streakBonus, CHECK_IN_CONFIG.maxStreakBonus);
  points += streakBonus;

  // 连续 7 天额外奖励
  if (streak % 7 === 0) {
    points += CHECK_IN_CONFIG.weeklyBonus;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 创建签到记录
    await DailyCheckIn.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userId),
          date: today,
          pointsEarned: points,
          streak,
        },
      ],
      { session }
    );

    // 增加用户积分
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { credits: points } },
      { new: true, session }
    );

    if (!user) throw new Error('User not found');

    // 创建积分变动记录
    await CreditsTransaction.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userId),
          type: 'grant',
          amount: points,
          balanceAfter: user.credits,
          description: `每日签到 (连续${streak}天)`,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return {
      success: true,
      message: streak % 7 === 0
        ? `签到成功！连续${streak}天 + 周奖励，共获 ${points} 积分`
        : `签到成功！连续${streak}天，获得 ${points} 积分`,
      points,
      streak,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * 获取签到状态（今天是否已签到 + 连续天数）
 */
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

/**
 * 获取签到历史
 */
export async function getCheckInHistory(userId: string, page = 1, pageSize = 30) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    DailyCheckIn.find({ userId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(pageSize),
    DailyCheckIn.countDocuments({ userId }),
  ]);

  return { items, total, page, pageSize };
}

/**
 * 任务积分发放（AI对话、知识上传等）
 */
export async function awardTaskPoints(
  userId: string,
  amount: number,
  taskType: string
): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { credits: amount } },
      { new: true, session }
    );

    if (!user) throw new Error('User not found');

    await CreditsTransaction.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userId),
          type: 'grant',
          amount,
          balanceAfter: user.credits,
          description: `任务奖励: ${taskType}`,
        },
      ],
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// 任务积分配置
export const TASK_POINTS = {
  ai_chat: 5,           // 每次 AI 对话
  knowledge_upload: 30,  // 上传知识文档
  course_complete: 20,   // 完成课程
  tool_use: 3,           // 使用智能工具
  daily_login: 2,        // 每日登录
  profile_complete: 50,  // 完善个人资料（一次性）
  share_content: 5,      // 分享内容
} as const;
