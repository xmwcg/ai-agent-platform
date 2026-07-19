/**
 * 套餐（Plan）定义 —— 商业变现核心配置
 *
 * 金额单位统一为「分（cent）」，避免浮点误差。
 * limits 中的数值为「单日」配额上限，-1 表示无限制。
 *
 * ─── 2026-07 定价重塑：1/10 破局策略 ───
 * 对标竞品（Coze ¥99/月、Gamma $8–20/月），全系定价压到约 1/10：
 *   免费版 ¥0 ｜ 专业版 ¥9.9/月 ｜ 旗舰版 ¥19.9/月 ｜ 团队版 ¥99/月
 * 底气：自带 Key 成本转嫁（毛利→90%+）+ 网关路由最便宜模型 + 轻量架构。
 */
export type PlanId = 'free' | 'pro' | 'max' | 'team';
export type QuotaResource = 'ai_chat' | 'rag_query' | 'rag_upload' | 'knowledge_create' | 'mcp_create' | 'mcp_call' | 'learning_path' | 'code_explain' | 'translate' | 'file_convert' | 'plan_generate' | 'media_gen' | 'cs_query' | 'model_config';
export interface Plan {
    id: PlanId;
    name: string;
    tagline: string;
    /** 月付价格（分） */
    priceMonthly: number;
    /** 年付价格（分），约等于月付 × 10 */
    priceYearly: number;
    /** 计费周期内赠送的「AI 积分」，用于抵扣按量资源 */
    credits: number;
    features: string[];
    limits: Record<QuotaResource, number>;
    highlighted?: boolean;
    /** 团队席位（仅团队版 > 1） */
    seats?: number;
}
export declare const PLANS: Record<PlanId, Plan>;
export declare const PLAN_ORDER: PlanId[];
/** 套餐等级，用于权限比较 */
export declare function planRank(plan: PlanId): number;
/** 判断 from 套餐是否 >= target 套餐 */
export declare function planSatisfies(from: PlanId, target: PlanId): boolean;
export declare function getPlan(id: PlanId): Plan;
export declare const DEFAULT_PLAN: PlanId;
export type PayPerUseResource = 'media_image' | 'media_video' | 'media_image2video' | 'api_chat';
export declare const PER_USE_COST: Record<PayPerUseResource, number>;
/** 方案B（BYOK）强制场景：这些资源在旗舰/企业版下优先走用户自带 key，平台零边际成本 */
export declare const BYOK_PREFERRED_RESOURCES: PayPerUseResource[];
export declare const PLAN_AI_BUDGET_FEN: Record<PlanId, number>;
/** 成本预警阈值：当日成本达到预算的该比例时触发通知告警 */
export declare const COST_WARN_RATIO = 0.7;
//# sourceMappingURL=billing.d.ts.map