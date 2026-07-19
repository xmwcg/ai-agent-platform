export interface DashboardMetrics {
    timestamp: string;
    health: {
        mongo: {
            status: "connected" | "disconnected";
            latencyMs?: number;
        };
        redis: {
            status: "connected" | "disconnected" | "memory";
            latencyMs?: number;
        };
        sandbox: {
            status: "available" | "unavailable";
        };
    };
    api: {
        today5xx: number;
        p95Ms: number;
        p99Ms: number;
        uptimePercent: number;
    };
    orders: {
        totalToday: number;
        pendingPayment: number;
        paidToday: number;
        refundedToday: number;
        refundPending: number;
    };
    payments: {
        wechatSuccessRate: number;
        avgCallbackLatencyMs: number;
        unfulfilledOrders: number;
    };
    credits: {
        totalActiveUsers: number;
        totalCreditsInCirculation: number;
        overdraftCount24h: number;
        reversalCount24h: number;
    };
    ledger: {
        lastReconciledAt?: string;
        reconciliationDiffCount: number;
        unresolvedDiffs: number;
    };
    sandbox: {
        executionsToday: number;
        avgDurationMs: number;
        denialRate: number;
        circuitBreakerActive: number;
    };
    users: {
        total: number;
        activeToday: number;
        newToday: number;
        paidConversion: number;
        activeSessions: number;
    };
}
export declare function getDashboardMetrics(): Promise<DashboardMetrics>;
/** 启动仪表盘数据定时采集（供监控系统拉取） */
export declare function startDashboardCollection(): void;
//# sourceMappingURL=dashboard.service.d.ts.map