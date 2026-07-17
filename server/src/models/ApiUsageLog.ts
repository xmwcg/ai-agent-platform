import mongoose, { Schema, Document } from 'mongoose';

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
  prefix: string;          // API Key 前缀，方便导出可读
  resource: string;        // 调用资源（chat / embed / compare / image）
  requestId?: string;      // 单次业务调用 ID，用于幂等与补偿关联
  modelId?: string;        // 真实执行模型 ID；未知时不写入
  providerId?: string;     // 真实执行厂商 ID；未知时不写入
  promptBytes?: number;    // 输入字节数（粗略估算）
  replyBytes?: number;     // 输出字节数
  status: 'success' | 'quota_exceeded' | 'error';
  creditsDeducted?: number;// 本次抵扣积分数（若开启积分抵扣）
  timestamp: Date;
}

const ApiUsageLogSchema = new Schema<IApiUsageLog>(
  {
    keyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    prefix: { type: String, required: true },
    resource: { type: String, default: 'chat' },
    requestId: { type: String },
    modelId: { type: String },
    providerId: { type: String },
    promptBytes: { type: Number },
    replyBytes: { type: Number },
    status: { type: String, enum: ['success', 'quota_exceeded', 'error'], default: 'success' },
    creditsDeducted: { type: Number },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// 复合索引：按密钥 + 时间查询用量报表
ApiUsageLogSchema.index({ keyId: 1, timestamp: -1 });
ApiUsageLogSchema.index({ ownerId: 1, requestId: 1 }, { unique: true, sparse: true });
ApiUsageLogSchema.index({ ownerId: 1, modelId: 1, timestamp: -1 });
// TTL 索引：90 天后自动清理（控制存储成本）
ApiUsageLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 86400 });

export const ApiUsageLog = mongoose.model<IApiUsageLog>('ApiUsageLog', ApiUsageLogSchema);
