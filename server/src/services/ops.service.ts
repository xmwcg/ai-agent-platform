// server/src/services/ops.service.ts
//
// Aggregation layer for the operations dashboard (North-Star: Weekly Active
// Creators, WAU). Reuses existing Mongoose models — no schema changes.
//
// Field reality (verified against server/src/models/*):
//   - User:        role('user'|'admin'), plan('free'|'pro'|'max'|'team'),
//                  referredBy, createdAt, updatedAt. NO lastActiveAt / hasCreatedAsset.
//   - Order:       userId(ObjectId), orderType, plan, amount(分), status, paidAt, createdAt.
//   - ApiUsageLog: ownerId(string), resource, status('success'|'quota_exceeded'|'error'),
//                  timestamp. TTL 90d.
//
// WAU definition used here: distinct users who had ANY platform activity in the
// last 7 days. Current reliable activity source = ApiUsageLog (API calls) +
// paid Orders. When a dedicated user_activity log table is added later, point
// getActiveUserIds() at it — everything downstream stays the same.

import { User } from '../models/User';
import { Order } from '../models/Order';
import { ApiUsageLog } from '../models/ApiUsageLog';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

function startOfNDaysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() - n * DAY);
}

/** Distinct active user ids (as strings) within [from, to). */
async function getActiveUserIds(from: Date, to: Date): Promise<Set<string>> {
  const [apiUsers, orderUsers] = await Promise.all([
    ApiUsageLog.distinct('ownerId', { timestamp: { $gte: from, $lt: to } }),
    Order.distinct('userId', { createdAt: { $gte: from, $lt: to }, status: 'paid' }),
  ]);
  const ids = new Set<string>();
  apiUsers.forEach((id: any) => ids.add(String(id)));
  orderUsers.forEach((id: any) => ids.add(String(id)));
  return ids;
}

export interface OpsSnapshot {
  northStar: { wau: number; wauTarget: number; wowGrowth: number };
  acquisition: { signupsLast7d: number; newCreatorsLast7d: number };
  activation: { activatedLast7d: number; activationRate: number };
  retention: { weeklyRetentionRate: number; returningCreators: number };
  revenue: { mrr: number; paidUsers: number; arpu: number; ordersLast7d: number };
  referral: { referralSignupsLast7d: number; publicApiCallsLast7d: number; quotaHitsLast7d: number };
  trend: { week: string; wau: number }[];
}

export async function getOpsSnapshot(): Promise<OpsSnapshot> {
  const weekAgo = startOfNDaysAgo(7);
  const twoWeeksAgo = startOfNDaysAgo(14);
  const monthAgo = startOfNDaysAgo(30);

  // --- North Star: WAU (distinct active users, last 7d) ---
  const thisWeekIds = await getActiveUserIds(weekAgo, new Date());
  const lastWeekIds = await getActiveUserIds(twoWeeksAgo, weekAgo);
  const wau = thisWeekIds.size;

  // WoW growth (guard against divide-by-zero)
  const prevWau = lastWeekIds.size;
  const wowGrowth = prevWau > 0 ? (wau - prevWau) / prevWau : 0;

  // --- Acquisition ---
  const signupsLast7d = await User.countDocuments({ createdAt: { $gte: weekAgo } });
  // new creators = signed up this week AND already active
  const newCreatorsLast7d = await User.countDocuments({
    createdAt: { $gte: weekAgo },
    _id: { $in: Array.from(thisWeekIds).map((id) => id) },
  });

  // --- Activation (activated = signed up + produced activity) ---
  const activationRate = signupsLast7d > 0 ? newCreatorsLast7d / signupsLast7d : 0;

  // --- Retention (weekly) ---
  let returningCreators = 0;
  for (const id of thisWeekIds) if (lastWeekIds.has(id)) returningCreators++;
  const weeklyRetentionRate = prevWau > 0 ? returningCreators / prevWau : 0;

  // --- Revenue ---
  const paidUsers = await User.countDocuments({ plan: { $in: ['pro', 'max', 'team'] } });
  const revenueAgg = await Order.aggregate([
    { $match: { status: 'paid', paidAt: { $gte: monthAgo } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const monthlyRevenueFen = revenueAgg[0]?.total ?? 0; // 分
  const mrr = monthlyRevenueFen / 100; // 元
  const arpu = paidUsers > 0 ? mrr / paidUsers : 0;
  const ordersLast7d = await Order.countDocuments({ status: 'paid', createdAt: { $gte: weekAgo } });

  // --- Referral / API marketplace ---
  const referralSignupsLast7d = await User.countDocuments({
    referredBy: { $ne: null },
    createdAt: { $gte: weekAgo },
  });
  const publicApiCallsLast7d = await ApiUsageLog.countDocuments({ timestamp: { $gte: weekAgo } });
  const quotaHitsLast7d = await ApiUsageLog.countDocuments({
    status: 'quota_exceeded',
    timestamp: { $gte: weekAgo },
  });

  // --- 12-week WAU trend ---
  const trend: OpsSnapshot['trend'] = [];
  for (let i = 11; i >= 0; i--) {
    const from = startOfNDaysAgo(7 * (i + 1));
    const to = startOfNDaysAgo(7 * i);
    const ids = await getActiveUserIds(from, to);
    trend.push({ week: `W-${i}`, wau: ids.size });
  }

  return {
    northStar: { wau, wauTarget: 20_000, wowGrowth },
    acquisition: { signupsLast7d, newCreatorsLast7d },
    activation: { activatedLast7d: newCreatorsLast7d, activationRate },
    retention: { weeklyRetentionRate, returningCreators },
    revenue: { mrr, paidUsers, arpu, ordersLast7d },
    referral: { referralSignupsLast7d, publicApiCallsLast7d, quotaHitsLast7d },
    trend,
  };
}

// Public, anonymous subset for the marketing page (Phase B).
// Only expose metrics safe to show externally — never revenue / retention detail.
export async function getPublicMetrics() {
  const [totalUsers, weekAgo] = await Promise.all([
    User.countDocuments(),
    Promise.resolve(startOfNDaysAgo(7)),
  ]);
  const activeIds = await getActiveUserIds(weekAgo, new Date());
  return {
    totalCreators: totalUsers,
    weeklyActiveCreators: activeIds.size,
    serviceOnline: true,
  };
}

export default { getOpsSnapshot, getPublicMetrics };
