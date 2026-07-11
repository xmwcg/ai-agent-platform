/**
 * 订阅与配额中间件 —— 商业变现的「闸门」
 *
 * - `requirePlan(min)`：要求登录且套餐等级 ≥ min（会员过期视为 free）。
 * - `enforceQuota(resource)`：按「用户套餐当日配额」做限流，超出返回 402 引导升级。
 *   计数基于 Redis 日维度键，天然滚动清零，无需定时任务。
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { User } from '../models/User';
import { redisClient } from '../config/database';
import {
  PLANS,
  PlanId,
  QuotaResource,
  planSatisfies,
  DEFAULT_PLAN,
} from '../config/billing';
import { checkCostValve } from '../services/cost-control.service';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/** 读取用户当前有效套餐（过期则降级为 free） */
export async function resolveUserPlan(userId: string): Promise<{ plan: PlanId; expired: boolean }> {
  const user = await User.findById(userId).select('plan membershipExpiresAt').lean();
  if (!user) return { plan: DEFAULT_PLAN, expired: false };
  const plan = (user.plan as PlanId) || DEFAULT_PLAN;
  const expired = !!user.membershipExpiresAt && user.membershipExpiresAt.getTime() < Date.now();
  return { plan: expired ? DEFAULT_PLAN : plan, expired };
}

/** 要求套餐等级 */
export function requirePlan(min: PlanId) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }
    const { plan } = await resolveUserPlan(req.user.id);
    if (!planSatisfies(plan, min)) {
      res.status(403).json({
        error: '权限不足',
        code: 'PLAN_REQUIRED',
        requiredPlan: min,
        currentPlan: plan,
        message: `该功能需要 ${PLANS[min].name}，请升级套餐`,
      });
      return;
    }
    next();
  };
}

/** 配额强制（在 requireAuth 之后使用） */
export function enforceQuota(resource: QuotaResource) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // BYOK：用户自带 Key 生成，平台零垫付，直接放行配额闸门
    if ((req as any).byokBypass) return next();
    if (!req.user) {
      next();
      return;
    }
    try {
      const { plan } = await resolveUserPlan(req.user.id);
      const limit = PLANS[plan].limits[resource];
      if (limit === -1) return next(); // 无限制

      const key = `quota:${req.user.id}:${resource}:${todayKey()}`;
      const used = Number(await redisClient.get(key)) || 0;
      if (used >= limit) {
        res.status(402).json({
          error: '今日配额已用尽',
          code: 'QUOTA_EXCEEDED',
          resource,
          limit,
          used,
          currentPlan: plan,
          message: `当前 ${PLANS[plan].name} 的「${resource}」今日配额已用尽，升级套餐以获得更多额度`,
          upgradeUrl: '/pricing',
        });
        return;
      }
      // 预占配额（请求成功后由业务层调用 quotaIncrement 真正累加）
      next();
    } catch (err) {
      // 配额系统异常不阻断主流程
      next();
    }
  };
}

/** 业务成功后累加用量（供路由在处理完成后调用） */
export async function quotaIncrement(userId: string, resource: QuotaResource, by = 1): Promise<void> {
  try {
    const key = `quota:${userId}:${resource}:${todayKey()}`;
    const ttl = 86400; // 一天
    await redisClient.incrby(key, by);
    await redisClient.expire(key, ttl);
  } catch {
    /* 忽略配额计数异常 */
  }
}

/** 查询用户当日各资源用量 */
export async function getQuotaUsage(userId: string): Promise<Record<QuotaResource, { used: number; limit: number }>> {
  const { plan } = await resolveUserPlan(userId);
  const limits = PLANS[plan].limits;
  const result = {} as Record<QuotaResource, { used: number; limit: number }>;
  for (const resource of Object.keys(limits) as QuotaResource[]) {
    const used = Number(await redisClient.get(`quota:${userId}:${resource}:${todayKey()}`)) || 0;
    result[resource] = { used, limit: limits[resource] };
  }
  return result;
}

/**
 * 成本阀门（垫付模式第二道闸门）：请求开始时按「当日已累计 AI 成本」拦截。
 * 业务层在真实 AI 调用返回后调用 `quotaCostRecord` 记录本次成本。
 * @param contact 告警接收方（openid/手机号），可选
 */
export function enforceCostValve(contact = '') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // BYOK：用户自带 Key 生成，平台零垫付，成本阀门直接放行
    if ((req as any).byokBypass) return next();
    if (!req.user) {
      next();
      return;
    }
    try {
      const { plan } = await resolveUserPlan(req.user.id);
      const valve = await checkCostValve(req.user.id, plan, contact);
      if (!valve.allowed) {
        res.status(402).json({
          error: '今日 AI 成本预算已用尽',
          code: 'COST_BUDGET_EXCEEDED',
          message: '为保障平台稳定，您今日的 AI 调用成本已达上限。可升级套餐或改用自带 Key（BYOK）继续。',
          upgradeUrl: '/pricing',
          dailyCostFen: valve.usedFen,
        });
        return;
      }
      next();
    } catch (err) {
      // 异常不阻断主流程
      next();
    }
  };
}

/** 记录一次 AI 调用成本（业务层在 AI 返回后调用） */
export async function quotaCostRecord(userId: string, estimatedFen: number): Promise<void> {
  try {
    const { recordAiCost } = await import('../services/cost-control.service');
    await recordAiCost(userId, estimatedFen);
  } catch {
    /* 忽略 */
  }
}
