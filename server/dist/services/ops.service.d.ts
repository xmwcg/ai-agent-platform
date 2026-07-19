export interface OpsSnapshot {
    northStar: {
        wau: number;
        wauTarget: number;
        wowGrowth: number;
    };
    acquisition: {
        signupsLast7d: number;
        newCreatorsLast7d: number;
    };
    activation: {
        activatedLast7d: number;
        activationRate: number;
    };
    retention: {
        weeklyRetentionRate: number;
        returningCreators: number;
    };
    revenue: {
        mrr: number;
        paidUsers: number;
        arpu: number;
        ordersLast7d: number;
    };
    referral: {
        referralSignupsLast7d: number;
        publicApiCallsLast7d: number;
        quotaHitsLast7d: number;
    };
    trend: {
        week: string;
        wau: number;
    }[];
}
export declare function getOpsSnapshot(): Promise<OpsSnapshot>;
export declare function getPublicMetrics(): Promise<{
    totalCreators: number;
    weeklyActiveCreators: number;
    serviceOnline: boolean;
}>;
declare const _default: {
    getOpsSnapshot: typeof getOpsSnapshot;
    getPublicMetrics: typeof getPublicMetrics;
};
export default _default;
//# sourceMappingURL=ops.service.d.ts.map