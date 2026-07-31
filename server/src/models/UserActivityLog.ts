import mongoose, { Schema, Document } from "mongoose";

/**
 * 用户行为日志：长期保留的用户活动记录，用于运营分析和漏斗追踪。
 *
 * 不同于 ApiUsageLog（90d TTL + API 计量专用），UserActivityLog 保留时间更长，
 * 聚焦于业务关键行为（注册、付费、报告发布、页面访问、资源使用等），
 * 支撑 WAU/MAU、用户分群、留存分析、转化漏斗等运营场景。
 */
export interface IUserActivityLog extends Document {
  userId?: string;              // 用户ID（匿名事件可为空）
  sessionId?: string;           // 归因会话ID（关联 AttributionSession）
  event: string;                // 事件类型：page_view / register / pay / report_publish / evaluate / login / upgrade / cancel
  category: string;             // 分类：acquisition / engagement / monetization / retention
  metadata?: Record<string, unknown>; // 额外上下文（projectType, source, amount, plan 等）
  ip?: string;
  userAgent?: string;
  referrer?: string;
  timestamp: Date;
}

const UserActivityLogSchema = new Schema<IUserActivityLog>(
  {
    userId: { type: String, index: true },
    sessionId: { type: String, index: true },
    event: { type: String, required: true, index: true },
    category: { type: String, default: "engagement", index: true },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
    referrer: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

// Compound indexes for common queries
UserActivityLogSchema.index({ event: 1, timestamp: -1 });
UserActivityLogSchema.index({ userId: 1, timestamp: -1 });
UserActivityLogSchema.index({ category: 1, timestamp: -1 });

export const UserActivityLog = mongoose.model<IUserActivityLog>(
  "UserActivityLog",
  UserActivityLogSchema
);