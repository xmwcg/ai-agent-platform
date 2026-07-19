import mongoose, { Document } from 'mongoose';
/**
 * API 用量日志（开放 API 市场计费深化基座）
 *
 * 每次经 enforceApiKey 的 API 调用写入一条，支撑：
 * - 按时间区间汇总每日/每密钥用量
 * - CSV / JSON 账单导出
 * - 积分抵扣审计
 *
 * TTL 索引 90 天后自动清理，控制存储成本。
 */
export interface IApiUsageLog extends Document {
    keyId: mongoose.Types.ObjectId;
    ownerId: string;
    prefix: string;
    resource: string;
    requestId?: string;
    modelId?: string;
    providerId?: string;
    promptBytes?: number;
    replyBytes?: number;
    status: 'success' | 'quota_exceeded' | 'error';
    creditsDeducted?: number;
    timestamp: Date;
}
export declare const ApiUsageLog: mongoose.Model<IApiUsageLog, {}, {}, {}, mongoose.Document<unknown, {}, IApiUsageLog, {}, {}> & IApiUsageLog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ApiUsageLog.d.ts.map