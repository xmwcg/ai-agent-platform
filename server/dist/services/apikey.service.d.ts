export interface ApiKeyQuotaState {
    quotaDaily: number;
    usedToday: number;
    lastReset: Date;
}
export declare function generateApiKey(): {
    plain: string;
    prefix: string;
    hash: string;
};
export declare function hashKey(plain: string): string;
export declare function isSameDay(a: Date, b: Date): boolean;
/** 按自然日重置用量，返回是否发生重置 */
export declare function resetQuotaIfNeeded(key: ApiKeyQuotaState, now?: Date): boolean;
export declare function isWithinQuota(key: ApiKeyQuotaState, now?: Date): boolean;
export declare function remainingQuota(key: ApiKeyQuotaState, now?: Date): number;
/** 累加用量（调用方需先确认 isWithinQuota） */
export declare function applyUsage(key: ApiKeyQuotaState, by?: number, now?: Date): void;
/** 记录 API 调用日志（异步，不阻塞主流程），支撑用量报表与账单导出 */
export declare function logApiUsage(params: {
    keyId: string;
    ownerId: string;
    prefix: string;
    resource?: string;
    requestId?: string;
    modelId?: string;
    providerId?: string;
    promptBytes?: number;
    replyBytes?: number;
    status?: 'success' | 'quota_exceeded' | 'error';
    creditsDeducted?: number;
}): Promise<void>;
//# sourceMappingURL=apikey.service.d.ts.map