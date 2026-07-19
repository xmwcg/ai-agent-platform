import { PlanId } from '../config/billing';
/** 记录一次 AI 调用的预估成本（分），返回累计值 */
export declare function recordAiCost(userId: string, estimatedFen: number): Promise<number>;
/** 查询当日已累计成本（分） */
export declare function getDailyCost(userId: string): Promise<number>;
/** 查询指定日期（YYYY-MM-DD）全站 AI 成本（分），用于毛利看板月度聚合 */
export declare function getGlobalCost(date: string): Promise<number>;
export type CostLevel = 'ok' | 'warn' | 'block';
export interface CostValveResult {
    allowed: boolean;
    level: CostLevel;
    usedFen: number;
    budgetFen: number;
    ratio: number;
}
/**
 * 检查成本阀门。会按需触发通知（warn/block 级别，且当日仅告警一次避免轰炸）。
 * @param userId 用户ID
 * @param plan 当前套餐
 * @param contact 告警接收方（openid/手机号/空=仅控制台）
 */
export declare function checkCostValve(userId: string, plan: PlanId, contact?: string): Promise<CostValveResult>;
/**
 * 把 token 用量估算为成本（分）。基于 DeepSeek 混合价：输入¥1/百万、输出¥2/百万。
 * @param promptTokens 输入 token
 * @param completionTokens 输出 token
 */
export declare function estimateCostFen(promptTokens: number, completionTokens: number): number;
//# sourceMappingURL=cost-control.service.d.ts.map