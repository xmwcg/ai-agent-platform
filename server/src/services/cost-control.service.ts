/**
 * 成本预警阀门 —— 低成本变现（方案A 垫付）的「第二道闸门」
 *
 * 第一道闸门是 middleware/subscription.ts 的「日配额上限」（次数限制）。
 * 本服务按「预估金额（分）」计量单用户每日 AI 调用成本：
 *   - 业务层在每次真实 AI 调用后调用 recordAiCost(userId, estimatedFen)
 *   - 每日成本累计进 Redis（按天滚动）
 *   - checkCostValve() 返回当前是否允许继续、告警级别，并在逼近/超限时发通知
 *
 * 与配额闸门解耦：配额管「次数」，成本阀门管「钱」。两者任一触发即限流。
 */
import { redisClient } from '../config/database';
import { PLAN_AI_BUDGET_FEN, COST_WARN_RATIO, PlanId } from '../config/billing';
import { notifyCostAlert } from './notify.service';
import { logger } from '../lib/logger';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function costKey(userId: string): string {
  return `ai_cost:${userId}:${todayKey()}`;
}

/** 记录一次 AI 调用的预估成本（分），返回累计值 */
export async function recordAiCost(userId: string, estimatedFen: number): Promise<number> {
  try {
    if (estimatedFen <= 0) return 0;
    const key = costKey(userId);
    const total = await redisClient.incrby(key, Math.ceil(estimatedFen));
    await redisClient.expire(key, 86400);
    return total;
  } catch (err: any) {
    logger.warn('cost-control', `记录成本失败(忽略): ${err?.message}`);
    return 0;
  }
}

/** 查询当日已累计成本（分） */
export async function getDailyCost(userId: string): Promise<number> {
  try {
    return Number(await redisClient.get(costKey(userId))) || 0;
  } catch {
    return 0;
  }
}

export type CostLevel = 'ok' | 'warn' | 'block';

export interface CostValveResult {
  allowed: boolean;      // 是否允许继续调用（block 时为 false）
  level: CostLevel;      // 当前级别
  usedFen: number;       // 已用成本
  budgetFen: number;     // 预算（-1 表示无限）
  ratio: number;         // 已用/预算
}

/**
 * 检查成本阀门。会按需触发通知（warn/block 级别，且当日仅告警一次避免轰炸）。
 * @param userId 用户ID
 * @param plan 当前套餐
 * @param contact 告警接收方（openid/手机号/空=仅控制台）
 */
export async function checkCostValve(
  userId: string,
  plan: PlanId,
  contact = ''
): Promise<CostValveResult> {
  const budget = PLAN_AI_BUDGET_FEN[plan] ?? PLAN_AI_BUDGET_FEN.free;
  const used = await getDailyCost(userId);

  // 无限预算（如旗舰版）：只计量不限制
  if (budget < 0) {
    return { allowed: true, level: 'ok', usedFen: used, budgetFen: budget, ratio: 0 };
  }

  const ratio = used / budget;
  let level: CostLevel = 'ok';
  let allowed = true;

  if (ratio >= 1) {
    level = 'block';
    allowed = false;
  } else if (ratio >= COST_WARN_RATIO) {
    level = 'warn';
  }

  // 告警去重：当日每个级别只通知一次
  if (level !== 'ok') {
    const alertFlag = `ai_cost_alert:${userId}:${todayKey()}:${level}`;
    try {
      const already = await redisClient.get(alertFlag);
      if (!already) {
        await redisClient.set(alertFlag, '1', 'EX', 86400);
        await notifyCostAlert(contact, plan, used, budget);
      }
    } catch (err: any) {
      logger.warn('cost-control', `告警标记失败(忽略): ${err?.message}`);
    }
  }

  return { allowed, level, usedFen: used, budgetFen: budget, ratio };
}

/**
 * 把 token 用量估算为成本（分）。基于 DeepSeek 混合价：输入¥1/百万、输出¥2/百万。
 * @param promptTokens 输入 token
 * @param completionTokens 输出 token
 */
export function estimateCostFen(promptTokens: number, completionTokens: number): number {
  const inputFen = (promptTokens / 1_000_000) * 100 * 1;   // ¥1/百万 → 100分/百万
  const outputFen = (completionTokens / 1_000_000) * 100 * 2; // ¥2/百万
  return inputFen + outputFen;
}
