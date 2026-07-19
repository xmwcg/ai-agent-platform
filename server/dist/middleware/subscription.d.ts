/**
 * 订阅与配额中间件 —— 商业变现的「闸门」
 *
 * - `requirePlan(min)`：要求登录且套餐等级 ≥ min（会员过期视为 free）。
 * - `enforceQuota(resource)`：按「用户套餐当日配额」做限流，超出返回 402 引导升级。
 *   计数基于 Redis 日维度键，天然滚动清零，无需定时任务。
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { PlanId, QuotaResource } from '../config/billing';
/** 读取用户当前有效套餐（过期则降级为 free） */
export declare function resolveUserPlan(userId: string): Promise<{
    plan: PlanId;
    expired: boolean;
}>;
/** 要求套餐等级 */
export declare function requirePlan(min: PlanId): (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/** 配额强制（在 requireAuth 之后使用） */
export declare function enforceQuota(resource: QuotaResource): (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/** 业务成功后累加用量（供路由在处理完成后调用） */
export declare function quotaIncrement(userId: string, resource: QuotaResource, by?: number): Promise<void>;
/** 查询用户当日各资源用量 */
export declare function getQuotaUsage(userId: string): Promise<Record<QuotaResource, {
    used: number;
    limit: number;
}>>;
/**
 * 成本阀门（垫付模式第二道闸门）：请求开始时按「当日已累计 AI 成本」拦截。
 * 业务层在真实 AI 调用返回后调用 `quotaCostRecord` 记录本次成本。
 * @param contact 告警接收方（openid/手机号），可选
 */
export declare function enforceCostValve(contact?: string): (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/** 记录一次 AI 调用成本（业务层在 AI 返回后调用） */
export declare function quotaCostRecord(userId: string, estimatedFen: number): Promise<void>;
//# sourceMappingURL=subscription.d.ts.map