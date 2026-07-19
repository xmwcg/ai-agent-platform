export type KbAccessVerdict = {
    level: 'full';
    deduct?: number;
} | {
    level: 'preview';
    freePreviewPages?: number;
    creditsCost?: number;
    requiredPlan?: string;
} | {
    level: 'plan_locked';
    requiredPlan: string;
    creditsCost?: number;
    price?: number;
} | {
    level: 'credit_locked';
    creditsNeeded: number;
    creditsHave: number;
    freePreviewPages?: number;
};
/**
 * 纯函数：依据文档权限配置与用户状态，判定可访问级别。
 * 不修改数据库，便于在路由中先判读再决定是否扣减积分。
 */
export declare function resolveKbAccess(doc: any, user: any): KbAccessVerdict;
/**
 * 应用访问判定：按需扣减积分并记录解锁，返回可下发的正文。
 * 仅在 verdict.level === 'full' 且需要扣减时落库。
 */
export declare function applyKbAccess(doc: any, user: any, verdict: KbAccessVerdict): Promise<{
    content: string;
    deducted?: number;
}>;
//# sourceMappingURL=kb-access.d.ts.map